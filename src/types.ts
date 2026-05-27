// src/types.ts — shared types

export type AutonomyMode = 'off' | 'approve' | 'assist' | 'autopilot';
export type RiskLevel = 'low' | 'med' | 'high';
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';
export type ActionStatus = 'auto-completed' | 'approved-executed' | 'rejected' | 'blocked' | 'failed';

export type CapabilityName =
  | 'lead-reply'
  | 'listing-onboard'
  | 'fraud-check'
  | 'price-suggest'
  | 'broker-outreach'
  | 'blog-draft'
  | 'social-post'
  | 'nudge-broker';

export interface AgentTask<T = Record<string, unknown>> {
  id: string;
  capability: CapabilityName;
  input: T;
  status: TaskStatus;
  attempts: number;
  max_attempts: number;
  result?: unknown;
  error?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  dedup_key?: string;
}

export interface CapabilityResult {
  /** Plain-English summary of what the agent did (or wants to do) */
  summary: string;
  /** How sure the agent is, 0–1 */
  confidence: number;
  /** Risk classification — drives autonomy routing */
  risk: RiskLevel;
  /** The concrete action payload (what to write/post/send) */
  proposal: Record<string, unknown>;
  /** Reasoning trace for the audit log + admin console */
  trace: Array<{ state: 'done' | 'current' | 'blocked'; title: string; t: string }>;
  /** Evidence shown in the approval detail pane */
  evidence: Array<{ label: string; value: string }>;
  /** Optional: if this should always be queued for approval regardless of autonomy */
  force_approval?: boolean;
}

export interface ExecuteResult {
  ok: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export interface Capability<TInput = Record<string, unknown>> {
  name: CapabilityName;
  /** Reason about the input — pure, no side effects on external systems */
  reason: (input: TInput) => Promise<CapabilityResult>;
  /** Execute the proposed action (the side-effectful part) */
  execute: (input: TInput, proposal: Record<string, unknown>) => Promise<ExecuteResult>;
}
