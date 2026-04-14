import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) fetchUnreadCount();
  }, [user, location]);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await axios.get('/api/alerts');
      setUnreadCount(data.alerts.filter(a => !a.read).length);
    } catch {}
  };

  const handleLogout = () => { logout(); navigate('/'); };
  const isActive = (path) => location.pathname === path;

  if (!user && location.pathname === '/') return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to={user ? '/dashboard' : '/'} className="brand-link">
          <img src="/logo.svg" alt="BreathTruth" className="brand-logo" />
          <span className="brand-name">BreathTruth</span>
        </Link>
      </div>

      {user && (
        <>
          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>Dashboard</Link>
            <Link to="/report" className={isActive('/report') ? 'active' : ''}>Report AQI</Link>
            <Link to="/map" className={isActive('/map') ? 'active' : ''}>Map</Link>
            <Link to="/trends" className={isActive('/trends') ? 'active' : ''}>Trends</Link>
            <Link to="/civic" className={isActive('/civic') ? 'active' : ''}>Civic Action</Link>
            <Link to="/alerts" className={`${isActive('/alerts') ? 'active' : ''} alert-link`}>
              Alerts {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </Link>
          </div>
          <div className="navbar-user">
            <Link to="/settings" className="user-chip">
              <span className="user-avatar">{user.name?.[0]?.toUpperCase()}</span>
              <span className="user-locality">{user.locality}</span>
            </Link>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </>
      )}

      {!user && (
        <div className="navbar-auth">
          <Link to="/login" className="btn-outline">Login</Link>
          <Link to="/register" className="btn-primary-sm">Sign Up</Link>
        </div>
      )}
    </nav>
  );
}
