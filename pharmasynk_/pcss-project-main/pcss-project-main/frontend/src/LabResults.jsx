import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

// --- 1. DEFINE ALL FIELDS ---
const LAB_SECTIONS = {
  hematology: {
    title: "Hematology",
    fields: [
      { key: 'rbc', label: 'RBC', normal: '4.5-5.5 x10^3/µL' },
      { key: 'wbc', label: 'WBC', normal: '4-11 x10^3/µL' },
      { key: 'dlc', label: 'DLC (N/L/M/EB)', normal: '' },
      { key: 'platelets', label: 'Platelets', normal: '150-400 x10^3/µL' },
      { key: 'hb', label: 'Hb', normal: '13-17 g/dl' },
      { key: 'pcv_hct', label: 'PCV/HCT', normal: '40-50%' },
      { key: 'mcv', label: 'MCV', normal: '80-100 Fl' },
      { key: 'mch', label: 'MCH', normal: '27-32 PG' },
      { key: 'esr', label: 'ESR', normal: '3-10mm' },
    ]
  },
  urine: {
    title: "Urine Routine",
    fields: [
      { key: 'u_colour', label: 'Colour', normal: '' },
      { key: 'u_sg', label: 'S.Gravity', normal: '' },
      { key: 'u_glucose', label: 'Glucose/Xylose', normal: '' },
      { key: 'u_ketones', label: 'Ketones', normal: '' },
      { key: 'u_proteins', label: 'Proteins', normal: '' },
      { key: 'u_rbc', label: 'RBC', normal: '' },
      { key: 'u_wbc', label: 'WBC', normal: '' },
      { key: 'u_epithelial', label: 'Epithelial Cells', normal: '' },
      { key: 'u_pus', label: 'Pus Cells', normal: '' },
      { key: 'u_casts', label: 'Casts/Crystals/Bacteria', normal: '' },
      { key: 'u_blood', label: 'Blood Myoglobin', normal: '' },
    ]
  },
  plasma: {
    title: "Plasma",
    fields: [
      { key: 'aptt', label: 'APTT', normal: '' },
      { key: 'pt_inr', label: 'PT Test / INR', normal: '11-15 Sec' },
    ]
  },
  stool: {
    title: "Stool",
    fields: [
      { key: 's_occult', label: 'Occult Blood', normal: '' },
      { key: 's_fat', label: 'Fat Globules', normal: '' },
      { key: 's_culture', label: 'Stool Cultures', normal: '' },
    ]
  },
  lipid: {
    title: "Lipid Profile",
    fields: [
      { key: 'chol_tot', label: 'T.Cholesterol', normal: '< 200 mg/dl' },
      { key: 'tg', label: 'TG', normal: '< 150 mg/dl' },
      { key: 'ldl', label: 'LDL', normal: '< 130 mg/dl' },
      { key: 'hdl', label: 'HDL', normal: '> 40 mg/dl' },
    ]
  },
  biochem: {
    title: "Clinical Biochemistry",
    fields: [
      { key: 'fbs', label: 'FBS', normal: '70-110 mg/dl' },
      { key: 'rbs', label: 'RBS', normal: '70-149 mg/dl' },
      { key: 'glycosyl_hb', label: 'Glycosyl.Hb', normal: '3.8-6.3 %' },
      { key: 'urea', label: 'Urea', normal: '14-40 mg/dl' },
      { key: 'creatinine', label: 'Creatinine', normal: '0.8 – 1.25 mg/dl' },
      { key: 'uric_acid', label: 'Uric Acid', normal: '2-7 mg/dl' },
      { key: 'sodium', label: 'Sodium', normal: '135-145 mEq/L' },
      { key: 'potassium', label: 'Potassium', normal: '3.5-4.5 mEq/L' },
      { key: 'bicarbonate', label: 'Bicarbonate', normal: '20-25 mEq/L' },
      { key: 'chloride', label: 'Chloride', normal: '96-106 mEq/L' },
      { key: 'calcium', label: 'Tot.Calcium', normal: '8.8-10.2 mg/dl' },
      { key: 'protein_tot', label: 'Tot.Proteins', normal: '6.4-8.3 g/dl' },
      { key: 'albumin', label: 'Albumin', normal: '3.4-4.8 g/dl' },
      { key: 'globulin', label: 'Globulin', normal: '1.8-3.6 g/dl' },
      { key: 'bili_t', label: 'T.Bilirubin', normal: '0.2-1.0 mg/dl' },
      { key: 'bili_d', label: 'D.Bilirubin', normal: '0-0.2 mg/dl' },
      { key: 'bili_ind', label: 'Ind.Bilirubin', normal: '0.2-0.8 mg/dl' },
      { key: 'ast_sgot', label: 'AST/SGOT', normal: '5-38 U/L' },
      { key: 'alt_sgpt', label: 'ALT/SGPT', normal: '5-41 U/L' },
      { key: 'alp', label: 'ALP', normal: '40-129 U/L' },
      { key: 'ggt', label: 'GGT', normal: '10-66 U/L' },
      { key: 'ldh', label: 'LDH', normal: '135-214 U/L' },
      { key: 'ck_total', label: 'CK Total', normal: '39-308 U/L' },
      { key: 'ck_mb', label: 'CK MB', normal: '4.94-6.73 ng/ml' },
      { key: 'troponin_t', label: 'Troponin-T', normal: '< 14 pg/ml' },
      { key: 'crp', label: 'CRP', normal: '0.5 mg/L' },
      { key: 'tsh', label: 'TSH', normal: '0.27-4.2 µIU/ml' },
      { key: 't3', label: 'T3', normal: '0.84-2.02 ng/dl' },
      { key: 'ft3', label: 'FT3', normal: '2.0-4.4 pg/dl' },
      { key: 'ft4', label: 'FT4', normal: '0.93-1.71 ng/dl' },
      { key: 'tibc', label: 'Sr.TIBC', normal: '250-450 pg/zdl' },
      { key: 'folate', label: 'Sr.Folate', normal: '3.1-17.5 ng/ml' },
      { key: 'procalcitonin', label: 'Procalcitonin', normal: '< 0.5 ng/ml' },
    ]
  }
};

