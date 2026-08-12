import apiClient from './apiClient.js';




export const authApi = {

  // ─── SME ──────────────────────────────────────────────────────────────────
  smeRegister: (data) =>
    apiClient.post('/auth/sme/register', data),

  smeLogin: (credentials) =>
    apiClient.post('/auth/sme/login', credentials),


  // ─── Bank Admin ───────────────────────────────────────────────────────────
  bankRegister: (data) =>
    apiClient.post('/auth/bank/register', data),

  bankLogin: (credentials) =>
    apiClient.post('/auth/bank/login', credentials),


  // ─── MFA ──────────────────────────────────────────────────────────────────
  // Verify the 6-digit OTP — exchanges tempToken + code for access + refresh tokens
  mfaVerify: (tempToken, code) =>
    apiClient.post('/auth/mfa/verify', { tempToken, code }),

  // Resend OTP — exchanges the current tempToken for a new one with a fresh OTP
  mfaResend: (tempToken) =>
    apiClient.post('/auth/mfa/resend', { tempToken }),


  // ─── Session ──────────────────────────────────────────────────────────────
  // Refresh the access token using the httpOnly refresh-token cookie
  refresh: () =>
    apiClient.post('/auth/refresh', {}),

  // Logout — invalidates the server-side session and clears the refresh cookie
  logout: () =>
    apiClient.post('/auth/logout', {}),


  // ─── Current User ─────────────────────────────────────────────────────────
  me: () =>
    apiClient.get('/auth/me'),
};
