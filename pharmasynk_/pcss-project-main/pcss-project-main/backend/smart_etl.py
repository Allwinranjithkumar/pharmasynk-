import os
import time
import json
import sys  # Added for flushing output
from lxml import etree
from sqlalchemy import create_engine, text

# --- Configuration ---
XML_FILE_PATH = os.path.join('data', 'full_database.xml') 
DATABASE_URL = "postgresql://pharmadmin:mysecretpassword@localhost:5432/pcss_data"
NS = {'db': 'http://www.drugbank.ca'}

# --- SMART MAPPING DICTIONARY (ALIGNED WITH UI SCREENSHOTS) ---
# This map ensures the 'lab_test_name' in the database matches the 'key' or 'label' in your React Frontend.
LAB_KEYWORD_MAP = {
    # Electrolytes (UI: Potassium, Sodium, Chloride, Bicarbonate)
    'hyperkalemia': ('Potassium', 'increase', 'Risk of Hyperkalemia (High Potassium).'),
    'hypokalemia': ('Potassium', 'decrease', 'Risk of Hypokalemia (Low Potassium).'),
    'hypernatremia': ('Sodium', 'increase', 'Risk of Hypernatremia (High Sodium).'),
    'hyponatremia': ('Sodium', 'decrease', 'Risk of Hyponatremia (Low Sodium).'),
    'hyperchloremia': ('Chloride', 'increase', 'Risk of Hyperchloremia (High Chloride).'),
    'hypochloremia': ('Chloride', 'decrease', 'Risk of Hypochloremia (Low Chloride).'),

    # Kidney (UI: Creatinine, Urea)
    'nephrotoxicity': ('Creatinine', 'increase', 'Risk of Nephrotoxicity (Kidney Damage).'),
    'renal failure': ('Creatinine', 'increase', 'Risk of Renal Failure.'),
    'creatinine increased': ('Creatinine', 'increase', 'May increase Creatinine levels.'),
    'creatinine': ('Creatinine', 'increase', 'Monitor Creatinine levels.'),
    'urea': ('Urea', 'increase', 'May increase Blood Urea Nitrogen (BUN).'),

    # Liver (UI: AST/SGOT, ALT/SGPT, T.Bilirubin, ALP)
    'hepatotoxicity': ('AST/SGOT', 'increase', 'Risk of Hepatotoxicity (Liver Damage).'),
    'liver function': ('AST/SGOT', 'increase', 'Monitor Liver Enzymes (AST/ALT).'),
    'transaminases increased': ('ALT/SGPT', 'increase', 'May increase liver transaminases.'),
    'hyperbilirubinemia': ('T.Bilirubin', 'increase', 'Risk of Hyperbilirubinemia (High Bilirubin).'),
    'jaundice': ('T.Bilirubin', 'increase', 'Risk of Jaundice.'),
    'cholestasis': ('ALP', 'increase', 'Risk of Cholestasis (Monitor ALP).'),

    # Hematology (UI: Platelets, WBC, Hb)
    'thrombocytopenia': ('Platelets', 'decrease', 'Risk of Thrombocytopenia (Low Platelets).'),
    'bleeding': ('Platelets', 'decrease', 'Risk of bleeding events.'),
    'neutropenia': ('WBC', 'decrease', 'Risk of Neutropenia (Low WBC).'),
    'leukopenia': ('WBC', 'decrease', 'Risk of Leukopenia (Low WBC).'),
    'anemia': ('Hb', 'decrease', 'Risk of Anemia (Low Hemoglobin).'),
    'pancytopenia': ('WBC', 'decrease', 'Risk of Pancytopenia (Low counts across all lines).'),

    # Glucose (UI: FBS, RBS)
    'hyperglycemia': ('FBS', 'increase', 'Risk of Hyperglycemia (High Blood Sugar).'),
    'hypoglycemia': ('FBS', 'decrease', 'Risk of Hypoglycemia (Low Blood Sugar).'),
    'diabetes': ('FBS', 'increase', 'May worsen glycemic control.'),
    
    # Muscle (UI: CK Total)
    'rhabdomyolysis': ('CK Total', 'increase', 'Risk of Rhabdomyolysis (Muscle Breakdown).'),
    'myopathy': ('CK Total', 'increase', 'Risk of Myopathy (Muscle pain/weakness).'),
    'cpk increased': ('CK Total', 'increase', 'May increase Creatine Phosphokinase (CPK/CK).')
}