const DB_TO_FORM_MAP = {
  'Potassium': ['potassium'],
  'Sodium': ['sodium'],
  'Chloride': ['chloride'],
  'Creatinine': ['creatinine'],
  'Urea': ['urea'],
  'AST/SGOT': ['ast_sgot'],
  'ALT/SGPT': ['alt_sgpt'],
  'T.Bilirubin': ['bili_t'],
  'ALP': ['alp'],
  'Platelets': ['platelets'],
  'WBC': ['wbc'],
  'Hb': ['hb'],
  'FBS': ['fbs', 'rbs'], 
  'CK Total': ['ck_total']
};

const getLabSeverity = (warning) => {
  const text = (warning.description + ' ' + warning.lab_test_name).toLowerCase();
  if (
    text.includes('failure') || 
    text.includes('toxicity') || 
    text.includes('nephrotoxic') || 
    text.includes('hepatotoxic') || 
    text.includes('rhabdomyolysis') || 
    text.includes('severe') ||
    text.includes('pancytopenia')
  ) {
    return { class: 'severity-major', label: 'Major Risk' };
  }
  return { class: 'severity-moderate', label: 'Moderate Risk' };
};

const generateDefaultState = () => {
  const state = {};
  Object.values(LAB_SECTIONS).forEach(section => {
    section.fields.forEach(field => state[field.key] = '');
  });
  return state;
};

function LabResults({ localPatientId, activeMedications, labWarnings, setLabWarnings }) {
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [labValues, setLabValues] = useState(generateDefaultState());
  const [pastLabPanels, setPastLabPanels] = useState([]);
  const [editingPanel, setEditingPanel] = useState(null);

  const handleLabChange = (e) => {
    setLabValues({ ...labValues, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const checkLabWarnings = async () => {
      if (activeMedications.length === 0) {
        setLabWarnings([]);
        return;
      }
      setIsLoading(true);
      const drugbank_ids = activeMedications.map(d => d.drugbank_id);
      try {
        const response = await apiClient.post('/check-lab-relations', { drugbank_ids });
        setLabWarnings(response.data);
      } catch (error) { console.error("Error checking lab relations:", error); }
      setIsLoading(false);
    };
    checkLabWarnings();
  }, [activeMedications, setLabWarnings]);

  useEffect(() => {
    if (localPatientId) loadHistory();
  }, [localPatientId]);

  const loadHistory = () => {
    apiClient.get(`/patient/${localPatientId}/labs`)
      .then(response => setPastLabPanels(response.data))
      .catch(error => console.error("Error fetching lab panels:", error));
  };

  const handleEditClick = (panel) => {
    setEditingPanel(panel);
    setLabValues({ ...generateDefaultState(), ...panel.lab_data });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (panelId) => {
    if (window.confirm("Delete this lab panel?")) {
      apiClient.delete(`/labs/${panelId}`)
        .then(() => setPastLabPanels(pastLabPanels.filter(p => p.lab_panel_id !== panelId)));
    }
  };

  const handleCancelEdit = () => {
    setEditingPanel(null);
    setLabValues(generateDefaultState());
  };

  const handleSaveOrUpdateLabs = () => {
    setIsSaving(true);
    const apiCall = editingPanel 
      ? apiClient.put(`/labs/${editingPanel.lab_panel_id}`, { lab_data: labValues })
      : apiClient.post(`/patient/${localPatientId}/labs`, { lab_data: labValues });

    apiCall.then(res => {
      alert(editingPanel ? "Lab panel updated!" : "Lab panel saved!");
      loadHistory();
      handleCancelEdit();
      setIsSaving(false);
    }).catch(err => { console.error(err); setIsSaving(false); });
  };

  const isAbnormal = (key, value) => {
    if (!value) return false;
    const val = parseFloat(value);
    switch (key) {
      case 'potassium': return val < 3.5 || val > 4.5;
      case 'sodium': return val < 135 || val > 145;
      case 'chloride': return val < 96 || val > 106;
      case 'creatinine': return val < 0.8 || val > 1.25;
      case 'urea': return val < 14 || val > 40;
      case 'platelets': return val < 150 || val > 400;
      case 'wbc': return val < 4 || val > 11;
      case 'hb': return val < 13 || val > 17;
      case 'ast_sgot': return val < 5 || val > 38;
      case 'alt_sgpt': return val < 5 || val > 41;
      case 'fbs': return val < 70 || val > 110;
      case 'rbs': return val < 70 || val > 149;
      case 'bili_t': return val < 0.2 || val > 1.0;
      case 'alp': return val < 40 || val > 129;
      case 'ck_total': return val < 39 || val > 308;
      default: return false;
    }
  };

  const isWarningRelevant = (warning) => {
    const relevantKeys = DB_TO_FORM_MAP[warning.lab_test_name] || [];
    return relevantKeys.some(key => isAbnormal(key, labValues[key]));
  };

  const majorWarnings = [];
  const moderateWarnings = [];

  labWarnings.forEach(warning => {
    const severity = getLabSeverity(warning);
    const enhancedWarning = { ...warning, ...severity };
    if (severity.class === 'severity-major') {
      majorWarnings.push(enhancedWarning);
    } else {
      moderateWarnings.push(enhancedWarning);
    }
  });

  return (
    <div className="lab-results-container">
      <div className="lab-input-panel">
        <h3 style={{marginTop: 0}}>
          {editingPanel ? `Editing Lab Panel (Saved: ${new Date(editingPanel.created_at).toLocaleDateString()})` : 'New Lab Entry'}
        </h3>

        {Object.entries(LAB_SECTIONS).map(([sectionKey, sectionData]) => (
          <div className="lab-section" key={sectionKey}>
            <h3>{sectionData.title}</h3>
            <div className="lab-grid">
              {sectionData.fields.map((field) => {
                const abnormal = isAbnormal(field.key, labValues[field.key]);
                
                const isFieldRelevant = labWarnings.some(w => {
                  const keys = DB_TO_FORM_MAP[w.lab_test_name] || [];
                  return keys.includes(field.key);
                });

                return (
                  <div className="lab-input-group" key={field.key}>
                    <label className={abnormal ? 'abnormal-lab' : ''}>
                      {field.label} 
                      {field.normal && <span style={{fontSize: '0.8em', fontWeight: 'normal', color: '#666', marginLeft: '5px'}}>({field.normal})</span>}
                    </label>
                    <input 
                      type="text" 
                      name={field.key} 
                      value={labValues[field.key]} 
                      onChange={handleLabChange}
                      className={isFieldRelevant && abnormal ? 'relevant-warning-input' : ''}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        <div className="editor-buttons">
          <button onClick={handleSaveOrUpdateLabs} disabled={isSaving} className="save-btn">
            {isSaving ? 'Saving...' : (editingPanel ? 'Update Lab Panel' : 'Save Lab Panel')}
          </button>
          {editingPanel && <button onClick={handleCancelEdit} className="cancel-btn">Cancel Edit</button>}
        </div>

        <div className="lab-history-panel">
          <h3>Past Lab Results</h3>
          <div className="history-list">
            {pastLabPanels.map(panel => {
                const abnormals = [];
                Object.entries(panel.lab_data).forEach(([key, val]) => {
                    if(isAbnormal(key, val)) {
                        abnormals.push(`${key}: ${val}`);
                    }
                });
                
                return (
                  <div key={panel.lab_panel_id} className="history-card">
                    <div className="history-card-header">
                      <strong>Date: {new Date(panel.created_at).toLocaleDateString()}</strong>
                      
                      {/* --- BUTTONS WITH SPACING --- */}
                      <div className="card-actions" style={{display: 'flex', gap: '10px'}}>
                        <button 
                            onClick={() => handleEditClick(panel)} 
                            className="edit-btn"
                            style={{padding: '6px 12px', minWidth: '60px'}}
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => handleDeleteClick(panel.lab_panel_id)} 
                            className="delete-btn"
                            style={{padding: '6px 12px', minWidth: '60px'}}
                        >
                            Delete
                        </button>
                      </div>
                    </div>
                    
                    <div style={{marginTop: '8px', fontSize: '0.9em', color: '#666'}}>
                        {abnormals.length > 0 ? (
                            <span style={{color: '#d9534f'}}>
                                <strong>Abnormal:</strong> {abnormals.join(', ')}
                            </span>
                        ) : (
                            <span style={{color: '#28a745'}}>All values within normal range.</span>
                        )}
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
      </div>

      <div className="interaction-panel">
        <h3>Drug-Lab Decision Support</h3>
        {isLoading && <p>Checking...</p>}
        <div className="interaction-results">
          {labWarnings.length === 0 && !isLoading && (
            <p className="no-interactions">No known drug-lab relations found.</p>
          )}

          {majorWarnings.length > 0 && (
            <div className="interaction-group group-major">
              <h4 className="group-title">Major Risks</h4>
              {majorWarnings.map((warning, index) => {
                const relevant = isWarningRelevant(warning);
                return (
                  <div key={`major-${index}`} className={`interaction-card ${warning.class} ${relevant ? 'relevant-warning' : ''}`}>
                    <span className="severity-badge">{warning.label}</span>
                    <strong>{warning.drug_name}</strong>
                    <p>
                      <strong>Test:</strong> {warning.lab_test_name}<br/>
                      <strong>Effect:</strong> {warning.effect}<br/>
                      {warning.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {moderateWarnings.length > 0 && (
            <div className="interaction-group group-moderate">
              <h4 className="group-title">Moderate Risks</h4>
              {moderateWarnings.map((warning, index) => {
                const relevant = isWarningRelevant(warning);
                return (
                  <div key={`mod-${index}`} className={`interaction-card ${warning.class} ${relevant ? 'relevant-warning' : ''}`}>
                    <span className="severity-badge">{warning.label}</span>
                    <strong>{warning.drug_name}</strong>
                    <p>
                      <strong>Test:</strong> {warning.lab_test_name}<br/>
                      <strong>Effect:</strong> {warning.effect}<br/>
                      {warning.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LabResults;