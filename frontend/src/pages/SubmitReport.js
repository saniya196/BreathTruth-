import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { POLLUTION_SOURCES, SYMPTOM_OPTIONS } from '../utils/aqiHelpers';

export default function SubmitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    pincode: user?.pincode || '',
    locality: user?.locality || '',
    city: user?.city || '',
    hasDirectReading: true,
    aqiEstimate: '',
    symptoms: [],
    pollutionSource: '',
    description: ''
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const toggleSymptom = (val) => {
    setForm(f => ({
      ...f,
      symptoms: f.symptoms.includes(val)
        ? f.symptoms.filter(s => s !== val)
        : [...f.symptoms, val]
    }));
  };

  const handleSubmit = async () => {
    if (!form.pollutionSource) return toast.error('Please select a pollution source');
    if (form.hasDirectReading && !form.aqiEstimate) return toast.error('Please enter AQI reading');
    if (!form.hasDirectReading && form.symptoms.length === 0) return toast.error('Please select at least one symptom');

    setSubmitting(true);
    try {
      const payload = {
        pincode: form.pincode,
        locality: form.locality,
        city: form.city,
        aqiEstimate: form.hasDirectReading ? parseInt(form.aqiEstimate) : null,
        symptoms: !form.hasDirectReading ? form.symptoms : [],
        pollutionSource: form.pollutionSource,
        description: form.description
      };
      await axios.post('/api/reports', payload);
      toast.success('✅ Report submitted! Thank you for contributing.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page report-page">
      <div className="report-card">
        <div className="report-header">
          <h1>Submit Air Quality Report</h1>
          <p>Your report helps build community-verified AQI data for <strong>{user?.locality}</strong></p>
          <div className="step-indicator">
            {[1, 2, 3].map(s => (
              <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="form-step">
            <h2>Step 1: Confirm Location</h2>
            <div className="form-group">
              <label>Locality</label>
              <input name="locality" value={form.locality} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Pincode</label>
                <input name="pincode" value={form.pincode} onChange={handleChange} className="form-input" maxLength={6} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input name="city" value={form.city} onChange={handleChange} className="form-input" />
              </div>
            </div>
            <div className="use-gps">
              <button type="button" className="btn-ghost" onClick={() => {
                navigator.geolocation?.getCurrentPosition(pos => {
                  toast.info(`Location detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
                });
              }}>
                📍 Use GPS Location
              </button>
            </div>
            <button className="btn-primary btn-full" onClick={() => setStep(2)}>Next →</button>
          </div>
        )}

        {/* Step 2: AQI Data */}
        {step === 2 && (
          <div className="form-step">
            <h2>Step 2: Air Quality Data</h2>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${form.hasDirectReading ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, hasDirectReading: true }))}
              >
                I have a sensor reading
              </button>
              <button
                type="button"
                className={`toggle-btn ${!form.hasDirectReading ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, hasDirectReading: false }))}
              >
                Report by symptoms
              </button>
            </div>

            {form.hasDirectReading ? (
              <div className="form-group">
                <label>AQI Reading (0–500)</label>
                <input
                  name="aqiEstimate" type="number" min="0" max="500"
                  value={form.aqiEstimate} onChange={handleChange}
                  className="form-input form-input--large"
                  placeholder="e.g. 187"
                />
                <p className="form-hint">From your air quality sensor, monitor app, or visible estimate</p>
              </div>
            ) : (
              <div className="form-group">
                <label>Select symptoms you are experiencing</label>
                <div className="symptom-grid">
                  {SYMPTOM_OPTIONS.map(s => (
                    <label key={s.value} className={`symptom-chip ${form.symptoms.includes(s.value) ? 'selected' : ''}`}>
                      <input type="checkbox" hidden onChange={() => toggleSymptom(s.value)} />
                      {s.label}
                    </label>
                  ))}
                </div>
                <p className="form-hint">We'll convert your symptoms to an approximate AQI estimate</p>
              </div>
            )}

            <div className="form-nav">
              <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary" onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Source + Submit */}
        {step === 3 && (
          <div className="form-step">
            <h2>Step 3: Pollution Source</h2>
            <div className="form-group">
              <label>What do you think is causing the pollution?</label>
              <div className="source-grid">
                {POLLUTION_SOURCES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    className={`source-btn ${form.pollutionSource === s.value ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, pollutionSource: s.value }))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Additional Notes (optional)</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="form-input form-textarea"
                placeholder="Any details about the pollution source, smell, visibility, etc."
                rows={3}
              />
            </div>

            {/* Summary preview */}
            <div className="report-preview">
              <strong>Report Preview:</strong>
              <p>📍 {form.locality}, {form.city} ({form.pincode})</p>
              {form.hasDirectReading ? <p>📊 AQI: {form.aqiEstimate}</p> : <p>🤧 Symptoms: {form.symptoms.join(', ')}</p>}
              <p>🏭 Source: {form.pollutionSource}</p>
            </div>

            <div className="form-nav">
              <button className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : '✅ Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
