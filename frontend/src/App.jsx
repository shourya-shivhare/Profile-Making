import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from '@/pages/LoginPage';
import SMELoginPage from '@/pages/SMELoginPage';
import SMERegisterPage from '@/pages/SMERegisterPage';
import BankAdminLoginPage from '@/pages/BankAdminLoginPage';
import BankAdminRegisterPage from '@/pages/BankAdminRegisterPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import DashboardPage from '@/pages/DashboardPage';
import LoanApplicationPage from '@/pages/LoanApplicationPage';

import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';


/**
 * GuestRoute — redirects already-authenticated users to the dashboard.
 * During session hydration (isInitializing) it renders the login page
 * immediately to avoid a full-screen spinner flash on public routes.
 */
function GuestRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();

  // While initializing, let the page render (no redirect yet).
  // This avoids a flash where an authenticated user briefly sees the
  // login form before being sent to /dashboard.
  if (isInitializing) return children;

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}


function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        {/* ── Portal selector (root) ─────────────────────────── */}
        <Route
          path="/"
          element={
            <GuestRoute><LoginPage /></GuestRoute>
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute><LoginPage /></GuestRoute>
          }
        />

        {/* ── SME routes ─────────────────────────────────────── */}
        <Route
          path="/sme/login"
          element={
            <GuestRoute><SMELoginPage /></GuestRoute>
          }
        />
        <Route
          path="/sme/register"
          element={
            <GuestRoute><SMERegisterPage /></GuestRoute>
          }
        />

        {/* ── Bank Admin routes ──────────────────────────────── */}
        <Route
          path="/bank/login"
          element={
            <GuestRoute><BankAdminLoginPage /></GuestRoute>
          }
        />
        <Route
          path="/bank/register"
          element={
            <GuestRoute><BankAdminRegisterPage /></GuestRoute>
          }
        />

        {/* ── Public routes ──────────────────────────────────── */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Protected routes ───────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loan/apply"
          element={
            <ProtectedRoute roles={['sme']}>
              <LoanApplicationPage />
            </ProtectedRoute>
          }
        />

        {/* ── 404 ────────────────────────────────────────────── */}
        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
              <div className="text-center space-y-4">
                <div className="text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-indigo-600">
                  404
                </div>
                <p className="text-slate-400">Page not found</p>
                <button
                  onClick={() => window.history.back()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
