import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/auth/forgot-password", { email });
      toast.success("If that email is registered, an OTP has been sent.");
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/verify-otp", { email, otp });
      setResetToken(data.resetToken);
      toast.success("OTP verified. Set your new password.");
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { resetToken, newPassword });
      toast.success("Password reset successfully. Please log in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--login">
        <img src="/logo.svg" alt="BreathTruth" className="auth-logo-img" />
        <h2>Reset Password</h2>

        {step === 1 && (
          <>
            <p className="auth-sub">Enter your email to receive an OTP</p>
            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="form-input" required placeholder="you@example.com" />
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="auth-sub">Enter the 6-digit code sent to {email}</p>
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label>OTP</label>
                <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                  className="form-input" required maxLength={6} placeholder="123456" />
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
            </form>
            <button className="btn-outline btn-full" style={{ marginTop: "0.5rem" }}
              onClick={() => setStep(1)}>
              Change email
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="auth-sub">Set your new password</p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input" required placeholder="Min 8 characters, 1 uppercase, 1 number, 1 special" />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input" required placeholder="Re-enter password" />
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <div className="auth-divider"><span>Remembered it?</span></div>
        <Link to="/login" className="btn-outline btn-full">Back to Login</Link>
      </div>
    </div>
  );
}