# --- Database Connection ---
try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Database connection successful.")
except Exception as e:
    print(f"Database connection failed: {e}")
    exit()

def get_xml_text(element, query):
    node = element.find(query, NS)
    return node.text if node is not None else None

# --- CLINICALLY SMART CLASSIFIER (ENHANCED) ---
def classify_interaction_severity(description):
    """
    Predicts severity based on keywords AND specific clinical conditions.
    Prioritizes 'Contraindicated' to ensure Hard Stops are not missed.
    """
    if not description: return "unknown"
    desc = description.lower()
    
    # 1. CONTRAINDICATED (Black/Critical)
    # Expanded keywords to capture strict prohibitions
    contra_keywords = [
        "contraindicat",               # Catches: contraindicated, contraindication
        "do not use",
        "avoid use",
        "must not be used",
        "must not be combined",
        "must not be co-administered",
        "should not be used",
        "should not be combined",
        "should not be administered",
        "combination is not recommended" # Strong warning often treated as contraindication
    ]
    if any(k in desc for k in contra_keywords):
        return "contraindicated"
    
    # 2. MAJOR (Red)
    major_keywords = [
        "severe", "toxicity", "life-threatening", "avoid", # 'Avoid' alone defaults to Major
        "renal failure", "kidney failure", "respiratory depression",
        "serotonin syndrome", "qt prolongation", "qt interval",
        "hyperkalemia", "hypotension", "bleeding", "hemorrhage",
        "rhabdomyolysis", "anaphylaxis", "cardiac arrest",
        "seizure", "convulsion", "arrhythmia"
    ]
    if any(k in desc for k in major_keywords): return "major"
        
    # 3. MODERATE (Yellow)
    moderate_keywords = [
        "risk", "adverse", "increase the effect", "decrease the effect",
        "serum concentration", "metabolism", "clearance", "absorption",
        "bioavailability", "monitor", "adjust dose", "dose adjustment"
    ]
    if any(k in desc for k in moderate_keywords): return "moderate"
        
    # 4. MINOR (Blue)
    return "minor"

def process_term(term, drugbank_id, adrs_list, labs_list):
    """Helper function to process a reaction term."""
    if not term: return
    term_lower = term.lower()
    
    # Add to ADR list
    adrs_list.append({
        'drugbank_id': drugbank_id,
        'adr_term': term,
        'incidence': None 
    })
    
    # Check for Lab mappings
    for keyword, lab_data in LAB_KEYWORD_MAP.items():
        if keyword in term_lower:
            lab_test_name, effect, description = lab_data
            labs_list.append({
                'drugbank_id': drugbank_id,
                'lab_test_name': lab_test_name,
                'effect': effect,
                'description': description
            })

