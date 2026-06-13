// agent-screens.jsx — Mission Control, Approvals, Broker Outreach screens

const { TASK_TYPES, ACTIVITY_SEED, APPROVALS, CAPABILITIES, TASK_MIX, REGIONS, SUGGESTED_BROKERS, KPIS } = window.CB_DATA;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatTimeAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
function formatHM(ms) {
  if (ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(ss).padStart(2, "0")}s`;
}

function Sparkline({ values = [], color = "var(--cb-cyan)", width = 60, height = 22 }) {
  if (!values.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="kpi__spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity="0.08" stroke="none" />
    </svg>
  );
}

function StreamRow({ ev, isNew }) {
  const tt = TASK_TYPES[ev.type];
  const IconC = Icon[tt.icon];
  const ageMs = Date.now() - ev.t;
  const cls = "stream__item" + (isNew ? " is-new" : "");
  const actionLabel = { auto: "Auto-acted", pending: "Awaiting approval", blocked: "Blocked" }[ev.action];
  const actionCls = "stream__action is-" + ev.action;
  return (
    <div className={cls}>
      <div className={"stream__icon " + tt.tone}><IconC size={12} /></div>
      <div className="stream__main">
        <div className="stream__title">
          {ev.title} <span className="ref">{ev.ref}</span>
        </div>
        <div className="stream__meta">
          <span>{tt.label}</span>
          <span className="sep">·</span>
          <span>{ev.meta}</span>
          <span className="sep">·</span>
          <span className={actionCls}>{actionLabel}</span>
        </div>
      </div>
      <div className="stream__time">
        <span className="ago">{formatTimeAgo(ageMs)}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// KPI Tile
// ────────────────────────────────────────────────────────────

function KpiTile({ kpi }) {
  const IconC = Icon[kpi.icon];
  const dirIcon = kpi.dir === "up" ? Icon.TrendingUp : kpi.dir === "down" ? Icon.TrendingDown : null;
  const DirIcon = dirIcon;
  // For some metrics, a down delta is good (e.g. pending decreased)
  const deltaCls = "kpi__delta " + (
    kpi.goodDown
      ? (kpi.dir === "down" ? "is-up" : "is-down")
      : (kpi.dir === "up" ? "is-up" : kpi.dir === "down" ? "is-down" : "is-flat")
  );
  const sparkValues = {
    tasks:    [180, 240, 210, 260, 230, 290, 320, 280, 340, 380, 360, 420],
    auto:     [94, 95.1, 94.4, 95.6, 95.2, 96.0, 96.1, 95.8, 96.4, 96.3, 96.5, 96.4],
    pending:  [22, 20, 24, 26, 22, 19, 21, 18, 17, 20, 22, 18],
    sla:      [1, 2, 1, 0, 1, 2, 3, 2, 4, 3, 4, 4],
    savings:  [180, 210, 200, 230, 250, 240, 270, 290, 280, 300, 312, 312],
    brokers:  [3, 5, 4, 7, 6, 9, 11, 8, 14, 19, 21, 23],
  }[kpi.key] || [];
  const sparkColor = kpi.alert ? "var(--cb-error)" : "var(--cb-cyan)";
  return (
    <div className={"kpi" + (kpi.alert ? " is-alert" : "")}>
      <div className="kpi__label">
        <span className="icon"><IconC size={11} /></span>
        {kpi.label}
      </div>
      <div className="kpi__value">
        {kpi.value}
        {kpi.unit && <span className="unit">{kpi.unit}</span>}
      </div>
      <div className="kpi__sub">
        <span className={deltaCls}>
          {DirIcon && <DirIcon size={11} />} {kpi.delta}
        </span>
        <span style={{ color: "var(--cb-ink-4)" }}>·</span>
        <span>{kpi.sub}</span>
      </div>
      <Sparkline values={sparkValues} color={sparkColor} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MISSION CONTROL / OVERVIEW
// ────────────────────────────────────────────────────────────

function ActivityFeed({ events, height = 480, autoplay = true }) {
  return (
    <div className="stream" style={{ maxHeight: height, overflowY: "auto" }}>
      {events.map((ev, i) => (
        <StreamRow key={ev.uid} ev={ev} isNew={i === 0 && autoplay && ev.isNew} />
      ))}
    </div>
  );
}

function CapabilityStrip() {
  return (
    <div className="caps">
      {CAPABILITIES.map(c => {
        const IconC = Icon[c.icon];
        const ringMap = {
          "t-lead": { bg: "#E5EEF3", color: "#1c5f7b" },
          "t-listing": { bg: "var(--cb-cyan-soft)", color: "#0a7e93" },
          "t-fraud": { bg: "var(--cb-error-soft)", color: "#b92444" },
          "t-price": { bg: "var(--cb-warn-soft)", color: "#b87a14" },
          "t-outreach": { bg: "var(--cb-success-soft)", color: "#0e8b58" },
          "t-marketing": { bg: "var(--cb-violet-soft)", color: "#5b3fc1" },
          "t-translate": { bg: "#EAF2F5", color: "#455D6A" },
          "t-nudge": { bg: "var(--cb-amber-soft)", color: "#b85a36" },
        }[c.ring] || { bg: "var(--cb-bg)", color: "var(--cb-ink-2)" };
        return (
          <div key={c.key} className={"cap" + (c.health === "warn" ? " is-warn" : c.health === "down" ? " is-down" : "")}>
            <div className="cap__icon" style={{ background: ringMap.bg, color: ringMap.color }}>
              <IconC size={14} />
            </div>
            <div>
              <div className="cap__name">{c.name}</div>
              <div className="cap__sub">{c.today} {c.subtext}</div>
            </div>
            <div className="cap__health">
              <span className="dot"></span>
              {c.health === "ok" ? "OK" : c.health === "warn" ? "Watch" : "Down"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskMix() {
  const max = Math.max(...TASK_MIX.map(t => t.count));
  return (
    <div className="taskmix">
      {TASK_MIX.map(row => {
        const tt = TASK_TYPES[row.type];
        const IconC = Icon[tt.icon];
        return (
          <div key={row.type} className="taskmix__row">
            <div className={"icon " + tt.tone}><IconC size={10} /></div>
            <div>
              <div className="taskmix__name">{tt.label}</div>
              <div className="taskmix__bar"><div style={{ width: (row.count / max * 100) + "%" }}></div></div>
            </div>
            <div className="taskmix__count">{row.count.toLocaleString()}</div>
            <div className="taskmix__auto">{row.autoPct}% auto</div>
          </div>
        );
      })}
    </div>
  );
}

function MiniApprovalRow({ a, now }) {
  const tt = TASK_TYPES[a.type];
  const IconC = Icon[tt.icon];
  const elapsed = a.elapsedMs + (now - a.openedAt);
  const remaining = a.slaMs - elapsed;
  const pct = Math.min(100, Math.max(0, (elapsed / a.slaMs) * 100));
  const stateCls = remaining < 5 * 60 * 1000 ? "is-danger" : remaining < 30 * 60 * 1000 ? "is-warn" : "";
  const timeCls = remaining < 5 * 60 * 1000 ? "is-danger" : remaining < 30 * 60 * 1000 ? "is-warn" : "";
  return (
    <div className="queue__row">
      <div className={"queue__row-icon " + tt.tone}>
        <IconC size={14} />
      </div>
      <div>
        <div className="queue__what">{a.what}</div>
        <div className="queue__who">{a.who}</div>
      </div>
      <div className={"queue__risk is-" + a.risk}>
        <span className="queue__risk-bars">
          <span className={a.risk !== "" ? "on" : ""}></span>
          <span className={a.risk === "med" || a.risk === "high" ? "on" : ""}></span>
          <span className={a.risk === "high" ? "on" : ""}></span>
        </span>
        {a.risk === "low" ? "Low" : a.risk === "med" ? "Med" : "High"}
      </div>
      <div className="queue__sla">
        <div className={"queue__sla-bar " + stateCls}><div style={{ width: pct + "%" }}></div></div>
      </div>
      <div className={"queue__sla-time " + timeCls}>{formatHM(remaining)}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Regional map (simplified — Africa + Arabia silhouette w/ pins)
// ────────────────────────────────────────────────────────────

function RegionsMap() {
  // Pins positioned by approximate (x,y) on the SVG viewbox
  const pins = [
    { code: "ET", x: 360, y: 92,  label: "Addis" },
    { code: "KE", x: 365, y: 122, label: "Nairobi" },
    { code: "UG", x: 340, y: 115, label: "Kampala" },
    { code: "TZ", x: 360, y: 145, label: "Dar" },
    { code: "RW", x: 333, y: 120, label: "Kigali" },
    { code: "ZA", x: 330, y: 215, label: "Cape Town" },
    { code: "AE", x: 460, y: 70,  label: "Dubai" },
    { code: "QA", x: 442, y: 70,  label: "Doha" },
  ];
  return (
    <svg className="regions-map" viewBox="220 30 320 220" preserveAspectRatio="xMidYMid meet">
      {/* Africa (very simplified silhouette) */}
      <path className="land is-active" d="M260,60 L320,52 L340,58 L370,55 L380,75 L395,90 L385,115 L398,135 L405,160 L385,190 L360,215 L340,235 L310,240 L290,225 L275,200 L262,170 L255,140 L258,110 L260,85 Z" />
      {/* Arabian peninsula */}
      <path className="land is-active" d="M400,55 L440,50 L470,55 L490,75 L495,100 L485,118 L460,128 L435,118 L420,100 L408,82 Z" />
      {/* Madagascar-ish */}
      <path className="land" d="M420,180 L432,178 L435,195 L425,212 L418,205 Z" />

      {pins.map(p => (
        <g key={p.code}>
          <circle className="pin-ring" cx={p.x} cy={p.y} r="6" />
          <circle className="pin" cx={p.x} cy={p.y} r="3.5" />
          <text x={p.x + 8} y={p.y + 3} fontSize="8" fontWeight="700" fill="#0F2A36">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ────────────────────────────────────────────────────────────
// MISSION CONTROL SCREEN
// ────────────────────────────────────────────────────────────

function MissionControl({ events, now }) {
  const engine = window.useAgentEngine();
  const approvals = engine?.approvals || APPROVALS;
  // Generate broker outreach via claude (shared with Outreach screen)
  const openBrokerOutreach = (b) => {
    if (!engine) return;
    const lang = b.tags && b.tags[0] || "English";
    const prompt = `You are CoBrop's broker outreach agent. CoBrop is a real-estate co-brokerage platform helping brokers across East Africa + Arab Gulf split fees on cross-border deals.

Write a SHORT, personalised outbound message in ${lang} to this broker.

BROKER: ${b.name} (${b.location}) · ${b.tenure} · sourced from ${b.sourcedFrom}

Voice: warm but professional, specific, brief (≤ 90 words), no marketing fluff, no emoji. Open with their name. Soft CTA to a 7-minute onboarding call.

Output ONLY the message body.`;
    engine.generateAndPreview({
      title: "Outreach to " + b.name,
      eyebrow: b.location + " · " + lang,
      kind: "outreach",
      prompt,
      badges: [{ label: "score " + b.score, cls: "is-cyan" }],
    });
  };
  // Pick most urgent approvals for the preview
  const previewApprovals = [...approvals]
    .map(a => ({ ...a, openedAt: window.__APPROVAL_OPENED_AT, remaining: a.slaMs - a.elapsedMs }))
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 4);

  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-grid">
        {KPIS.map(k => <KpiTile key={k.key} kpi={k} />)}
      </div>

      {/* Capability health */}
      <CapabilityStrip />

      {/* Two-column: live activity + side stack */}
      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Activity size={13} /></span>
              Live activity
            </div>
            <span className="chip is-success"><span className="dot-mini"></span>Streaming</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.Filter size={11} /> Filter</button>
              <button className="btn is-sm is-ghost"><Icon.RotateCw size={11} /> 30s</button>
            </div>
          </div>
          <div className="card__body is-flush">
            <ActivityFeed events={events} height={460} />
          </div>
          <div className="card__foot">
            <Icon.Zap size={11} color="var(--cb-cyan)" />
            <span><b style={{ color: "var(--cb-ink)" }}>2,732</b> events today · 96.4% auto-resolved · 1.2% rework</span>
            <button className="btn is-sm is-ghost" style={{ marginLeft: "auto" }}>View full log <Icon.ArrowRight size={11} /></button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Approvals preview */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Inbox size={13} /></span>
                Awaiting approval
              </div>
              <span className="chip is-warn">{approvals.length} pending</span>
              <div className="card__head-right">
                <button className="btn is-sm is-cyan">Review queue <Icon.ArrowRight size={11} /></button>
              </div>
            </div>
            <div className="card__body is-flush">
              <div className="queue" style={{ maxHeight: 260, overflow: "auto" }}>
                {previewApprovals.length === 0 && (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--cb-ink-3)", fontSize: 12 }}>
                    <Icon.CheckCircle size={20} color="var(--cb-success)" />
                    <div style={{ marginTop: 6, fontWeight: 600 }}>Inbox zero · all tasks auto-resolved</div>
                  </div>
                )}
                {previewApprovals.map(a => (
                  <MiniApprovalRow key={a.id} a={a} now={now} />
                ))}
              </div>
            </div>
          </div>

          {/* Task mix breakdown */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Layers size={13} /></span>
                Task mix · today
              </div>
              <span className="card__sub">2,732 total · 8 capabilities</span>
            </div>
            <div className="card__body">
              <TaskMix />
            </div>
          </div>
        </div>
      </div>

      {/* Regional outreach */}
      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Globe size={13} /></span>
              Broker recruitment · 8 active markets
            </div>
            <span className="chip is-cyan">+23 onboarded this week</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost">All regions <Icon.ArrowRight size={11} /></button>
            </div>
          </div>
          <RegionsMap />
          <div className="region-list">
            {REGIONS.slice(0, 4).map(r => {
              const respRate = Math.round((r.responded / r.contacted) * 100);
              return (
                <div key={r.code} className="region-row">
                  <div className="region-flag">{r.flag}</div>
                  <div className="region-name">{r.name}<span className="sub">{r.sub}</span></div>
                  <div className="region-stat">{r.contacted.toLocaleString()}<span className="label">Contacted</span></div>
                  <div className="region-stat" style={{ color: "var(--cb-success)" }}>{respRate}%<span className="label" style={{ color: "var(--cb-ink-3)" }}>Reply rate</span></div>
                  <div className="meter">
                    <div className="meter__head">
                      <span>Onboarded</span>
                      <b>{r.onboarded}</b>
                    </div>
                    <div className="meter__bar"><div style={{ width: Math.min(100, (r.onboarded / 200) * 100) + "%" }}></div></div>
                  </div>
                  <div className="region-stat" style={{ textAlign: "right" }}>{r.listed}<span className="label">Listed</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Sparkles size={13} /></span>
              Agent drafts · next moves
            </div>
            <span className="card__sub">3 ready to send</span>
          </div>
          <div className="card__body" style={{ gap: 10 }}>
            {SUGGESTED_BROKERS.map(b => (
              <div key={b.id} className="suggested-outreach" style={{ border: "1px solid var(--cb-line)", padding: 12, cursor: "pointer" }} onClick={() => openBrokerOutreach(b)}>
                <div className="suggested-outreach__head">
                  <div className="broker-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{b.initials}</div>
                  <div>
                    <div className="suggested-outreach__name">{b.name} <span className="chip is-ghost" style={{ padding: "0 4px", fontSize: 10 }}>{b.location}</span></div>
                    <div className="suggested-outreach__sub">{b.tenure} · via {b.sourcedFrom}</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div className="suggested-outreach__score">{b.score}</div>
                    <div className="suggested-outreach__score-lab">Fit score</div>
                  </div>
                </div>
                <div className="suggested-outreach__preview">"{b.preview}"</div>
                <div className="suggested-outreach__tags">
                  {b.tags.map(t => <span key={t} className="chip">{t}</span>)}
                  <span className={"risktag is-" + b.risk}>{b.risk} risk</span>
                </div>
                <div className="suggested-outreach__cta" onClick={e => e.stopPropagation()}>
                  {b.status === "auto-sent" ? (
                    <>
                      <span className="chip is-success"><Icon.CheckCircle size={11} /> Auto-sent</span>
                      <button className="btn is-sm is-ghost" style={{ marginLeft: "auto" }} onClick={() => openBrokerOutreach(b)}><Icon.Eye size={11} /> View thread</button>
                    </>
                  ) : (
                    <>
                      <button className="btn is-sm is-cyan" onClick={() => openBrokerOutreach(b)}><Icon.Send size={11} /> Approve & send</button>
                      <button className="btn is-sm" onClick={() => openBrokerOutreach(b)}><Icon.Edit size={11} /> Edit</button>
                      <button className="btn is-sm is-ghost" style={{ marginLeft: "auto" }} onClick={() => engine?.pushToast({ kind: "info", msg: "Broker skipped for this cohort" })}><Icon.XCircle size={11} /> Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ────────────────────────────────────────────────────────────
// APPROVALS QUEUE SCREEN
// ────────────────────────────────────────────────────────────

function ApprovalsScreen({ now }) {
  const engine = window.useAgentEngine();
  const approvals = engine?.approvals || APPROVALS;
  const [selectedId, setSelectedId] = React.useState(approvals[0]?.id);
  const [filter, setFilter] = React.useState("all");

  // Keep selection valid when items get approved/rejected
  React.useEffect(() => {
    if (!approvals.find(a => a.id === selectedId)) {
      setSelectedId(approvals[0]?.id);
    }
  }, [approvals, selectedId]);

  const filtered = approvals.filter(a => filter === "all" || a.risk === filter);
  const selected = approvals.find(a => a.id === selectedId) || approvals[0];

  return (
    <div className="row-2" style={{ flex: 1, gridTemplateColumns: "1.4fr 1fr", minHeight: 0 }}>
      <div className="card" style={{ minHeight: 0 }}>
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.ListChecks size={13} /></span>
            Approval queue
          </div>
          <span className="chip is-warn">{approvals.length} pending</span>
          {approvals.length > 0 && <span className="chip is-error"><span className="dot-mini"></span>{Math.min(approvals.length, 4)} nearing SLA</span>}
          <div className="card__head-right">
            {["all", "high", "med", "low"].map(f => (
              <button
                key={f}
                className={"btn is-sm" + (filter === f ? " is-primary" : " is-ghost")}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "high" ? "High" : f === "med" ? "Medium" : "Low"}
              </button>
            ))}
          </div>
        </div>

        <div className="queue__row" style={{ background: "var(--cb-bg)", borderBottom: "1px solid var(--cb-line)", padding: "6px 14px", cursor: "default", color: "var(--cb-ink-3)", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
          <div></div>
          <div>Task</div>
          <div>Risk</div>
          <div>SLA</div>
          <div style={{ textAlign: "right" }}>Time left</div>
        </div>

        <div className="card__body is-flush" style={{ overflow: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--cb-ink-3)" }}>
              <Icon.CheckCircle size={32} color="var(--cb-success)" />
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14, color: "var(--cb-ink)" }}>Inbox zero</div>
              <div style={{ marginTop: 4, fontSize: 12 }}>All approval requests resolved. The agent is operating autonomously.</div>
            </div>
          )}
          <div className="queue">
            {filtered.map(a => {
              const tt = TASK_TYPES[a.type];
              const IconC = Icon[tt.icon];
              const elapsed = a.elapsedMs + (now - window.__APPROVAL_OPENED_AT);
              const remaining = a.slaMs - elapsed;
              const pct = Math.min(100, Math.max(0, (elapsed / a.slaMs) * 100));
              const slaWarn = remaining < 30 * 60 * 1000;
              const slaDanger = remaining < 5 * 60 * 1000;
              return (
                <div
                  key={a.id}
                  className={"queue__row" + (a.id === selectedId ? " is-selected" : "")}
                  onClick={() => setSelectedId(a.id)}
                >
                  <div className={"queue__row-icon " + tt.tone}><IconC size={14} /></div>
                  <div>
                    <div className="queue__what">{a.what}</div>
                    <div className="queue__who">{a.who}</div>
                  </div>
                  <div className={"queue__risk is-" + a.risk}>
                    <span className="queue__risk-bars">
                      <span className="on"></span>
                      <span className={a.risk === "med" || a.risk === "high" ? "on" : ""}></span>
                      <span className={a.risk === "high" ? "on" : ""}></span>
                    </span>
                    {a.risk === "low" ? "Low" : a.risk === "med" ? "Med" : "High"}
                  </div>
                  <div className="queue__sla">
                    <div className={"queue__sla-bar " + (slaDanger ? "is-danger" : slaWarn ? "is-warn" : "")}>
                      <div style={{ width: pct + "%" }}></div>
                    </div>
                  </div>
                  <div className={"queue__sla-time " + (slaDanger ? "is-danger" : slaWarn ? "is-warn" : "")}>{formatHM(remaining)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ApprovalDetail item={selected} now={now} engine={engine} />
    </div>
  );
}

function ApprovalDetail({ item, now, engine }) {
  if (!item) {
    return (
      <div className="detail" style={{ alignItems: "center", justifyContent: "center", display: "grid", placeItems: "center", padding: 40, color: "var(--cb-ink-3)", textAlign: "center" }}>
        <div>
          <Icon.CheckCircle size={36} color="var(--cb-success)" />
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--cb-ink)" }}>Queue empty</div>
          <div style={{ marginTop: 4, fontSize: 12 }}>Nothing to review right now. Agent will surface anything risky here.</div>
        </div>
      </div>
    );
  }
  const tt = TASK_TYPES[item.type];
  const IconC = Icon[tt.icon];
  const elapsed = item.elapsedMs + (now - window.__APPROVAL_OPENED_AT);
  const remaining = item.slaMs - elapsed;
  const slaWarn = remaining < 30 * 60 * 1000;
  const slaDanger = remaining < 5 * 60 * 1000;

  return (
    <div className="detail">
      <div className="detail__head">
        <div className="detail__eyebrow">
          <IconC size={11} /> {tt.label} · <span style={{ fontFamily: "var(--font-mono)" }}>{item.id}</span>
        </div>
        <div className="detail__title">{item.what}</div>
        <div className="detail__meta">
          <span className={"risktag is-" + item.risk}>{item.risk === "low" ? "Low" : item.risk === "med" ? "Medium" : "High"} risk</span>
          <span className="chip"><Icon.Clock size={11} />
            <b style={{
              fontFamily: "var(--font-data)",
              color: slaDanger ? "var(--cb-error)" : slaWarn ? "#b87a14" : "var(--cb-ink)",
              fontSize: 12,
              marginLeft: 2
            }}>{formatHM(remaining)}</b>&nbsp;left
          </span>
          <span className="chip is-cyan"><Icon.Sparkles size={10} /> {Math.round(item.confidence * 100)}% confidence</span>
          <span className="chip">{item.who.split("·")[0].trim()}</span>
        </div>
      </div>

      <div className="detail__body">
        <div>
          <div className="detail__section-title">
            <Icon.Sparkles size={11} color="var(--cb-cyan)" /> Agent proposes
          </div>
          <div className="proposed">{item.proposal}</div>
        </div>

        <div>
          <div className="detail__section-title">
            <Icon.Activity size={11} color="var(--cb-cyan)" /> Trace · {item.trace.length} steps
          </div>
          <div className="trace">
            {item.trace.map((s, i) => (
              <div key={i} className={"trace__step " + (s.state === "done" ? "is-done" : s.state === "current" ? "is-current" : s.state === "blocked" ? "is-blocked" : "")}>
                <div><b>{s.title}</b><span className="t">{s.t}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="detail__section-title">
            <Icon.Database size={11} color="var(--cb-cyan)" /> Evidence
          </div>
          <div className="evidence">
            {item.evidence.map(e => (
              <div key={e.label} className="evidence__item">
                <div className="lab">{e.label}</div>
                <div className="val">{e.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="detail__foot">
        <button className="btn is-success" onClick={() => engine?.approve(item.id)}><Icon.CheckCircle size={12} /> Approve</button>
        <button className="btn" onClick={() => engine?.approve(item.id)}><Icon.Edit size={12} /> Edit & approve</button>
        <button className="btn is-danger" onClick={() => engine?.reject(item.id, "manual review")}><Icon.XCircle size={12} /> Reject</button>
        <button className="btn is-ghost" style={{ marginLeft: "auto" }} onClick={() => engine?.snooze(item.id)}><Icon.Slash size={12} /> Snooze 30m</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BROKER OUTREACH SCREEN
// ────────────────────────────────────────────────────────────

function OutreachScreen({ now }) {
  const engine = window.useAgentEngine && window.useAgentEngine();
  // Generate a live outreach message for a broker via claude
  const openBrokerOutreach = (b) => {
    if (!engine) return;
    const lang = b.tags && b.tags[0] || "English";
    const prompt = `You are CoBrop's broker outreach agent. CoBrop is a real-estate co-brokerage platform helping brokers across Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar split fees on cross-border deals.

Write a SHORT, personalised outbound message in ${lang} to this broker.

BROKER: ${b.name} (${b.location})
TENURE: ${b.tenure}
SOURCED FROM: ${b.sourcedFrom}
RELEVANT TAGS: ${b.tags ? b.tags.join(", ") : "—"}

Channel: ${lang === "Arabic" ? "WhatsApp (Arabic, right-to-left, brief)" : lang === "Kinyarwanda" ? "WhatsApp (Kinyarwanda, brief, warm)" : "LinkedIn DM (English, professional)"}

Voice: warm but professional, specific (mention their actual neighborhood / niche), brief (≤ 90 words), no marketing fluff, no emoji. Open with their name. Close with a soft CTA to a 7-minute onboarding call.

Output ONLY the message body. No preface.`;

    engine.generateAndPreview({
      title: "Outreach to " + b.name,
      eyebrow: b.location + " · " + lang,
      kind: "outreach",
      prompt,
      badges: [
        { label: "score " + b.score, cls: "is-cyan" },
        { label: b.risk + " risk", cls: b.risk === "low" ? "is-success" : "is-warn" },
      ],
    });
  };

  // Aggregate funnel across all regions
  const total = REGIONS.reduce((acc, r) => ({
    sourced: acc.sourced + r.sourced,
    contacted: acc.contacted + r.contacted,
    responded: acc.responded + r.responded,
    onboarded: acc.onboarded + r.onboarded,
    listed: acc.listed + r.listed,
  }), { sourced: 0, contacted: 0, responded: 0, onboarded: 0, listed: 0 });

  const sourcedMax = total.sourced;
  const funnelSteps = [
    { key: "sourced",   label: "Sourced",   sub: "scraped + referred",    count: total.sourced,   tone: "t-sourced" },
    { key: "contacted", label: "Contacted", sub: "first outbound sent",   count: total.contacted, tone: "t-contacted" },
    { key: "responded", label: "Responded", sub: "any reply or click",    count: total.responded, tone: "t-responded" },
    { key: "onboarded", label: "Onboarded", sub: "completed setup",       count: total.onboarded, tone: "t-onboarded" },
    { key: "listed",    label: "Listed",    sub: "≥1 active listing",     count: total.listed,    tone: "t-listed" },
  ];

  return (
    <React.Fragment>
      {/* Top KPI row scoped to outreach */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <KpiTile kpi={{ key: "tasks", icon: "Globe", label: "Markets active", value: "8", unit: "", delta: "+2", dir: "up", sub: "this quarter" }} />
        <KpiTile kpi={{ key: "outreach-sent", icon: "Send", label: "Outreach sent · wk", value: "1,847", unit: "", delta: "+22%", dir: "up", sub: "vs last week" }} />
        <KpiTile kpi={{ key: "reply", icon: "MessageCircle", label: "Reply rate", value: "31.4", unit: "%", delta: "+2.1pp", dir: "up", sub: "200 replies this wk" }} />
        <KpiTile kpi={{ key: "joined", icon: "Users", label: "Brokers joined · wk", value: "23", unit: "", delta: "+9", dir: "up", sub: "best week ever" }} />
        <KpiTile kpi={{ key: "cost", icon: "DollarSign", label: "Cost / acquisition", value: "$4.30", unit: "", delta: "−$1.10", dir: "down", goodDown: true, sub: "AI-driven scoring" }} />
      </div>

      {/* Map + funnel */}
      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Globe size={13} /></span>
              Active markets
            </div>
            <span className="card__sub">East Africa · Arab Gulf · Southern Africa</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.Plus size={11} /> Add market</button>
            </div>
          </div>
          <RegionsMap />
          <div className="region-list">
            {REGIONS.map(r => {
              const respRate = Math.round((r.responded / r.contacted) * 100);
              const onbRate = Math.round((r.onboarded / r.responded) * 100);
              return (
                <div key={r.code} className="region-row">
                  <div className="region-flag">{r.flag}</div>
                  <div className="region-name">{r.name}<span className="sub">{r.sub}</span></div>
                  <div className="region-stat">{r.contacted.toLocaleString()}<span className="label">Contacted</span></div>
                  <div className="region-stat" style={{ color: "var(--cb-success)" }}>{respRate}%<span className="label" style={{ color: "var(--cb-ink-3)" }}>Reply</span></div>
                  <div className="meter">
                    <div className="meter__head">
                      <span>{r.onboarded} onboarded · {r.listed} listed</span>
                      <b>{onbRate}%</b>
                    </div>
                    <div className="meter__bar is-success"><div style={{ width: Math.min(100, onbRate * 2) + "%" }}></div></div>
                  </div>
                  <div className="region-stat" style={{ textAlign: "right", color: "var(--cb-cyan)" }}>{r.listed}<span className="label" style={{ color: "var(--cb-ink-3)" }}>Listed</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Funnel */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.GitMerge size={13} /></span>
                Outreach funnel · last 30d
              </div>
              <span className="card__sub">All regions</span>
            </div>
            <div className="card__body">
              <div className="funnel">
                {funnelSteps.map((s, i) => {
                  const pct = (s.count / sourcedMax) * 100;
                  const conv = i === 0 ? null : Math.round((s.count / funnelSteps[i - 1].count) * 100);
                  return (
                    <div key={s.key} className="funnel__step">
                      <div>
                        <b>{s.label}</b>
                        <span className="small">{s.sub}{conv != null ? ` · ${conv}% conv` : ""}</span>
                      </div>
                      <div className="funnel__bar"><div className={s.tone} style={{ width: pct + "%" }}></div></div>
                      <div className="funnel__count">{s.count.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card__foot">
              <Icon.TrendingUp size={11} color="var(--cb-success)" />
              <span><b style={{ color: "var(--cb-ink)" }}>1.74%</b> sourced → listed (industry avg 0.4%)</span>
              <button className="btn is-sm is-ghost" style={{ marginLeft: "auto" }}>Tune cohort <Icon.ArrowRight size={11} /></button>
            </div>
          </div>

          {/* Pending outreach */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Send size={13} /></span>
                Agent-drafted outreach
              </div>
              <span className="chip is-warn">2 pending</span>
              <span className="chip is-success">1 auto-sent</span>
            </div>
            <div className="card__body is-flush" style={{ maxHeight: 320, overflowY: "auto" }}>
              {SUGGESTED_BROKERS.map(b => (
                <div key={b.id} className="broker-card" style={{ cursor: "pointer" }} onClick={() => openBrokerOutreach(b)}>
                  <div className="broker-avatar">{b.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="broker-card__name">
                      {b.name}
                      <span className="chip is-ghost" style={{ padding: "0 4px", fontSize: 10 }}>{b.location}</span>
                      {b.status === "auto-sent" && <span className="chip is-success" style={{ padding: "0 6px" }}><Icon.CheckCircle size={10} /> sent</span>}
                      {b.status === "pending" && <span className="chip is-warn" style={{ padding: "0 6px" }}><Icon.Clock size={10} /> awaiting</span>}
                    </div>
                    <div className="broker-card__sub">{b.tenure} · {b.tags[0]} · score <b style={{ color: "var(--cb-cyan)" }}>{b.score}</b></div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    {b.status === "pending" ? (
                      <>
                        <button className="btn is-sm is-cyan" onClick={() => openBrokerOutreach(b)} title="Preview & send"><Icon.Send size={10} /></button>
                        <button className="btn is-sm" onClick={() => openBrokerOutreach(b)} title="Edit draft"><Icon.Edit size={10} /></button>
                      </>
                    ) : (
                      <button className="btn is-sm is-cyan" onClick={() => openBrokerOutreach(b)} title="View thread"><Icon.Eye size={10} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Marketing channel summary */}
      <div className="card">
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.Megaphone size={13} /></span>
            CoBrop marketing &amp; awareness · last 7d
          </div>
          <span className="card__sub">Agent runs campaigns to seed new markets</span>
          <div className="card__head-right">
            <button className="btn is-sm is-ghost"><Icon.RotateCw size={11} /> 7d</button>
            <button className="btn is-sm is-cyan"><Icon.Plus size={11} /> New campaign</button>
          </div>
        </div>
        <div className="card__body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, padding: 0 }}>
          {[
            { ch: "LinkedIn", impr: "184k", clicks: "4,210", sign: 47, icon: "Linkedin", color: "#0a66c2" },
            { ch: "WhatsApp",  impr: "—",     clicks: "1,180", sign: 24, icon: "MessageCircle", color: "#25d366" },
            { ch: "Email",     impr: "92k",   clicks: "3,640", sign: 31, icon: "Mail", color: "#1c5f7b" },
            { ch: "Telegram",  impr: "61k",   clicks: "1,420", sign: 19, icon: "Send", color: "#06B6D4" },
          ].map(c => {
            const IconC = Icon[c.icon];
            return (
              <div key={c.ch} style={{ padding: "14px 16px", borderRight: "1px solid var(--cb-line)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: c.color + "1a", color: c.color, display: "grid", placeItems: "center" }}>
                    <IconC size={12} />
                  </span>
                  <b style={{ fontSize: 13 }}>{c.ch}</b>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--cb-ink-3)" }}>
                  <span>Impr <b style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "var(--cb-ink)", marginLeft: 3 }}>{c.impr}</b></span>
                  <span>Clicks <b style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "var(--cb-ink)", marginLeft: 3 }}>{c.clicks}</b></span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 22, fontWeight: 700, color: "var(--cb-cyan)" }}>{c.sign}</span>
                  <span style={{ fontSize: 11, color: "var(--cb-ink-3)" }}>sign-ups</span>
                  <span className="chip is-success" style={{ marginLeft: "auto", fontSize: 10 }}><Icon.TrendingUp size={10} /> +{Math.round(c.sign * 0.3)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

window.MissionControl = MissionControl;
window.ApprovalsScreen = ApprovalsScreen;
window.OutreachScreen = OutreachScreen;
window.KpiTile = KpiTile;
window.Sparkline = Sparkline;
window.ActivityFeed = ActivityFeed;
window.StreamRow = StreamRow;
window.formatHM = formatHM;
window.formatTimeAgo = formatTimeAgo;
