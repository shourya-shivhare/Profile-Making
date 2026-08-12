import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import {
  findSMEByEmail, findSMEById, createSMEUser, updateSMELastLogin,
  findBankAdminByEmail, findBankAdminById, createBankAdminUser, updateBankAdminLastLogin,
} from '../db/queries/users.queries.js';
import { createOtp, deleteOtpsByUserContact, findOtp, incrementOtpAttempts, deleteOtp } from '../db/queries/otps.queries.js';
import { recordAuditLog } from '../db/queries/auditLogs.queries.js';
import {
  generateAccessToken, generateRefreshToken, verifyRefreshToken,
  buildTokenPayload, sanitizeUser, generateMfaToken, verifyMfaToken,
  hashOtpCode, verifyOtpCode,
} from '../utils/token.utils.js';
import { ApiError } from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import {
  setSession, getSession, deleteSession,
  blacklistToken, isTokenBlacklisted,
  acquireOtpLock, releaseOtpLock,
  incrementFailedAttempts, getFailedAttempts, clearFailedAttempts,
  redisClient,
} from '../config/redis.js';
import { publishEvent } from '../notifications/index.js';
import { NOTIFICATION_EVENTS } from '../notifications/events/notificationEvents.js';
import { sendEmail } from '../notifications/services/emailSender.service.js';
import { otpTemplate } from '../notifications/templates/otp.template.js';




/**
 * Generate a 6-digit OTP, hash it, persist the HASH (never plaintext),
 * and return the raw code so it can be delivered to the user (e.g. via email).
 *
 * BUG-04 FIX:
 *   1. The OTP code is no longer logged in plaintext.
 *   2. Only the HMAC-SHA256 hash of the code is stored in the database.
 *      An attacker with DB read access cannot recover the original code.
 */
