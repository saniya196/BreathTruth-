// pages/Login.js
import axios from "axios";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      const msg = apiErrors?.length
        ? apiErrors.map((e) => e.message).join(", ")
        : err.response?.data?.message || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--login">
        <img src="/logo.svg" alt="BreathTruth" className="auth-logo-img" />
        <h2>Login</h2>
        <p className="auth-sub">Sign in to continue</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="auth-divider">
          <span>New here?</span>
        </div>
        <Link to="/register" className="btn-outline btn-full">
          Create New Account
        </Link>
      </div>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    pincode: "",
    locality: "",
    city: "Hyderabad",
  });
  const [loading, setLoading] = useState(false);
  const [localityOptions, setLocalityOptions] = useState([]);
  const [cityLocked, setCityLocked] = useState(false);
  const [pincodeChecking, setPincodeChecking] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handlePincodeChange = async (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, pincode: value, locality: "" }));
    if (value.length !== 6 || !/^\d{6}$/.test(value)) {
      setLocalityOptions([]);
      setCityLocked(false);
      return;
    }
    setPincodeChecking(true);
    try {
      const { data } = await axios.get(
        `https://api.postalpincode.in/pincode/${value}`,
        {
          withCredentials: false,
        },
      );
      const result = data?.[0];
      if (result?.Status === "Success" && result.PostOffice?.length) {
        const city = result.PostOffice[0].District;
        const localities = [...new Set(result.PostOffice.map((po) => po.Name))];
        setForm((f) => ({ ...f, city }));
        setLocalityOptions(localities);
        setCityLocked(true);
      } else {
        toast.error("Pincode not found — please check and try again");
        setLocalityOptions([]);
        setCityLocked(false);
      }
    } catch {
      toast.error("Could not verify pincode — check your connection");
      setLocalityOptions([]);
      setCityLocked(false);
    } finally {
      setPincodeChecking(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const pwd = form.password;
    if (pwd.length < 8)
      return toast.error("Password must be at least 8 characters");
    if (!/[A-Z]/.test(pwd))
      return toast.error("Password must contain at least one uppercase letter");
    if (!/[a-z]/.test(pwd))
      return toast.error("Password must contain at least one lowercase letter");
    if (!/[0-9]/.test(pwd))
      return toast.error("Password must contain at least one number");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd))
      return toast.error(
        "Password must contain at least one special character",
      );
    if (form.pincode.length !== 6)
      return toast.error("Enter a valid 6-digit pincode");
    if (!form.locality)
      return toast.error("Please select a locality from the pincode results");
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Welcome to BreathTruth.");
      navigate("/dashboard");
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      const msg = apiErrors?.length
        ? apiErrors.map((e) => e.message).join(", ")
        : err.response?.data?.message || "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <img src="/logo.svg" alt="BreathTruth" className="auth-logo-img" />
        <h2>Join the community</h2>
        <p className="auth-sub">Help map air quality in your area</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="Priya Sharma"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="priya@email.com"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Min 8 characters, 1 uppercase, 1 number, 1 special"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Locality / Area</label>
              <select
                name="locality"
                value={form.locality}
                onChange={handleChange}
                className="form-input"
                required
                disabled={!localityOptions.length}
              >
                <option value="">
                  {pincodeChecking
                    ? "Checking pincode…"
                    : localityOptions.length
                      ? "Select your locality"
                      : "Enter pincode first"}
                </option>
                {localityOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input
                name="pincode"
                value={form.pincode}
                onChange={handlePincodeChange}
                className="form-input"
                required
                maxLength={6}
                placeholder="500084"
              />
            </div>
          </div>
          <div className="form-group">
            <label>City</label>
            <input
              name="city"
              value={form.city}
              className="form-input"
              required
              readOnly
              disabled={cityLocked}
            />
          </div>
          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function Settings() {
  const { user, updateSettings, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    alertThreshold: user?.alertThreshold || 200,
    alertsEnabled: user?.alertsEnabled !== false,
    alertEmail: user?.alertEmail !== false,
    alertInApp: user?.alertInApp !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page settings-page">
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <h3 className="card-title">Profile</h3>
        <div className="profile-info">
          <div className="profile-avatar">{user?.name?.[0]}</div>
          <div>
            <p>
              <strong>{user?.name}</strong>
            </p>
            <p className="muted-text">{user?.email}</p>
            <p className="muted-text">
              {user?.locality}, {user?.city} — {user?.pincode}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Alert Preferences</h3>
        <div className="form-group">
          <label>AQI Alert Threshold</label>
          <p className="form-hint">
            Get notified when community AQI in your area exceeds this value
          </p>
          <div className="threshold-slider">
            <input
              type="range"
              name="alertThreshold"
              min={50}
              max={400}
              step={25}
              value={form.alertThreshold}
              onChange={handleChange}
            />
            <span
              className="threshold-value"
              style={{
                color:
                  form.alertThreshold > 300
                    ? "#ef4444"
                    : form.alertThreshold > 200
                      ? "#f97316"
                      : "#22c55e",
              }}
            >
              {form.alertThreshold} AQI
            </span>
          </div>
        </div>
        <div className="toggle-settings">
          <label className="toggle-item">
            <span>Enable All Alerts</span>
            <input
              type="checkbox"
              name="alertsEnabled"
              checked={form.alertsEnabled}
              onChange={handleChange}
            />
          </label>
          <label className="toggle-item">
            <span>Email Notifications</span>
            <input
              type="checkbox"
              name="alertEmail"
              checked={form.alertEmail}
              onChange={handleChange}
            />
          </label>
          <label className="toggle-item">
            <span>In-App Notifications</span>
            <input
              type="checkbox"
              name="alertInApp"
              checked={form.alertInApp}
              onChange={handleChange}
            />
          </label>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">Account</h3>
        <div className="account-stats">
          <span>
            Reports submitted: <strong>{user?.reportsCount || 0}</strong>
          </span>
          <span>
            Member since:{" "}
            <strong>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-IN")
                : "—"}
            </strong>
          </span>
          <span>
            Role: <strong>{user?.role}</strong>
          </span>
        </div>
        <button
          className="btn-danger"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// Default exports
export default Login;
