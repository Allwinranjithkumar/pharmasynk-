import xml.etree.ElementTree as ET
from sqlalchemy import create_engine, text
import os
import re

# --- CONFIGURATION ---
XML_FILE_PATH = "full_database.xml" 
DATABASE_URL = "postgresql://pharmadmin:mysecretpassword@localhost:5432/pcss_data"
NS = {'db': 'http://www.drugbank.ca'}

def clean_text(text_val):
    """
    Advanced cleaning: 
    1. Removes citations/HTML.
    2. Handles **Bold** headings by adding newlines.
    3. Auto-bullets long paragraphs only if no headings exist.
    """
    if not text_val: return None
    
    # 1. Remove references [L1234], [A123], [1], [1,2]
    text_val = re.sub(r'\[.*?\]', '', text_val)
    
    # 2. Remove HTML tags
    text_val = re.sub(r'<[^>]+>', '', text_val)
    
    # 3. Fix "Merged.Sentences" -> "Merged. Sentences"
    text_val = re.sub(r'([a-z0-9\)])\.([A-Z])', r'\1. \2', text_val)
    
    # 4. Normalize whitespace (tabs/multiple spaces -> single space)
    text_val = " ".join(text_val.split())
    
    # 5. Handle **Bold Headings** (The "Changes" you requested)
    # If text contains **Heading**, ensure it starts on a new double line.
    if "**" in text_val:
        # Add newline before ** if it's not the start of the string
        text_val = re.sub(r'(?<!^)\s*\*\*', r'\n\n**', text_val)
        return text_val.strip()

    # 6. If NO headings are found, apply Auto-Bullet logic for long paragraphs
    if len(text_val) > 150:
        sentences = re.split(r'\. (?=[A-Z])', text_val)
        formatted_text = ""
        for s in sentences:
            s = s.strip()
            if s:
                if not s.endswith('.'): s += '.'
                formatted_text += f"• {s}\n"
        return formatted_text.strip()
        
    return text_val

def get_text(element, tag):
    """Safely extracts and cleans text."""
    if element is None: return None
    child = element.find(f"db:{tag}", NS)
    return clean_text(child.text) if child is not None else None

def get_list(element, parent_tag, child_tag):
    """
    Extracts a list and formats it as BULLET POINTS 
    instead of commas for better readability.
    """
    if element is None: return None
    parent = element.find(f"db:{parent_tag}", NS)
    if parent is None: return None
    
    items = []
    for child in parent.findall(f"db:{child_tag}", NS):
        cleaned = re.sub(r'\[.*?\]', '', child.text or "").strip()
        if cleaned:
            items.append(cleaned)
    
    if not items: return None
    
    # IMPROVEMENT: Return as a bulleted string for the Monograph
    if len(items) > 1:
        return "• " + "\n• ".join(items)
    return items[0]

def get_dosages(element):
    if element is None: return None
    dosages_el = element.find("db:dosages", NS)
    if dosages_el is None: return None
    
    dosage_strings = []
    for dosage in dosages_el.findall("db:dosage", NS):
        form = get_text(dosage, "form") or "?"
        route = get_text(dosage, "route") or "?"
        strength = get_text(dosage, "strength") or "?"
        dosage_strings.append(f"{form} ({strength}) [{route}]")
    
    # Return as bullet points
    return "• " + "\n• ".join(dosage_strings) if dosage_strings else None

def get_categories(element):
    if element is None: return None
    cats_el = element.find("db:categories", NS)
    if cats_el is None: return None
    cats = [get_text(cat, "category") for cat in cats_el.findall("db:category", NS)]
    return ", ".join(filter(None, cats)) if cats else None

def get_brands(element):
    if element is None: return None
    brands = set()
    # 1. Commercial Products
    products_el = element.find("db:products", NS)
    if products_el is not None:
        for product in products_el.findall("db:product", NS):
            name = get_text(product, "name")
            if name: brands.add(name)
    # 2. International Brands
    intl_brands_el = element.find("db:international-brands", NS)
    if intl_brands_el is not None:
        for brand in intl_brands_el.findall("db:international-brand", NS):
            name = get_text(brand, "name")
            if name: brands.add(name)
    
    sorted_brands = sorted(list(brands))[:50]
    return ", ".join(sorted_brands) if sorted_brands else None

