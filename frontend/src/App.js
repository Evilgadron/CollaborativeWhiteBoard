import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth/Auth';           // Assumes: src/components/Auth/Auth.js
import AuthRedirect from './pages/AuthRedirect';     // Assumes: src/pages/AuthRedirect.js
import Home from './pages/Home';                     // Assumes: src/pages/Home.js
import Session from './pages/Session';               // Assumes: src/pages/Session.js
import PrivateRoute from './components/PrivateRoute'; // Assumes: src/components/PrivateRoute.js
import { AuthProvider } from './context/AuthContext'; // Assumes: src/context/AuthContext.js
import './App.css';                                  // Assumes: src/App.css

// Import the new public-specific session component
import SessionPublic from './pages/SessionPublic';   // Assumes: src/pages/SessionPublic.js

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Existing routes */}
            <Route path="/session/:sessionId" element={
              <PrivateRoute>
                <Session />
              </PrivateRoute>
            } />
            <Route path="/home" element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } />
            <Route path="/auth/redirect" element={<AuthRedirect />} />
            <Route path="/auth/login" element={<Auth isLogin={true} />} />
            <Route path="/auth/signup" element={<Auth isLogin={false} />} />
            <Route path="/auth" element={<Navigate to="/auth/login" />} />
            <Route path="/" element={<Navigate to="/auth/login" />} />

            {/* NEW ROUTE FOR PUBLIC SESSIONS */}
            {/* This route uses the new SessionPublic component */}
            <Route path="/public-session/:sessionId" element={
              <PrivateRoute>
                <SessionPublic /> {/* Renders the public session component */}
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
