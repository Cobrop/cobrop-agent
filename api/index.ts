// api/index.ts — Vercel serverless entrypoint (Hono official adapter).
// Vercel compiles this file + its imports automatically; no tsc build needed.

import { handle } from 'hono/vercel';
import app from '../src/index.js';

export const config = { runtime: 'nodejs' };

export default handle(app);