def parse_and_load_smart():
    print(f"Starting ALIGNED ETL (Final V11) for {XML_FILE_PATH}...")
    
    interactions_to_insert = []
    adrs_to_insert = []
    labs_to_insert = []
    
    context = etree.iterparse(XML_FILE_PATH, events=('end',), tag='{http://www.drugbank.ca}drug')
    
    BATCH_SIZE = 5000
    count = 0

    for event, elem in context:
        drugbank_id = get_xml_text(elem, 'db:drugbank-id[@primary="true"]')
        
        if drugbank_id:
            # 1. INTERACTIONS
            for interaction in elem.findall('db:drug-interactions/db:drug-interaction', NS):
                partner_id = get_xml_text(interaction, 'db:drugbank-id')
                desc = get_xml_text(interaction, 'db:description')
                if partner_id and desc:
                    severity = classify_interaction_severity(desc)
                    interactions_to_insert.append({
                        'drugbank_id_1': drugbank_id,
                        'drugbank_id_2': partner_id,
                        'severity': severity,
                        'description': desc
                    })

            # 2. ADRs & LABS (Strategy 1: Adverse Effects)
            for reaction in elem.findall('db:adverse-effects/db:reaction', NS):
                if reaction.text: process_term(reaction.text, drugbank_id, adrs_to_insert, labs_to_insert)

            # Strategy 2: SNP Reactions
            for reaction in elem.findall('db:snp-adverse-drug-reactions/db:reaction', NS):
                adr_term = get_xml_text(reaction, 'db:adverse-reaction')
                if adr_term: process_term(adr_term, drugbank_id, adrs_to_insert, labs_to_insert)

            # Strategy 3: Toxicity Field
            toxicity_node = elem.find('db:toxicity', NS)
            if toxicity_node is not None and toxicity_node.text:
                toxicity_text = toxicity_node.text.lower()
                for keyword, lab_data in LAB_KEYWORD_MAP.items():
                    if keyword in toxicity_text:
                        lab_test_name, effect, description = lab_data
                        labs_to_insert.append({
                            'drugbank_id': drugbank_id,
                            'lab_test_name': lab_test_name,
                            'effect': effect,
                            'description': description
                        })
        
        # Clear memory
        elem.clear()
        while elem.getprevious() is not None:
            del elem.getparent()[0]
            
        count += 1
        # --- FLUSH=TRUE added here so terminal updates instantly ---
        if count % 100 == 0:
            print(f"Processed {count} drugs...", end='\r', flush=True)

    print("\nXML parsing complete. Loading data into database...")
    
    with engine.connect() as conn:
        print("Clearing old tables...", flush=True)
        conn.execute(text("TRUNCATE TABLE interactions CASCADE"))
        conn.execute(text("TRUNCATE TABLE adverse_reactions CASCADE"))
        conn.execute(text("TRUNCATE TABLE drug_lab_relations CASCADE"))
        
        # Insert Interactions
        if interactions_to_insert:
            print(f"Inserting {len(interactions_to_insert)} interactions...", flush=True)
            chunk_size = 5000
            for i in range(0, len(interactions_to_insert), chunk_size):
                chunk = interactions_to_insert[i:i + chunk_size]
                conn.execute(text("""
                    INSERT INTO interactions (drugbank_id_1, drugbank_id_2, severity, description) 
                    VALUES (:drugbank_id_1, :drugbank_id_2, :severity, :description)
                """), chunk)
                # --- FLUSH=TRUE added here ---
                print(f"Inserted interactions chunk {i} to {i+len(chunk)}", flush=True)
        
        # Insert ADRs
        if adrs_to_insert:
            print(f"Inserting {len(adrs_to_insert)} ADRs...", flush=True)
            unique_adrs = [dict(t) for t in {tuple(d.items()) for d in adrs_to_insert}]
            conn.execute(text("""
                INSERT INTO adverse_reactions (drugbank_id, adr_term, incidence_percent) 
                VALUES (:drugbank_id, :adr_term, :incidence)
                ON CONFLICT DO NOTHING
            """), unique_adrs)

        # Insert Labs
        if labs_to_insert:
            print(f"Inserting {len(labs_to_insert)} Lab Relations...", flush=True)
            unique_labs = [dict(t) for t in {tuple(d.items()) for d in labs_to_insert}]
            conn.execute(text("""
                INSERT INTO drug_lab_relations (drugbank_id, lab_test_name, effect, description) 
                VALUES (:drugbank_id, :lab_test_name, :effect, :description)
                ON CONFLICT DO NOTHING
            """), unique_labs)
            
        conn.commit()

    print("--- SMART ETL (V11 - Aligned & Verified) Process Complete! ---", flush=True)

if __name__ == "__main__":
    parse_and_load_smart()