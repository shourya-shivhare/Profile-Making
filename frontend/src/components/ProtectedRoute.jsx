import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';



/**
 * ProtectedRoute
 *
 * Guards a route behind authentication and optional role checks.
 *
 * Props:
 *   children  – the route element to render
 *   roles     – optional array of allowed roles (e.g. ['sme'], ['bank_admin'])
 *
 * States handled:
 *  1. Initializing (hydrating session from cookie)  → show loading spinner
 *  2. Not authenticated                             → redirect to /login
 *  3. Authenticated but wrong role                  → redirect to /unauthorized
 *  4. Authenticated + correct role                  → render children
 */
export default function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const location = useLocation();

  // While we wait for the cookie-based token refresh to complete, show a
  // full-screen spinner. This prevents a flash of the login page for users
  // who are already logged in.
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo ring */}
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-wide">Restoring session…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login, preserving the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but not the right role
  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
