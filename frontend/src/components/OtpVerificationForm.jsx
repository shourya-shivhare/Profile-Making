import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertCircle, Loader2, ArrowRight, RotateCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext.jsx';


const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Shared MFA OTP verification form used for both SME and Bank Admin flows.
 *
 * Props:
 *  - tempToken      : The current MFA session token from the login/register response
 *  - setTempToken   : Setter to update the token when resend generates a new one
 *  - onVerifySuccess: Called after successful OTP verification (user object returned)
 *  - onCancel       : Called when user clicks "Back to Login"
 *  - accentColor    : 'blue' (SME, default) or 'emerald' (Bank Admin)
 */
export default function OtpVerificationForm({
  tempToken,
  setTempToken,
  onVerifySuccess,
  onCancel,
  accentColor = 'blue',
}) {
  const { verifyMfa, resendOtp, isLoading } = useAuth();

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);

  const inputRefs = useRef([]);

  // ─── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ─── Derived styles ───────────────────────────────────────────────────────
  const accent = {
    blue: {
      ring:   'focus:ring-blue-500/30 focus:border-blue-500/50',
      btn:    'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 shadow-blue-500/20 hover:shadow-blue-500/30',
      resend: 'text-blue-400 hover:text-blue-300',
      icon:   'bg-blue-500/20 border-blue-500/30',
      iconClr:'text-blue-400',
    },
    emerald: {
      ring:   'focus:ring-emerald-500/30 focus:border-emerald-500/50',
      btn:    'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 shadow-emerald-500/20 hover:shadow-emerald-500/30',
      resend: 'text-emerald-400 hover:text-emerald-300',
      icon:   'bg-emerald-500/20 border-emerald-500/30',
      iconClr:'text-emerald-400',
    },
  }[accentColor] || {};

  // ─── OTP digit input handling (individual boxes) ──────────────────────────
  const handleDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    // Auto-advance to next box
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtpDigits(next);
    // Focus last filled box
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();
  };

  const otpCode = otpDigits.join('');

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    setResendSuccess('');

    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }

    try {
      const user = await verifyMfa(tempToken, otpCode);
      onVerifySuccess(user);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Verification failed. Please check the code.';
      setOtpError(msg);
      // Clear digits on failure so user can retry cleanly
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || isLoading) return;
    setOtpError('');
    setResendSuccess('');

    try {
      const result = await resendOtp(tempToken);
      if (result?.tempToken) {
        setTempToken(result.tempToken);
      }
      setResendSuccess('A new verification code has been sent to your email.');
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setOtpError(err?.response?.data?.message || 'Failed to resend code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Header */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-4 ${accent.icon}`}>
              <ShieldCheck className={`w-7 h-7 ${accent.iconClr}`} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Verify Your Identity</h1>
            <p className="text-slate-400 text-sm">
              Enter the 6-digit code sent to your email address
            </p>
          </div>

          {/* Error alert */}
          {otpError && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm">{otpError}</p>
            </div>
          )}

          {/* Success alert */}
          {resendSuccess && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-6 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0 rounded-full bg-emerald-400/20 flex items-center justify-center">
                <span className="text-[10px] font-bold">✓</span>
              </div>
              <p className="text-emerald-400 text-sm">{resendSuccess}</p>
            </div>
          )}

          {/* OTP form */}
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 text-center">
                Verification Code
              </label>

              {/* 6-box digit input */}
              <div
                className="flex gap-2 justify-center"
                onPaste={handlePaste}
              >
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    autoFocus={i === 0}
                    className={`w-11 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-white text-xl font-mono font-bold focus:outline-none focus:ring-2 transition-all ${accent.ring} ${digit ? 'border-white/25' : ''}`}
                    aria-label={`OTP digit ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className={`w-full flex items-center justify-center gap-2 ${accent.btn} disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify &amp; Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend + Back */}
          <div className="mt-6 space-y-3 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || isLoading}
              className={`${accent.resend} disabled:text-slate-500 text-sm transition-colors font-medium flex items-center justify-center gap-1.5 mx-auto`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading && countdown === 0 ? 'animate-spin' : ''}`} />
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
