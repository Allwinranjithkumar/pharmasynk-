# PharmaSynk - Pharmaceutical Care Support System (PCSS)

A full-stack clinical decision support system for pharmacists, featuring Drug-Drug Interaction (DDI), Adverse Drug Reaction (ADR), and Drug-Lab conflict checking.

## Tech Stack
- **Frontend**: React
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Data Source**: DrugBank Full Database

---

## ⚠️ DrugBank Data Setup (Required)

The DrugBank XML database is **not included** in this repository because:
- The file is ~205 MB (exceeds GitHub's 100 MB limit)
- It is licensed data from DrugBank

### Steps to get the data:
1. Go to [https://go.drugbank.com/releases/latest](https://go.drugbank.com/releases/latest)
2. Create a free academic/research account and download: `drugbank_all_full_database.xml.zip`
3. Place the file inside the `drugbank/` folder:
   ```
   drugbank/
   └── drugbank_all_full_database.xml.zip
   ```
4. Run the ETL pipeline to load data into PostgreSQL (see backend setup below)

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/Allwinranjithkumar/pharmasynk-.git
cd pharmasynk-
```

### 2. Start with Docker Compose
```bash
docker-compose up --build
```

### 3. Manual Setup (without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

---

## Features
- Patient registration and medication history tracking
- Drug-Drug Interaction (DDI) alerts
- Adverse Drug Reaction (ADR) monitoring
- Drug-Lab conflict detection
- Clinical dashboard for pharmacists