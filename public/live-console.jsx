// live-console.jsx — Full CoBrop production console
// ALL 10 tabs + real backend data
// Loads after: agent-icons, agent-data, tweaks-panel, agent-shell,
//              agent-screens, agent-screens-extra, agent-console

const { useState, useEffect, useCallback, useRef } = React;

// ── Config ──────────────────────────────────────────────────────────
const LC_KEY = 'cobrop_agent_live_cfg';
function lcLoad() { try { return JSON.parse(localStorage.getItem(LC_KEY) || 'null'); } catch { return null; } }
function lcSave(c) { localStorage.setItem(LC_KEY, JSON.stringify(c)); }
function lcClear() { localStorage.removeItem(LC_KEY); }

// ── API client ───────────────────────────────────────────────────────
function makeLiveApi(cfg) {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const hdrs = { 'Authorization': `Bearer ${cfg.adminKey}`, 'Content-Type': 'application/json' };

  async function call(path, opts = {}) {
    const r = await fetch(base + path, { ...opts, headers: { ...hdrs, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.headers.get('content-type')?.includes('json') ? r.json() : r.text();
  }

  return {
    health:           ()                    => call('/health'),
    approvals:        (s = 'pending')       => call(`/approvals?status=${s}`),
    approve:          (id, edited)          => call(`/approvals/${id}/approve`,  { method: 'POST', body: JSON.stringify(edited ? { edited_proposal: edited } : {}) }),
    reject:           (id, reason)          => call(`/approvals/${id}/reject`,   { method: 'POST', body: JSON.stringify({ reason }) }),
    snooze:           (id)                  => call(`/approvals/${id}/snooze`,   { method: 'POST', body: '{}' }),
    activity:         (n = 50)              => call(`/agent/activity?limit=${n}`),
    kpis:             ()                    => call('/agent/kpis'),
    // AI draft — calls Groq/Gemini on your backend (no Claude API key needed)
    draft:            (prompt, system)      => call('/agent/draft', { method: 'POST', body: JSON.stringify({ prompt, system, max_tokens: 1200, temperature: 0.4 }) }),
    // Marketing — /agent/marketing/schedule and /agent/blog/schedule never
    // existed (confirmed 404 in production); both draft flows silently
    // failed to create a real, approvable task. /agent/run already does
    // exactly this (enqueue + process immediately) for any capability.
    marketingFeed:    ()                    => call('/agent/marketing/feed'),
    marketingSchedule:(body)               => call('/agent/run', { method: 'POST', body: JSON.stringify({ capability: 'social-post', input: body }) }),
    // Blog
    blogFeed:         ()                    => call('/agent/blog/feed'),
    blogSchedule:     (body)               => call('/agent/run', { method: 'POST', body: JSON.stringify({ capability: 'blog-draft', input: body }) }),
    // Real rows from blog_posts. blog-draft.execute() writes status:'draft', so
    // publishing is a separate deliberate step rather than part of approval.
    blogPosts:        (n = 25)              => call(`/agent/blog/posts?limit=${n}`),
    blogPublish:      (id)                  => call(`/agent/blog/posts/${id}/publish`, { method: 'POST', body: '{}' }),
    // Manual run
    run:              (capability, input)   => call('/agent/run', { method: 'POST', body: JSON.stringify({ capability, input }) }),
    // Broker recruitment — real prospects (broker_prospects table), added
    // manually since no sourcing pipeline exists (no scraping/purchased list).
    prospects:        (status = 'new')      => call(`/agent/prospects?status=${status}`),
    addProspect:      (body)               => call('/agent/prospects', { method: 'POST', body: JSON.stringify(body) }),
  };
}

// ── Adapters: backend → prototype shape ─────────────────────────────
const C2T = {
  'lead-reply':       'lead',      'listing-onboard': 'listing',
  'fraud-check':      'fraud',     'price-suggest':   'price',
  'broker-outreach':  'outreach',  'blog-draft':      'marketing',
  'social-post':      'marketing', 'nudge-broker':    'nudge',
};

function lcAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function adaptApproval(a) {
  return {
    id: a.id, what: a.what,
    who: a.who || a.ref_entity || '—',
    type: C2T[a.capability] || 'lead',
    risk: a.risk || 'med',
    urgency: a.risk === 'high' ? 'urgent' : a.risk === 'med' ? 'warn' : 'ok',
    elapsedMs: Math.max(0, Date.now() - new Date(a.created_at).getTime()),
    capability: a.capability, proposal: a.proposal,
    evidence: a.evidence, trace: a.trace,
    confidence: a.confidence, created_at: a.created_at,
  };
}

function adaptActivity(ev) {
  const action = (ev.status === 'auto-completed' || ev.status === 'approved-executed')
    ? 'auto' : ev.status === 'failed' ? 'blocked' : 'pending';
  const title = (ev.details && (ev.details.summary || ev.details.title)) || ev.capability || '—';
  return {
    uid: ev.id,
    type: C2T[ev.capability] || 'lead',
    title,
    meta: [ev.ref_entity, ev.status, ev.duration_ms ? `${ev.duration_ms}ms` : null].filter(Boolean).join(' · '),
    action,
    t: new Date(ev.created_at).getTime(),
    isNew: false,
    ref: String(ev.ref_entity || ev.id || '').slice(0, 12),
    risk: action === 'blocked' ? 'high' : action === 'pending' ? 'med' : 'low',
  };
}

// ── Setup modal ──────────────────────────────────────────────────────
function LiveSetup({ onSave }) {
  const [baseUrl,  setBaseUrl]  = useState('https://your-agent.vercel.app');
  const [adminKey, setAdminKey] = useState('');
  const [status,   setStatus]   = useState({ kind: null, msg: '' });
  const [testing,  setTesting]  = useState(false);

  const test = async () => {
    setTesting(true); setStatus({ kind: null });
    try {
      const api = makeLiveApi({ baseUrl, adminKey });
      const h = await api.health();
      await api.approvals('pending');
      setStatus({ kind: 'ok', msg: `✓ Connected · ${h.service || 'CoBrop Agent'} · Click Save to continue.` });
    } catch (e) {
      setStatus({ kind: 'err', msg: `✗ ${e.message}` });
    } finally { setTesting(false); }
  };

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <h2>Connect to your CoBrop Agent backend</h2>
        <p>Enter your deployed Vercel URL and admin key (SUPABASE_SERVICE_ROLE_KEY). Stored in your browser only.</p>
        <div className="setup-field">
          <label>Backend URL</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-agent.vercel.app" />
        </div>
        <div className="setup-field">
          <label>Admin key · SUPABASE_SERVICE_ROLE_KEY</label>
          <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="eyJhbGciOiJI…" />
        </div>
        {status.kind === 'err' && <div className="err">{status.msg}</div>}
        {status.kind === 'ok'  && <div className="ok">{status.msg}</div>}
        <div className="setup-actions">
          <button className="btn" onClick={test} disabled={testing || !baseUrl || !adminKey}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button className="btn is-cyan" disabled={status.kind !== 'ok'}
            onClick={() => onSave({ baseUrl: baseUrl.replace(/\/$/, ''), adminKey })}>
            Save &amp; connect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Live status bar ──────────────────────────────────────────────────
function LiveStatusBar({ kpis, err, lastSync }) {
  const today = kpis?.today || {};
  return (
    <div className="live-status-bar">
      {err ? (
        <span className="live-status-bar__err">
          <Icon.AlertTriangle size={12} /> {err} · Retrying…
        </span>
      ) : (
        <>
          <span className="chip is-success" style={{ fontSize: 11 }}>
            <span className="dot-mini"></span>Live · production
          </span>
          {today.tasks_today != null && (
            <span className="chip" style={{ fontSize: 11 }}>
              <Icon.Zap size={11} /> {Number(today.tasks_today)} tasks today
            </span>
          )}
          {today.auto_pct != null && (
            <span className="chip" style={{ fontSize: 11 }}>
              <Icon.Activity size={11} /> {Number(today.auto_pct).toFixed(1)}% auto
            </span>
          )}
          {kpis?.approvals_pending != null && kpis.approvals_pending > 0 && (
            <span className="chip is-warn" style={{ fontSize: 11 }}>
              <Icon.ListChecks size={11} /> {kpis.approvals_pending} pending
            </span>
          )}
          {lastSync && (
            <span className="live-status-bar__sync">
              Synced {lcAgo(new Date(lastSync).toISOString())}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ── Main live agent console ──────────────────────────────────────────
const LIVE_DEFAULTS = { autonomy: 'assist', density: 'regular' };

function LiveAgentConsole({ cfg, onDisconnect }) {
  const api = useRef(makeLiveApi(cfg)).current;
  const EngineCtx = window.__AgentEngineContext;

  const [t, setTweak]               = useTweaks(LIVE_DEFAULTS);
  const [screen, setScreen]         = useState('overview');
  const [polledEvents, setPolled]   = useState([]);
  const [localEvents,  setLocal]    = useState([]);
  const [approvals,  setApprovals]  = useState([]);
  const [kpis,       setKpis]       = useState(null);
  const [marketingFeed, setMktFeed] = useState({ executed: [], pending_approvals: [] });
  const [blogFeed,   setBlogFeed]   = useState({ executed: [], pending_approvals: [] });
  const [blogPosts,  setBlogPosts]  = useState(null); // null = not loaded yet, [] = loaded and empty
  const [prospects,  setProspects]  = useState([]);
  const [paused,     setPaused]     = useState(false);
  const [now,        setNow]        = useState(Date.now());
  const [agentThinking, setAT]      = useState(false);
  const [toasts,     setToasts]     = useState([]);
  const [draftModal, setDraftModal] = useState(null);
  const [err,        setErr]        = useState(null);
  const [lastSync,   setLastSync]   = useState(null);
  const toastId = useRef(1);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Toasts
  const pushToast = useCallback((toast) => {
    const id = toastId.current++;
    const dur = toast.duration ?? (toast.kind === 'thinking' ? null : 3800);
    setToasts(p => [...p, { ...toast, id }]);
    if (dur) setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), dur);
    return id;
  }, []);
  const dismissToast = useCallback((id) => setToasts(p => p.filter(x => x.id !== id)), []);

  // ── Backend AI draft — routes through YOUR Groq/Gemini backend ───
  const agentDraft = useCallback(async (prompt, system) => {
    const resp = await api.draft(prompt, system);
    if (!resp.text) throw new Error('Empty response from /agent/draft');
    return resp.text;
  }, [api]);

  // ── Polling ──────────────────────────────────────────────────────
  const fetchApprovals = useCallback(async () => {
    try {
      const r = await api.approvals('pending');
      setApprovals((r.approvals || []).map(adaptApproval));
      setErr(null); setLastSync(Date.now());
    } catch (e) { setErr(e.message); }
  }, [api]);

  const fetchActivity = useCallback(async () => {
    try {
      const r = await api.activity(60);
      setPolled((r.events || []).map(adaptActivity));
      setLocal([]);
    } catch { }
  }, [api]);

  const fetchKpis = useCallback(async () => {
    try { setKpis(await api.kpis()); } catch { }
  }, [api]);

  const fetchMarketingFeed = useCallback(async () => {
    try { setMktFeed(await api.marketingFeed()); } catch { }
  }, [api]);

  const fetchBlogFeed = useCallback(async () => {
    try { setBlogFeed(await api.blogFeed()); } catch { }
  }, [api]);

  const fetchProspects = useCallback(async () => {
    try { const r = await api.prospects('new'); setProspects(r.prospects || []); } catch { }
  }, [api]);

  // Real blog_posts rows. Kept separate from blogFeed (which reads agent_actions
  // and agent_approvals) because publishing acts on the post itself.
  const fetchBlogPosts = useCallback(async () => {
    try { const r = await api.blogPosts(25); setBlogPosts(r.posts || []); } catch { setBlogPosts([]); }
  }, [api]);

  useEffect(() => {
    fetchApprovals(); fetchActivity(); fetchKpis();
    fetchMarketingFeed(); fetchBlogFeed(); fetchProspects(); fetchBlogPosts();
  }, [fetchApprovals, fetchActivity, fetchKpis, fetchMarketingFeed, fetchBlogFeed, fetchProspects, fetchBlogPosts]);

  useEffect(() => { const id = setInterval(fetchApprovals,     8000); return () => clearInterval(id); }, [fetchApprovals]);
  useEffect(() => { const id = setInterval(fetchActivity,      5000); return () => clearInterval(id); }, [fetchActivity]);
  useEffect(() => { const id = setInterval(fetchKpis,         30000); return () => clearInterval(id); }, [fetchKpis]);
  useEffect(() => { const id = setInterval(fetchMarketingFeed,20000); return () => clearInterval(id); }, [fetchMarketingFeed]);
  useEffect(() => { const id = setInterval(fetchProspects,    20000); return () => clearInterval(id); }, [fetchProspects]);
  useEffect(() => { const id = setInterval(fetchBlogFeed,     20000); return () => clearInterval(id); }, [fetchBlogFeed]);
  useEffect(() => { const id = setInterval(fetchBlogPosts,    20000); return () => clearInterval(id); }, [fetchBlogPosts]);

  // Combined feed
  const allEvents = [...localEvents, ...polledEvents].slice(0, 80);

  // Optimistic push
  const pushEvent = useCallback((ev) => {
    const full = {
      ...ev,
      ref: ev.ref || `EV-${Date.now()}`,
      uid: ev.uid || `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      t:   ev.t   || Date.now(),
      isNew: true,
    };
    setLocal(p => [full, ...p].slice(0, 20));
    return full;
  }, []);

  // ── Actions (real API) ────────────────────────────────────────────
  const approve = useCallback(async (id) => {
    const item = approvals.find(a => a.id === id);
    try {
      await api.approve(id);
      setApprovals(p => p.filter(a => a.id !== id));
      if (item) pushEvent({
        type: item.type, action: 'auto', risk: 'low',
        title: `Approved & executed · ${item.what}`,
        meta: `Admin approved · ${item.who}`,
      });
      pushToast({ kind: 'success', title: 'Approved', msg: item?.what || 'Action executed' });
      setTimeout(() => { fetchActivity(); fetchMarketingFeed(); fetchBlogFeed(); }, 2000);
    } catch (e) {
      // If execute failed (e.g. LinkedIn not configured), show the content so user can copy-paste
      const isSocial = item?.capability === 'social-post';
      const isBlog   = item?.capability === 'blog-draft';
      if (isSocial || isBlog) {
        let body = '';
        try {
          const p = typeof item.proposal === 'string' ? JSON.parse(item.proposal) : item.proposal;
          body = p?.body || p?.intro || p?.message || JSON.stringify(p, null, 2);
        } catch { body = item?.proposal || ''; }
        setDraftModal({
          title:   item?.what || (isSocial ? 'Social post' : 'Blog draft'),
          eyebrow: item?.capability,
          body,
          status:  'done',
          kind:    isSocial ? 'social' : 'blog',
          badges:  ['Copy to clipboard — could not auto-publish: ' + e.message],
        });
        pushToast({ kind: 'error', title: 'Could not auto-publish', msg: 'Content shown for manual posting · ' + e.message.slice(0, 80) });
      } else {
        pushToast({ kind: 'error', title: 'Approve failed', msg: e.message });
      }
    }
  }, [api, approvals, pushEvent, pushToast, fetchActivity, fetchMarketingFeed, fetchBlogFeed]);

  const reject = useCallback(async (id, reason) => {
    const item = approvals.find(a => a.id === id);
    try {
      await api.reject(id, reason || 'manual reject');
      setApprovals(p => p.filter(a => a.id !== id));
      if (item) pushEvent({
        type: item.type, action: 'blocked', risk: 'high',
        title: `Rejected · ${item.what}`,
        meta: 'Admin override · agent will not retry',
      });
      pushToast({ kind: 'error', title: 'Rejected', msg: item?.what || 'Action blocked' });
    } catch (e) { pushToast({ kind: 'error', title: 'Error', msg: e.message }); }
  }, [api, approvals, pushEvent, pushToast]);

  const snooze = useCallback(async (id) => {
    try {
      await api.snooze(id);
      setApprovals(p => p.map(a => a.id === id ? { ...a, elapsedMs: 0 } : a));
      pushToast({ kind: 'info', title: 'Snoozed', msg: 'SLA reset by 30 minutes' });
    } catch (e) { pushToast({ kind: 'error', title: 'Error', msg: e.message }); }
  }, [api, pushToast]);

  // ── AI: run agent task via YOUR backend ───────────────────────────
  const runAgentTask = useCallback(async ({ category } = {}) => {
    if (agentThinking) return;
    setAT(true);
    const thinkId = pushToast({ kind: 'thinking', title: 'Agent reasoning…', msg: 'Picking next move from the platform queue' });
    const { TASK_TYPES } = window.CB_DATA;
    const allowed = category
      ? [category]
      : ['lead', 'listing', 'outreach', 'marketing', 'price', 'nudge', 'translate', 'fraud'];

    const prompt = `You are CoBrop's autonomous platform agent for an East African + Arab Gulf real-estate co-brokerage platform. Brokers operate in Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar.

Decide on ONE realistic next action RIGHT NOW. Pick from: ${allowed.join(', ')}.
Be SPECIFIC: real broker handles (@meron.t, @faisal.h), neighborhoods (Bole, Kazanchis, Karen, Marina), numbers. Terse, professional. NO emoji.

Output ONLY this JSON (no markdown, no explanation):
{"type":"<${allowed.join('|')}>","title":"<max 80 chars>","meta":"<3 facts · separated · max 60 chars>","risk":"<low|med|high>"}`;

    try {
      const raw = await agentDraft(prompt);
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON found');
      const parsed = JSON.parse(m[0]);
      if (!parsed.type || !TASK_TYPES[parsed.type]) parsed.type = allowed[0];
      const risk   = parsed.risk || 'low';
      const mode   = t.autonomy;
      const action = mode === 'suggest' ? 'pending'
                   : mode === 'autopilot' ? (risk === 'high' ? 'pending' : 'auto')
                   : (risk === 'high' || risk === 'med') ? 'pending' : 'auto';
      pushEvent({ type: parsed.type, title: parsed.title, meta: parsed.meta, risk, action });
      dismissToast(thinkId);
      pushToast({ kind: 'success', title: 'Agent acted', msg: parsed.title });
      if (action === 'pending') setTimeout(fetchApprovals, 2000);
    } catch (e) {
      dismissToast(thinkId);
      pushToast({ kind: 'error', title: 'Agent error', msg: e.message || "Couldn't reason · check /agent/draft endpoint" });
    } finally { setAT(false); }
  }, [agentThinking, agentDraft, t.autonomy, pushToast, dismissToast, pushEvent, fetchApprovals]);

  // Kicks off the real capability run (blog-draft / social-post) once the
  // fast preview text is showing, and sets modal.publish so the Publish
  // button reflects what actually happened — auto-published, ready to
  // approve, or failed — instead of the old dead button that did nothing
  // because /agent/blog/schedule and /agent/marketing/schedule never
  // existed (confirmed 404) and nothing was ever wired to click anyway.
  const preparePublish = useCallback(async (scheduleCall) => {
    setDraftModal(d => d ? { ...d, publish: { state: 'preparing' } } : null);
    try {
      const r = await scheduleCall();
      if (r.status === 'auto-completed') {
        setDraftModal(d => d ? { ...d, publish: { state: 'published' } } : null);
        fetchActivity();
      } else if (r.status === 'pending' && r.approvalId) {
        setDraftModal(d => d ? { ...d, publish: { state: 'ready', approvalId: r.approvalId } } : null);
        fetchApprovals();
      } else {
        setDraftModal(d => d ? { ...d, publish: { state: 'error', message: r.error || 'Could not prepare for publish' } } : null);
      }
    } catch (e) {
      setDraftModal(d => d ? { ...d, publish: { state: 'error', message: e.message } } : null);
    }
  }, [fetchActivity, fetchApprovals]);

  // ── AI: draft blog post via YOUR backend ──────────────────────────
  const draftBlogPost = useCallback(async ({ title, category }) => {
    if (agentThinking) return;
    setAT(true);
    setDraftModal({ title, eyebrow: category, body: '', status: 'thinking', kind: 'blog' });
    const thinkId = pushToast({ kind: 'thinking', title: 'Drafting blog post…', msg: title.slice(0, 50) });

    const prompt = `You are CoBrop's blog writer. CoBrop connects brokers in Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar for cross-border co-brokerage.
BRAND VOICE: confident, educational, empowering. Regional data + concrete broker stories. NO emoji, NO clichés, NO hype.
Write the FIRST 4 short paragraphs.
TITLE: "${title}"
CATEGORY: ${category}
Output ONLY the post body (no title, no headings, no meta).`;

    try {
      const text = await agentDraft(prompt);
      setDraftModal(d => d ? { ...d, body: text.trim(), status: 'done' } : null);
      dismissToast(thinkId);
      pushToast({ kind: 'success', title: 'Draft ready', msg: `~${text.split(/\s+/).length} words drafted` });
      pushEvent({
        type: 'marketing', action: 'pending', risk: 'low',
        title: `Drafted blog post · ${title}`,
        meta: `${category} · ~${text.split(/\s+/).length} words · awaiting review`,
      });
      // Run the real blog-draft capability (full structured draft, not the
      // 4-paragraph preview above) so the Publish button has something real
      // to approve.
      preparePublish(() => api.blogSchedule({ title, category }));
    } catch (e) {
      setDraftModal(d => d ? { ...d, status: 'error', body: e.message } : null);
      dismissToast(thinkId);
      pushToast({ kind: 'error', title: 'Draft failed', msg: e.message });
    } finally { setAT(false); }
  }, [agentThinking, agentDraft, pushToast, dismissToast, pushEvent, api, preparePublish]);

  // ── AI: generic generate + preview via YOUR backend ───────────────
  const generateAndPreview = useCallback(async ({ title, eyebrow, kind, channel, topicSub, prompt, badges }) => {
    if (agentThinking) return;
    setAT(true);
    setDraftModal({ title, eyebrow, body: '', status: 'thinking', kind, badges });
    const thinkId = pushToast({ kind: 'thinking', title: 'Agent drafting…', msg: title.slice(0, 50) });
    try {
      const text = await agentDraft(prompt);
      setDraftModal(d => d ? { ...d, body: text.trim(), status: 'done' } : null);
      dismissToast(thinkId);
      pushToast({ kind: 'success', title: 'Draft ready', msg: title.slice(0, 50) });
      // Schedule as a real backend task for social posts. Needs an explicit
      // channel (linkedin/facebook/instagram/etc.) — social-post.ts rejects
      // anything else, and eyebrow is a display string ("LinkedIn · KE"),
      // not a valid channel value, so it can't be derived from that.
      if ((kind === 'social' || kind === 'post') && channel) {
        preparePublish(() => api.marketingSchedule({
          channel,
          topic:     title,
          topic_sub: topicSub || '',
        }));
      }
    } catch (e) {
      setDraftModal(d => d ? { ...d, status: 'error', body: e.message } : null);
      dismissToast(thinkId);
      pushToast({ kind: 'error', title: 'Draft failed', msg: e.message });
    } finally { setAT(false); }
  }, [agentThinking, agentDraft, pushToast, dismissToast, api, preparePublish]);

  const previewContent = useCallback(({ title, eyebrow, body, kind, badges }) => {
    setDraftModal({ title, eyebrow, body, status: 'done', kind: kind || 'preview', badges });
  }, []);

  // ── Broker recruitment: draft (and on approve, actually send) a cold
  // outreach invite to a real prospect. Unlike blog/social there's no
  // separate fast-preview call — the real broker-recruit capability run
  // IS the draft, so the modal shows its output directly.
  const recruitProspect = useCallback(async (prospect) => {
    if (agentThinking) return;
    setAT(true);
    setDraftModal({ title: `Invite to ${prospect.full_name}`, eyebrow: prospect.company || prospect.location || '', body: '', status: 'thinking', kind: 'recruit' });
    const thinkId = pushToast({ kind: 'thinking', title: 'Drafting invite…', msg: prospect.full_name });
    try {
      const r = await api.run('broker-recruit', { prospect_id: prospect.id });
      if (r.status === 'pending' && r.approvalId) {
        const approvalsResp = await api.approvals('pending');
        const found = (approvalsResp.approvals || []).find(a => a.id === r.approvalId);
        let body = r.summary || '';
        try {
          const p = typeof found?.proposal === 'string' ? JSON.parse(found.proposal) : found?.proposal;
          body = p?.message || body;
        } catch { /* keep summary fallback */ }
        setDraftModal(d => d ? { ...d, body, status: 'done', publish: { state: 'ready', approvalId: r.approvalId } } : null);
        fetchApprovals();
      } else if (r.status === 'auto-completed') {
        setDraftModal(d => d ? { ...d, body: r.summary || 'Sent.', status: 'done', publish: { state: 'published' } } : null);
        fetchActivity();
      } else {
        setDraftModal(d => d ? { ...d, status: 'error', body: r.error || 'Could not draft invite' } : null);
      }
      dismissToast(thinkId);
      pushToast({ kind: r.status === 'failed' ? 'error' : 'success', title: r.status === 'failed' ? 'Failed' : 'Draft ready', msg: prospect.full_name });
    } catch (e) {
      setDraftModal(d => d ? { ...d, status: 'error', body: e.message } : null);
      dismissToast(thinkId);
      pushToast({ kind: 'error', title: 'Draft failed', msg: e.message });
    } finally { setAT(false); }
  }, [agentThinking, api, pushToast, dismissToast, fetchApprovals, fetchActivity]);

  // Publish a real blog_posts draft. Returns true on success so the caller can
  // reflect it; the 409 "already published" case is surfaced rather than hidden.
  const publishBlogPost = useCallback(async (id, title) => {
    try {
      const r = await api.blogPublish(id);
      pushToast({ kind: 'success', title: 'Published', msg: (title || r.post?.title || '').slice(0, 50) });
      pushEvent({ type: 'blog', title: `Published: ${title || r.post?.title || id}`, meta: 'blog_posts · status → published', action: 'auto', risk: 'low' });
      fetchBlogPosts();
      return true;
    } catch (e) {
      pushToast({ kind: 'error', title: 'Publish failed', msg: e.message.slice(0, 90) });
      fetchBlogPosts();
      return false;
    }
  }, [api, pushToast, pushEvent, fetchBlogPosts]);

  const addProspect = useCallback(async (body) => {
    try {
      await api.addProspect(body);
      pushToast({ kind: 'success', title: 'Prospect added', msg: body.full_name });
      fetchProspects();
    } catch (e) {
      pushToast({ kind: 'error', title: 'Could not add prospect', msg: e.message });
    }
  }, [api, pushToast, fetchProspects]);

  // ── Engine context (all screens read this) ────────────────────────
  const engine = {
    approvals, events: allEvents, now,
    autonomy: t.autonomy, paused, agentThinking,
    approve, reject, snooze,
    runAgentTask, draftBlogPost, generateAndPreview, previewContent,
    pushToast, pushEvent,
    // Live-only props
    kpis, err, lastSync, cfg,
    // Marketing / Blog real data
    marketingFeed, blogFeed,
    // Real blog_posts rows + the publish action behind the Publish button
    blogPosts, publishBlogPost, refreshBlogPosts: fetchBlogPosts,
    // Schedule helpers (for screens to call directly)
    scheduleMarketingPost: (body) => api.marketingSchedule(body).then(fetchMarketingFeed).catch(e => pushToast({ kind: 'error', title: 'Schedule failed', msg: e.message })),
    scheduleBlogDraft:     (body) => api.blogSchedule(body).then(fetchBlogFeed).catch(e => pushToast({ kind: 'error', title: 'Schedule failed', msg: e.message })),
    // Broker recruitment — real prospects, no fake seed data
    prospects, recruitProspect, addProspect,
  };

  const screenMap = {
    overview:  MissionControl,
    approvals: ApprovalsScreen,
    tasks:     TaskTraceScreen,
    outreach:  OutreachScreen,
    marketing: MarketingScreen,
    blog:      BlogScreen,
    fraud:     RiskScreen,
    playbooks: PlaybooksScreen,
    tools:     ToolsDataScreen,
    settings:  SettingsScreen,
  };
  const ScreenComp = screenMap[screen] || MissionControl;

  return (
    <EngineCtx.Provider value={engine}>
      <div className={'console density-' + t.density}>

        <Sidebar
          screen={screen}
          onScreenChange={setScreen}
          autonomy={t.autonomy}
          approvalCount={approvals.length}
        />

        <Topbar
          screen={screen}
          autonomy={t.autonomy}
          paused={paused}
          onTogglePaused={() => setPaused(p => !p)}
          agentThinking={agentThinking}
          onRunAgent={runAgentTask}
          approvalCount={approvals.length}
        />

        <main className="main">
          <LiveStatusBar kpis={kpis} err={err} lastSync={lastSync} />
          <ScreenComp events={allEvents} now={now} />
        </main>

        <TweaksPanel>
          <TweakSection label="Connection" />
          <div style={{ fontSize: 10.5, color: 'rgba(41,38,27,0.55)', lineHeight: 1.5, padding: '0 2px 8px' }}>
            {cfg.baseUrl.replace(/^https?:\/\//, '').slice(0, 36)}<br />
            {lastSync ? `Synced ${lcAgo(new Date(lastSync).toISOString())}` : 'Connecting…'}
          </div>

          <TweakSection label="Agent autonomy" />
          <TweakRadio
            label="Mode"
            value={t.autonomy}
            options={['suggest', 'assist', 'autopilot']}
            onChange={v => setTweak('autonomy', v)}
          />
          <div style={{ fontSize: 10.5, color: 'rgba(41,38,27,0.65)', lineHeight: 1.4, padding: '0 2px' }}>
            {t.autonomy === 'suggest'   && 'Every action queued for human review.'}
            {t.autonomy === 'assist'    && 'Low-risk auto. Med/high escalated. Recommended.'}
            {t.autonomy === 'autopilot' && 'All but high-risk fraud & big spend auto-resolved.'}
          </div>

          <TweakSection label="Display" />
          <TweakRadio
            label="Density"
            value={t.density}
            options={['compact', 'regular', 'cozy']}
            onChange={v => setTweak('density', v)}
          />

          <TweakSection label="Session" />
          <button
            className="btn is-ghost"
            onClick={onDisconnect}
            style={{ width: '100%', justifyContent: 'center', fontSize: 11, marginTop: 4 }}
          >
            <Icon.XCircle size={11} /> Disconnect backend
          </button>
        </TweaksPanel>

        <ToastTray toasts={toasts} />
        {draftModal && <DraftModal modal={draftModal} engine={engine} onClose={() => setDraftModal(null)} />}
      </div>
    </EngineCtx.Provider>
  );
}

// ── Root ─────────────────────────────────────────────────────────────
function LiveRoot() {
  const [cfg, setCfg] = useState(lcLoad);
  if (!cfg) return <LiveSetup onSave={(c) => { lcSave(c); setCfg(c); }} />;
  return (
    <LiveAgentConsole
      cfg={cfg}
      onDisconnect={() => { lcClear(); setCfg(null); }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LiveRoot />);
