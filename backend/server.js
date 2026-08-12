import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createApp } from './src/app.js';
import { initCloudinary } from './src/config/cloudinary.js';
import env from './src/config/env.js';
import logger from './src/utils/logger.js';
import { connectRabbitMQ, closeRabbitMQ } from './src/config/rabbitmq.js';
import { startOTPWorker } from './src/notifications/workers/otpWorker.js';
import { startEmailWorker } from './src/notifications/workers/emailWorker.js';
import { startDLQProcessor } from './src/notifications/dlq/dlqProcessor.js';
import { initSSEManager } from './src/notifications/sse/sseManager.js';
import { verifySmtpConnection } from './src/notifications/services/emailSender.service.js';



const start = async () => {
  try {
    logger.info('✅  Supabase Client Initialized');

    initCloudinary();

    // ── SSE + SMTP (non-fatal) ───────────────────────────────────────────────
    initSSEManager();
    await verifySmtpConnection();

    // ── RabbitMQ + Workers (optional — graceful degradation) ─────────────────
    // If RabbitMQ is unavailable (e.g. local dev without Docker), the server
    // still starts. OTPs are sent directly via sendMfaOtpDirect() fallback
    // in auth.service.js. Email worker and DLQ are simply not started.
    try {
      await connectRabbitMQ();
      await startOTPWorker();
      await startEmailWorker();
      await startDLQProcessor();
      logger.info('✅  RabbitMQ workers started');
    } catch (mqErr) {
      logger.warn(
        `⚠️  RabbitMQ unavailable (${mqErr.message}) — running in DIRECT email mode. OTPs will be sent synchronously.`
      );
    }

    // ── Express App ─────────────────────────────────────────────────────────
    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀  Backend running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📡  API base: http://localhost:${env.PORT}/api`);
    });

    server.timeout = 600000;

    // ── Graceful Shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully...`);
      try { await closeRabbitMQ(); } catch { /* ignore if not connected */ }
      server.close(() => {
        logger.info('✅  HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('⚠️  Could not close connections in time — forcefully shutting down');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

  } catch (err) {
    logger.error('❌  Failed to start server:', err);
    process.exit(1);
  }
};

start();
