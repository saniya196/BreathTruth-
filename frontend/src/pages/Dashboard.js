import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { AqiGauge, ConfidenceBadge, AnomalyBanner, HealthAdvisory, AqiComparisonBar } from '../components/Dashboard/AqiCard';

export default function Dashboard() {
  const { user } = useAuth();
  const [aqiData, setAqiData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`/api/export/csv?pincode=${user.pincode}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `breathtruth-${user.pincode}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV export failed');
    }
  };

  useEffect(() => {
    if (user?.pincode) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [aqiRes, summaryRes, comparisonRes] = await Promise.all([
        axios.get(`/api/aqi/current/${user.pincode}`),
        axios.get(`/api/reports/summary/${user.pincode}`),
        axios.get(`/api/aqi/comparison/${user.pincode}`).catch(() => null)
      ]);
      setAqiData(aqiRes.data);
      setSummary(summaryRes.data.summary);

      const comparisonData = comparisonRes?.data;
      if (comparisonData && !comparisonData.hasLocalSensor) {
        const nearestRes = await axios.get(`/api/aqi/nearest/${user.pincode}`);
        setNearestStation(nearestRes.data);
      } else {
        setNearestStation(null);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /><p>Loading air quality data…</p></div>;

  const aqi = aqiData?.aqi;
  const hasAnomaly = aqiData?.anomalyFlagged;
  const comparisonOfficialAqi = nearestStation?.aqi ?? aqiData?.officialAqi;

  return (
    <div className="page dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Hello, {user.name.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">{user.locality}, {user.city} — Pincode {user.pincode}</p>
        </div>
        <Link to="/report" className="btn-primary btn-report-cta">
          + Submit AQI Report
        </Link>
      </div>

      {/* AQI Summary Row */}
      <div className="dashboard-grid">
        {/* Main AQI Gauge */}
        <div className="card card--aqi">
          <h3 className="card-title">Current AQI</h3>
          <AqiGauge aqi={aqi} />
          {summary && <ConfidenceBadge score={summary.confidenceScore} />}
          <p className="aqi-meta">{summary?.reportCount || 0} community reports today</p>
        </div>

        {/* Community vs Official */}
        <div className="card card--comparison">
          <h3 className="card-title">Community vs Official AQI</h3>
          <AqiComparisonBar
            communityAqi={aqiData?.communityAqi}
            officialAqi={comparisonOfficialAqi}
            nearestStation={nearestStation}
          />
          {hasAnomaly && (
            <AnomalyBanner
              ratio={aqiData?.divergenceRatio}
              communityAqi={aqiData?.communityAqi}
              officialAqi={aqiData?.officialAqi}
            />
          )}
          {!aqiData?.officialAqi && (
            <p className="muted-text">No official station data for your pincode yet. <Link to="/report">Help by reporting!</Link></p>
          )}
        </div>

        {/* Health Advisory */}
        <div className="card card--advisory">
          <HealthAdvisory advisory={aqiData?.advisory} aqi={aqi} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="action-grid">
          <Link to="/report" className="action-card">
            <span className="action-icon">📋</span>
            <span>Submit Report</span>
          </Link>
          <Link to="/trends" className="action-card">
            <span className="action-icon">📈</span>
            <span>7-Day Trends</span>
          </Link>
          <Link to="/map" className="action-card">
            <span className="action-icon">🗺️</span>
            <span>Area Map</span>
          </Link>
          <Link to="/civic" className="action-card">
            <span className="action-icon">📢</span>
            <span>Civic Action</span>
          </Link>
          <button type="button" className="action-card" onClick={handleExportCSV}>
            <span className="action-icon">📥</span>
            <span>Export CSV</span>
          </button>
          <Link to="/alerts" className="action-card">
            <span className="action-icon">🔔</span>
            <span>My Alerts</span>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      {summary && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{summary.reportCount}</span>
            <span className="stat-label">Reports Today</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.communityAqiMin || '—'}</span>
            <span className="stat-label">Daily Min AQI</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.communityAqiMax || '—'}</span>
            <span className="stat-label">Daily Max AQI</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.anomalyFlagged ? '⚠️ Yes' : '✅ No'}</span>
            <span className="stat-label">Anomaly Flagged</span>
          </div>
        </div>
      )}
    </div>
  );
}
