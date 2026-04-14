import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getAqiColor } from '../utils/aqiHelpers';
import { format } from 'date-fns';

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data } = await axios.get('/api/alerts');
      setAlerts(data.alerts);
    } catch (err) {
      const status = err?.response?.status;
      // Avoid noisy toasts for expected auth transitions on page load.
      if (status !== 401 && status !== 403) {
        toast.error('Could not load alerts', { toastId: 'alerts-load-failed' });
      }
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await axios.put(`/api/alerts/${id}/read`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      const unread = alerts.filter(a => !a.read);
      await Promise.all(unread.map(a => axios.put(`/api/alerts/${a._id}/read`)));
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      toast.success('All alerts marked as read');
    } catch {
      toast.error('Could not update alerts', { toastId: 'alerts-update-failed' });
    }
  };

  const ALERT_ICONS = {
    threshold_breach: '🔴',
    anomaly: '⚠️',
    institution_risk: '🏫',
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="page alerts-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-ghost" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-icon">🔔</div>
          <h3>No alerts yet</h3>
          <p>You'll be notified when AQI in <strong>{user?.locality}</strong> crosses your threshold of <strong>{user?.alertThreshold}</strong>.</p>
          <a href="/settings" className="btn-outline">Adjust alert settings</a>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map(alert => (
            <div
              key={alert._id}
              className={`alert-item ${!alert.read ? 'unread' : ''}`}
              onClick={() => !alert.read && markRead(alert._id)}
            >
              <div className="alert-icon-wrap">
                <span className="alert-type-icon">{ALERT_ICONS[alert.type] || '🔔'}</span>
                {!alert.read && <span className="unread-dot" />}
              </div>
              <div className="alert-body">
                <div className="alert-header-row">
                  <strong className="alert-title">{alert.title}</strong>
                  <span className="alert-time">
                    {format(new Date(alert.createdAt), 'dd MMM, HH:mm')}
                  </span>
                </div>
                <p className="alert-message">{alert.message}</p>
                {alert.aqiAtAlert && (
                  <span
                    className="alert-aqi-badge"
                    style={{ background: getAqiColor(alert.aqiAtAlert) + '20', color: getAqiColor(alert.aqiAtAlert), border: `1px solid ${getAqiColor(alert.aqiAtAlert)}` }}
                  >
                    AQI {alert.aqiAtAlert}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert settings reminder */}
      <div className="card alert-settings-reminder">
        <p>
          <span>🔔</span>
          Alerts fire when AQI exceeds <strong>{user?.alertThreshold}</strong>.
          <a href="/settings"> Change threshold</a>
        </p>
      </div>
    </div>
  );
}
