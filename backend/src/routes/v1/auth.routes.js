import express from 'express';

import {
  smeRegister,
  smeLogin,
  bankAdminRegister,
  bankAdminLogin,
  verifyMfa,
  refresh,
  logout,
  getMe,
  resendOtp,
} from '../../controllers/auth.controller.js';
import { protect } from '../../middleware/auth.js';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import {
  smeRegisterSchema,
  bankAdminRegisterSchema,
  loginSchema,
  mfaVerifySchema,
  resendOtpSchema,
} from '../../validators/auth.validator.js';



const router = express.Router();


router.post(
  '/sme/register',
  authRateLimiter,
  validate(smeRegisterSchema),
  smeRegister
);

router.post(
  '/sme/login',
  authRateLimiter,
  validate(loginSchema),
  smeLogin
);


router.post(
  '/bank/register',
  authRateLimiter,
  validate(bankAdminRegisterSchema),
  bankAdminRegister
);

router.post(
  '/bank/login',
  authRateLimiter,
  validate(loginSchema),
  bankAdminLogin
);


// MFA verify — apply strict OTP rate limiter + schema validation
router.post(
  '/mfa/verify',
  otpRateLimiter,
  validate(mfaVerifySchema),
  verifyMfa
);

// MFA resend — allow up to 5 resend requests per window
router.post(
  '/mfa/resend',
  otpRateLimiter,
  validate(resendOtpSchema),
  resendOtp
);

router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;
