// agent-shell.jsx — Sidebar + Topbar chrome for CoBrop Agent console

const NAV_ITEMS = [
  { key: "overview",  label: "Mission Control", icon: "Activity",      group: "monitor" },
  { key: "approvals", label: "Approvals",       icon: "ListChecks",    group: "monitor", count: 18, urgent: true },
  { key: "tasks",     label: "Task trace",      icon: "Database",      group: "monitor", count: 2732 },
  { key: "outreach",  label: "Broker outreach", icon: "Users",         group: "monitor", count: 318 },
  { key: "marketing", label: "Marketing",       icon: "Megaphone",     group: "monitor" },
  { key: "blog",      label: "Blog & content",  icon: "BookOpen",      group: "monitor", count: 6 },
  { key: "fraud",     label: "Risk & fraud",    icon: "ShieldCheck",   group: "monitor" },
  { key: "playbooks", label: "Playbooks",       icon: "FileText",      group: "config" },
  { key: "tools",     label: "Tools & data",    icon: "Wand",          group: "config" },
  { key: "settings",  label: "Agent settings",  icon: "Settings",      group: "config" },
];

function Sidebar({ screen, onScreenChange, autonomy, approvalCount }) {
  const monitorItems = NAV_ITEMS.filter(n => n.group === "monitor").map(n =>
    n.key === "approvals" && approvalCount != null
      ? { ...n, count: approvalCount, urgent: approvalCount > 0 }
      : n
  );
  const configItems = NAV_ITEMS.filter(n => n.group === "config");
  const levels = { suggest: 1, assist: 2, autopilot: 3 };
  const lvl = levels[autonomy] || 2;
  const autonomyLabel = {
    suggest: "Suggest only",
    assist: "Assist · escalate risky",
    autopilot: "Auto-pilot",
  }[autonomy];
  const autonomyHint = {
    suggest: "Every action queued for review. 0 auto-acts.",
    assist: "Low-risk auto. Med/high human review. ← active",
    autopilot: "Acts on all but high-risk fraud & big spend.",
  }[autonomy];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">CB</div>
        <div className="sidebar__brand-text">
          <b>CoBrop Agent</b>
          <span>Mission Control</span>
        </div>
      </div>

      <div className="sidebar__group">
        <div className="sidebar__group-title">Monitor</div>
        <nav className="sidebar__nav">
          {monitorItems.map(item => {
            const IconC = Icon[item.icon];
            return (
              <button
                key={item.key}
                className={item.key === screen ? "is-active" : ""}
                onClick={() => onScreenChange(item.key)}
              >
                <IconC size={14} />
                <span>{item.label}</span>
                {item.count != null && (
                  <span className={"count" + (item.urgent ? " is-urgent" : "")}>{item.count.toLocaleString()}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar__group">
        <div className="sidebar__group-title">Configure</div>
        <nav className="sidebar__nav">
          {configItems.map(item => {
            const IconC = Icon[item.icon];
            return (
              <button
                key={item.key}
                className={item.key === screen ? "is-active" : ""}
                onClick={() => onScreenChange(item.key)}
              >
                <IconC size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar__footer">
        <div className="autonomy-card">
          <div className="autonomy-card__label">Autonomy level</div>
          <div className="autonomy-card__value">
            <span className="dot"></span>{autonomyLabel}
          </div>
          <div className="autonomy-card__bar">
            <span className={lvl >= 1 ? "on" : ""}></span>
            <span className={lvl >= 2 ? "on" : ""}></span>
            <span className={lvl >= 3 ? "on" : ""}></span>
          </div>
          <div className="autonomy-card__hint">{autonomyHint}</div>
        </div>

        <div className="sidebar__me">
          <div className="sidebar__me-avatar">DA</div>
          <div>
            <div className="sidebar__me-name">Dawit Asfaw</div>
            <div className="sidebar__me-role">Platform admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ screen, autonomy, paused, onTogglePaused, agentThinking, onRunAgent, approvalCount }) {
  const titleMap = {
    overview:  { crumb: "Monitor", title: "Mission Control" },
    approvals: { crumb: "Monitor", title: "Approvals queue" },
    tasks:     { crumb: "Monitor", title: "Task trace" },
    outreach:  { crumb: "Monitor", title: "Broker outreach" },
    marketing: { crumb: "Monitor", title: "Marketing" },
    blog:      { crumb: "Monitor", title: "Blog & content" },
    fraud:     { crumb: "Monitor", title: "Risk & fraud" },
    playbooks: { crumb: "Configure", title: "Playbooks" },
    tools:     { crumb: "Configure", title: "Tools & data" },
    settings:  { crumb: "Configure", title: "Agent settings" },
  };
  const t = titleMap[screen] || titleMap.overview;

  return (
    <header className="topbar">
      <div className="topbar__title">
        <span className="crumb">{t.crumb}</span>
        <span className="topbar__crumb-sep">/</span>
        <h1>{t.title}</h1>
      </div>

      <div className="topbar__live">
        <span className="dot"></span>
        {paused ? "Paused" : "Agent live"}
      </div>

      {agentThinking && (
        <span className="agent-thinking-pill">
          <span className="toast__spinner"></span>
          Reasoning
        </span>
      )}

      <div className="topbar__right">
        <div className="topbar__metric">
          <span className="icon"><Icon.Inbox size={12} /></span>
          <b>{approvalCount != null ? approvalCount : "—"}</b>
          <span>awaiting</span>
        </div>
        <div className="topbar__metric">
          <span className="icon"><Icon.Zap size={12} /></span>
          <b>96.4%</b>
          <span>auto</span>
        </div>
        <div className="topbar__search">
          <Icon.Search size={13} color="#6B8A95" />
          <input placeholder="Search tasks, brokers, listings…" />
          <kbd>⌘K</kbd>
        </div>
        <button className="topbar__icon-btn" title="Notifications">
          <Icon.Bell size={14} />
          <span className="bump"></span>
        </button>
        <button
          className="btn is-cyan"
          onClick={() => onRunAgent && onRunAgent()}
          disabled={agentThinking}
          title="Trigger the agent to reason and pick its next action"
        >
          <Icon.Sparkles size={12} />
          {agentThinking ? "Thinking…" : "Run agent"}
        </button>
        <button
          className={"btn " + (paused ? "is-primary" : "")}
          onClick={onTogglePaused}
          title={paused ? "Resume agent" : "Pause agent"}
        >
          {paused ? <Icon.Play size={12} /> : <Icon.Pause size={12} />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
