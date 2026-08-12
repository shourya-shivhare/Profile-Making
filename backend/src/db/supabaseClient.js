import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import env from '../config/env.js';
import logger from '../utils/logger.js';


if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

// Custom fetch wrapper using axios to bypass Node 18's native fetch IPv6 bugs
const customFetch = async (url, options = {}) => {
  try {
    const response = await axios({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      data: options.body,
      responseType: 'text',
      validateStatus: () => true, // resolve on any HTTP status
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: {
        get: (name) => response.headers[name.toLowerCase()],
        forEach: (cb) => {
          Object.entries(response.headers).forEach(([k, v]) => cb(v, k));
        },
      },
      text: async () => response.data,
      json: async () => (typeof response.data === 'string' ? JSON.parse(response.data) : response.data),
    };
  } catch (error) {
    logger.error(`Axios wrapper error for ${url}:`, error.message, error.code);
    throw error;
  }
};

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: customFetch
  }
});

logger.info('✅  Supabase Client Initialized');

export default supabase;
