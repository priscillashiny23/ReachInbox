import React, { useState } from "react";
import apiService from "../services/api";

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    // Redirect browser to backend Google OAuth initiation route
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter both Email ID and Password.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.login(email.trim(), password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError("Invalid email ID or password.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        <h1 className="title-xl" style={{ fontSize: "1.65rem", fontWeight: "700", marginBottom: "24px", color: "var(--text-primary)" }}>
          Login
        </h1>

        <button className="btn-google-login" onClick={handleGoogleLogin}>
          {/* Inline SVG representation of the Google logo */}
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#EA4335"
              d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.93 1 12 1 7.37 1 3.4 3.68 1.48 7.57l3.86 3C6.26 7.59 8.87 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.75-4.87 3.75-8.63z"
            />
            <path
              fill="#FBBC05"
              d="M5.34 14.43c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.48 6.87C.54 8.75 0 10.82 0 13s.54 4.25 1.48 6.13l3.86-3z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.66-2.84c-1.1.74-2.51 1.18-4.3 1.18-3.13 0-5.74-2.55-6.66-5.53l-3.86 3C3.4 20.32 7.37 23 12 23z"
            />
          </svg>
          <span>Login with Google</span>
        </button>

        <div className="login-divider">
          <span>or sign up through email</span>
        </div>

        <form onSubmit={handleCredentialsLogin} className="login-fields">
          {error && (
            <div style={{ color: "var(--color-failed-text)", fontSize: "0.8rem", textAlign: "center", marginBottom: "4px" }}>
              {error}
            </div>
          )}
          <input
            type="email"
            placeholder="Email ID"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button 
            type="submit" 
            className="btn-login-submit" 
            disabled={loading}
            style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="body-sm" style={{ marginTop: "24px", fontSize: "0.725rem", textAlign: "center", color: "var(--text-muted)" }}>
          Google OAuth is the active secure authentication method for this application.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