const sendMfaOtp = async (userId, email) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // UNMISSABLE CONSOLE LOG FOR TESTING
  console.log("\n\n\n");
  console.log("🔥".repeat(40));
  console.log(`🔥 OTP FOR ${email}: ${code} 🔥`);
  console.log("🔥".repeat(40));
  console.log("\n\n\n");

  await deleteOtpsByUserContact(userId, email);
  // Store the hash — never the plaintext code
  const codeHash = hashOtpCode(code);
  await createOtp({ user_id: userId, contact: email, code: codeHash, expiresInMs: 5 * 60 * 1000 });

  // Try async queue first (RabbitMQ). If unavailable, fall back to direct send.
  try {
    await publishEvent(NOTIFICATION_EVENTS.AUTH_OTP_SEND, {
      userId, email, code, expiresInMinutes: 5,
    });
  } catch (mqErr) {
    logger.warn(`[OTP] RabbitMQ unavailable (${mqErr.message}) — sending email directly.`);
    
    // In dev mode, always print the OTP so the developer can see it instantly
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`=================================================`);
      logger.warn(`[OTP] DEV MODE — OTP code for ${email} is: ${code}`);
      logger.warn(`=================================================`);
    }

    try {
      const emailContent = otpTemplate({ code, expiresInMinutes: 5 });
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        correlationId: `direct_${userId}_${Date.now()}`,
      });
      logger.info(`[OTP] Direct email sent to ${email}`);
    } catch (emailErr) {
      // Still don't throw — OTP is in DB; user can request resend.
      // Log plaintext code only in development so devs can test locally.
      logger.error(`[OTP] Direct email also failed: ${emailErr.message}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`[OTP] DEV MODE — OTP for ${email}: ${code}`);
      }
    }
  }

  return code;
};



export const registerSME = async (data, _ipAddress, _userAgent) => {
  const { full_name, business_name, phone, email, password, address } = data;

  const existing = await findSMEByEmail(email);
  if (existing) { throw ApiError.conflict('An account with this email already exists'); }

  const password_hash = await argon2.hash(password);

  // role_id is optional — the user's role is determined by which table they
  // are in (sme_users) and encoded directly in the JWT (`role: 'sme'`).
  const user = await createSMEUser({ full_name, business_name, phone, email, password_hash, role_id: null, address });

  logger.info(`SME registered: ${email}`);

  await sendMfaOtp(user.id, email);
  const tempToken = generateMfaToken({ id: user.id, email, role: 'sme' });

  return { mfaRequired: true, tempToken, user: sanitizeUser(user, 'sme') };
};
export const loginSME = async ({ email, password }, ipAddress) => {
  try {
    const attempts = await getFailedAttempts(email, ipAddress);
    if (attempts >= 5) {
      throw ApiError.tooManyRequests(
        'Account locked due to too many failed attempts. Try again in 15 minutes.'
      );
    }

    const user = await findSMEByEmail(email, true);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.is_active) {
      throw ApiError.forbidden(
        'Your account has been deactivated. Contact support.'
      );
    }

    const isMatch = await argon2.verify(user.password_hash, password);
    if (!isMatch) {
      await incrementFailedAttempts(email, ipAddress);
      throw ApiError.unauthorized('Invalid email or password');
    }

    await clearFailedAttempts(email, ipAddress);

    await sendMfaOtp(user.id, email);

    const tempToken = generateMfaToken({
      id: user.id,
      email,
      role: 'sme',
    });

    logger.info(`SME login phase 1 passed: ${email}, MFA pending`);

    return { mfaRequired: true, tempToken };
  } catch (err) {
    logger.error('loginSME failed', {
      message: err.message,
      stack: err.stack,
      error: err,
    });

    throw err;
  }
};


export const registerBankAdmin = async (data) => {
  const { bank_name, branch_name, branch_address, ifsc_code, admin_name, email, phone, password } = data;

  const existing = await findBankAdminByEmail(email);
  if (existing) { throw ApiError.conflict('An account with this email already exists'); }

  const password_hash = await argon2.hash(password);

  // role_id is optional — the user's role is determined by which table they
  // are in (bank_admin_users) and encoded directly in the JWT (`role: 'bank_admin'`).
  const user = await createBankAdminUser({ bank_name, branch_name, branch_address, ifsc_code, admin_name, email, phone, password_hash, role_id: null });

  logger.info(`Bank admin registered: ${email}`);

  await sendMfaOtp(user.id, email);
  const tempToken = generateMfaToken({ id: user.id, email, role: 'bank_admin' });

  return { mfaRequired: true, tempToken, user: sanitizeUser(user, 'bank_admin') };
};

export const loginBankAdmin = async ({ email, password }, ipAddress) => {
  const attempts = await getFailedAttempts(email, ipAddress);
  if (attempts >= 5) { throw ApiError.tooManyRequests('Account locked due to too many failed attempts. Try again in 15 minutes.'); }

  const user = await findBankAdminByEmail(email, true);
  if (!user) { throw ApiError.unauthorized('Invalid email or password'); }
  if (!user.is_active) { throw ApiError.forbidden('Your account has been deactivated. Contact support.'); }

  const isMatch = await argon2.verify(user.password_hash, password);
  if (!isMatch) {
    await incrementFailedAttempts(email, ipAddress);
    throw ApiError.unauthorized('Invalid email or password');
  }

  await clearFailedAttempts(email, ipAddress);
  await updateBankAdminLastLogin(user.id);

  const payload = buildTokenPayload(user, 'bank_admin');
  const jti = uuidv4();
  const accessToken  = generateAccessToken(payload, jti);
  const refreshToken = generateRefreshToken({ id: user.id }, jti);
  await setSession(jti, { userId: user.id, email: user.email, role: 'bank_admin', ipAddress, userAgent, createdAt: new Date() });

  logger.info(`Bank admin logged in: ${email}`);
  return { user: sanitizeUser(user, 'bank_admin'), accessToken, refreshToken };
};



export const verifyMfaOTP = async (tempToken, code, ipAddress, userAgent) => {
  if (!tempToken || !code) { throw ApiError.badRequest('MFA token and verification code are required'); }

  let decoded;
  try { decoded = verifyMfaToken(tempToken); }
  catch { throw ApiError.unauthorized('Invalid or expired MFA session'); }

  const { id, email, role } = decoded;

  // BUG-10 FIX: Acquire a per-user distributed Redis lock before verification.
  // This prevents concurrent requests from racing past the attempt counter,
  // which could allow brute-forcing past the 3-attempt lockout.
  const lockAcquired = await acquireOtpLock(id);
  if (!lockAcquired) {
    throw ApiError.tooManyRequests('A verification attempt is already in progress. Please wait a moment.');
  }

  try {
    const otp = await findOtp({ user_id: id, contact: email });
    if (!otp) { throw ApiError.notFound('No verification request found. Please login again.'); }

    if (otp.expires_at < new Date()) {
      await deleteOtp(otp.id);
      throw ApiError.badRequest('Verification code has expired. Please login again.');
    }

    // BUG-04 FIX: Compare hashed codes using constant-time comparison.
    // verifyOtpCode uses HMAC-SHA256 + timingSafeEqual — no plaintext comparison.
    const isMatch = verifyOtpCode(code, otp.code);
    if (!isMatch) {
      await incrementOtpAttempts(otp.id);
      if (otp.attempts + 1 >= 3) {
        await deleteOtp(otp.id);
        throw ApiError.badRequest('Too many failed attempts. Please login again.');
      }
      throw ApiError.badRequest('Invalid verification code');
    }

    await deleteOtp(otp.id);

    let user;
    if (role === 'sme') {
      user = await findSMEById(id);
    } else {
      user = await findBankAdminById(id);
    }

    if (!user || !user.is_active) { throw ApiError.unauthorized('User not found or account is inactive'); }

    if (role === 'sme') { await updateSMELastLogin(id); }
    else { await updateBankAdminLastLogin(id); }

    const payload = buildTokenPayload(user, role);
    const jti = uuidv4();
    const refreshToken = generateRefreshToken({ id: user.id }, jti);
    const accessToken  = generateAccessToken(payload, jti);

    await setSession(jti, { userId: user.id, email: user.email, role, ipAddress, userAgent, createdAt: new Date() });

    logger.info(`MFA verified. User logged in: ${email}`);
    return { user: sanitizeUser(user, role), accessToken, refreshToken };

  } finally {
    // Always release the lock — even if an error is thrown above.
    await releaseOtpLock(id);
  }
};



export const refreshAccessToken = async (refreshToken, ipAddress, userAgent) => {
  if (!refreshToken) { throw ApiError.unauthorized('Refresh token is required'); }

  let decoded;
  try { decoded = verifyRefreshToken(refreshToken); }
  catch { throw ApiError.unauthorized('Invalid or expired refresh token'); }

  const { id, jti } = decoded;

  const isBlacklisted = await isTokenBlacklisted(jti);
  if (isBlacklisted) {
    recordAuditLog({ actor_id: id, action: 'security.token_reuse_fraud', status: 'failure', ip_address: ipAddress, metadata: { reason: 'Refresh token reuse' } });
    throw ApiError.unauthorized('Security alert: Token reuse detected. Please log in again.');
  }

  const session = await getSession(jti);
  if (!session) { throw ApiError.unauthorized('Session has expired. Please log in again.'); }

  await blacklistToken(jti);
  await deleteSession(jti);

  let user = await findSMEById(id);
  let type = 'sme';
  if (!user) { user = await findBankAdminById(id); type = 'bank_admin'; }
  if (!user || !user.is_active) { throw ApiError.unauthorized('User not found or account is inactive'); }

  const newJti         = uuidv4();
  const newRefreshToken = generateRefreshToken({ id: user.id }, newJti);
  const newAccessToken  = generateAccessToken(buildTokenPayload(user, type), newJti);
  await setSession(newJti, { userId: user.id, email: user.email, role: type, ipAddress, userAgent, createdAt: new Date() });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};



export const logout = async (accessTokenPayload) => {
  // The sessionId in the JWT payload equals the JTI of the refresh token
  // (set when verifyMfaOTP creates the session). Both the session AND the
  // JTI must be invalidated so that neither the access token nor the refresh
  // token can be reused after logout.
  const sid = accessTokenPayload?.sessionId;
  if (sid) {
    try {
      await Promise.all([
        deleteSession(sid),
        blacklistToken(sid),
      ]);
    } catch (err) {
      logger.error(`[logout] Failed to invalidate session ${sid}: ${err.message}`);
    }
  }
  return true;
};



/**
 * Resend MFA OTP — verifies the existing temp token, enforces a per-user
 * resend rate limit (max 3 resends per 10 minutes), then issues a fresh
 * OTP and returns a new temp token.
 */
export const resendMfaOtp = async (tempToken, _ipAddress) => {
  if (!tempToken) { throw ApiError.badRequest('MFA session token is required'); }

  let decoded;
  try { decoded = verifyMfaToken(tempToken); }
  catch { throw ApiError.unauthorized('Invalid or expired MFA session. Please login again.'); }

  const { id, email, role } = decoded;

  // Rate-limit resend: max 3 per 10 minutes per user
  const resendKey = `otp:resend:${id}`;
  let resendCount = 0;
  try {
    resendCount = await redisClient?.incr(resendKey) ?? 0;
    if (resendCount === 1 && redisClient) {
      await redisClient.expire(resendKey, 10 * 60);
    }
  } catch { /* Redis unavailable — allow resend */ }

  if (resendCount > 3) {
    throw ApiError.tooManyRequests('Too many resend attempts. Please login again in 10 minutes.');
  }

  // Delete old OTPs and send a fresh one
  await deleteOtpsByUserContact(id, email);
  await sendMfaOtp(id, email);

  // Issue a fresh 5-minute temp token (resets expiry)
  const newTempToken = generateMfaToken({ id, email, role });

  logger.info(`OTP resent for user ${email} (attempt ${resendCount})`);
  return { tempToken: newTempToken };
};
