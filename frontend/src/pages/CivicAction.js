import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function CivicAction() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [civicEligibility, setCivicEligibility] = useState(null);
  const [escalating, setEscalating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const canGenerateComplaint = Boolean(civicEligibility?.canGenerateComplaint);

  useEffect(() => {
    if (user?.pincode) fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    try {
      const { data } = await axios.get(`/api/reports/summary/${user.pincode}`);
      setSummary(data.summary);
      setCivicEligibility(data.civicEligibility || null);
    } catch {}
  };

  const handleDownloadPDF = async () => {
    if (!canGenerateComplaint) {
      const min = civicEligibility?.minUniqueReporters || 11;
      const got = civicEligibility?.uniqueReporterCount || 0;
      toast.info(`Need at least ${min} different accounts in the last ${civicEligibility?.windowDays || 7} days (currently ${got}).`, { toastId: 'pdf-no-data' });
      return;
    }
    setDownloading(true);
    try {
      const response = await axios.get(`/api/civic/complaint-pdf/${user.pincode}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `breathtruth-complaint-${user.pincode}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Complaint PDF downloaded!');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        toast.info('No complaint data found yet for your area.', { toastId: 'pdf-no-area-data' });
      } else if (status === 400) {
        toast.info(err?.response?.data?.message || 'Not enough unique reporters yet.', { toastId: 'pdf-not-eligible' });
      } else {
        toast.error('Could not generate PDF right now.', { toastId: 'pdf-generate-failed' });
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleEscalate = async () => {
    if (!canGenerateComplaint) {
      toast.info('Escalation is enabled after complaint eligibility is met.', { toastId: 'escalate-no-data' });
      return;
    }
    setEscalating(true);
    try {
      await axios.post('/api/civic/escalate', { pincode: user.pincode });
      toast.success('Escalation logged. Download the PDF and send it to your local authorities.');
    } catch (err) {
      toast.error('Error logging escalation', { toastId: 'escalate-failed' });
    } finally {
      setEscalating(false);
    }
  };

  const handleExportCSV = () => {
    if (!summary) {
      toast.info('No reports to export yet.', { toastId: 'csv-no-data' });
      return;
    }
    axios.get(`/api/export/csv?pincode=${user.pincode}`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `breathtruth-${user.pincode}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'CSV export failed', { toastId: 'csv-export-failed' });
      });
  };

  return (
    <div className="page civic-page">
      <div className="page-header">
        <h1 className="page-title">Civic Action Centre</h1>
        <p className="page-subtitle">Turn your community's air quality data into official complaints</p>
      </div>

      {/* What can you do */}
      <div className="civic-steps">
        <div className="civic-step">
          <div className="step-num">1</div>
          <div>
            <h3>Review Community Data</h3>
            <p>Check that your area has enough reports (10+ recommended) to make a credible complaint.</p>
          </div>
        </div>
        <div className="civic-step">
          <div className="step-num">2</div>
          <div>
            <h3>Download Pre-Filled Complaint PDF</h3>
            <p>We auto-generate a formal complaint letter with your area's 7-day AQI data, report count, and comparison with official readings.</p>
          </div>
        </div>
        <div className="civic-step">
          <div className="step-num">3</div>
          <div>
            <h3>Submit to Authorities</h3>
            <p>Send to GHMC, TSPCB (Telangana), or your local municipal body. Email or physical post both accepted.</p>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      {summary ? (
        <div className="card civic-data-card">
          <h3 className="card-title">Your Area Data Summary</h3>
          <div className="civic-stats">
            <div className="civic-stat">
              <span className="stat-num">{summary.reportCount || 0}</span>
              <span className="stat-desc">Community Reports (Latest Day)</span>
            </div>
            <div className="civic-stat">
              <span className="stat-num">{summary.communityAqi || '—'}</span>
              <span className="stat-desc">Community AQI</span>
            </div>
            <div className="civic-stat">
              <span className="stat-num">{summary.officialAqi || '—'}</span>
              <span className="stat-desc">Official AQI</span>
            </div>
            <div className="civic-stat">
              <span className={`stat-num ${summary.anomalyFlagged ? 'text-danger' : 'text-success'}`}>
                {summary.anomalyFlagged ? '⚠️ YES' : '✅ No'}
              </span>
              <span className="stat-desc">Anomaly Flagged</span>
            </div>
          </div>

          {summary.reportCount < 5 && (
            <div className="civic-warning">
              ⚠️ Your area has only {summary.reportCount} report(s). A complaint is more credible with 10+ reports.
              <a href="/report"> Submit more reports</a> or encourage neighbours to contribute.
            </div>
          )}

          {civicEligibility && (
            <div className="civic-warning">
              Complaint letter eligibility: <strong>{civicEligibility.uniqueReporterCount}</strong> / <strong>{civicEligibility.minUniqueReporters}</strong> unique accounts in last {civicEligibility.windowDays} days.
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="empty-state">No data yet for {user?.locality}. <a href="/report">Submit the first report!</a></p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="civic-actions">
        <button
          className="btn-primary btn-civic"
          onClick={handleDownloadPDF}
          disabled={downloading || !canGenerateComplaint}
        >
          {downloading ? 'Generating PDF…' : '📄 Download Complaint Letter (PDF)'}
        </button>

        <button
          className="btn-secondary btn-civic"
          onClick={handleExportCSV}
          disabled={!summary}
        >
          📊 Export Evidence CSV
        </button>

        <button
          className="btn-outline btn-civic"
          onClick={handleEscalate}
          disabled={escalating || !canGenerateComplaint}
        >
          {escalating ? 'Logging…' : '🚨 Flag for Escalation'}
        </button>
      </div>

      {/* Contacts */}
      <div className="card contacts-card">
        <h3 className="card-title">Where to Send Your Complaint</h3>
        <div className="contact-list">
          <div className="contact-row">
            <strong>TSPCB (Telangana State Pollution Control Board)</strong>
            <span>complaints@tspcb.cgg.gov.in</span>
            <span>Paryavarana Bhavan, Saifabad, Hyderabad</span>
          </div>
          <div className="contact-row">
            <strong>GHMC Environment Wing</strong>
            <span>environment@ghmc.gov.in</span>
            <span>GHMC Head Office, Tankbund Road, Hyderabad</span>
          </div>
          <div className="contact-row">
            <strong>CPCB (Central Pollution Control Board)</strong>
            <span>complaints@cpcb.nic.in</span>
            <span>Parivesh Bhawan, East Arjun Nagar, Delhi</span>
          </div>
          <div className="contact-row">
            <strong>National Green Tribunal</strong>
            <span>ngt-registry@gov.in</span>
            <span>Faridkot House, Copernicus Marg, New Delhi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