def process_drugbank_xml():
    print(f"Connecting to database: {DATABASE_URL}...")
    engine = create_engine(DATABASE_URL)
    
    if not os.path.exists(XML_FILE_PATH):
        print(f"ERROR: XML file '{XML_FILE_PATH}' not found!") 
        return

    print("Parsing XML... (Filtering empty records & formatting headings)")
    context = ET.iterparse(XML_FILE_PATH, events=("end",))
    
    count = 0
    batch = []
    BATCH_SIZE = 50 
    
    sql_insert = text("""
        INSERT INTO drugs (
            drugbank_id, name, description, groups, synonyms, brand_names,
            indication, pharmacodynamics, mechanism_of_action, affected_organisms,
            absorption, volume_of_distribution, protein_binding, metabolism, 
            route_of_elimination, half_life, clearance, 
            toxicity, food_interactions, fda_label, state, 
            categories, dosage_forms, updated_at
        ) VALUES (
            :drugbank_id, :name, :description, :groups, :synonyms, :brand_names,
            :indication, :pharmacodynamics, :mechanism_of_action, :affected_organisms,
            :absorption, :volume_of_distribution, :protein_binding, :metabolism, 
            :route_of_elimination, :half_life, :clearance, 
            :toxicity, :food_interactions, :fda_label, :state, 
            :categories, :dosage_forms, NOW()
        )
        ON CONFLICT (drugbank_id) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            groups = EXCLUDED.groups,
            synonyms = EXCLUDED.synonyms,
            brand_names = EXCLUDED.brand_names,
            indication = EXCLUDED.indication,
            pharmacodynamics = EXCLUDED.pharmacodynamics,
            mechanism_of_action = EXCLUDED.mechanism_of_action,
            affected_organisms = EXCLUDED.affected_organisms,
            absorption = EXCLUDED.absorption,
            volume_of_distribution = EXCLUDED.volume_of_distribution,
            protein_binding = EXCLUDED.protein_binding,
            metabolism = EXCLUDED.metabolism,
            route_of_elimination = EXCLUDED.route_of_elimination,
            half_life = EXCLUDED.half_life,
            clearance = EXCLUDED.clearance,
            toxicity = EXCLUDED.toxicity,
            food_interactions = EXCLUDED.food_interactions,
            fda_label = EXCLUDED.fda_label,
            state = EXCLUDED.state,
            categories = EXCLUDED.categories,
            dosage_forms = EXCLUDED.dosage_forms,
            updated_at = NOW();
    """)

    with engine.connect() as conn:
        for event, elem in context:
            if elem.tag == f"{{{NS['db']}}}drug":
                # Filter empty entries
                if 'created' not in elem.attrib:
                    elem.clear()
                    continue

                db_id_el = elem.find("db:drugbank-id[@primary='true']", NS)
                if db_id_el is None:
                    ids = elem.findall("db:drugbank-id", NS)
                    if ids:
                        # Find the primary ID, or use the first one as fallback
                        db_id_el = next((i for i in ids if i.attrib.get('primary') == 'true'), ids[0])

                if db_id_el is not None:
                    drug_data = {
                        "drugbank_id": db_id_el.text,
                        "name": get_text(elem, "name"),
                        "description": get_text(elem, "description"),
                        "groups": get_list(elem, "groups", "group"),
                        "synonyms": get_list(elem, "synonyms", "synonym"),
                        "brand_names": get_brands(elem),
                        "indication": get_text(elem, "indication"),
                        "pharmacodynamics": get_text(elem, "pharmacodynamics"),
                        "mechanism_of_action": get_text(elem, "mechanism-of-action"),
                        "affected_organisms": get_list(elem, "affected-organisms", "affected-organism"),
                        "absorption": get_text(elem, "absorption"),
                        "volume_of_distribution": get_text(elem, "volume-of-distribution"),
                        "protein_binding": get_text(elem, "protein-binding"),
                        "metabolism": get_text(elem, "metabolism"),
                        "route_of_elimination": get_text(elem, "route-of-elimination"),
                        "half_life": get_text(elem, "half-life"),
                        "clearance": get_text(elem, "clearance"),
                        "toxicity": get_text(elem, "toxicity"),
                        "food_interactions": get_list(elem, "food-interactions", "food-interaction"),
                        "fda_label": get_text(elem, "fda-label"),
                        "state": get_text(elem, "state"),
                        "categories": get_categories(elem),
                        "dosage_forms": get_dosages(elem)
                    }
                    batch.append(drug_data)
                    count += 1

                elem.clear()

                if len(batch) >= BATCH_SIZE:
                    conn.execute(sql_insert, batch)
                    conn.commit()
                    print(f"Updated {count} drugs...")
                    batch = []

        if batch:
            conn.execute(sql_insert, batch)
            conn.commit()
            print(f"Updated {count} drugs (Final batch).")

    print("Success! Database populated with bold-formatted monographs.")

if __name__ == "__main__":
    process_drugbank_xml()