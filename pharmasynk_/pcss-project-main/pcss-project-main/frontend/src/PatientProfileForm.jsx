import React, { useState } from 'react';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

// --- FORCE WHITE STYLES ---
const cleanInputStyle = {
    width: '100%',
    backgroundColor: '#ffffff', 
    color: '#333333', 
    border: '1px solid #ccc', 
    padding: '8px 10px', 
    borderRadius: '4px',
    fontSize: '1rem',
    fontFamily: 'inherit'
};

function PatientProfileForm({ patient, setPatient, localPatientId }) {
  const [isSaving, setIsSaving] = useState(false);

  // Handle Input Changes
  const handleChange = (e) => {
    setPatient({ ...patient, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!localPatientId) return;
    setIsSaving(true);
    
    apiClient.put(`/patient/${localPatientId}/profile`, patient)
      .then(() => {
        alert("Patient Profile Updated!");
        setIsSaving(false);
      })
      .catch(err => {
        console.error(err);
        setIsSaving(false);
      });
  };

  if (!patient) return <div>Loading...</div>;

  return (
    <div className="profile-form-container">
      <h3>Patient Demographics</h3>
      
      <div className="form-grid">
        <div className="form-group">
          <label>First Name:</label>
          <input 
            name="first_name" 
            value={patient.first_name || ''} 
            onChange={handleChange} 
            style={cleanInputStyle} // Applied Fix
          />
        </div>
        
        <div className="form-group">
          <label>Last Name:</label>
          <input 
            name="last_name" 
            value={patient.last_name || ''} 
            onChange={handleChange} 
            style={cleanInputStyle} // Applied Fix
          />
        </div>

        <div className="form-group">
          <label>Age (Years):</label>
          <input 
            name="age" 
            type="number" 
            value={patient.age || ''} 
            onChange={handleChange} 
            style={cleanInputStyle} 
          />
        </div>

        <div className="form-group">
          <label>Sex / Gender:</label>
          <select 
            name="sex" 
            value={patient.sex || ''} 
            onChange={handleChange}
            style={cleanInputStyle}
          >
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group full-width">
          <label>Weight (kg):</label>
          <input 
            name="weight_kg" 
            type="number" 
            value={patient.weight_kg || ''} 
            onChange={handleChange} 
            style={cleanInputStyle} 
          />
        </div>

        <div className="form-group full-width">
          <label style={{color: '#2c3e50', fontWeight: 'bold'}}>Diagnosis (Primary & Secondary):</label>
          <textarea 
            name="diagnosis" 
            value={patient.diagnosis || ''} 
            onChange={handleChange} 
            rows="3" 
            placeholder="e.g. Hypertension, Type 2 Diabetes Mellitus, CKD Stage 3..."
            style={{...cleanInputStyle, borderColor: '#3498db'}} 
          />
        </div>

        <div className="form-group full-width">
          <label>Allergies:</label>
          <textarea 
            name="allergies" 
            value={patient.allergies || ''} 
            onChange={handleChange} 
            rows="2" 
            placeholder="Enter known drug/food allergies..."
            style={cleanInputStyle}
          />
        </div>
      </div>

      <button className="save-btn" onClick={handleSave} disabled={isSaving} style={{marginTop: '20px'}}>
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}

export default PatientProfileForm;