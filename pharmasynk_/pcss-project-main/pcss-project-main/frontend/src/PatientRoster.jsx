import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

function PatientRoster({ onPatientSelect }) {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Patient Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '', last_name: '', age: '', sex: '', emr_patient_id: '' 
  });

  // Pinned Patients State
  const [pinnedPatientIds, setPinnedPatientIds] = useState(() => {
    try {
      const saved = localStorage.getItem('pinnedPatients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    localStorage.setItem('pinnedPatients', JSON.stringify(pinnedPatientIds));
  }, [pinnedPatientIds]);

  const loadPatients = () => {
    apiClient.get('/patients')
      .then(response => {
        if (Array.isArray(response.data)) {
          setPatients(response.data);
        } else {
          setPatients([]);
        }
      })
      .catch(error => console.error(error));
  };

  const handleInputChange = (e) => {
    setNewPatient({ ...newPatient, [e.target.name]: e.target.value });
  };

  const handleCreatePatient = () => {
    if (!newPatient.first_name || !newPatient.last_name || !newPatient.emr_patient_id) {
        alert("Please fill in Name and IP/OP Number");
        return;
    }
    
    // Payload matching the Pydantic Model
    const payload = {
        first_name: newPatient.first_name,
        last_name: newPatient.last_name,
        age: parseInt(newPatient.age) || 0,
        sex: newPatient.sex || 'Unknown',
        emr_id: newPatient.emr_patient_id 
    };

    apiClient.post('/patients', payload)
      .then(() => {
        loadPatients();
        setShowAddForm(false);
        setNewPatient({ first_name: '', last_name: '', age: '', sex: '', emr_patient_id: '' });
      })
      .catch(err => {
          console.error(err);
          alert("Error creating patient. IP Number might already exist.");
      });
  };

  const handleDeletePatient = (id) => {
    if (window.confirm("Are you sure you want to completely remove this patient from the database?")) {
      apiClient.delete(`/patients/${id}`)
        .then(() => {
          loadPatients();
          if (pinnedPatientIds.includes(id)) {
            setPinnedPatientIds(pinnedPatientIds.filter(pid => pid !== id));
          }
        })
        .catch(err => console.error(err));
    }
  };

  const togglePin = (patientId) => {
    if (pinnedPatientIds.includes(patientId)) {
      setPinnedPatientIds(pinnedPatientIds.filter(id => id !== patientId));
    } else {
      setPinnedPatientIds([...pinnedPatientIds, patientId]);
    }
  };

  const handleExport = () => {
    apiClient.get('/export/patients/csv', { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Patient_Roster_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((error) => console.error("Export failed:", error));
  };

  // --- FILTER LOGIC ---
  const filteredPatients = patients.filter(p => {
    if (!p) return false; 
    const firstName = (p.first_name || '').toLowerCase();
    const lastName = (p.last_name || '').toLowerCase();
    const emrId = (p.emr_patient_id || p.emr_id || '').toLowerCase(); 
    const term = searchTerm.toLowerCase();
    return (firstName + ' ' + lastName).includes(term) || emrId.includes(term);
  });

  const pinnedList = filteredPatients.filter(p => pinnedPatientIds.includes(p.patient_id));
  const unpinnedList = filteredPatients.filter(p => !pinnedPatientIds.includes(p.patient_id));

  return (
    <div className="roster-dashboard-modern">
      {/* HEADER SECTION */}
      <div className="roster-hero-header">
        <div className="hero-title-group">
          <div className="hero-icon">👥</div>
          <div>
            <h1>Clinical Patient Roster</h1>
            <p>Manage and access longitudinal electronic medical records.</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn-secondary" onClick={handleExport}>📥 Export CSV</button>
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '✕ Cancel Entry' : '➕ Register New Patient'}
          </button>
        </div>
      </div>

      {/* ADD PATIENT WIDGET */}
      {showAddForm && (
        <div className="roster-add-widget">
          <div className="widget-header">
            <h3>New Patient Registration</h3>
            <p>Enter the demographic details to instantiate a new medical record.</p>
          </div>
          <div className="widget-form-grid">
            <div className="widget-input-wrapper">
              <label>First Name</label>
              <input name="first_name" placeholder="John..." value={newPatient.first_name} onChange={handleInputChange} />
            </div>
            <div className="widget-input-wrapper">
              <label>Last Name</label>
              <input name="last_name" placeholder="Doe..." value={newPatient.last_name} onChange={handleInputChange} />
            </div>
            <div className="widget-input-wrapper">
              <label>Age</label>
              <input name="age" type="number" placeholder="Years..." value={newPatient.age} onChange={handleInputChange} />
            </div>
            <div className="widget-input-wrapper">
              <label>Sex</label>
              <select name="sex" value={newPatient.sex} onChange={handleInputChange}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="widget-input-wrapper">
              <label>EMR / IP / OP Number <span className="req">*</span></label>
              <input name="emr_patient_id" placeholder="e.g. EMR-1001" value={newPatient.emr_patient_id} onChange={handleInputChange} />
            </div>
          </div>
          <div className="widget-footer">
            <button className="btn-success" onClick={handleCreatePatient}>💾 Save & Register Patient</button>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTER BAR */}
      <div className="roster-search-bar-modern">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Lookup patient by Name or exact EMR Number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="patient-count-badge">
          {filteredPatients.length} Patients Found
        </div>
      </div>

      {/* MAIN GRID LAYOUT */}
      <div className="roster-main-grid">
        
        {/* TABLE SECTION */}
        <div className="roster-table-wrapper">
          <table className="roster-table-modern">
            <thead>
              <tr>
                <th style={{width: '60px', textAlign: 'center'}}>Pin</th>
                <th>Patient Name</th>
                <th>Demographics</th>
                <th>Record ID</th>
                <th>Admission</th>
                <th style={{textAlign: 'right', paddingRight: '20px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {[...pinnedList, ...unpinnedList].map((patient) => {
                const isPinned = pinnedPatientIds.includes(patient.patient_id);
                const displayIP = patient.emr_patient_id || patient.emr_id || 'N/A';
                
                return (
                  <tr key={patient.patient_id} className={isPinned ? 'pinned-row-highlight' : ''}>
                    <td style={{textAlign: 'center'}}>
                      <button className={`star-btn ${isPinned ? 'active' : ''}`} onClick={() => togglePin(patient.patient_id)} title={isPinned ? "Unpin Patient" : "Pin Patient"}>
                        {isPinned ? '⭐' : '☆'}
                      </button>
                    </td>
                    <td className="patient-name-cell">
                      <strong>{patient.first_name} {patient.last_name}</strong>
                    </td>
                    <td className="demographics-cell">
                      <span className="demo-badge">{patient.age} Yrs</span>
                      <span className="demo-badge">{patient.sex}</span>
                    </td>
                    <td className="id-cell">
                      <span className="id-badge">{displayIP}</span>
                    </td>
                    <td className="date-cell">
                      {patient.admission_date || 'Not Admitted'}
                    </td>
                    <td style={{textAlign: 'right', paddingRight: '15px'}}>
                      <div className="row-actions">
                        <button className="btn-open-record" onClick={() => onPatientSelect(patient)}>
                          Open Chart ➔
                        </button>
                        <button className="btn-delete-record" onClick={() => handleDeletePatient(patient.patient_id)} title="Delete Record">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state-cell">
                    <div className="empty-state-content">
                      <span className="empty-icon">📂</span>
                      <p>No patients matched your search.</p>
                      <span className="empty-sub">Try searching by a different name or EMR number.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PINNED SIDEBAR */}
        <div className="roster-sidebar-premium">
          <div className="sidebar-header">
            <h3>⭐ Pinned Ward</h3>
            <span className="badge">{pinnedList.length}</span>
          </div>
          
          <div className="sidebar-content">
            {pinnedList.length === 0 ? (
               <div className="sidebar-empty">
                 <p>Star a patient in the roster to pin them here for immediate access.</p>
               </div>
            ) : (
               <div className="pinned-cards-list">
                 {pinnedList.map(p => (
                   <div key={p.patient_id} className="premium-pinned-card">
                     <div className="card-top">
                       <strong>{p.first_name} {p.last_name}</strong>
                       <button className="btn-unpin-minimal" onClick={() => togglePin(p.patient_id)}>✕</button>
                     </div>
                     <div className="card-mid">
                       <span className="id-pill">{p.emr_patient_id || p.emr_id}</span>
                       <span className="demo-text">{p.age} Y • {p.sex}</span>
                     </div>
                     <button className="btn-open-full" onClick={() => onPatientSelect(p)}>
                       Open EMR Chart
                     </button>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientRoster;