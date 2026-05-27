// scripts/trigger-task.ts — enqueue a task. PowerShell-friendly.
//
// Easy form (no JSON, no quote escaping):
//   npm run trigger blog-draft "title=How Addis brokers split fees with Nairobi" category=Co-brokerage
//   npm run trigger social-post channel=linkedin "topic=Why brokers join CoBrop" language=English
//   npm run trigger broker-outreach broker_id=abc-123 goal=re-engage
//
// Still works with JSON if you want:
//   npm run trigger -- lead-reply '{"inquiry_id":"..."}'

import 'dotenv/config';
import { supabase } from '../src/db/supabase.js';
import { listCapabilities } from '../src/capabilities/index.js';

const argv = process.argv.slice(2);

if (argv.length === 0) {
  console.error('Usage: npm run trigger <capability> [key=value …]');
  console.error('   or: npm run trigger -- <capability> "<json>"');
  console.error('\nAvailable capabilities:', listCapabilities().join(', '));
  process.exit(1);
}

const capability = argv[0];

if (!listCapabilities().includes(capability as never)) {
  console.error(`Unknown capability: ${capability}`);
  console.error('Available:', listCapabilities().join(', '));
  process.exit(1);
}

let input: Record<string, unknown> = {};
const rest = argv.slice(1);

if (rest.length === 1 && rest[0].trim().startsWith('{')) {
  try {
    input = JSON.parse(rest[0]);
  } catch (e) {
    console.error('Could not parse input JSON:', (e as Error).message);
    console.error('Hint: use key=value pairs instead.');
    process.exit(1);
  }
} else {
  for (const arg of rest) {
    const m = arg.match(/^([a-z0-9_]+)=(.*)$/i);
    if (!m) {
      console.error(`Bad argument "${arg}" — expected key=value`);
      process.exit(1);
    }
    const [, k, v] = m;
    if (/^-?\d+(\.\d+)?$/.test(v)) input[k] = Number(v);
    else if (v === 'true') input[k] = true;
    else if (v === 'false') input[k] = false;
    else if (v.startsWith('{') || v.startsWith('[')) {
      try { input[k] = JSON.parse(v); } catch { input[k] = v; }
    } else input[k] = v;
  }
}

const { data, error } = await supabase()
  .from('agent_tasks')
  .insert({ capability, input })
  .select('id')
  .single();

if (error) {
  console.error('Failed to enqueue:', error.message);
  process.exit(1);
}

console.log(`✓ Enqueued ${capability} task ${data.id}`);
console.log(`  Input: ${JSON.stringify(input)}`);
console.log(`  Watch the \`npm run dev\` terminal — task picks up in ≤${process.env.QUEUE_POLL_MS ?? 5000}ms.`);
process.exit(0);
