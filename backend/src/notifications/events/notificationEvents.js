/**
 * Canonical list of all notification event types.
 * Business services publish ONLY these events — they never import email logic.
 *
 * Convention: <domain>.<entity>.<action>
 */
export const NOTIFICATION_EVENTS = Object.freeze({
  // ── Authentication ────────────────────────────────────────────────────────
  AUTH_OTP_SEND: 'otp.send',


  // ── Loan Status Transitions ───────────────────────────────────────────────
  LOAN_SUBMITTED:           'loan.status.submitted',
  LOAN_ELIGIBILITY_CHECK:   'loan.status.eligibility_check',
  LOAN_AGENT_REVIEW:        'loan.status.agent_review',
  LOAN_MISSING_INFO:        'loan.status.missing_info',
  LOAN_APPROVED:            'loan.status.approved',
  LOAN_REJECTED:            'loan.status.rejected',
  LOAN_DISBURSED:           'loan.status.disbursed',
  LOAN_MISSING_INFO_COMPLETED: 'loan.missing_info.completed',

  // Future extensibility (not yet wired)
  AUTH_WELCOME_SME:         'auth.welcome.sme',
  AUTH_WELCOME_BANK:        'auth.welcome.bank_admin',
  AUTH_PASSWORD_RESET:      'auth.password_reset',
});

/**
 * Which statuses trigger an in-app notification to the SME.
 */
export const SME_IN_APP_STATUSES = new Set([
  'submitted',
  'eligibility_check',
  'agent_review',
  'missing_info',
  'approved',
  'rejected',
  'disbursed',
]);

/**
 * Which statuses trigger an email to the SME.
 */
export const SME_EMAIL_STATUSES = new Set([
  'missing_info',
  'approved',
  'rejected',
]);

/**
 * Maps a loan toStatus to an event type string.
 */
export const loanStatusToEvent = (toStatus) => {
  const map = {
    submitted:          NOTIFICATION_EVENTS.LOAN_SUBMITTED,
    eligibility_check:  NOTIFICATION_EVENTS.LOAN_ELIGIBILITY_CHECK,
    agent_review:       NOTIFICATION_EVENTS.LOAN_AGENT_REVIEW,
    missing_info:       NOTIFICATION_EVENTS.LOAN_MISSING_INFO,
    approved:           NOTIFICATION_EVENTS.LOAN_APPROVED,
    rejected:           NOTIFICATION_EVENTS.LOAN_REJECTED,
    disbursed:          NOTIFICATION_EVENTS.LOAN_DISBURSED,
  };
  return map[toStatus] || null;
};
