import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

const createEmptyRow = () => ({
  date: new Date().toISOString().slice(0, 10),
  brand_name: '',
  generic_name: '',
  drugbank_id: '', 
  dose: '',
  frequency: '',
  route: '',
  bf_af: '', 
  time: '',
  instructions: ''
});

const customSelectStyles = {
  control: (provided) => ({ ...provided, minHeight: '38px', border: '1px solid #ccc', boxShadow: 'none' }),
  menu: (provided) => ({ ...provided, zIndex: 9999 }),
  container: (provided) => ({ ...provided, width: '100%' })
};

const cleanInputStyle = {
    width: '100%',
    backgroundColor: '#ffffff', 
    color: '#333333', 
    border: '1px solid #ccc', 
    padding: '8px 10px', 
    borderRadius: '4px',
    fontSize: '0.95rem',
    fontFamily: 'inherit'
};

function Prescription({ 
  localPatientId, 
  setActiveTab, 
  setActiveMedications,
  rows, 
  setRows, 
  doctorNotes, 
  setDoctorNotes,
  currentPrescriptionId,
  setCurrentPrescriptionId,
  setInteractions,
  setAdrs,
  setLabWarnings
}) {
  
  const [history, setHistory] = useState([]);
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

  useEffect(() => {
    if (localPatientId) loadHistory();
  }, [localPatientId]);

  const loadHistory = () => {
    apiClient.get(`/patient/${localPatientId}/prescription_history`)
      .then(res => setHistory(res.data))
      .catch(err => console.error(err));
  };

  const getLocalDateObject = (dateString) => {
      if (!dateString) return new Date();
      const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
      return new Date(utcString);
  };

  const groupHistoryByDate = (historyItems) => {
    const sortedItems = [...historyItems].sort((a, b) => 
        getLocalDateObject(b.created_at) - getLocalDateObject(a.created_at)
    );
    
    const groups = {};
    sortedItems.forEach(item => {
      const dateObj = getLocalDateObject(item.created_at);
      const dateKey = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });
    return groups;
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleBfAfChange = (index, value) => {
    const newRows = [...rows];
    if (newRows[index].bf_af === value) {
        newRows[index].bf_af = '';
    } else {
        newRows[index].bf_af = value;
    }
    setRows(newRows);
  };

  const handleGenericSelect = (index, option) => {
    const newRows = [...rows];
    newRows[index].generic_name = option ? option.label : '';
    newRows[index].drugbank_id = option ? option.id : '';
    setRows(newRows);
  };

  const addRow = () => setRows([...rows, createEmptyRow()]);
  const removeRow = (index) => {
    if (rows.length > 1) setRows(rows.filter((_, i) => i !== index));
  };

  // --- CLEAR INTERACTIONS ON NEW PRESCRIPTION ---
  const handleNewPrescription = () => {
      if (rows.some(r => r.generic_name) && window.confirm("Start a fresh prescription? Any unsaved changes to the current form will be lost.") === false) {
          return;
      }
      setRows([createEmptyRow()]);
      setDoctorNotes('');
      setCurrentPrescriptionId(null); 
      // Clear Clinical Data
      setInteractions([]);
      setAdrs([]);
      setLabWarnings([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = (targetTab = null) => {
    if (!localPatientId) return;
    const validRows = rows.filter(r => r.generic_name);
    if (validRows.length === 0) {
      alert("Please add at least one drug with a Generic Name.");
      return;
    }

    setIsLoading(true);
    const payload = { items: validRows, doctor_notes: doctorNotes };

    let apiCall;
    if (currentPrescriptionId) {
        apiCall = apiClient.put(`/prescription/${currentPrescriptionId}`, payload);
    } else {
        apiCall = apiClient.post(`/patient/${localPatientId}/prescription`, payload);
    }

    apiCall
      .then(async (res) => {
        if (!currentPrescriptionId) {
            setCurrentPrescriptionId(res.data.prescription_id);
        }

        alert(currentPrescriptionId ? "Prescription Updated!" : "Prescription Saved!");
        loadHistory();
        setIsLoading(false);
        
        const fullMedsList = validRows.map(r => ({
           ...r,
           name: r.generic_name, 
           drugbank_id: r.drugbank_id
        }));
        setActiveMedications(fullMedsList);

        if (targetTab === 'plan') {
            // Auto-run checks if moving to Plan
            try {
                const drugIds = validRows.map(r => r.drugbank_id).filter(id => id);
                if (drugIds.length > 1) {
                    const interactRes = await apiClient.post('/interact', { drugbank_ids: drugIds });
                    setInteractions(interactRes.data.interactions || []);
                    setAdrs(interactRes.data.adrs || []);
                } else {
                    setInteractions([]); 
                    setAdrs([]);
                }
                try {
                    const labRes = await apiClient.post('/check-labs', { patient_id: localPatientId, meds: validRows });
                    setLabWarnings(labRes.data.warnings || []);
                } catch (e) {
                    setLabWarnings([]); 
                }
            } catch (error) {
                console.error("Auto-check failed:", error);
            }
        }

        if (targetTab) {
            setTimeout(() => setActiveTab(targetTab), 500);
        } else {
            // --- CLEAR INTERACTIONS ON SAVE/RESET ---
            setRows([createEmptyRow()]);
            setDoctorNotes('');
            setCurrentPrescriptionId(null);
            setInteractions([]);
            setAdrs([]);
            setLabWarnings([]);
        }
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
        alert("Error saving prescription.");
      });
  };

  const handleLoadPast = (prescription) => {
    if(window.confirm("Load this prescription? This will replace current entries.")) {
        setRows(prescription.items);
        setDoctorNotes(prescription.doctor_notes || '');
        setCurrentPrescriptionId(prescription.prescription_id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = (id) => {
      if (window.confirm("Are you sure you want to delete this prescription history?")) {
          apiClient.delete(`/prescription/${id}`)
            .then(() => {
                setHistory(history.filter(h => h.prescription_id !== id));
                if (currentPrescriptionId === id) {
                    setCurrentPrescriptionId(null);
                    setRows([createEmptyRow()]);
                    setDoctorNotes('');
                }
            })
            .catch(err => {
                console.error("Error deleting prescription:", err);
                alert("Failed to delete.");
            });
      }
  };

  const groupedHistory = groupHistoryByDate(history);
  const sortedDates = Object.keys(groupedHistory).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="prescription-container">
      <style>{`
        .custom-checkbox {
          appearance: none; -webkit-appearance: none; background-color: #fff; margin: 0;
          font: inherit; color: currentColor; width: 18px; height: 18px;
          border: 2px solid #555; border-radius: 3px; display: grid; place-content: center;
          margin-right: 8px; cursor: pointer;
        }
        .custom-checkbox::before {
          content: ""; width: 10px; height: 10px; transform: scale(0);
          transition: 100ms transform ease-in-out; box-shadow: inset 1em 1em #2980b9;
          transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        }
        .custom-checkbox:checked::before { transform: scale(1); }
      `}</style>

      {/* --- EDITOR SECTION --- */}
      <div className="prescription-editor" style={{marginBottom: '40px'}}>
        
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px'}}>
            <h3 style={{margin: 0}}>Doctor's Prescription Entry</h3>
            <button onClick={handleNewPrescription} className="load-btn" style={{backgroundColor: '#e67e22', fontSize: '0.9em', padding: '8px 16px'}}>
                + New Prescription
            </button>
        </div>
        
        <div> 
          <table className="roster-table" style={{fontSize: '0.9rem', width: '100%', tableLayout: 'fixed'}}>
            <thead>
              <tr style={{backgroundColor: '#f8f9fa', color: '#555'}}>
                <th style={{width: '3%', padding: '12px 5px', textAlign:'center'}}>S.No</th>
                <th style={{width: '9%', padding: '12px 8px'}}>Date</th>
                <th style={{width: '12%', padding: '12px 8px'}}>Brand</th>
                <th style={{width: '16%', padding: '12px 8px'}}>Generic Name</th>
                <th style={{width: '7%', padding: '12px 8px'}}>Dose</th>
                <th style={{width: '8%', padding: '12px 8px'}}>Route</th>
                <th style={{width: '7%', padding: '12px 8px'}}>Freq</th>
                <th style={{width: '9%', padding: '12px 8px', textAlign: 'center'}}>BF / AF</th>
                <th style={{width: '10%', padding: '12px 8px'}}>Time</th>
                <th style={{width: '15%', padding: '12px 8px'}}>Instructions</th>
                <th style={{width: '4%', padding: '12px 8px'}}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                  <td style={{textAlign: 'center', padding: '12px 5px', verticalAlign: 'top', paddingTop: '15px', fontWeight: 'bold', color: '#777'}}>{index + 1}</td>
                  
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <input type="date" value={row.date} onChange={e => handleRowChange(index, 'date', e.target.value)} style={cleanInputStyle} />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <input type="text" value={row.brand_name} onChange={e => handleRowChange(index, 'brand_name', e.target.value)} placeholder="Brand..." style={cleanInputStyle} />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <AsyncSelect
                      loadOptions={loadDrugOptions}
                      onChange={opt => handleGenericSelect(index, opt)}
                      value={row.generic_name ? { label: row.generic_name, value: row.generic_name } : null}
                      styles={customSelectStyles}
                      placeholder="Search..."
                    />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <input value={row.dose} onChange={e => handleRowChange(index, 'dose', e.target.value)} placeholder="500mg" style={cleanInputStyle} />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                      <select value={row.route} onChange={e => handleRowChange(index, 'route', e.target.value)} style={cleanInputStyle}>
                          <option value="">Select</option>
                          <option value="PO">PO (Oral)</option>
                          <option value="IV">IV</option>
                          <option value="IM">IM</option>
                          <option value="SC">SC</option>
                          <option value="Topical">Topical</option>
                          <option value="Inhale">Inhale</option>
                          <option value="PR">Rectal</option>
                      </select>
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <input value={row.frequency} onChange={e => handleRowChange(index, 'frequency', e.target.value)} placeholder="1-0-1" style={cleanInputStyle} />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top', textAlign: 'center'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', paddingLeft: '12px'}}>
                        <label style={{fontSize: '0.85em', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#333'}}>
                            <input type="checkbox" checked={row.bf_af === 'Before'} onChange={() => handleBfAfChange(index, 'Before')} className="custom-checkbox" /> BF (Before)
                        </label>
                        <label style={{fontSize: '0.85em', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#333'}}>
                            <input type="checkbox" checked={row.bf_af === 'After'} onChange={() => handleBfAfChange(index, 'After')} className="custom-checkbox" /> AF (After)
                        </label>
                    </div>
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <input value={row.time} onChange={e => handleRowChange(index, 'time', e.target.value)} placeholder="8am..." style={cleanInputStyle} />
                  </td>
                  <td style={{padding: '8px', verticalAlign: 'top'}}>
                    <textarea rows={2} value={row.instructions} onChange={e => handleRowChange(index, 'instructions', e.target.value)} placeholder="Instructions..." style={{...cleanInputStyle, resize: 'vertical', minHeight: '38px'}} />
                  </td>
                  <td style={{padding: '8px', textAlign: 'center', verticalAlign: 'top', paddingTop: '12px'}}>
                    <button onClick={() => removeRow(index)} className="delete-btn" style={{padding: '5px 10px'}}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <button onClick={addRow} className="add-row-btn" style={{marginTop: '15px', width: '100%', padding: '12px'}}>+ Add Another Drug</button>

        <div style={{marginTop: '30px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontSize: '1.1rem', fontWeight: '500'}}>Doctor's Clinical Notes:</label>
            <textarea 
                rows="4" 
                value={doctorNotes} 
                onChange={e => setDoctorNotes(e.target.value)} 
                placeholder="Enter clinical observations, diagnosis notes, or specific instructions for the pharmacist..."
                style={{width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontFamily: 'inherit', fontSize: '1rem'}}
            />
        </div>

        <div className="editor-buttons" style={{marginTop: '30px', display: 'flex', gap: '15px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px'}}>
            <button onClick={() => handleSave(null)} disabled={isLoading} className="save-btn" style={{backgroundColor: '#8e44ad', padding: '12px 24px'}}>
                {currentPrescriptionId ? 'Update' : 'Save'}
            </button>
            <button onClick={() => handleSave('meds')} disabled={isLoading} className="load-btn" style={{backgroundColor: '#3498db', padding: '12px 24px'}}>
                Check Interactions (Meds Review) →
            </button>
            <button onClick={() => handleSave('plan')} disabled={isLoading} className="load-btn" style={{backgroundColor: '#27ae60', padding: '12px 24px'}}>
                Finalize Pharmacotherapy Plan →
            </button>
        </div>
      </div>

      {/* --- HISTORY SECTION --- */}
      <div className="prescription-history-section" style={{borderTop: '3px solid #eee', paddingTop: '20px', backgroundColor: '#fafafa', padding: '20px', borderRadius: '8px'}}>
        <h3 style={{marginTop: 0, color: '#444'}}>Past Prescriptions History</h3>
        
        {history.length === 0 ? (
            <p style={{color:'#888', fontStyle: 'italic'}}>No prescription history found for this patient.</p>
        ) : (
            <div className="history-list">
              {sortedDates.map(dateKey => (
                <div key={dateKey} style={{marginBottom: '30px'}}>
                  <h4 style={{backgroundColor: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', color: '#2c3e50', borderLeft: '5px solid #3498db', margin: '0 0 15px 0'}}>
                    {dateKey}
                  </h4>

                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px'}}>
                    {groupedHistory[dateKey].map(p => (
                        <div key={p.prescription_id} className="history-card" style={{backgroundColor: '#fff', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                                <strong style={{color: '#2980b9', fontSize: '1.1em'}}>
                                    {getLocalDateObject(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}
                                </strong>
                                <span style={{fontSize: '0.85em', backgroundColor: '#eef2f3', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>{p.items.length} Drugs</span>
                            </div>
                            
                            <p style={{fontSize: '0.9em', color: '#666', marginBottom: '15px', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                {p.doctor_notes || "No notes provided."}
                            </p>
                            
                            <div style={{display: 'flex', gap: '10px'}}>
                                <button onClick={() => handleLoadPast(p)} className="edit-btn" style={{flex: 1, textAlign: 'center', padding: '8px'}}>Load</button>
                                <button onClick={() => handleDelete(p.prescription_id)} className="delete-btn" style={{padding: '8px 12px', flex: '0 0 auto'}} title="Delete">Del</button>
                            </div>
                        </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}

export default Prescription;