import axios from 'axios';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

const _isBrevoConfigured = () => !!env.SMTP_PASS;

const _getSender = () => {
  let name = 'CapitalScale';
  let email = env.SMTP_USER || 'noreply@capitalscale.com';
  
  if (env.EMAIL_FROM) {
    const match = env.EMAIL_FROM.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
      name = match[1].trim();
      email = match[2].trim();
    } else {
      email = env.EMAIL_FROM;
    }
  }
  return { name, email };
};

// ── Exponential backoff delay ──────────────────────────────────────────────
const _backoffDelay = (retryCount) =>
  new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));

// ── Core send function with retry logic ────────────────────────────────────
/**
 * Send an email with exponential backoff retry using Brevo HTTP API.
 *
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} options.correlationId
 * @param {number} options.retryCount - Current attempt (0-based)
 * @param {number} options.maxRetries
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export const sendEmail = async ({ to, subject, html, correlationId, retryCount = 0, maxRetries = 10 }) => {
  // Simulated mode — no Brevo configured
  if (!_isBrevoConfigured()) {
    logger.info(`[EmailSender] SIMULATED → to:${to} | subject:${subject} | correlationId:${correlationId}`);
    logger.info(`[EmailSender] HTML snippet: ${html.replace(/<[^>]*>/g, '').slice(0, 150)}...`);
    return { success: true, messageId: `sim_${Date.now()}_${correlationId}` };
  }

  try {
    const sender = _getSender();
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: {
        name: sender.name,
        email: sender.email
      },
      to: [
        { email: to }
      ],
      subject,
      htmlContent: html,
      headers: {
        'X-Correlation-Id': correlationId,
        'X-Mailer': 'CapitalScale-NotificationWorker/1.0',
      }
    }, {
      headers: {
        'api-key': env.SMTP_PASS,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    logger.info(`[EmailSender] Sent via Brevo HTTP API → to:${to} | messageId:${response.data.messageId} | correlationId:${correlationId}`);
    return { success: true, messageId: response.data.messageId };

  } catch (err) {
    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    logger.error(`[EmailSender] Attempt ${retryCount + 1}/${maxRetries + 1} failed | to:${to} | error:${errorMsg} | correlationId:${correlationId}`);

    if (retryCount < maxRetries) {
      await _backoffDelay(retryCount + 1);
      return sendEmail({ to, subject, html, correlationId, retryCount: retryCount + 1, maxRetries });
    }

    // All retries exhausted
    logger.error(`[EmailSender] All ${maxRetries + 1} attempts exhausted for ${to} | correlationId:${correlationId}`);
    throw new Error(`Email delivery failed after ${maxRetries + 1} attempts: ${errorMsg}`);
  }
};

/**
 * Verify Brevo API connectivity (call on startup).
 */
export const verifySmtpConnection = async () => {
  if (!_isBrevoConfigured()) return false;
  
  try {
    await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': env.SMTP_PASS,
        'Accept': 'application/json'
      }
    });
    logger.info('✅ Brevo HTTP API connection verified');
    return true;
  } catch (err) {
    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    logger.warn(`⚠️  Brevo HTTP API verify failed: ${errorMsg} — emails will use simulated mode`);
    return false;
  }
};
