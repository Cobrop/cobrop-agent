// live-app.jsx — production console for the deployed CoBrop Agent backend.
// Polls /approvals, /agent/activity, /agent/kpis. Approve/Reject hits the
// backend. Stores backend URL + admin key in localStorage.

const { useState, useEffect, useCallback, useRef } = React;

// ── Config ---------------------------------------------------------
const LS_KEY = 'cobrop_agent_live_cfg';
const POLL_APPROVALS_MS = 8000;
const POLL_ACTIVITY_MS = 5000;
const POLL_KPIS_MS = 30000;

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
  catch { return null; }
}
function saveCfg(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}
function clearCfg() {
  localStorage.removeItem(LS_KEY);
}

// ── API client -----------------------------------------------------
function makeApi(cfg) {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const headers = { 'Authorization': `Bearer ${cfg.adminKey}`, 'Content-Type': 'application/json' };

  async function call(path, opts = {}) {
    const r = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
    const ct = r.headers.get('content-type') || '';
    return ct.includes('json') ? r.json() : r.text();
  }

  return {
    health: () => call('/health'),
    approvals: (status = 'pending') => call(`/approvals?status=${status}`),
    approve: (id) => call(`/approvals/${id}/approve`, { method: 'POST', body: '{}' }),
    reject: (id, reason) => call(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    snooze: (id) => call(`/approvals/${id}/snooze`, { method: 'POST', body: '{}' }),
    activity: (limit = 50) => call(`/agent/activity?limit=${limit}`),
    kpis: () => call(`/agent/kpis`),
    run: (capability, input) => call('/agent/run', { method: 'POST', body: JSON.stringify({ capability, input }) }),
  };
}

// ── Setup screen ---------------------------------------------------
function Setup({ onSave }) {
  const [baseUrl, setBaseUrl] = useState('https://your-agent.vercel.app');
  const [adminKey, setAdminKey] = useState('');
  const [status, setStatus] = useState({ kind: null, msg: '' });
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    setStatus({ kind: null });
    try {
      const api = makeApi({ baseUrl, adminKey });
      const h = await api.health();
      setStatus({ kind: 'ok', msg: `✓ Connected · ${h.service} · LLM: ${h.llm?.primary?.provider}` });
      // Also try a protected endpoint
      await api.approvals('pending');
      setStatus({ kind: 'ok', msg: '✓ Connected & authenticated. Click Save to continue.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: `✗ ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <h2>Connect to your CoBrop Agent backend</h2>
        <p>Point this console at your deployed agent. Both values are stored locally in your browser — never sent anywhere else.</p>
        <div className="setup-field">
          <label>Backend URL</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-agent.vercel.app" />
        </div>
        <div className="setup-field">
          <label>Admin key · SUPABASE_SERVICE_ROLE_KEY from your backend .env</label>
          <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="eyJhbGciOiJI…" />
        </div>
        {status.kind === 'err' && <div className="err">{status.msg}</div>}
        {status.kind === 'ok' && <div className="ok">{status.msg}</div>}
        <div className="setup-actions">
          <button className="btn" onClick={test} disabled={testing || !baseUrl || !adminKey}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button className="btn is-cyan" disabled={status.kind !== 'ok'}
            onClick={() => onSave({ baseUrl: baseUrl.replace(/\/$/, ''), adminKey })}>
            Save & connect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers --------------------------------------------------------
function fmtHM(ms) {
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`;
}
function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CAP_LABEL = {
  'lead-reply': 'Lead reply',
  'listing-onboard': 'Listing onboard',
  'fraud-check': 'Fraud check',
  'price-suggest': 'Price suggest',
  'broker-outreach': 'Broker outreach',
  'blog-draft': 'Blog draft',
  'social-post': 'Social post',
  'nudge-broker': 'Nudge broker',
};
const CAP_TONE = {
  'lead-reply': 't-lead',
  'listing-onboard': 't-listing',
  'fraud-check': 't-fraud',
  'price-suggest': 't-price',
  'broker-outreach': 't-outreach',
  'blog-draft': 't-marketing',
  'social-post': 't-marketing',
  'nudge-broker': 't-nudge',
};

// ── Approval detail pane -------------------------------------------
function ApprovalDetail({ item, api, onAction }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!item) {
    return (
      <div className="detail" style={{ alignItems: 'center', justifyContent: 'center', display: 'grid', placeItems: 'center', padding: 40, color: 'var(--cb-ink-3)', textAlign: 'center' }}>
        <div>
          <Icon.CheckCircle size={36} color="var(--cb-success)" />
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: 'var(--cb-ink)' }}>Inbox zero</div>
          <div style={{ marginTop: 4, fontSize: 12 }}>Nothing waiting for your review.</div>
        </div>
      </div>
    );
  }

  const tone = CAP_TONE[item.capability] || 't-lead';
  const proposal = typeof item.proposal === 'string' ? (() => { try { return JSON.parse(item.proposal); } catch { return item.proposal; } })() : item.proposal;
  const evidence = item.evidence || [];
  const trace = item.trace || [];

  const doAction = async (kind) => {
    setBusy(true); setErr(null);
    try {
      if (kind === 'approve') await api.approve(item.id);
      else if (kind === 'reject') await api.reject(item.id, 'manual reject');
      else if (kind === 'snooze') await api.snooze(item.id);
      onAction();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="detail">
      <div className="detail__head">
        <div className="detail__eyebrow">
          {CAP_LABEL[item.capability]} · <span style={{ fontFamily: 'var(--font-mono)' }}>{item.id}</span>
        </div>
        <div className="detail__title">{item.what}</div>
        <div className="detail__meta">
          <span className={'risktag is-' + item.risk}>{item.risk} risk</span>
          <span className="chip is-cyan">{Math.round(item.confidence * 100)}% conf</span>
          <span className="chip">{timeAgo(item.created_at)}</span>
        </div>
      </div>

      <div className="detail__body">
        {proposal && (
          <div>
            <div className="detail__section-title">Agent proposes</div>
            <ProposalView proposal={proposal} capability={item.capability} />
          </div>
        )}

        {trace.length > 0 && (
          <div>
            <div className="detail__section-title">Reasoning trace · {trace.length} steps</div>
            <div className="trace">
              {trace.map((s, i) => (
                <div key={i} className={'trace__step ' + (s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : '')}>
                  <div><b>{s.title}</b></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {evidence.length > 0 && (
          <div>
            <div className="detail__section-title">Evidence</div>
            <div className="evidence">
              {evidence.map((e, i) => (
                <div key={i} className="evidence__item">
                  <div className="lab">{e.label}</div>
                  <div className="val">{e.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {err && <div style={{ background: 'var(--cb-error-soft)', color: '#b92444', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}>{err}</div>}
      </div>

      <div className="detail__foot">
        <button className="btn is-success" disabled={busy} onClick={() => doAction('approve')}>
          <Icon.CheckCircle size={12} /> {busy ? 'Working…' : 'Approve & execute'}
        </button>
        <button className="btn is-danger" disabled={busy} onClick={() => doAction('reject')}>
          <Icon.XCircle size={12} /> Reject
        </button>
        <button className="btn is-ghost" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => doAction('snooze')}>
          <Icon.Slash size={12} /> Snooze 30m
        </button>
      </div>
    </div>
  );
}

function ProposalView({ proposal, capability }) {
  if (typeof proposal === 'string') {
    return <div className="proposed">{proposal}</div>;
  }
  // Capability-aware rendering for common fields
  const showFields = (fields) => fields
    .map(([key, label]) => proposal[key] != null ? <div key={key} style={{ marginBottom: 6 }}><b style={{ color: '#08323b' }}>{label}:</b> {String(proposal[key])}</div> : null)
    .filter(Boolean);

  if (capability === 'blog-draft') {
    return (
      <div className="proposed">
        <div style={{ fontWeight: 700, fontSize: 14, color: '#08323b', marginBottom: 6 }}>{proposal.title}</div>
        <div style={{ fontSize: 11.5, color: '#0a3d48', whiteSpace: 'pre-wrap' }}>{(proposal.body || '').slice(0, 1200)}{(proposal.body || '').length > 1200 ? '…' : ''}</div>
        {proposal.meta_description && <div style={{ fontSize: 11, marginTop: 8, color: '#0a3d48' }}><b>SEO:</b> {proposal.meta_description}</div>}
      </div>
    );
  }
  if (capability === 'social-post') {
    return (
      <div className="proposed">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{proposal.channel?.toUpperCase()} · {proposal.language}</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{proposal.body}</div>
        {proposal.hashtags?.length > 0 && <div style={{ marginTop: 6 }}>{proposal.hashtags.map(t => <span key={t} className="chip" style={{ marginRight: 4 }}>{t}</span>)}</div>}
      </div>
    );
  }
  if (capability === 'broker-outreach') {
    return (
      <div className="proposed">
        {showFields([['channel', 'Channel'], ['language', 'Language'], ['subject', 'Subject'], ['cta', 'CTA']])}
        <div style={{ marginTop: 6, padding: 8, background: '#fff', borderRadius: 4, whiteSpace: 'pre-wrap' }}>{proposal.message}</div>
      </div>
    );
  }
  if (capability === 'price-suggest') {
    return (
      <div className="proposed">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><b>Current:</b> {proposal.current_price?.toLocaleString()}</div>
          <div><b>Suggested:</b> {proposal.recommended_price?.toLocaleString()} ({proposal.change_pct > 0 ? '+' : ''}{proposal.change_pct}%)</div>
        </div>
        <div style={{ fontStyle: 'italic' }}>"{proposal.broker_copy}"</div>
      </div>
    );
  }
  if (capability === 'listing-onboard') {
    return (
      <div className="proposed">
        <div style={{ fontSize: 11, color: '#0a3d48', marginBottom: 6 }}><b>Picked variant {proposal.picked_variant}:</b></div>
        <div>{proposal.description}</div>
      </div>
    );
  }
  return <div className="proposed"><pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>{JSON.stringify(proposal, null, 2).slice(0, 1500)}</pre></div>;
}

// ── Main app -------------------------------------------------------
function LiveApp({ cfg, onDisconnect }) {
  const api = useRef(makeApi(cfg)).current;
  const [approvals, setApprovals] = useState([]);
  const [activity, setActivity] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [err, setErr] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const r = await api.approvals('pending');
      setApprovals(r.approvals || []);
      setErr(null);
      setLastSync(Date.now());
    } catch (e) { setErr(e.message); }
  }, [api]);

  const fetchActivity = useCallback(async () => {
    try {
      const r = await api.activity(40);
      setActivity(r.events || []);
    } catch (e) { /* keep showing last good */ }
  }, [api]);

  const fetchKpis = useCallback(async () => {
    try {
      const r = await api.kpis();
      setKpis(r);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { fetchApprovals(); fetchActivity(); fetchKpis(); }, [fetchApprovals, fetchActivity, fetchKpis]);
  useEffect(() => { const t = setInterval(fetchApprovals, POLL_APPROVALS_MS); return () => clearInterval(t); }, [fetchApprovals]);
  useEffect(() => { const t = setInterval(fetchActivity, POLL_ACTIVITY_MS); return () => clearInterval(t); }, [fetchActivity]);
  useEffect(() => { const t = setInterval(fetchKpis, POLL_KPIS_MS); return () => clearInterval(t); }, [fetchKpis]);

  // Keep selection valid
  useEffect(() => {
    if (!approvals.find(a => a.id === selectedId)) {
      setSelectedId(approvals[0]?.id || null);
    }
  }, [approvals, selectedId]);

  const selected = approvals.find(a => a.id === selectedId);
  const onActionDone = () => { fetchApprovals(); fetchActivity(); };

  const todayStats = kpis?.today || {};

  return (
    <div className="console density-regular">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">CB</div>
          <div className="sidebar__brand-text">
            <b>CoBrop Agent</b>
            <span>Live · production</span>
          </div>
        </div>
        <div className="sidebar__group">
          <div className="sidebar__group-title">Monitor</div>
          <nav className="sidebar__nav">
            <button className="is-active"><Icon.Activity size={14} /><span>Mission Control</span></button>
            <button><Icon.ListChecks size={14} /><span>Approvals</span>{approvals.length > 0 && <span className="count is-urgent">{approvals.length}</span>}</button>
            <button><Icon.Database size={14} /><span>Activity</span></button>
          </nav>
        </div>
        <div className="sidebar__footer">
          <div className="autonomy-card">
            <div className="autonomy-card__label">Connected to</div>
            <div className="autonomy-card__value" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
              <span className="dot"></span>{cfg.baseUrl.replace(/^https?:\/\//, '').slice(0, 28)}
            </div>
            <div className="autonomy-card__hint">{lastSync ? `Synced ${timeAgo(new Date(lastSync).toISOString())}` : 'Connecting…'}</div>
          </div>
          <button className="btn is-ghost" onClick={onDisconnect} style={{ color: 'rgba(255,255,255,0.7)' }}><Icon.XCircle size={11} /> Disconnect</button>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar__title">
          <span className="crumb">Live</span>
          <span className="topbar__crumb-sep">/</span>
          <h1>Mission Control</h1>
        </div>
        <div className="topbar__live">
          <span className="dot"></span>{err ? 'Connection issue' : 'Agent live'}
        </div>
        <div className="topbar__right">
          <div className="topbar__metric"><Icon.Inbox size={12} /> <b>{approvals.length}</b> <span>awaiting</span></div>
          <div className="topbar__metric"><Icon.Activity size={12} /> <b>{Math.round(Number(todayStats.tasks_today) || 0)}</b> <span>today</span></div>
          {todayStats.auto_pct != null && <div className="topbar__metric"><Icon.Zap size={12} /> <b>{Number(todayStats.auto_pct).toFixed(1)}%</b> <span>auto</span></div>}
        </div>
      </header>

      <main className="main">
        {err && (
          <div style={{ background: 'var(--cb-error-soft)', border: '1px solid #F2C2CC', color: '#b92444', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            ⚠ {err}
          </div>
        )}

        {/* Approvals: queue + detail */}
        <div className="row-2" style={{ gridTemplateColumns: '1.3fr 1fr', minHeight: 0, flex: 1 }}>
          <div className="card" style={{ minHeight: 0 }}>
            <div className="card__head">
              <div className="card__title"><Icon.ListChecks size={13} color="var(--cb-cyan)" /> Pending approvals</div>
              <span className="chip is-warn">{approvals.length}</span>
            </div>
            <div className="card__body is-flush" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              {approvals.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--cb-ink-3)' }}>
                  <Icon.CheckCircle size={28} color="var(--cb-success)" />
                  <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--cb-ink)' }}>Inbox zero</div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>Agent operating autonomously.</div>
                </div>
              ) : (
                <div className="queue">
                  {approvals.map(a => (
                    <div key={a.id} className={'queue__row' + (a.id === selectedId ? ' is-selected' : '')} onClick={() => setSelectedId(a.id)}>
                      <div className={'queue__row-icon ' + (CAP_TONE[a.capability] || 't-lead')}>
                        <Icon.Sparkles size={13} />
                      </div>
                      <div>
                        <div className="queue__what">{a.what}</div>
                        <div className="queue__who">{CAP_LABEL[a.capability] || a.capability} · {a.who || '—'}</div>
                      </div>
                      <div className={'queue__risk is-' + a.risk}>
                        <span className="queue__risk-bars">
                          <span className="on"></span>
                          <span className={a.risk === 'med' || a.risk === 'high' ? 'on' : ''}></span>
                          <span className={a.risk === 'high' ? 'on' : ''}></span>
                        </span>
                        {a.risk}
                      </div>
                      <div className="queue__sla"><div className="queue__sla-bar"><div style={{ width: '40%' }}></div></div></div>
                      <div className="queue__sla-time">{timeAgo(a.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ApprovalDetail item={selected} api={api} onAction={onActionDone} />
        </div>

        {/* Activity feed */}
        <div className="card">
          <div className="card__head">
            <div className="card__title"><Icon.Activity size={13} color="var(--cb-cyan)" /> Recent activity</div>
            <span className="chip is-success"><span className="dot-mini"></span>Live</span>
          </div>
          <div className="card__body is-flush" style={{ maxHeight: 360, overflow: 'auto' }}>
            {activity.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--cb-ink-3)', fontSize: 12 }}>No activity yet.</div>
            ) : (
              <div className="stream">
                {activity.map(ev => (
                  <div key={ev.id} className="stream__item">
                    <div className={'stream__icon ' + (CAP_TONE[ev.capability] || 't-lead')}>
                      <Icon.Sparkles size={11} />
                    </div>
                    <div className="stream__main">
                      <div className="stream__title">{ev.details?.summary || ev.capability}</div>
                      <div className="stream__meta">
                        <span>{CAP_LABEL[ev.capability] || ev.capability}</span>
                        <span className="sep">·</span>
                        <span>{ev.ref_entity || '—'}</span>
                        <span className="sep">·</span>
                        <span className={'stream__action is-' + (ev.status === 'auto-completed' ? 'auto' : ev.status === 'approved-executed' ? 'auto' : ev.status === 'failed' ? 'blocked' : 'pending')}>
                          {ev.status}
                        </span>
                        {ev.duration_ms && <><span className="sep">·</span><span>{ev.duration_ms}ms</span></>}
                      </div>
                    </div>
                    <div className="stream__time"><span className="ago">{timeAgo(ev.created_at)}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Root -----------------------------------------------------------
function Root() {
  const [cfg, setCfg] = useState(loadCfg);
  if (!cfg) return <Setup onSave={(c) => { saveCfg(c); setCfg(c); }} />;
  return <LiveApp cfg={cfg} onDisconnect={() => { clearCfg(); setCfg(null); }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
