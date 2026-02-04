import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { useEffect, useState, createContext } from "react";
import axios from "axios";

// Pages
import Universe from "./pages/Universe";
import Setup from "./pages/Setup";
import PersonProfile from "./pages/PersonProfile";
import Settings from "./pages/Settings";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Context for user data
export const UserContext = createContext(null);

// Configure axios to include user ID header for all requests
const setupAxiosAuth = (userId) => {
  axios.defaults.headers.common['X-User-Id'] = userId;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for Telegram WebApp
        const tg = window.Telegram?.WebApp;
        
        // CRITICAL: Call ready() and expand() FIRST before anything else
        // This tells Telegram the app is loaded and allows it to populate initData
        if (tg) {
          console.log('Telegram WebApp detected, calling ready()...');
          tg.ready();
          tg.expand();
          
          // Small delay to allow Telegram to populate initData
          await new Promise(resolve => setTimeout(resolve, 150));
          console.log('initData after ready():', tg.initData ? 'populated' : 'empty');
        }
        
        // Now check initData - it should be populated after ready()
        if (tg?.initData && tg.initData.length > 0) {
          console.log('Attempting Telegram auth with initData...');
          // Authenticate via Telegram
          const res = await axios.post(`${API}/auth/telegram`, {
            init_data: tg.initData
          });
          const userData = res.data.user;
          setUser(userData);
          setupAxiosAuth(userData.id);
          console.log('Telegram auth successful:', userData.display_name);
        } else {
          console.log('Demo mode - no Telegram initData available');
          // Demo mode - use localStorage
          let demoId = localStorage.getItem('fo_demo_id');
          if (!demoId) {
            demoId = `demo_${Date.now()}`;
            localStorage.setItem('fo_demo_id', demoId);
          }
          
          const res = await axios.post(`${API}/auth/telegram`, {
            telegram_id: demoId,
            display_name: 'Demo User'
          });
          const userData = res.data.user;
          setUser(userData);
          setupAxiosAuth(userData.id);
        }
      } catch (error) {
        console.error('Auth error:', error);
        // Create fallback demo user
        const fallbackId = `demo_${Date.now()}`;
        localStorage.setItem('fo_demo_id', fallbackId);
        const userData = {
          id: fallbackId,
          telegram_id: fallbackId,
          display_name: 'Demo User',
          onboarded: false
        };
        setUser(userData);
        setupAxiosAuth(userData.id);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const updateUser = (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="stars-bg" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full sun animate-pulse" />
          <p className="mt-4 text-slate-400 font-medium">Loading your universe...</p>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser, updateUser }}>
      <div className="App min-h-screen bg-background">
        <HashRouter>
          <Routes>
            <Route path="/" element={user?.onboarded ? <Universe /> : <Setup />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/universe" element={<Universe />} />
            <Route path="/person/:id" element={<PersonProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </HashRouter>
        <Toaster position="top-center" richColors />
      </div>
    </UserContext.Provider>
  );
}

export default App;
