import React, { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LoadingSpinner from "./components/LoadingSpinner";
import apiService from "./services/api";
import type { User } from "./types";

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await apiService.checkAuth();
      if (res.authenticated && res.user) {
        setUser(res.user as User);
        setAuthenticated(true);
      } else {
        setUser(null);
        setAuthenticated(false);
      }
    } catch (err) {
      // In case of offline backend or session expiration
      setUser(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "var(--bg-app)", alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner label="Securing connection..." size="lg" />
      </div>
    );
  }

  if (authenticated && user) {
    return (
      <DashboardPage 
        user={user} 
        onLogout={() => { 
          setAuthenticated(false); 
          setUser(null); 
        }} 
      />
    );
  }

  return <LoginPage onLoginSuccess={(u) => { setUser(u); setAuthenticated(true); }} />;
};

export default App;
