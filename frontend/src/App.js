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

// Safe localStorage helper
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage.getItem failed:', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage.setItem failed:', e);
    }
  }
};

// Configure axios to include user ID header for all requests
const setupAxiosAuth = (userId) => {
  axios.defaults.headers.common['X-User-Id'] = userId;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for Telegram WebApp
        const tg = window.Telegram?.WebApp;
        
        // CRITICAL: Call ready() and expand() FIRST before anything else
        if (tg) {
          console.log('Telegram WebApp detected, calling ready()...');
          tg.ready();
          tg.expand();
          
          // Small delay to allow Telegram to populate initData
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log('initData after ready():', tg.initData ? 'populated' : 'empty');
          console.log('initDataUnsafe:', JSON.stringify(tg.initDataUnsafe || {}));
        }
        
        // Try to get user info from Telegram (initDataUnsafe works without signature)
        const tgUser = tg?.initDataUnsafe?.user;
        
        if (tg?.initData && tg.initData.length > 0) {
          // Full Telegram auth with signature validation
          console.log('Attempting Telegram auth with initData...');
          const res = await axios.post(`${API}/auth/telegram`, {
            init_data: tg.initData
          });
          const userData = res.data.user;
          setUser(userData);
          setupAxiosAuth(userData.id);
          console.log('Telegram auth successful:', userData.display_name);
        } else if (tgUser && tgUser.id) {
          // Telegram user available but no signature - use ID directly
          console.log('Using Telegram user without signature:', tgUser.id);
          const res = await axios.post(`${API}/auth/telegram`, {
            telegram_id: String(tgUser.id),
            display_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User'
          });
          const userData = res.data.user;
          setUser(userData);
          setupAxiosAuth(userData.id);
          console.log('Telegram auth (unsafe) successful:', userData.display_name);
        } else {
          // Demo mode - no Telegram user info
          console.log('Demo mode - no Telegram user info available');
          let demoId = safeLocalStorage.getItem('fo_demo_id');
          if (!demoId) {
            demoId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            safeLocalStorage.setItem('fo_demo_id', demoId);
          }
          
          const res = await axios.post(`${API}/auth/telegram`, {
            telegram_id: demoId,
            display_name: 'Demo User'
          });
          const userData = res.data.user;
          setUser(userData);
          setupAxiosAuth(userData.id);
          console.log('Demo auth successful');
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError(err.message || 'Authentication failed');
        
        // Create offline fallback user - don't use localStorage here
        const fallbackId = `offline_${Date.now()}`;
        const userData = {
          id: fallbackId,
          telegram_id: fallbackId,
          display_name: 'Guest User',
          onboarded: false
        };
        setUser(userData);
        setupAxiosAuth(userData.id);
        console.log('Using offline fallback user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const updateUser = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
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

  // Safety check - if somehow user is still null, show loading
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="stars-bg" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full sun animate-pulse" />
          <p className="mt-4 text-slate-400 font-medium">
            {error ? `Error: ${error}` : 'Connecting...'}
          </p>
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
