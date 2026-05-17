import lxml.etree as ET
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://pharmadmin:mysecretpassword@localhost:5432/pcss_data"
engine = create_engine(DATABASE_URL)
XML_FILE_PATH = 'data/full_database.xml'

def parse_and_load_drugs():
    print("Starting fast extraction of drug definitions...", flush=True)
    context = ET.iterparse(XML_FILE_PATH, events=('end',))
    ns = {'db': 'http://www.drugbank.ca'}
    
    drugs_to_insert = []
    count = 0
    for event, elem in context:
        if elem.tag == '{http://www.drugbank.ca}drug' and elem.get('type') in ['biotech', 'small molecule']:
            db_id_elem = elem.find('db:drugbank-id[@primary="true"]', ns)
            name_elem = elem.find('db:name', ns)
            
            if db_id_elem is not None and name_elem is not None:
                drugs_to_insert.append({
                    'drugbank_id': db_id_elem.text,
                    'name': name_elem.text,
                    'description': ""
                })
                count += 1
                if count % 1000 == 0:
                    print(f"Parsed {count} drugs...", end='\r', flush=True)
            
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]
                
    print(f"\nFound {len(drugs_to_insert)} drugs. Inserting into Postgres...", flush=True)
    
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO drugs (drugbank_id, name, description) 
            VALUES (:drugbank_id, :name, :description)
            ON CONFLICT (drugbank_id) DO NOTHING
        """), drugs_to_insert)
        conn.commit()
    print("Drugs loaded successfully!", flush=True)

if __name__ == "__main__":
    parse_and_load_drugs()
