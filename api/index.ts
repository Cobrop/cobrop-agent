// api/index.ts — Vercel serverless entrypoint.
// Uses @hono/node-server's Vercel adapter, which writes to the Node (req,res)
// signature Vercel's Node runtime expects. (hono/vercel is Edge-only and its
// returned Response gets ignored on the Node runtime → 404.)
//
// IMPORTANT: 'nodejs' is NOT a valid Vercel runtime value → it caused Vercel
// to attempt an Edge compile, which fails because @hono/node-server imports
// node:http. The function was never deployed → catch-all rewrite → 404.
// Fixed: use 'nodejs20.x' (or omit config entirely — Node.js is the default).

import { handle } from '@hono/node-server/vercel';
import app from '../src/index.js';

export const config = { runtime: 'nodejs20.x' };

export default handle(app);
