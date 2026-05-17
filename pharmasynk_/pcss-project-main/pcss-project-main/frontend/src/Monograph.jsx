import React, { useState } from 'react';
import AsyncSelect from 'react-select/async';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

const customSelectStyles = {
  control: (provided) => ({
    ...provided,
    minHeight: '45px',
    fontSize: '1.1rem',
    border: '1px solid #ccc',
    boxShadow: 'none',
  }),
  option: (provided) => ({
    ...provided,
    color: '#333',
  }),
};

function Monograph() {
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [monograph, setMonograph] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDrugOptions = (inputValue) => {
    if (inputValue.length < 3) return Promise.resolve([]);
    return apiClient.get(`/search-drugs?query=${inputValue}`)
      .then(res => res.data.map(drug => ({ 
        label: drug.name, 
        value: drug.name, 
        id: drug.drugbank_id 
      })));
  };

  const handleDrugSelect = (option) => {
    setSelectedDrug(option);
    if (option && option.id) {
      setIsLoading(true);
      apiClient.get(`/drug/${option.id}/monograph`)
        .then(res => {
          setMonograph(res.data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Error fetching monograph:", err);
          setMonograph(null);
          setIsLoading(false);
        });
    } else {
      setMonograph(null);
    }
  };

  return (
    <div className="monograph-container" style={{padding: '20px', maxWidth: '1200px', margin: '0 auto'}}>
      
      {/* HEADER & SEARCH */}
      <div style={{marginBottom: '30px', textAlign: 'center'}}>
        <h2 style={{color: '#2c3e50', marginBottom: '15px'}}>Drug Monograph Lookup</h2>
        <div style={{maxWidth: '600px', margin: '0 auto'}}>
          <AsyncSelect
            cacheOptions
            loadOptions={loadDrugOptions}
            onChange={handleDrugSelect}
            value={selectedDrug}
            placeholder="Type drug name (e.g., Aspirin)..."
            styles={customSelectStyles}
          />
        </div>
      </div>

      {/* CONTENT DISPLAY */}
      {isLoading && <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>Loading monograph data...</div>}

      {!isLoading && monograph && (
        <div className="monograph-content" style={{animation: 'fadeIn 0.5s'}}>
          
          <div style={{borderBottom: '3px solid #3498db', paddingBottom: '15px', marginBottom: '25px'}}>
            <h1 style={{margin: 0, color: '#2c3e50', fontSize: '2.2rem'}}>{monograph.name}</h1>
            {monograph.brand_names && (
                <div style={{marginTop: '5px', fontSize: '0.95rem', color: '#666', fontStyle: 'italic'}}>
                    <strong>Common Brands:</strong> {monograph.brand_names}
                </div>
            )}
            <div style={{marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
               {monograph.categories && monograph.categories.split(',').slice(0, 3).map((cat, i) => (
                 <span key={i} style={{background: '#e1f5fe', color: '#0288d1', padding: '4px 10px', borderRadius: '15px', fontSize: '0.85rem', fontWeight: 'bold'}}>
                   {cat.trim()}
                 </span>
               ))}
               <span style={{background: '#f0f4c3', color: '#827717', padding: '4px 10px', borderRadius: '15px', fontSize: '0.85rem'}}>
                 {monograph.groups}
               </span>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '25px'}}>
            
            <div className="mono-col">
              <Section title="1. Description & Indication">
                <InfoLabel text="Description" />
                <div>{formatText(monograph.description)}</div>
                <div style={{marginTop: '15px'}}></div>
                <InfoLabel text="Indication" />
                <div>{formatText(monograph.indication)}</div>
              </Section>

              <Section title="2. Pharmacology">
                <InfoLabel text="Mechanism of Action" />
                <div>{formatText(monograph.mechanism_of_action)}</div>
                <div style={{marginTop: '15px'}}></div>
                <InfoLabel text="Pharmacodynamics" />
                <div>{formatText(monograph.pharmacodynamics)}</div>
              </Section>

              <Section title="3. Dosage & Administration">
                <InfoLabel text="Available Forms" />
                <div>{formatText(monograph.dosage_forms)}</div>
                <div style={{marginTop: '15px'}}></div>
                <InfoLabel text="Food Interactions" />
                <div>{formatText(monograph.food_interactions || 'None reported.')}</div>
              </Section>
            </div>

            <div className="mono-col">
              <Section title="4. Pharmacokinetics (ADME)">
                <InfoRow label="Absorption" value={monograph.absorption} />
                <InfoRow label="Metabolism" value={monograph.metabolism} />
                <InfoRow label="Half-Life" value={monograph.half_life} />
                <InfoRow label="Elimination" value={monograph.elimination_route} />
                <InfoRow label="Protein Binding" value={monograph.protein_binding} />
              </Section>

              <Section title="5. Safety & Toxicity" color="#e74c3c">
                <p style={{color: '#c0392b'}}>{formatText(monograph.toxicity || 'No specific toxicity data available.')}</p>
              </Section>

              <Section title="6. Synonyms & Other Names">
                <p style={{fontSize: '0.9rem', color: '#555'}}>{monograph.synonyms || 'N/A'}</p>
              </Section>
            </div>

          </div>
        </div>
      )}

      {!isLoading && !monograph && selectedDrug && (
        <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
          No monograph data found for this drug.
        </div>
      )}
    </div>
  );
}

// --- HELPER COMPONENTS ---

// 1. Text Parser: Converts **Bold** text to HTML <strong> tags
const formatText = (text) => {
  if (!text) return "N/A";
  // Split the string by the ** markers
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove asterisks and wrap in strong
      return <strong key={index} style={{color: '#2c3e50'}}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const Section = ({ title, children, color = '#2980b9' }) => (
  <div style={{marginBottom: '20px', background: 'white', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
    <h3 style={{background: '#f8f9fa', margin: 0, padding: '12px 15px', borderBottom: '1px solid #e0e0e0', color: color, fontSize: '1.1rem'}}>
      {title}
    </h3>
    <div style={{
        padding: '15px', 
        fontSize: '0.95rem', 
        lineHeight: '1.6', 
        color: '#333', 
        whiteSpace: 'pre-line' // Essential for bullet points and spacing
    }}>
      {children}
    </div>
  </div>
);

const InfoLabel = ({ text }) => (
    <div style={{fontWeight: 'bold', color: '#555', marginBottom: '4px', textDecoration: 'underline'}}>{text}:</div>
);

const InfoRow = ({ label, value }) => (
  <div style={{marginBottom: '12px'}}>
    <span style={{fontWeight: 'bold', color: '#555'}}>{label}:</span> 
    <div style={{marginTop: '2px'}}>{formatText(value)}</div>
  </div>
);

export default Monograph;