import React, { useState } from 'react';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

const MOCK_PHARMACIST = "Dr. Pharmacist";

const getSeverityProps = (severity) => {
  const sev = String(severity).toLowerCase();
  if (sev.includes('contraindicated')) return { class: 'severity-contra', text: 'Contraindicated' };
  if (sev.includes('major')) return { class: 'severity-major', text: 'Major' };
  if (sev.includes('moderate')) return { class: 'severity-moderate', text: 'Moderate' };
  if (sev.includes('minor')) return { class: 'severity-minor', text: 'Minor' };
  return { class: 'severity-unknown', text: 'Unknown' };
};

const getLabSeverity = (warning) => {
  const text = (warning.description + ' ' + warning.lab_test_name).toLowerCase();
  if (
    text.includes('failure') || text.includes('toxicity') || text.includes('nephrotoxic') || 
    text.includes('hepatotoxic') || text.includes('rhabdomyolysis') || 
    text.includes('severe') || text.includes('pancytopenia')
  ) {
    return { class: 'severity-major', label: 'Major Risk' };
  }
  return { class: 'severity-moderate', label: 'Moderate Risk' };
};

const formatDateDDMMYYYY = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; 
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

function CarePlan({ 
  localPatientId, 
  pastPlans, 
  setPastPlans,
  activeMedications,
  interactions,
  adrs,
  labWarnings,
  doctorNotes,
  patientProfile,
  emrId,
  setInteractions,
  setAdrs,
  setLabWarnings,
  setActiveMedications,
  setDoctorNotes 
}) {
  
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);

  const sourceData = editingPlan && editingPlan.plan_data ? editingPlan.plan_data.snapshot_data : null;

  const displayMeds = sourceData ? (sourceData.active_medications || []) : activeMedications;
  const displayInteractions = sourceData ? (sourceData.interactions || []) : interactions;
  const displayLabWarnings = sourceData ? (sourceData.lab_warnings || []) : labWarnings;
  const displayDoctorNotes = sourceData ? (sourceData.doctor_notes || '') : doctorNotes;

  const getLocalDateObject = (dateString) => {
      if (!dateString) return new Date();
      const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
      return new Date(utcString);
  };

  const groupPlansByDate = (plans) => {
    const sortedPlans = [...plans].sort((a, b) => 
        getLocalDateObject(b.created_at) - getLocalDateObject(a.created_at)
    );
    
    const groups = {};
    sortedPlans.forEach(plan => {
      const dateObj = getLocalDateObject(plan.created_at);
      const dateKey = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(plan);
    });
    return groups;
  };

  const handleEditClick = (plan) => {
    setEditingPlan(plan); 
    if (plan.plan_data) {
      if (plan.plan_data.plan_note) {
        setNote(plan.plan_data.plan_note);
      } else if (plan.plan_data.p) {
        setNote(plan.plan_data.p);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (planId) => {
    if (window.confirm("Are you sure you want to delete this pharmacotherapy care plan note?")) {
      apiClient.delete(`/careplan/${planId}`)
        .then(() => {
          setPastPlans(pastPlans.filter(p => p.plan_id !== planId));
          if (editingPlan && editingPlan.plan_id === planId) {
              setEditingPlan(null);
              setNote('');
          }
        })
        .catch(err => {
          console.error("Error deleting plan:", err);
          alert("Failed to delete plan.");
        });
    }
  };

  const handleDiscardOrDelete = () => {
      if (editingPlan) {
          handleDeleteClick(editingPlan.plan_id);
      } else {
          const hasNote = note && note.trim().length > 0;
          const hasMeds = activeMedications && activeMedications.length > 0;
          const hasDocNotes = doctorNotes && doctorNotes.trim().length > 0;
          const hasWarnings = (interactions && interactions.length > 0) || 
                              (adrs && adrs.length > 0) || 
                              (labWarnings && labWarnings.length > 0);

          if (!hasNote && !hasMeds && !hasWarnings && !hasDocNotes) {
              return; 
          }

          if (window.confirm("Discard draft? This will clear the entire form, including the prescription context and doctor's notes.")) {
              setNote('');
              if (setActiveMedications) setActiveMedications([]);
              if (setDoctorNotes) setDoctorNotes('');
              if (setInteractions) setInteractions([]);
              if (setAdrs) setAdrs([]);
              if (setLabWarnings) setLabWarnings([]);
          }
      }
  };

  const handleCancelEdit = () => {
    setEditingPlan(null);
    setNote('');
  };
  
  const handleSaveOrUpdateNote = () => {
    if (!localPatientId || !note) {
      alert("Cannot save empty note.");
      return;
    }
    
    setIsLoading(true);
    
    let snapshot;
    if (editingPlan) {
        snapshot = editingPlan.plan_data.snapshot_data; 
    } else {
        snapshot = {
            active_medications: activeMedications,
            interactions: interactions,
            adrs: adrs,
            lab_warnings: labWarnings,
            doctor_notes: doctorNotes
        };
    }

    const planPayload = {
      plan_note: note,
      pharmacist_name: MOCK_PHARMACIST,
      snapshot_data: snapshot 
    };

    if (editingPlan) {
      apiClient.put(`/careplan/${editingPlan.plan_id}`, planPayload)
      .then(response => {
        setPastPlans(pastPlans.map(p => 
          p.plan_id === editingPlan.plan_id ? response.data : p
        ));
        handleCancelEdit(); 
        setIsLoading(false);
        alert("Pharmacotherapy Plan updated!");
      })
      .catch(error => {
        console.error("Error updating plan:", error);
        setIsLoading(false);
      });

    } else {
      apiClient.post(`/careplan/${localPatientId}`, planPayload)
      .then(response => {
        setPastPlans([response.data, ...pastPlans]);
        setNote('');
        setIsLoading(false);
        alert("Pharmacotherapy Plan saved!");

        if(setInteractions) setInteractions([]);
        if(setAdrs) setAdrs([]);
        if(setLabWarnings) setLabWarnings([]);
        if(setActiveMedications) setActiveMedications([]);
        if(setDoctorNotes) setDoctorNotes('');
      })
      .catch(error => {
        console.error("Error saving plan:", error);
        setIsLoading(false);
      });
    }
  };

  const toggleDetails = (planId) => {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(planId);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const groupedPlans = groupPlansByDate(pastPlans);
  const sortedDates = Object.keys(groupedPlans).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="care-plan-container">
      
      <style>{`
        @media print {
            body * { visibility: hidden; }
            #printable-care-plan, #printable-care-plan * { visibility: visible; }
            #printable-care-plan { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 20px; z-index: 9999; }
            @page { size: A4; margin: 1cm; }
        }
        @media screen { #printable-care-plan { display: none; } }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 5px; border: 2px solid #f1f1f1; }
        ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
      `}</style>

      {/* --- PRINT TEMPLATE --- */}
      <div id="printable-care-plan">
        <div style={{borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px'}}>
            <h2 style={{margin: 0, textAlign: 'center'}}>Pharmacotherapy Care Plan</h2>
            <p style={{textAlign: 'center', margin: '5px 0', fontSize: '0.9em', color: '#555'}}>Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '15px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', marginBottom: '20px'}}>
            <div><strong>Patient Name:</strong> {patientProfile?.first_name} {patientProfile?.last_name}</div>
            <div><strong>MRN / ID:</strong> {emrId}</div>
            <div><strong>Age/Sex:</strong> {patientProfile?.age} / {patientProfile?.sex}</div>
            <div><strong>Weight:</strong> {patientProfile?.weight_kg} kg</div>
            <div style={{gridColumn: 'span 2'}}><strong>Allergies:</strong> {patientProfile?.allergies || 'NKA'}</div>
            <div style={{gridColumn: 'span 2'}}><strong>Diagnosis:</strong> {patientProfile?.diagnosis || 'N/A'}</div>
        </div>
        <h4 style={{borderBottom: '1px solid #ccc', paddingBottom: '5px'}}>1. Current Medications</h4>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', marginBottom: '20px'}}>
            <thead>
                <tr style={{borderBottom: '1px solid #000'}}>
                    <th style={{textAlign:'left', padding:'5px'}}>Drug Name</th>
                    <th style={{textAlign:'left', padding:'5px'}}>Dose</th>
                    <th style={{textAlign:'left', padding:'5px'}}>Freq</th>
                    <th style={{textAlign:'left', padding:'5px'}}>Route</th>
                    <th style={{textAlign:'left', padding:'5px'}}>Time</th>
                    <th style={{textAlign:'left', padding:'5px'}}>Instructions</th>
                </tr>
            </thead>
            <tbody>
                {displayMeds.map((med, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                        <td style={{padding:'5px'}}>{med.name} <br/> <span style={{fontSize:'0.8em', color:'#666'}}>({med.brand_name})</span></td>
                        <td style={{padding:'5px'}}>{med.dose}</td>
                        <td style={{padding:'5px'}}>{med.frequency}</td>
                        <td style={{padding:'5px'}}>{med.route} {med.bf_af ? `(${med.bf_af})` : ''}</td>
                        <td style={{padding:'5px'}}>{med.time}</td>
                        <td style={{padding:'5px'}}>{med.instructions}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <h4 style={{borderBottom: '1px solid #ccc', paddingBottom: '5px'}}>2. Doctor's Clinical Notes</h4>
        <div style={{minHeight: '60px', padding: '10px', border: '1px solid #eee', marginBottom: '20px', whiteSpace: 'pre-wrap'}}>{displayDoctorNotes || "No notes provided."}</div>
        <h4 style={{borderBottom: '1px solid #ccc', paddingBottom: '5px'}}>3. Pharmacist's Clinical Note & Intervention</h4>
        <div style={{minHeight: '150px', padding: '10px', border: '1px solid #eee', marginBottom: '40px', whiteSpace: 'pre-wrap'}}>{note || "(Pending entry...)"}</div>
        <div style={{marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9em'}}>
            <div>__________________________<br/><strong>Pharmacist Signature</strong></div>
            <div>__________________________<br/><strong>Date</strong></div>
        </div>
      </div>

      {/* --- EDITOR PANEL --- */}
      <div className="care-plan-editor">
        <h3 style={{borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px'}}>
            {editingPlan ? `Editing Pharmacotherapy Plan #${editingPlan.plan_id}` : 'New Pharmacotherapy Care Plan'}
        </h3>
        
        <div style={{marginBottom: '25px', padding: '0', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', overflow: 'hidden'}}>
            <div style={{padding: '12px 15px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h4 style={{margin: 0, color: '#334155'}}>Current Prescription Context</h4>
                {(displayInteractions.length > 0 || displayLabWarnings.length > 0) && (
                    <div style={{display: 'flex', gap: '10px'}}>
                        {displayInteractions.length > 0 && <span className="severity-badge-small severity-major">{displayInteractions.length} Interactions</span>}
                        {displayLabWarnings.length > 0 && <span className="severity-badge-small severity-moderate">{displayLabWarnings.length} Lab Risks</span>}
                    </div>
                )}
            </div>

            {displayDoctorNotes && (
              <div style={{padding: '15px', backgroundColor: '#fffbeb', borderBottom: '1px solid #e2e8f0'}}>
                <strong style={{color: '#d35400', display: 'block', marginBottom: '5px'}}>Doctor's Clinical Notes:</strong>
                <p style={{margin: 0, color: '#444', fontStyle: 'italic', whiteSpace: 'pre-wrap'}}>{displayDoctorNotes}</p>
              </div>
            )}
            
            {displayMeds.length === 0 ? (
                <div style={{padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic'}}>
                    No prescription data loaded. Please go to 'Prescription' tab to add drugs.
                </div>
            ) : (
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', minWidth: '1200px', fontSize: '0.9rem', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{background: '#f8f9fa', color: '#555', borderBottom: '2px solid #eee'}}>
                                <th style={{width: '40px', padding: '12px 8px', textAlign:'center'}}>S.No</th>
                                <th style={{width: '100px', padding: '12px 8px'}}>Date</th>
                                <th style={{width: '12%', padding: '12px 8px'}}>Brand Name</th>
                                <th style={{width: '16%', padding: '12px 8px'}}>Generic Name</th>
                                <th style={{width: '8%', padding: '12px 8px'}}>Dose</th>
                                <th style={{width: '8%', padding: '12px 8px'}}>Route</th>
                                <th style={{width: '8%', padding: '12px 8px'}}>Freq</th>
                                <th style={{width: '8%', padding: '12px 8px'}}>BF / AF</th>
                                <th style={{width: '10%', padding: '12px 8px'}}>Time</th>
                                <th style={{padding: '12px 8px'}}>Instructions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayMeds.map((med, i) => (
                                <tr key={i} style={{borderBottom: '1px solid #e2e8f0'}}>
                                    <td style={{textAlign: 'center', padding: '10px 8px', color: '#777', verticalAlign: 'top'}}>{i + 1}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{formatDateDDMMYYYY(med.date)}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{med.brand_name || '-'}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top', fontWeight: 'bold', color: '#2c3e50'}}>{med.name || med.generic_name}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{med.dose || '-'}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{med.route || '-'}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{med.frequency || '-'}</td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top', fontWeight: 'bold', color: '#2980b9'}}>
                                        {med.bf_af === 'Before' ? 'Before' : med.bf_af === 'After' ? 'After' : '-'}
                                    </td>
                                    <td style={{padding: '10px 8px', verticalAlign: 'top'}}>{med.time || '-'}</td>
                                    <td style={{padding: '10px 8px', color: '#555', verticalAlign: 'top', whiteSpace: 'pre-wrap'}}>{med.instructions || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        <label style={{fontWeight: '600', marginBottom: '8px', display: 'block', fontSize: '1.1rem'}}>
          Pharmacist's Clinical Note & Intervention:
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter your assessment, identified drug therapy problems, and recommendations here..."
          rows="6"
          style={{width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '1rem'}}
        />
        
        <div className="editor-buttons">
          <button onClick={handlePrint} className="load-btn" style={{backgroundColor: '#8e44ad', marginRight: 'auto'}}>
            🖨 Print Record
          </button>
          
          <button onClick={handleSaveOrUpdateNote} disabled={isLoading} className="save-btn">
            {isLoading ? 'Saving...' : (editingPlan ? 'Update Pharmacotherapy Plan' : 'Save Pharmacotherapy Plan')}
          </button>

          <button 
            onClick={handleDiscardOrDelete} 
            disabled={isLoading} 
            className="delete-btn" 
            style={{
                marginLeft: '10px', 
                backgroundColor: '#e74c3c', 
                color: '#ffffff', 
                minWidth: '120px', 
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
          >
            {editingPlan ? 'Delete Record' : 'Discard Draft'}
          </button>
          
          {editingPlan && (
            <button onClick={handleCancelEdit} disabled={isLoading} className="cancel-btn">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* --- HISTORY PANEL --- */}
      <div className="care-plan-history" style={{ marginTop: '30px' }}>
        <h3>Pharmacotherapy Care Plan History</h3>
        {pastPlans.length === 0 && (
          <p style={{color: '#666', fontStyle: 'italic'}}>No past plans found for this patient.</p>
        )}
        
        <div className="history-list">
          {sortedDates.map(dateKey => (
            <div key={dateKey} style={{marginBottom: '30px'}}>
              <h4 style={{backgroundColor: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', color: '#2c3e50', borderLeft: '5px solid #3498db', margin: '0 0 15px 0'}}>
                {dateKey}
              </h4>

              {groupedPlans[dateKey].map(plan => {
                let noteText = "Note not found.";
                let snapshot = null;
                
                if (plan.plan_data) {
                  if (plan.plan_data.plan_note) {
                    noteText = plan.plan_data.plan_note;
                    snapshot = plan.plan_data.snapshot_data;
                  } else if (plan.plan_data.p) {
                    noteText = plan.plan_data.p;
                  }
                }
                
                const isExpanded = expandedPlanId === plan.plan_id;

                const majorInteractions = snapshot?.interactions?.filter(i => {
                    const s = getSeverityProps(i.severity);
                    return s.class === 'severity-major' || s.class === 'severity-contra';
                }) || [];
                const moderateInteractions = snapshot?.interactions?.filter(i => {
                    const s = getSeverityProps(i.severity);
                    return s.class !== 'severity-major' && s.class !== 'severity-contra';
                }) || [];
                const majorLabs = snapshot?.lab_warnings?.filter(l => getLabSeverity(l).class === 'severity-major') || [];
                const moderateLabs = snapshot?.lab_warnings?.filter(l => getLabSeverity(l).class !== 'severity-major') || [];

                return (
                  <div key={plan.plan_id} className="history-card" style={{marginLeft: '10px', borderLeft: '2px solid #ddd'}}>
                    <div className="history-card-header">
                      <div>
                        <strong style={{fontSize: '1.1em', color: '#2980b9'}}>
                            {getLocalDateObject(plan.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}
                        </strong>
                        <br/>
                        <span style={{fontSize: '0.9em', color: '#555'}}>by {plan.pharmacist_name}</span>
                      </div>
                      
                      {/* --- BUTTONS WITH SPACING --- */}
                      <div className="card-actions" style={{display: 'flex', gap: '10px'}}>
                        <button 
                            onClick={() => handleEditClick(plan)} 
                            className="edit-btn"
                            style={{padding: '6px 12px', minWidth: '60px'}}
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => handleDeleteClick(plan.plan_id)} 
                            className="delete-btn"
                            style={{padding: '6px 12px', minWidth: '60px'}}
                        >
                            Delete
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ padding: '15px 0', fontSize: '1rem', whiteSpace: 'pre-wrap', borderBottom: '1px solid #eee' }}>
                      {noteText}
                    </div>
                    
                    {snapshot && (
                      <div className="snapshot-summary" style={{marginTop: '15px'}}>
                        <ul>
                          <li>{snapshot.active_medications?.length || 0} Meds Reviewed</li>
                          <li>{snapshot.interactions?.length || 0} Interactions ({majorInteractions.length} Major)</li>
                          <li>{snapshot.lab_warnings?.length || 0} Lab Warnings</li>
                        </ul>
                        <button onClick={() => toggleDetails(plan.plan_id)} className="details-btn" style={{ fontWeight: 'bold' }}>
                          {isExpanded ? 'Hide Snapshot' : 'View Clinical Snapshot'}
                        </button>
                      </div>
                    )}
                    
                    {isExpanded && snapshot && (
                        <div className="snapshot-details" style={{marginTop: '15px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                            <h4 style={{marginTop: 0, color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px'}}>Clinical Context (At Time of Note)</h4>
                            {snapshot.doctor_notes && (<div style={{marginBottom: '20px', padding: '10px', backgroundColor: '#fffbeb', border: '1px solid #f0e68c', borderRadius: '4px'}}><strong style={{display: 'block', fontSize: '0.9em', color: '#d35400'}}>Doctor's Notes (Snapshot):</strong><p style={{margin: '5px 0 0 0', fontSize: '0.95em', fontStyle: 'italic'}}>{snapshot.doctor_notes}</p></div>)}
                            <div style={{marginBottom: '25px'}}><strong style={{display: 'block', marginBottom: '8px', color:'#2c3e50'}}>Prescription at Time of Plan:</strong>{snapshot.active_medications?.length > 0 ? (<div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>{snapshot.active_medications.map((med, i) => (<div key={i} style={{fontSize: '0.9em', padding: '6px', background: 'white', border: '1px solid #ddd', borderRadius:'4px'}}><strong>{med.name}</strong> {med.dose && ` - ${med.dose}`} {med.frequency && ` ${med.frequency}`} {med.route && ` (${med.route})`} {med.bf_af === 'Before' && ' [BF]'} {med.bf_af === 'After' && ' [AF]'}</div>))}</div>) : <span style={{color: '#666'}}>No meds recorded.</span>}</div>
                            {/* Detailed Groups Logic */}
                            <div style={{marginBottom: '25px'}}><strong style={{display: 'block', marginBottom: '10px', fontSize:'1.05em'}}>Interactions Detected:</strong>{snapshot.interactions?.length === 0 && <span style={{color: '#666'}}>None detected.</span>}{majorInteractions.length > 0 && (<div style={{marginBottom: '15px'}}><h5 style={{margin: '0 0 8px 0', color: '#c0392b', fontSize: '0.95em'}}>Major / Contraindicated</h5><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>{majorInteractions.map((inter, idx) => { const severity = getSeverityProps(inter.severity); return (<div key={`maj-${idx}`} className={`interaction-card ${severity.class}`} style={{padding: '10px', borderLeftWidth: '5px'}}><span className="severity-badge" style={{fontSize: '0.7em'}}>{severity.text}</span><strong style={{display:'block', marginBottom: '4px'}}>{inter.drug_1_name} & {inter.drug_2_name}</strong><p style={{margin: 0, fontSize: '0.85em', color: '#333'}}>{inter.description}</p></div>); })}</div></div>)}{moderateInteractions.length > 0 && (<div><h5 style={{margin: '0 0 8px 0', color: '#d35400', fontSize: '0.95em'}}>Moderate / Minor</h5><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>{moderateInteractions.map((inter, idx) => { const severity = getSeverityProps(inter.severity); return (<div key={`mod-${idx}`} className={`interaction-card ${severity.class}`} style={{padding: '10px'}}><span className="severity-badge" style={{fontSize: '0.7em'}}>{severity.text}</span><strong style={{display:'block', marginBottom: '4px'}}>{inter.drug_1_name} & {inter.drug_2_name}</strong><p style={{margin: 0, fontSize: '0.85em', color: '#333'}}>{inter.description}</p></div>); })}</div></div>)}</div>
                            <div><strong style={{display: 'block', marginBottom: '10px', fontSize:'1.05em'}}>Drug-Lab Warnings:</strong>{snapshot.lab_warnings?.length === 0 && <span style={{color: '#666'}}>None detected.</span>}{majorLabs.length > 0 && (<div style={{marginBottom: '15px'}}><h5 style={{margin: '0 0 8px 0', color: '#c0392b', fontSize: '0.95em'}}>Major Risk</h5><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>{majorLabs.map((lab, idx) => { const severityProps = getLabSeverity(lab); return (<div key={`ml-${idx}`} className={`interaction-card ${severityProps.class}`} style={{padding: '10px', borderLeftWidth: '5px'}}><span className="severity-badge" style={{fontSize: '0.7em'}}>{severityProps.label}</span><strong style={{display:'block', marginBottom: '4px'}}>{lab.drug_name} ({lab.lab_test_name})</strong><p style={{margin: 0, fontSize: '0.85em', color: '#333'}}>{lab.description}</p></div>); })}</div></div>)}{moderateLabs.length > 0 && (<div><h5 style={{margin: '0 0 8px 0', color: '#d35400', fontSize: '0.95em'}}>Moderate Risk</h5><div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>{moderateLabs.map((lab, idx) => { const severityProps = getLabSeverity(lab); return (<div key={`mol-${idx}`} className={`interaction-card ${severityProps.class}`} style={{padding: '10px'}}><span className="severity-badge" style={{fontSize: '0.7em'}}>{severityProps.label}</span><strong style={{display:'block', marginBottom: '4px'}}>{lab.drug_name} ({lab.lab_test_name})</strong><p style={{margin: 0, fontSize: '0.85em', color: '#333'}}>{lab.description}</p></div>); })}</div></div>)}</div>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CarePlan;