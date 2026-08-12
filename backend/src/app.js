import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import router from './routes/index.js';


export const createApp = () => {
  const app = express();


  app.use(helmet());


  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, mobile apps, server-to-server)
        if (!origin) return callback(null, true);

        const allowedOrigins = env.NODE_ENV === 'production'
          ? (process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? [
              'https://capitalscale.vercel.app',
            ])
          : [
              'http://localhost:3000',
              'http://localhost:5173',
              'https://capitalscale.vercel.app',
            ];

        // Strip trailing slash for comparison
        const normalised = origin.replace(/\/$/, '');
        if (allowedOrigins.map(o => o.replace(/\/$/, '')).includes(normalised)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin '${origin}' is not allowed`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
      optionsSuccessStatus: 200,
    })
  );


  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));


  app.use(cookieParser());


  app.set("trust proxy", 1);
  app.use(requestLogger);


  app.use('/api', rateLimiter);


  app.use('/api', router);


  app.get('/', (_req, res) => {
    res.json({
      service: 'AI Loan Underwriting Backend',
      version: '1.0.0',
      status: 'running',
      docs: '/api/health',
    });
  });


  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });


  app.use(errorHandler);

  return app;
};

export default createApp;
