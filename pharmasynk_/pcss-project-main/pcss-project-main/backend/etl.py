import os
import time
from lxml import etree  # For efficient XML parsing
from sqlalchemy import create_engine, text

# --- Configuration ---

# 1. Update this to your XML file name
XML_FILE_PATH = os.path.join('data', 'full_database.xml') 

# 2. This connects to your Docker database
DATABASE_URL = "postgresql://pharmadmin:mysecretpassword@localhost:5432/pcss_data"

# 3. This namespace is required by DrugBank's XML. Do not change.
NS = {'db': 'http://www.drugbank.ca'}

# --- Database Connection ---
try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Database connection successful.")
except Exception as e:
    print(f"Database connection failed: {e}")
    exit()

# --- Helper Function for XML ---
def get_xml_text(element, query):
    """Safely get text from an XML element, handling namespaces."""
    node = element.find(query, NS)
    return node.text if node is not None else None

# --- Main Parsing Function ---
def parse_and_load():
    print(f"Starting ETL process for {XML_FILE_PATH}...")
    
    # We will collect data in lists and insert in batches for speed
    drugs_to_insert = []
    interactions_to_insert = []
    adrs_to_insert = []
    
    # Use iterparse for memory-efficient streaming. 
    # This reads the file piece by piece, not all at once.
    context = etree.iterparse(XML_FILE_PATH, events=('end',), tag='{http://www.drugbank.ca}drug')

    start_time = time.time()

    for event, elem in context:
        # --- 1. Extract Drug Info ---
        drugbank_id = get_xml_text(elem, 'db:drugbank-id[@primary="true"]')
        name = get_xml_text(elem, 'db:name')
        description = get_xml_text(elem, 'db:description')

        if drugbank_id and name:
            drugs_to_insert.append({
                'drugbank_id': drugbank_id,
                'name': name,
                'description': description
            })

        # --- 2. Extract Interactions ---
        for interaction in elem.findall('db:drug-interactions/db:drug-interaction', NS):
            partner_db_id = get_xml_text(interaction, 'db:drugbank-id')
            interaction_desc = get_xml_text(interaction, 'db:description')
            # We don't know severity from this node, default to 'unknown'
            
            if drugbank_id and partner_db_id:
                interactions_to_insert.append({
                    'drugbank_id_1': drugbank_id,
                    'drugbank_id_2': partner_db_id,
                    'severity': 'unknown', # Note: Severity is often in a different part of the XML
                    'description': interaction_desc
                })
        
        # --- 3. Extract Adverse Reactions (Side Effects) ---
        # Note: This is a simplified extraction. DrugBank's ADR data is complex.
        for adr in elem.findall('db:pathways/db:pathway/db:enzymes/db:enzyme/db:polypeptide', NS):
             # This is a proxy for ADRs, a more complex parser would look at 'toxicity'
             gene_name = get_xml_text(adr, 'db:gene-name')
             if gene_name:
                adrs_to_insert.append({
                    'drugbank_id': drugbank_id,
                    'adr_term': f"Metabolized by: {gene_name}" # Example
                })

        # Clear the element from memory to keep RAM usage low
        elem.clear()
        while elem.getprevious() is not None:
            del elem.getparent()[0]

    end_time = time.time()
    print(f"XML parsing complete in {end_time - start_time:.2f} seconds.")

    # --- Load Data into Database ---
    print("Loading data into database. This may take a few minutes...")
    
    with engine.connect() as conn:
        # Load Drugs
        if drugs_to_insert:
            print(f"Inserting {len(drugs_to_insert)} drugs...")
            conn.execute(text("""
                INSERT INTO drugs (drugbank_id, name, description) 
                VALUES (:drugbank_id, :name, :description)
                ON CONFLICT (drugbank_id) DO NOTHING
            """), drugs_to_insert)

        # Load Interactions
        if interactions_to_insert:
            print(f"Inserting {len(interactions_to_insert)} interactions...")
            conn.execute(text("""
                INSERT INTO interactions (drugbank_id_1, drugbank_id_2, severity, description) 
                VALUES (:drugbank_id_1, :drugbank_id_2, :severity, :description)
            """), interactions_to_insert)
        
        # Load ADRs
        if adrs_to_insert:
            print(f"Inserting {len(adrs_to_insert)} ADRs...")
            conn.execute(text("""
                INSERT INTO adverse_reactions (drugbank_id, adr_term) 
                VALUES (:drugbank_id, :adr_term)
            """), adrs_to_insert)
            
        conn.commit() # Commit all transactions

    print("--- ETL Process Complete! ---")

# --- Run the script ---
if __name__ == "__main__":
    parse_and_load()