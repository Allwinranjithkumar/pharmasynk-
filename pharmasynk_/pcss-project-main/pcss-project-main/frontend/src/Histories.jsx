import React, { useState } from 'react';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

function Histories({ localPatientId, formData, setFormData }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      social_history: { ...prev.social_history, [name]: value }
    }));
  };

  const handleSave = () => {
    setIsLoading(true);
    apiClient.put(`/patient/${localPatientId}/history`, formData)
      .then(response => {
        setIsLoading(false);
        alert("History saved successfully!");
      })
      .catch(error => {
        console.error("Error saving history:", error);
        setIsLoading(false);
      });
  };

  return (
    <div className="histories-dashboard">
      <div className="histories-header">
        <div>
          <h2>Patient Histories & Documentation</h2>
          <p>Record comprehensive medical, family, and social background.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isLoading} 
          className="save-btn action-save-btn"
        >
          {isLoading ? 'Saving...' : '💾 Save All Histories'}
        </button>
      </div>

      <div className="histories-grid">
        
        {/* Left Column: Medical History */}
        <div className="history-card-main">
          <div className="history-card-header">
            <h3>🏥 Clinical & Medical History</h3>
          </div>
          <div className="history-card-body">
            
            <div className="form-group-premium">
              <label>Complaints on Admission / Medical History</label>
              <textarea 
                name="medical_history" 
                value={formData.medical_history} 
                onChange={handleChange} 
                rows="4"
                placeholder="Detail the primary complaints and past medical conditions..."
              />
            </div>
            
            <div className="form-group-premium">
              <label>Medication History</label>
              <textarea 
                name="medication_history" 
                value={formData.medication_history} 
                onChange={handleChange} 
                rows="3"
                placeholder="List previous and current medications before admission..."
              />
            </div>
            
            <div className="form-group-premium">
              <label>Family History</label>
              <textarea 
                name="family_history" 
                value={formData.family_history} 
                onChange={handleChange} 
                rows="3"
                placeholder="Relevant hereditary conditions (e.g., Diabetes, Hypertension)..."
              />
            </div>
            
            <div className="form-group-premium allergy-group">
              <label>⚠️ Drug/Food & Other Allergies</label>
              <textarea 
                name="allergies" 
                value={formData.allergies} 
                onChange={handleChange} 
                rows="2"
                placeholder="List any known allergies to medications or food..."
              />
            </div>

          </div>
        </div>

        {/* Right Column: Social History */}
        <div className="history-card-side">
          <div className="history-card-header">
            <h3>👤 Social & Lifestyle</h3>
          </div>
          <div className="history-card-body social-form-grid">
            
            <div className="form-group-premium">
              <label>Alcohol Consumption</label>
              <select name="alcohol" value={formData.social_history.alcohol} onChange={handleSocialChange}>
                <option value="N">No</option>
                <option value="Y">Yes</option>
                <option value="Ex">Ex-alcoholic</option>
              </select>
            </div>
            
            <div className="form-group-premium">
              <label>Smoking Habit</label>
              <select name="smoker" value={formData.social_history.smoker} onChange={handleSocialChange}>
                <option value="N">No</option>
                <option value="Y">Yes</option>
                <option value="Ex">Ex-smoker</option>
              </select>
            </div>
            
            <div className="form-group-premium">
              <label>Dietary Preference</label>
              <select name="diet" value={formData.social_history.diet} onChange={handleSocialChange}>
                <option value="veg">Vegetarian</option>
                <option value="non-veg">Non-Vegetarian</option>
              </select>
            </div>
            
            <div className="form-group-premium">
              <label>Occupation</label>
              <input 
                type="text" 
                name="occupation" 
                value={formData.social_history.occupation} 
                onChange={handleSocialChange} 
                placeholder="e.g., Software Engineer"
              />
            </div>

          </div>

          <div className="history-info-box">
             <h4>Why is this important?</h4>
             <p>Social history like smoking and alcohol consumption can drastically alter drug metabolism and increase the risk of adverse reactions (e.g. hepatotoxicity).</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Histories;