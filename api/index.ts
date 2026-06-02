// api/index.ts — Vercel serverless entrypoint.
// Uses @hono/node-server's Vercel adapter, which writes to the Node (req,res)
// signature Vercel's Node runtime expects. (hono/vercel is Edge-only and its
// returned Response gets ignored on the Node runtime → 404.)

import { handle } from '@hono/node-server/vercel';
import app from '../src/index.js';

export const config = { runtime: 'nodejs' };

export default handle(app);
