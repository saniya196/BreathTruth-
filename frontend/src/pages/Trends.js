import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { getAqiColor, formatAqiLabel } from '../utils/aqiHelpers';

const EVENTS = [
  { date: '2024-11-01', name: 'Diwali', color: '#f97316' },
  { date: '2024-10-02', name: 'Gandhi Jayanti', color: '#3b82f6' },
];

export default function Trends() {
  const { user } = useAuth();
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('line');

  useEffect(() => {
    if (user?.pincode) fetchTrend();
  }, [user]);

  const fetchTrend = async () => {
    try {
      const { data } = await axios.get(`/api/reports/trend/${user.pincode}`);
      const formatted = data.trend.map(d => ({
        ...d,
        dateLabel: format(new Date(d.date), 'dd MMM'),
        communityAqi: d.communityAqi ?? null,
        officialAqi: d.officialAqi ?? null,
      }));
      setTrend(formatted);
    } catch (err) {
      console.error('Trend fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-date">{label}</p>
        {d?.communityAqi != null && (
          <p style={{ color: getAqiColor(d.communityAqi) }}>
            Community: <strong>{d.communityAqi}</strong> — {formatAqiLabel(d.communityAqi)}
          </p>
        )}
        {d?.officialAqi != null && (
          <p style={{ color: '#94a3b8' }}>
            Official: <strong>{d.officialAqi}</strong>
          </p>
        )}
        {d?.reportCount != null && <p className="tooltip-meta">{d.reportCount} reports · {d.confidenceScore} confidence</p>}
      </div>
    );
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page trends-page">
      <div className="page-header">
        <h1 className="page-title">7-Day Air Quality Trends</h1>
        <p className="page-subtitle">{user.locality}, {user.city}</p>
      </div>

      {/* Chart Type Toggle */}
      <div className="chart-controls">
        <button className={`chart-toggle ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>Line</button>
        <button className={`chart-toggle ${chartType === 'area' ? 'active' : ''}`} onClick={() => setChartType('area')}>Area</button>
      </div>

      {/* AQI Trend Chart */}
      <div className="card chart-card">
        <h3 className="card-title">Community AQI vs Official AQI</h3>
        {trend.length === 0 ? (
          <div className="empty-state">
            <p>No trend data yet for your area. Be the first to <a href="/report">submit a report!</a></p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {chartType === 'area' ? (
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="communityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 500]} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* AQI threshold reference lines */}
                <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="4 4" label={{ value: 'Satisfactory', position: 'right', fontSize: 11 }} />
                <ReferenceLine y={200} stroke="#eab308" strokeDasharray="4 4" label={{ value: 'Moderate', position: 'right', fontSize: 11 }} />
                <ReferenceLine y={300} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'Poor', position: 'right', fontSize: 11 }} />
                <Area type="monotone" dataKey="communityAqi" name="Community AQI"
                  stroke="#ef4444" fill="url(#communityGrad)" strokeWidth={2} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="officialAqi" name="Official AQI (CPCB)"
                  stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </AreaChart>
            ) : (
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 500]} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine y={200} stroke="#eab308" strokeDasharray="4 4" />
                <ReferenceLine y={300} stroke="#f97316" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="communityAqi" name="Community AQI"
                  stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5, fill: '#ef4444' }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="officialAqi" name="Official AQI (CPCB)"
                  stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Report Count Chart */}
      {trend.length > 0 && (
        <div className="card chart-card">
          <h3 className="card-title">Daily Report Submissions</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val) => [val, 'Reports']} />
              <Area type="monotone" dataKey="reportCount" name="Reports"
                stroke="#3b82f6" fill="url(#reportGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Divergence Summary */}
      {trend.some(d => d.communityAqi != null && d.officialAqi != null) && (
        <div className="card divergence-card">
          <h3 className="card-title">Divergence Analysis</h3>
          <div className="divergence-list">
            {trend.filter(d => d.communityAqi != null && d.officialAqi != null).map((d, i) => {
              const ratio = d.divergenceRatio || (d.communityAqi / d.officialAqi);
              return (
                <div key={i} className={`divergence-row ${d.anomalyFlagged ? 'anomaly' : ''}`}>
                  <span>{d.dateLabel}</span>
                  <span>Community: {d.communityAqi}</span>
                  <span>Official: {d.officialAqi}</span>
                  <span className={ratio > 2 ? 'ratio-high' : ratio > 1.5 ? 'ratio-med' : 'ratio-ok'}>
                    {ratio.toFixed(1)}x {d.anomalyFlagged && '⚠️'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
