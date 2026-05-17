import React, { useState, useEffect } from 'react';
import './App.css';
import PatientRoster from './PatientRoster';
import Prescription from './Prescription';
import MedicationReview from './MedicationReview';
import LabResults from './LabResults';
import Histories from './Histories';
import CarePlan from './CarePlan';
import PatientProfileForm from './PatientProfileForm';
import DischargeSummary from './DischargeSummary';
import axios from 'axios';
// --- 1. IMPORT NEW COMPONENT ---
import Monograph from './Monograph';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

const createEmptyPrescriptionRow = () => ({
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

const defaultHistoryState = {
  medical_history: '', medication_history: '', family_history: '', allergies: '',
  social_history: { alcohol: 'N', smoker: 'N', diet: 'veg', occupation: '' }
};

const defaultPatientState = {
  first_name: '', last_name: '', age: '', sex: '', weight_kg: '', allergies: '', diagnosis: ''
};

function App() {
  const [patientLoaded, setPatientLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedEmrId, setLoadedEmrId] = useState('');

  const [localPatientId, setLocalPatientId] = useState(null);
  const [patient, setPatient] = useState(defaultPatientState);
  
  const [activeMedications, setActiveMedications] = useState([]);
  const [historyFormData, setHistoryFormData] = useState(defaultHistoryState);
  const [pastPlans, setPastPlans] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [adrs, setAdrs] = useState([]);
  const [labWarnings, setLabWarnings] = useState([]);

  const [prescriptionRows, setPrescriptionRows] = useState([createEmptyPrescriptionRow()]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState(null);

  const [activeTab, setActiveTab] = useState('profile');

  const handleLoadPatient = (selectedPatient) => {
    const emrId = selectedPatient.emr_patient_id || selectedPatient.emr_id;
    if (!emrId) {
        alert("Error loading patient: Missing ID");
        return;
    }

    setIsLoading(true);
    setLoadedEmrId(emrId);

    apiClient.get(`/patient/${emrId}`)
      .then(response => {
        const { patient_id, profile, history_data, social_data } = response.data;
        
        setLocalPatientId(patient_id);
        setPatient(profile || defaultPatientState);
        
        setPrescriptionRows([createEmptyPrescriptionRow()]);
        setPrescriptionNotes('');
        setCurrentPrescriptionId(null);

        if (history_data || social_data) {
          setHistoryFormData({
            medical_history: history_data?.medical_history || '',
            medication_history: history_data?.medication_history || '',
            family_history: history_data?.family_history || '',
            allergies: history_data?.allergies || '',
            social_history: {
              alcohol: social_data?.alcohol || 'N',
              smoker: social_data?.smoker || 'N',
              diet: social_data?.diet || 'veg',
              occupation: social_data?.occupation || ''
            }
          });
        } else {
          setHistoryFormData(defaultHistoryState);
        }
        
        return apiClient.get(`/careplans/${patient_id}`);
      })
      .then(response => {
        setPastPlans(response.data || []);
        setActiveMedications([]); 
        setInteractions([]);
        setAdrs([]);
        setLabWarnings([]);
        setIsLoading(false);
        setPatientLoaded(true);
        setActiveTab('profile'); 
      })
      .catch(error => {
        console.error("Error loading patient:", error);
        alert("Failed to load patient data.");
        setIsLoading(false);
      });
  };

  const handleUnloadPatient = () => {
    setPatientLoaded(false);
    setLoadedEmrId('');
    setLocalPatientId(null);
    setPatient(defaultPatientState);
    setActiveMedications([]);
    setInteractions([]);
    setAdrs([]);
    setLabWarnings([]);
    setPastPlans([]);
    setHistoryFormData(defaultHistoryState);
    
    setPrescriptionRows([createEmptyPrescriptionRow()]);
    setPrescriptionNotes('');
    setCurrentPrescriptionId(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <PatientProfileForm patient={patient} setPatient={setPatient} localPatientId={localPatientId} />;
      
      case 'prescription':
        return <Prescription 
                  localPatientId={localPatientId} 
                  setActiveTab={setActiveTab} 
                  setActiveMedications={setActiveMedications}
                  rows={prescriptionRows}
                  setRows={setPrescriptionRows}
                  doctorNotes={prescriptionNotes}
                  setDoctorNotes={setPrescriptionNotes}
                  currentPrescriptionId={currentPrescriptionId}
                  setCurrentPrescriptionId={setCurrentPrescriptionId}
                  setInteractions={setInteractions}
                  setAdrs={setAdrs}
                  setLabWarnings={setLabWarnings}
               />;
               
      case 'meds':
        return <MedicationReview activeMedications={activeMedications} setActiveMedications={setActiveMedications} interactions={interactions} setInteractions={setInteractions} adrs={adrs} setAdrs={setAdrs} />;
      
      case 'labs':
        return <LabResults localPatientId={localPatientId} activeMedications={activeMedications} labWarnings={labWarnings} setLabWarnings={setLabWarnings} />;
      
      case 'history':
        return <Histories localPatientId={localPatientId} formData={historyFormData} setFormData={setHistoryFormData} />;
      
      case 'plan':
        return <CarePlan 
                  localPatientId={localPatientId} 
                  pastPlans={pastPlans} 
                  setPastPlans={setPastPlans} 
                  activeMedications={activeMedications} 
                  interactions={interactions} 
                  adrs={adrs} 
                  labWarnings={labWarnings}
                  doctorNotes={prescriptionNotes}
                  patientProfile={patient} 
                  emrId={loadedEmrId}
                  
                  // Setters for clearing context
                  setInteractions={setInteractions}
                  setAdrs={setAdrs}
                  setLabWarnings={setLabWarnings}
                  setActiveMedications={setActiveMedications}
                  
                  // Pass this to clear doctor notes
                  setDoctorNotes={setPrescriptionNotes}
               />;
      
      case 'discharge':
        return <DischargeSummary localPatientId={localPatientId} patientProfile={{ ...patient, emr_id: loadedEmrId }} />;
      
      // --- 2. RENDER MONOGRAPH ---
      case 'monograph':
        return <Monograph />;

      default:
        return <PatientProfileForm />;
    }
  };

  return (
    <div className="app-container">
      {!patientLoaded ? (
        <PatientRoster onPatientSelect={handleLoadPatient} />
      ) : (
        <>
          <header className="patient-header">
            <div style={{width: '100%'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <h1 style={{margin: 0}}>{patient.first_name} {patient.last_name}</h1>
                  <button onClick={handleUnloadPatient} className="back-to-roster-btn">← Back to Roster</button>
              </div>
              
              <div className="patient-vitals" style={{marginTop: '10px'}}>
                <span><strong>ID:</strong> {loadedEmrId}</span>
                <span><strong>Age:</strong> {patient.age ? `${patient.age} Yrs` : 'N/A'}</span>
                <span><strong>Weight:</strong> {patient.weight_kg ? `${patient.weight_kg} kg` : 'N/A'}</span>
                <span><strong>Allergies:</strong> <strong style={{color: '#ff6b6b'}}>{patient.allergies || 'NKA'}</strong></span>
              </div>

              <div style={{marginTop: '15px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column'}}>
                  <span style={{fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '4px'}}>Primary Diagnosis:</span>
                  <span style={{fontSize: '1.4em', fontWeight: 'bold', lineHeight: '1.3'}}>
                      {patient.diagnosis || "No Diagnosis Recorded"}
                  </span>
              </div>
            </div>
          </header>
          
          <main className="dashboard-tabs">
            <div className="tab-nav">
              <button className={activeTab === 'profile' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('profile')}>Profile</button>
              <button className={activeTab === 'prescription' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('prescription')}>Prescription</button>
              <button className={activeTab === 'meds' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('meds')}>Meds Review</button>
              <button className={activeTab === 'labs' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('labs')}>Lab Results</button>
              <button className={activeTab === 'history' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('history')}>Histories</button>
              <button className={activeTab === 'plan' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('plan')}>Pharmacotherapy Care Plan</button>
              <button className={activeTab === 'discharge' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('discharge')}>Discharge Plan</button>
              {/* --- 3. ADD TAB BUTTON --- */}
              <button className={activeTab === 'monograph' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('monograph')}>Drug Monograph</button>
            </div>
            
            <div className="tab-content">
              {renderTabContent()}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;