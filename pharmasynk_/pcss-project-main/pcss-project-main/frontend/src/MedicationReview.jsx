import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

const getSeverityProps = (severity) => {
  const sev = String(severity).toLowerCase();
  if (sev.includes('contraindicated')) {
    return { class: 'severity-contra', text: 'Contraindicated' };
  }
  if (sev.includes('major')) {
    return { class: 'severity-major', text: 'Major Interaction' };
  }
  if (sev.includes('moderate')) {
    return { class: 'severity-moderate', text: 'Moderate Interaction' };
  }
  if (sev.includes('minor')) {
    return { class: 'severity-minor', text: 'Minor Interaction' };
  }
  return { class: 'severity-unknown', text: 'Interaction Found (Unknown Severity)' };
};

// Helper component to render a list of interaction cards
const InteractionGroup = ({ title, interactions, className }) => {
  if (interactions.length === 0) return null;

  return (
    <div className={`interaction-group ${className}`}>
      <h4 className="group-title">{title} ({interactions.length})</h4>
      {interactions.map((interaction, index) => {
        const severityProps = getSeverityProps(interaction.severity);
        return (
          <div key={index} className={`interaction-card ${severityProps.class}`}>
            <span className="severity-badge">{severityProps.text}</span>
            <strong>{interaction.drug_1_name} & {interaction.drug_2_name}</strong>
            <p>{interaction.description}</p>
          </div>
        );
      })}
    </div>
  );
};

function MedicationReview({ 
  activeMedications, setActiveMedications,
  interactions, setInteractions,
  adrs, setAdrs
}) {
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState(null);

  const loadDrugOptions = (inputValue) => {
    if (inputValue.length < 3) return Promise.resolve([]);
    
    return apiClient.get(`/search-drugs?query=${inputValue}`)
      .then(res => {
        return res.data.map(drug => ({
          label: drug.name,
          value: drug.drugbank_id,
          drug: drug,
        }));
      });
  };

  const handleDrugSelected = (selectedOption) => {
    if (selectedOption) {
      if (!activeMedications.find(d => d.drug_id === selectedOption.drug.drug_id)) {
        setActiveMedications([...activeMedications, selectedOption.drug]);
      }
    }
    setSelectedValue(null);
  };
  
  useEffect(() => {
    const checkAllClinicalData = async () => {
      if (activeMedications.length === 0) {
        setInteractions([]);
        setAdrs([]);
        return;
      }

      setIsLoading(true);
      const drugbank_ids = activeMedications.map(d => d.drugbank_id);

      const interactionPromise = apiClient.post('/check-interactions', {
        drugbank_ids: drugbank_ids
      });

      const adrPromise = apiClient.post('/check-adrs', {
        drugbank_ids: drugbank_ids
      });

      try {
        const [interactionResponse, adrResponse] = await Promise.all([
          interactionPromise,
          adrPromise
        ]);

        setInteractions(interactionResponse.data);
        setAdrs(adrResponse.data);

      } catch (error) {
        console.error("Error checking clinical data:", error);
      }

      setIsLoading(false);
    };

    checkAllClinicalData();
  }, [activeMedications, setInteractions, setAdrs]); 

  // --- FILTER INTERACTIONS BY SEVERITY ---
  const contraindicatedList = interactions.filter(i => i.severity.toLowerCase().includes('contraindicated'));
  const majorList = interactions.filter(i => i.severity.toLowerCase().includes('major'));
  const moderateList = interactions.filter(i => i.severity.toLowerCase().includes('moderate'));
  const minorList = interactions.filter(i => i.severity.toLowerCase().includes('minor'));
  const unknownList = interactions.filter(i => !['contraindicated', 'major', 'moderate', 'minor'].some(level => i.severity.toLowerCase().includes(level)));

  return (
    <div className="medication-review-container-grid">
      
      {/* COLUMN 1: Drug List */}
      <div className="medication-list-panel">
        <h3>Drug Treatment Chart</h3>
        <div className="drug-search-box">
          <label>Add Drug (by Generic Name):</label>
          <AsyncSelect
            cacheOptions
            loadOptions={loadDrugOptions}
            onChange={handleDrugSelected}
            value={selectedValue}
            placeholder="Type 'Aspirin' or 'Warfarin'..."
          />
        </div>
        
        <table className="active-meds-table">
          <thead>
            <tr>
              <th>Drug Name</th>
              <th style={{width: '100px', textAlign: 'center'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeMedications.map(drug => (
              <tr key={drug.drug_id}>
                <td>{drug.name}</td>
                <td style={{textAlign: 'center'}}>
                  <button 
                    className="remove-btn"
                    onClick={() => setActiveMedications(
                      activeMedications.filter(d => d.drug_id !== drug.drug_id)
                    )}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* COLUMN 2: Interactions (Grouped) */}
      <div className="interaction-panel">
        <h3>Drug-Drug Interactions</h3>
        {isLoading && <p>Checking...</p>}
        
        <div className="interaction-results">
          {interactions.length === 0 && !isLoading && (
            <p className="no-interactions">No interactions found.</p>
          )}

          {/* Render Groups in Priority Order */}
          <InteractionGroup title="CONTRAINDICATED" interactions={contraindicatedList} className="group-contra" />
          <InteractionGroup title="Major Interactions" interactions={majorList} className="group-major" />
          <InteractionGroup title="Moderate Interactions" interactions={moderateList} className="group-moderate" />
          <InteractionGroup title="Minor Interactions" interactions={minorList} className="group-minor" />
          <InteractionGroup title="Unknown Severity" interactions={unknownList} className="group-unknown" />
        </div>
      </div>
      
      {/* COLUMN 3: ADR Panel */}
      <div className="interaction-panel adr-panel">
        <h3>Potential Adverse Reactions</h3>
        {isLoading && <p>Checking...</p>}
        <div className="interaction-results">
          {adrs.length === 0 && !isLoading && (
            <p className="no-interactions">No ADRs found in database.</p>
          )}
          
          {adrs.map((adr, index) => (
            <div key={index} className="adr-card">
              <strong>{adr.drug_name}</strong>
              <p>{adr.adr_term}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default MedicationReview;