// src/queue/router.ts — autonomy gate
//
// Given a capability result + current autonomy mode + risk, decide:
//   - 'auto'     → execute the proposal immediately, log to audit
//   - 'pending'  → write to agent_approvals, wait for admin decision
//   - 'blocked'  → don't act, log refusal
//
// This is the same logic that powers the autonomy radio in the admin
// console's Tweaks panel and the per-capability matrix in Agent Settings.

import type { AutonomyMode, RiskLevel, CapabilityResult } from '../types.js';

export type Routing = 'auto' | 'pending' | 'blocked';

export function routeAction(
  mode: AutonomyMode,
  result: CapabilityResult,
): Routing {
  if (mode === 'off') return 'blocked';
  if (result.force_approval) return 'pending';
  if (mode === 'approve') return 'pending';
  if (mode === 'autopilot') {
    return result.risk === 'high' ? 'pending' : 'auto';
  }
  // assist (the recommended default)
  if (result.risk === 'high') return 'pending';
  if (result.risk === 'med') return 'pending';
  return 'auto';
}

// Human-readable explanation for the audit log
export function explainRouting(mode: AutonomyMode, risk: RiskLevel, routing: Routing): string {
  if (routing === 'blocked') return `Agent disabled (autonomy=off)`;
  if (routing === 'auto') return `Auto-executed (autonomy=${mode}, risk=${risk})`;
  return `Escalated for review (autonomy=${mode}, risk=${risk})`;
}
