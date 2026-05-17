import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

// --- CUSTOM STYLES FOR REACT-SELECT (FORCE WRAPPING) ---
const customSelectStyles = {
  control: (provided) => ({
    ...provided,
    minHeight: '38px',
    height: 'auto',
    whiteSpace: 'normal',
    border: 'none',
    boxShadow: 'none',
    backgroundColor: '#f9f9f9',
  }),
  valueContainer: (provided) => ({
    ...provided,
    flexWrap: 'wrap',
    whiteSpace: 'normal',
    padding: '2px 8px',
  }),
  singleValue: (provided) => ({
    ...provided,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflow: 'visible',
    position: 'relative',
    maxWidth: '100%',
    transform: 'none',
    color: '#000'
  }),
  input: (provided) => ({
    ...provided,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: '38px',
    alignItems: 'start',
    paddingTop: '4px'
  })
};

const createEmptyRow = () => ({
  drug_name: '', dose: '', frequency: '', time: '', instruction: ''
});

const createInitialRows = () => {
  return Array(5).fill(null).map(createEmptyRow);
};

function DischargeSummary({ localPatientId, patientProfile }) {
  
  const [diagnosis, setDiagnosis] = useState('');
  const [medRows, setMedRows] = useState(createInitialRows());
  const [generalInstructions, setGeneralInstructions] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [pastSummaries, setPastSummaries] = useState([]);
  const [editingSummary, setEditingSummary] = useState(null);

  const loadDrugOptions = (inputValue) => {
    if (inputValue.length < 3) return Promise.resolve([]);
    return apiClient.get(`/search-drugs?query=${inputValue}`)
      .then(res => res.data.map(drug => ({ label: drug.name, value: drug.name })));
  };

  useEffect(() => {
    if (localPatientId) {
      loadHistory();
    }
  }, [localPatientId]);

  const loadHistory = () => {
    apiClient.get(`/patient/${localPatientId}/discharge_history`)
      .then(response => {
        setPastSummaries(response.data);
      })
      .catch(error => console.error("Error loading history:", error));
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...medRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setMedRows(newRows);
  };

  const handleDrugSelect = (index, selectedOption) => {
    handleRowChange(index, 'drug_name', selectedOption ? selectedOption.label : '');
  };

  const handleAddRow = () => setMedRows([...medRows, createEmptyRow()]);

  const handleRemoveRow = (index) => {
    if (medRows.length <= 1) return;
    const newRows = medRows.filter((_, i) => i !== index);
    setMedRows(newRows);
  };

  const handleEditClick = (summary) => {
    setEditingSummary(summary);
    setDiagnosis(summary.diagnosis);
    setGeneralInstructions(summary.general_instructions);
    
    let loadedMeds = summary.medication_list || [];
    loadedMeds = loadedMeds.map(med => ({ ...createEmptyRow(), ...med }));

    if (loadedMeds.length < 5) {
      const padding = Array(5 - loadedMeds.length).fill(null).map(createEmptyRow);
      loadedMeds = [...loadedMeds, ...padding];
    }
    setMedRows(loadedMeds);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (summaryId) => {
    if (window.confirm("Are you sure you want to delete this discharge summary?")) {
      apiClient.delete(`/discharge/${summaryId}`)
        .then(() => {
          setPastSummaries(pastSummaries.filter(s => s.summary_id !== summaryId));
        })
        .catch(err => {
          console.error("Error deleting summary:", err);
          alert("Failed to delete summary.");
        });
    }
  };

  const handleCancelEdit = () => {
    setEditingSummary(null);
    setDiagnosis('');
    setGeneralInstructions('');
    setMedRows(createInitialRows());
  };

  const handleSaveOrUpdate = () => {
    setIsLoading(true);
    const validMeds = medRows.filter(row => row.drug_name && row.drug_name.trim() !== '');
    
    const payload = {
      diagnosis: diagnosis,
      medication_list: validMeds,
      general_instructions: generalInstructions
    };

    if (editingSummary) {
      apiClient.put(`/discharge/${editingSummary.summary_id}`, payload)
        .then(res => {
          alert("Discharge Plan Updated!");
          handleCancelEdit();
          loadHistory();
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    } else {
      apiClient.post(`/patient/${localPatientId}/discharge`, payload)
        .then(res => {
          alert("Discharge Plan Saved!");
          handleCancelEdit();
          loadHistory();
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
        });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="discharge-container-grid">
      <div className="discharge-editor">
        
        <div className="print-header">
          <h1>Pharmacist Discharge Plan</h1>
          <div className="patient-info-grid">
            <div><strong>Name:</strong> {patientProfile.first_name} {patientProfile.last_name}</div>
            <div><strong>Age/Sex:</strong> {patientProfile.age || 'N/A'} / {patientProfile.sex || 'N/A'}</div>
            <div><strong>IP/OP No:</strong> {patientProfile.emr_id || 'N/A'}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <h3>{editingSummary ? `Editing Plan #${editingSummary.summary_id}` : 'New Discharge Summary'}</h3>

        <div className="discharge-section">
          <label><strong>Diagnosis / Clinical Indication:</strong></label>
          <input 
            type="text" 
            className="diagnosis-input"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Enter patient diagnosis..."
          />
        </div>

        <div className="discharge-table-wrapper">
          <table className="discharge-table">
            <thead>
              <tr>
                <th style={{width: '3%'}}>#</th>
                <th style={{width: '20%'}}>Drug Name</th>
                <th style={{width: '15%'}}>Dose</th>
                <th style={{width: '12%'}}>Freq</th> 
                <th style={{width: '15%'}}>Time</th>
                <th style={{width: '30%'}}>Instructions</th>
                <th className="no-print" style={{width: '5%'}}></th> 
              </tr>
            </thead>
            <tbody>
              {medRows.map((row, index) => (
                <tr key={index}>
                  <td style={{verticalAlign: 'top', paddingTop: '15px'}}>{index + 1}</td>
                  
                  <td className="drug-select-cell" style={{verticalAlign: 'top'}}>
                    <AsyncSelect 
                      cacheOptions 
                      loadOptions={loadDrugOptions} 
                      defaultOptions
                      onChange={(opt) => handleDrugSelect(index, opt)}
                      value={row.drug_name ? {label: row.drug_name, value: row.drug_name} : null}
                      placeholder="Select..."
                      className="discharge-select"
                      classNamePrefix="react-select"
                      styles={customSelectStyles}
                    />
                  </td>

                  <td style={{verticalAlign: 'top'}}>
                    <textarea rows="3" value={row.dose} onChange={(e) => handleRowChange(index, 'dose', e.target.value)} placeholder="e.g. 500mg"/>
                  </td>

                  <td style={{verticalAlign: 'top'}}>
                    <textarea rows="3" value={row.frequency} onChange={(e) => handleRowChange(index, 'frequency', e.target.value)} placeholder="e.g. 1-0-1"/>
                  </td>

                  <td style={{verticalAlign: 'top'}}>
                    <textarea rows="3" value={row.time} onChange={(e) => handleRowChange(index, 'time', e.target.value)} placeholder="e.g. 8 AM"/>
                  </td>

                  <td style={{verticalAlign: 'top'}}>
                    <textarea rows="3" value={row.instruction} onChange={(e) => handleRowChange(index, 'instruction', e.target.value)} placeholder="e.g. After food..."/>
                  </td>

                  <td className="no-print" style={{textAlign: 'center', verticalAlign: 'top', paddingTop: '15px'}}>
                    <button className="row-remove-btn" onClick={() => handleRemoveRow(index)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="add-row-btn no-print" onClick={handleAddRow}>+ Add Medication Row</button>
        </div>

        <div className="discharge-section">
          <label><strong>Patient Instructions / Re-visit:</strong></label>
          <textarea 
            rows="6"
            value={generalInstructions}
            onChange={(e) => setGeneralInstructions(e.target.value)}
            placeholder="Enter general instructions..."
            className="general-instructions-box"
          />
        </div>

        <div className="discharge-actions no-print">
          <button onClick={handleSaveOrUpdate} disabled={isLoading} className="save-btn">
            {isLoading ? 'Saving...' : (editingSummary ? 'Update Plan' : 'Save New Plan')}
          </button>
          
          {editingSummary && (
            <button onClick={handleCancelEdit} disabled={isLoading} className="cancel-btn">
              Cancel Edit
            </button>
          )}
          
          <button onClick={handlePrint} className="print-btn">
            Print / PDF
          </button>
        </div>

        <div className="print-footer">
          <div className="signature-line">Pharmacist Signature</div>
          <div className="signature-line">Date</div>
        </div>
      </div>

      <div className="discharge-history no-print">
        <h3>Past Discharge Summaries</h3>
        {pastSummaries.length === 0 && <p style={{color: '#666'}}>No past summaries found.</p>}
        
        <div className="history-list">
          {pastSummaries.map(summary => (
            <div key={summary.summary_id} className="history-card">
              <div className="history-card-header">
                <div>
                  <strong>Date: {new Date(summary.created_at).toLocaleDateString()}</strong>
                  <br/>
                  <span style={{fontSize: '0.9em', color: '#666'}}>Diag: {summary.diagnosis || 'None'}</span>
                </div>
                
                {/* --- BUTTONS WITH SPACING --- */}
                <div className="card-actions" style={{display: 'flex', gap: '10px'}}>
                  <button 
                    onClick={() => handleEditClick(summary)} 
                    className="edit-btn"
                    style={{padding: '6px 12px', minWidth: '60px'}}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(summary.summary_id)} 
                    className="delete-btn"
                    style={{padding: '6px 12px', minWidth: '60px'}}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="snapshot-summary">
                <ul>
                  <li>{summary.medication_list?.length || 0} Meds Prescribed</li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default DischargeSummary;