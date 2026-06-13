// agent-console.jsx — Root component for CoBrop Agent console
// Hosts the agent engine: live claude.complete-driven actions, queue mutations,
// blog drafting, toasts. Children consume via useAgentEngine().

const { useState, useEffect, useRef, useContext, useCallback } = React;
const { TASK_TYPES, ACTIVITY_SEED, APPROVALS: SEED_APPROVALS } = window.CB_DATA;

// Anchor for SLA timers
if (window.__APPROVAL_OPENED_AT == null) {
  window.__APPROVAL_OPENED_AT = Date.now();
}

// Shared context (exposed on window so other Babel scripts can read it)
const AgentEngineContext = window.__AgentEngineContext || React.createContext(null);
window.__AgentEngineContext = AgentEngineContext;
window.useAgentEngine = () => useContext(AgentEngineContext);

// ─────────────────────────────────────────────────────────────
// Activity feed seed
// ─────────────────────────────────────────────────────────────
function buildInitialFeed() {
  const now = Date.now();
  return ACTIVITY_SEED.map((ev, i) => ({
    ...ev,
    uid: `seed-${i}`,
    t: now - ev.seedMin * 60 * 1000,
    isNew: false,
  }));
}

const FALLBACK_POOL = [
  { type: "lead",      title: "Auto-replied to inquiry on Megenagna 2BR Apt", meta: "Sent AM + EN · routed to @selam.t", action: "auto", risk: "low" },
  { type: "translate", title: "Translated 3 listings → AM, SW, AR", meta: "Quality gate passed · cosine ≥ 0.91", action: "auto", risk: "low" },
  { type: "outreach",  title: "Drafted Swahili outreach to Mombasa broker", meta: "23 listings · Mombasa coast · score 84", action: "pending", risk: "med" },
  { type: "marketing", title: "Published carousel: 'Why Kigali brokers ↔ Addis'", meta: "LinkedIn · 12 impressions/min · 4 platforms", action: "auto", risk: "low" },
  { type: "nudge",     title: "Nudged @amanuel.t: 2 leads waiting 18h+", meta: "Predicted +1 deal saved · WA + in-app", action: "auto", risk: "low" },
  { type: "listing",   title: "Validated 'Lebu Compound 4BR'", meta: "GPS verified · price OK · 8 photos", action: "auto", risk: "low" },
  { type: "price",     title: "Recommended +3% on Bole 4BR (under-priced)", meta: "Comp median 14% higher · 22 days listed", action: "pending", risk: "med" },
  { type: "fraud",     title: "Photo reverse-search hit on Megenagna listing", meta: "Stock detected · halted publish", action: "blocked", risk: "high" },
];

const REF_PREFIX = { lead: "LD", listing: "LST", fraud: "RSK", price: "PR", outreach: "OUT", marketing: "MKT", nudge: "NU", translate: "TR", routing: "LD", describe: "LST" };
let refCounter = 7800;
function nextRef(type) { return `${REF_PREFIX[type] || "EV"}-${refCounter++}`; }

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

