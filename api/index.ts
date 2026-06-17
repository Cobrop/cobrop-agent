// api/index.ts — Vercel serverless entrypoint (Node.js runtime).
//
// WHY NOT `@hono/node-server/vercel`:
//   That subpath may not be in the installed package's exports map, causing
//   a silent build failure → function never deployed → catch-all rewrite → 404.
//
// WHY NOT `hono/vercel`:
//   That adapter is Edge-only. It returns a Response object. Vercel's Node.js
//   runtime expects the handler to write to (req, res) instead → 404.
//
// FIX: use `getRequestListener` from the main @hono/node-server export.
//   It's always present, converts app.fetch to a Node.js (req,res) handler,
//   and is exactly what the /vercel subpath wraps internally.

import { getRequestListener } from '@hono/node-server';
import app from '../src/index.js';

export const config = { runtime: 'nodejs' };

export default getRequestListener(app.fetch);