const AUTONOMY_DEFAULTS = /*EDITMODE-BEGIN*/{
  "autonomy": "assist",
  "scenario": "busy",
  "density": "regular",
  "feedSpeed": 6
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────
// Toast container
// ─────────────────────────────────────────────────────────────

function ToastTray({ toasts }) {
  return (
    <div className="toast-tray">
      {toasts.map(t => {
        const IconC = t.kind === "success" ? Icon.CheckCircle
                    : t.kind === "error"   ? Icon.AlertTriangle
                    : t.kind === "thinking"? Icon.Brain
                    : Icon.Sparkles;
        return (
          <div key={t.id} className={"toast is-" + t.kind}>
            {t.kind === "thinking"
              ? <span className="toast__spinner"></span>
              : <IconC size={13} />}
            <div className="toast__body">
              {t.title && <div className="toast__title">{t.title}</div>}
              <div className="toast__msg">{t.msg}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────

function AgentConsole({ initialScreen = "overview" }) {
  const [t, setTweak] = useTweaks(AUTONOMY_DEFAULTS);
  const [screen, setScreen] = useState(initialScreen);
  const [events, setEvents] = useState(buildInitialFeed);
  const [approvals, setApprovals] = useState(SEED_APPROVALS);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [agentThinking, setAgentThinking] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [draftModal, setDraftModal] = useState(null); // { title, category, body, status }

  const toastId = useRef(1);
  const pushToast = useCallback((toast) => {
    const id = toastId.current++;
    const dur = toast.duration ?? (toast.kind === "thinking" ? null : 3800);
    setToasts(prev => [...prev, { ...toast, id }]);
    if (dur) {
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== id));
      }, dur);
    }
    return id;
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);

  // Live tick for countdown timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Routing helper: for an event with `risk`, decide auto vs pending given autonomy
  const routeAction = useCallback((risk) => {
    const mode = t.autonomy;
    if (mode === "suggest") return "pending";
    if (mode === "autopilot") return risk === "high" ? "pending" : "auto";
    // assist (default)
    if (risk === "high") return "pending";
    if (risk === "med")  return "pending";
    return "auto";
  }, [t.autonomy]);

  // Add event to feed, applying autonomy routing
  const pushEvent = useCallback((ev) => {
    const routed = ev.action || routeAction(ev.risk || "low");
    const full = {
      ...ev,
      action: routed,
      ref: ev.ref || nextRef(ev.type),
      uid: ev.uid || `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      t: ev.t || Date.now(),
      isNew: true,
    };
    setEvents(prev => [full, ...prev].slice(0, 80));
    return full;
  }, [routeAction]);

  // Auto-tick fallback events (only when not paused; pauses while agent is thinking too)
  useEffect(() => {
    if (paused) return;
    const interval = Math.max(2500, t.feedSpeed * 1000);
    let idx = 0;
    const id = setInterval(() => {
      const proto = FALLBACK_POOL[idx % FALLBACK_POOL.length];
      idx++;
      pushEvent({ ...proto });
    }, interval);
    return () => clearInterval(id);
  }, [paused, t.feedSpeed, pushEvent]);

  // Clear isNew flag on top item after animation
  useEffect(() => {
    if (events.length && events[0].isNew) {
      const id = setTimeout(() => {
        setEvents(prev => prev.map((e, i) => i === 0 ? { ...e, isNew: false } : e));
      }, 1200);
      return () => clearTimeout(id);
    }
  }, [events]);

  // ── Approval actions ──────────────────────────────────────
  const approve = useCallback((id) => {
    const item = approvals.find(a => a.id === id);
    if (!item) return;
    setApprovals(prev => prev.filter(a => a.id !== id));
    pushEvent({
      type: item.type,
      title: <>Approved & executed · <span className="acc">{item.what}</span></>,
      meta: `${item.who.split("·")[0].trim()} · approved by admin in ${formatHM(item.elapsedMs)}`,
      action: "auto",
      ref: item.id,
    });
    pushToast({ kind: "success", title: "Approved", msg: item.what });
  }, [approvals, pushEvent, pushToast]);

  const reject = useCallback((id, reason) => {
    const item = approvals.find(a => a.id === id);
    if (!item) return;
    setApprovals(prev => prev.filter(a => a.id !== id));
    pushEvent({
      type: item.type,
      title: <>Rejected by admin · <span className="acc">{item.what}</span></>,
      meta: `Admin override · agent will not retry${reason ? " · " + reason : ""}`,
      action: "blocked",
      ref: item.id,
    });
    pushToast({ kind: "error", title: "Rejected", msg: item.what });
  }, [approvals, pushEvent, pushToast]);

  const snooze = useCallback((id) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, elapsedMs: 0 } : a));
    pushToast({ kind: "info", title: "Snoozed", msg: "SLA reset by 30 minutes" });
  }, [pushToast]);

  // ── Agent: generate a brand-new action via claude.complete ──
  const runAgentTask = useCallback(async ({ category } = {}) => {
    if (agentThinking) return;
    setAgentThinking(true);
    const thinkId = pushToast({ kind: "thinking", title: "Agent reasoning…", msg: "Picking next move from the platform queue" });

    const allowedTypes = category
      ? [category]
      : ["lead", "listing", "outreach", "marketing", "price", "nudge", "translate", "fraud"];
    const prompt = `You are CoBrop's autonomous platform agent for an East African + Arab Gulf real-estate co-brokerage platform. Brokers operate in Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar.

Decide on ONE realistic next action the agent should take RIGHT NOW. Pick from these task types: ${allowedTypes.join(", ")}.

Be SPECIFIC: real-sounding broker handles (e.g. @meron.t, @faisal.h), specific neighborhood names (Bole, Kazanchis, Karen, Marina), specific numbers. Be terse and professional. NO emoji.

Output ONLY this JSON object — no markdown, no fence, no explanation:
{"type":"<one of: ${allowedTypes.join("|")}>","title":"<short action description, max 80 chars>","meta":"<exactly 3 specific facts separated by ' · ', max 60 chars total>","risk":"<low|med|high>"}`;

    try {
      const raw = await window.claude.complete(prompt);
      // Strip any accidental markdown
      const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      // Some models prefix text — grab first {...}
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("No JSON found");
      const parsed = JSON.parse(m[0]);
      if (!parsed.type || !TASK_TYPES[parsed.type]) {
        parsed.type = allowedTypes[0];
      }
      pushEvent({
        type: parsed.type,
        title: parsed.title,
        meta: parsed.meta,
        risk: parsed.risk || "low",
        // action is decided by routeAction based on autonomy + risk
      });
      dismissToast(thinkId);
      pushToast({ kind: "success", title: "Agent acted", msg: parsed.title });
    } catch (e) {
      dismissToast(thinkId);
      pushToast({ kind: "error", title: "Agent error", msg: e.message || "Couldn't reason · try again" });
    } finally {
      setAgentThinking(false);
    }
  }, [agentThinking, pushToast, dismissToast, pushEvent]);

  // ── Agent: draft a full blog post (with streaming-style feel) ──
  const draftBlogPost = useCallback(async ({ title, category }) => {
    if (agentThinking) return;
    setAgentThinking(true);
    setDraftModal({ title, eyebrow: category, body: "", status: "thinking", kind: "blog" });
    const thinkId = pushToast({ kind: "thinking", title: "Drafting blog post…", msg: title.slice(0, 50) + "…" });

    const prompt = `You are CoBrop's blog writer. CoBrop is a real-estate co-brokerage platform connecting brokers in Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar so they can split fees on cross-border deals.

BRAND VOICE: confident, educational, empowering. Pair regional data with concrete broker stories. Long-form (8-12 min reads outperform). Use action verbs. NO emoji, NO clichés ("In today's fast-paced world…", "game-changer", "leverage"), NO hype, NO marketing speak.

STRUCTURE: hook with a specific stat or scene → set up the broker-level problem → promise the answer. Include 2-3 specific stats (invent realistic East African real estate numbers).

Write the FIRST 4 short paragraphs of a blog post.

TITLE: "${title}"
CATEGORY: ${category}

Output ONLY the post body (no title, no headings, no meta).`;

    try {
      const text = await window.claude.complete(prompt);
      setDraftModal(d => d ? { ...d, body: text.trim(), status: "done" } : null);
      dismissToast(thinkId);
      pushToast({ kind: "success", title: "Draft ready", msg: "~" + text.split(/\s+/).length + " words drafted" });
      pushEvent({
        type: "marketing",
        title: <>Drafted blog post · <span className="acc">{title}</span></>,
        meta: `${category} · ~${text.split(/\s+/).length} words · awaiting admin review`,
        risk: "low",
        action: "pending",
      });
    } catch (e) {
      setDraftModal(d => d ? { ...d, status: "error", body: e.message } : null);
      dismissToast(thinkId);
      pushToast({ kind: "error", title: "Draft failed", msg: e.message || "Could not generate" });
    } finally {
      setAgentThinking(false);
    }
  }, [agentThinking, pushToast, dismissToast, pushEvent]);

  // ── Agent: generate any content live & preview (social post, outreach, etc) ──
  const generateAndPreview = useCallback(async ({ title, eyebrow, kind, prompt, badges }) => {
    if (agentThinking) return;
    setAgentThinking(true);
    setDraftModal({ title, eyebrow, body: "", status: "thinking", kind, badges });
    const thinkId = pushToast({ kind: "thinking", title: "Agent drafting…", msg: title.slice(0, 50) });

    try {
      const text = await window.claude.complete(prompt);
      setDraftModal(d => d ? { ...d, body: text.trim(), status: "done" } : null);
      dismissToast(thinkId);
      pushToast({ kind: "success", title: "Draft ready", msg: title.slice(0, 50) });
    } catch (e) {
      setDraftModal(d => d ? { ...d, status: "error", body: e.message || "Unknown error" } : null);
      dismissToast(thinkId);
      pushToast({ kind: "error", title: "Draft failed", msg: e.message || "Couldn't generate" });
    } finally {
      setAgentThinking(false);
    }
  }, [agentThinking, pushToast, dismissToast]);

  // Show a pre-baked content preview (no LLM call)
  const previewContent = useCallback(({ title, eyebrow, body, kind, badges }) => {
    setDraftModal({ title, eyebrow, body, status: "done", kind: kind || "preview", badges });
  }, []);

  // Engine value
  const engine = {
    approvals,
    events,
    now,
    autonomy: t.autonomy,
    paused,
    agentThinking,
    approve, reject, snooze,
    runAgentTask,
    draftBlogPost,
    generateAndPreview,
    previewContent,
    pushToast,
    pushEvent,
  };

  const ScreenComp = {
    overview:  MissionControl,
    approvals: ApprovalsScreen,
    outreach:  OutreachScreen,
    tasks:     TaskTraceScreen,
    marketing: MarketingScreen,
    blog:      BlogScreen,
    fraud:     RiskScreen,
    playbooks: PlaybooksScreen,
    tools:     ToolsDataScreen,
    settings:  SettingsScreen,
  }[screen] || MissionControl;

  return (
    <AgentEngineContext.Provider value={engine}>
      <div className={"console density-" + t.density}>
        <Sidebar screen={screen} onScreenChange={setScreen} autonomy={t.autonomy} approvalCount={approvals.length} />
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
          <ScreenComp events={events} now={now} />
        </main>

        <TweaksPanel>
          <TweakSection label="Agent autonomy" />
          <TweakRadio
            label="Mode"
            value={t.autonomy}
            options={["suggest", "assist", "autopilot"]}
            onChange={v => setTweak("autonomy", v)}
          />
          <div style={{
            fontSize: 10.5, color: "rgba(41,38,27,0.65)", lineHeight: 1.4, padding: "0 2px"
          }}>
            {t.autonomy === "suggest"   && "Every action queued for human review. Highest control."}
            {t.autonomy === "assist"    && "Low-risk auto-resolved. Med/high risk escalated. Recommended."}
            {t.autonomy === "autopilot" && "All but high-risk fraud & big spend auto-resolved."}
          </div>

          <TweakSection label="Feed" />
          <TweakSlider
            label="Event cadence"
            value={t.feedSpeed}
            min={2}
            max={12}
            step={1}
            unit="s"
            onChange={v => setTweak("feedSpeed", v)}
          />
          <TweakRadio
            label="Density"
            value={t.density}
            options={["compact", "regular", "cozy"]}
            onChange={v => setTweak("density", v)}
          />
        </TweaksPanel>

        <ToastTray toasts={toasts} />
        {draftModal && <DraftModal modal={draftModal} onClose={() => setDraftModal(null)} />}
      </div>
    </AgentEngineContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Live blog draft modal
// ─────────────────────────────────────────────────────────────

function DraftModal({ modal, onClose }) {
  const isBlog = modal.kind === "blog";
  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-modal" onClick={e => e.stopPropagation()}>
        <div className="draft-modal__head">
          <div className="draft-modal__eyebrow">
            <Icon.Sparkles size={11} color="var(--cb-cyan)" /> {isBlog ? "Agent-drafted blog post" : "Agent preview"}
            {modal.eyebrow && <span className="chip is-blue" style={{ marginLeft: 6 }}>{modal.eyebrow}</span>}
            {(modal.badges || []).map((b, i) => <span key={i} className={"chip " + (b.cls || "")} style={{ marginLeft: 4 }}>{b.label}</span>)}
          </div>
          <div className="draft-modal__title">{modal.title}</div>
          <button className="draft-modal__close" onClick={onClose}><Icon.XCircle size={14} /></button>
        </div>
        <div className="draft-modal__body">
          {modal.status === "thinking" && (
            <div className="draft-modal__thinking">
              <span className="toast__spinner"></span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--cb-ink)" }}>Agent is writing…</div>
                <div style={{ fontSize: 11.5, color: "var(--cb-ink-3)", marginTop: 3 }}>
                  {isBlog
                    ? "Loading brand voice from last 24 posts · pulling regional data · drafting in CoBrop style"
                    : "Loading channel rules · brand voice · audience tone"}
                </div>
              </div>
            </div>
          )}
          {modal.status === "done" && (
            <article className={"draft-modal__article" + (isBlog ? "" : " is-plain")}>
              {String(modal.body).split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
              {isBlog && (
                <div className="draft-modal__continuation">
                  <Icon.Pencil size={11} color="var(--cb-ink-3)" />
                  <span>Continued — agent will write 6 more paragraphs · 3 stat callouts · 2 broker quotes · CTAs at mid + end.</span>
                </div>
              )}
            </article>
          )}
          {modal.status === "error" && (
            <div className="draft-modal__error">
              <Icon.AlertTriangle size={16} /> {modal.body}
            </div>
          )}
        </div>
        <div className="draft-modal__foot">
          <span className="chip is-cyan"><Icon.Zap size={11} /> live · claude-haiku-4-5</span>
          <span className="chip"><Icon.Type size={11} /> brand voice loaded</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn is-sm"><Icon.Pencil size={11} /> Edit</button>
            <button className="btn is-sm is-success" disabled={modal.status !== "done"}><Icon.CheckCircle size={11} /> {isBlog ? "Publish" : "Approve & send"}</button>
            <button className="btn is-sm is-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AgentConsole  = AgentConsole;
window.ToastTray     = ToastTray;
window.DraftModal    = DraftModal;
