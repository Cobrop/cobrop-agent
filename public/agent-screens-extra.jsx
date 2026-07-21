// agent-screens-extra.jsx — Marketing, Risk, Trace, Playbooks, Tools, Settings

const { TASK_TYPES: TT2, REGIONS: REG2, SUGGESTED_BROKERS: SB2 } = window.CB_DATA;

// ════════════════════════════════════════════════════════════════
// MARKETING — Social media posting & campaigns
// ════════════════════════════════════════════════════════════════

const CHANNELS = [
  { key: "li", name: "LinkedIn",  icon: "Linkedin",      color: "#0a66c2", posts: 27, impr: "184k", clicks: "4,210", sign: 47, status: "live" },
  { key: "fb", name: "Facebook",  icon: "Facebook",      color: "#1877f2", posts: 31, impr: "212k", clicks: "5,890", sign: 38, status: "live" },
  { key: "ig", name: "Instagram", icon: "Instagram",     color: "#e1306c", posts: 24, impr: "96k",  clicks: "2,140", sign: 22, status: "live" },
  { key: "tt", name: "TikTok",    icon: "TikTok",        color: "#000",    posts: 14, impr: "612k", clicks: "14k",   sign: 31, status: "live" },
  { key: "x",  name: "X (Twitter)",icon: "Twitter",      color: "#000",    posts: 18, impr: "42k",  clicks: "1,180", sign: 11, status: "warn" },
  { key: "tg", name: "Telegram",  icon: "Telegram",      color: "#2aabee", posts: 12, impr: "61k",  clicks: "1,420", sign: 19, status: "live" },
];

const POST_PREVIEWS = [
  {
    ch: "li", chName: "LinkedIn",
    handle: "CoBrop · Real Estate", time: "Posted 14m ago · agent-drafted",
    body: "120M new retail investors entered markets between 2019–2023. But cross-border real estate is still gated by gatekeepers. Here's how 480+ brokers from Addis to Dubai are splitting fees on CoBrop — without a single intermediary 👇",
    mediaTag: "Carousel · 5 slides",
    mediaTitle: "How CoBrop fee-splits work",
    stats: [{ k: "Impressions", v: "12,840" }, { k: "Likes", v: "412" }, { k: "Reposts", v: "38" }, { k: "Comments", v: "27" }],
    status: "auto-published",
  },
  {
    ch: "fb", chName: "Facebook",
    handle: "CoBrop Africa", time: "Posted 1h ago · agent-drafted",
    body: "🇰🇪 → 🇪🇹 Faisal in Nairobi just split his first cross-border fee with @hewan.s in Addis. 12 days from intro to closed deal. East African co-brokerage is real now.",
    mediaTag: "Video · 0:42",
    mediaTitle: "Faisal × Hewan — case study",
    stats: [{ k: "Reach", v: "32,140" }, { k: "Reactions", v: "1,107" }, { k: "Shares", v: "94" }],
    status: "auto-published",
  },
  {
    ch: "tt", chName: "TikTok",
    handle: "@cobrop.real", time: "Scheduled for 18:00 today",
    body: "POV: you're a broker in Kigali listing a Nyarutarama villa. Buyer is in Addis. They've never met. CoBrop handled the rest. #realestate #africa #cobrokerage",
    mediaTag: "Reel · 0:28",
    mediaTitle: "60-sec co-brokerage explainer",
    stats: [{ k: "Predicted views", v: "84k" }, { k: "Est. clicks", v: "1,820" }],
    status: "scheduled",
  },
];

const SCHEDULED = [
  { time: "14:30", day: "TODAY",    ch: "li", title: "Why East African brokers are joining CoBrop", sub: "Carousel · 5 slides · Q2 campaign", lang: ["EN"], locale: "ET·KE·UG" },
  { time: "18:00", day: "TODAY",    ch: "tt", title: "60-sec co-brokerage explainer",                 sub: "Reel · 0:28 · trending audio overlay",  lang: ["EN"], locale: "GLOBAL" },
  { time: "09:00", day: "TUE",      ch: "fb", title: "Hewan × Faisal cross-border case study",        sub: "Video · 0:42 · subtitles AM/SW",        lang: ["AM","SW"], locale: "ET·KE" },
  { time: "11:00", day: "TUE",      ch: "ig", title: "Bole Penthouse tour",                            sub: "Story set · 6 frames",                  lang: ["EN"], locale: "ADDIS" },
  { time: "13:00", day: "WED",      ch: "x",  title: "Capital markets opened 1602. Real estate, 2026.", sub: "Thread · 7 tweets",                    lang: ["EN"], locale: "GLOBAL" },
  { time: "15:30", day: "WED",      ch: "tg", title: "Dubai broker meetup invite (Arabic)",            sub: "Channel post · RSVP poll",              lang: ["AR"], locale: "AE·QA" },
  { time: "10:00", day: "THU",      ch: "li", title: "Hiring: country lead, South Africa",              sub: "Job post · sponsored",                  lang: ["EN"], locale: "ZA" },
];

const CAMPAIGNS = [
  { name: "Q2 East Africa awareness", channels: ["li","fb","tt","x"], budget: "$1,200", spent: 412, spentPct: 34, posts: 18, sign: 47, status: "live", ctr: "2.8%" },
  { name: "Dubai broker recruitment",   channels: ["li","fb","tg"],   budget: "$800",  spent: 612, spentPct: 76, posts: 14, sign: 24, status: "live", ctr: "3.1%" },
  { name: "South Africa launch",        channels: ["li","ig","fb"],   budget: "$1,800", spent: 88, spentPct: 5,  posts: 4,  sign: 6,  status: "warming", ctr: "1.9%" },
  { name: "Hewan × Faisal case study",  channels: ["fb","li","tt"],   budget: "$300",  spent: 210, spentPct: 70, posts: 6,  sign: 18, status: "live", ctr: "4.7%" },
];

function MarketingScreen() {
  const engine = window.useAgentEngine && window.useAgentEngine();
  const openScheduledPreview = (s) => {
    if (!engine) return;
    const ch = CHANNELS.find(c => c.key === s.ch) || { name: s.ch };
    const stylePrompt = {
      li: "professional, data-driven, 220–320 word LinkedIn post · 3 short paragraphs · 1 stat hook · NO emoji · soft CTA",
      fb: "warm, story-driven, 180–260 word Facebook post · broker case study angle · 1 emoji at most",
      ig: "punchy 80–120 word Instagram caption · benefit-led hook · 4 lines · 5 hashtags at end",
      tt: "TikTok script for a 28-second reel · 4 lines of voiceover + 3 on-screen captions · casual tone",
      x:  "X/Twitter thread · 6–8 tweets · each ≤ 270 chars · stat-led, contrarian framing",
      tg: "Telegram channel post · short paragraphs · 1 stat · clear CTA · uses inline links",
      wa: "WhatsApp template message · 1 paragraph · friendly · ≤ 480 chars · includes opt-out line",
    }[s.ch] || "social post in CoBrop brand voice";

    const prompt = `You are CoBrop's social-content agent. CoBrop is a real-estate co-brokerage platform connecting brokers across Ethiopia, Kenya, UAE, Rwanda, South Africa, Tanzania, Uganda, Qatar.

CHANNEL: ${ch.name}
STYLE: ${stylePrompt}
LANGUAGES: ${s.lang.join(", ")}${s.lang.length > 1 ? " (write in the FIRST listed language only)" : ""}
LOCALE TARGET: ${s.locale}
POST TOPIC: "${s.title}" — ${s.sub}

Brand voice rules: confident, educational, empowering. Use action verbs. NO marketing clichés ("game-changer", "leverage", "in today's"). NO emoji unless channel rule allows. Pair regional data with concrete broker stories. Invent realistic East African real-estate stats if needed.

Output ONLY the post body. No preface, no commentary.`;

    // Map the screen's short channel keys to what social-post.ts's Channel
    // type actually accepts — previously this was guessed by parsing the
    // display eyebrow text ("LinkedIn · KE"), which never produced a valid
    // channel string, so real scheduling silently never fired.
    const CHANNEL_KEY_MAP = { li: "linkedin", fb: "facebook", ig: "instagram", tt: "tiktok", x: "x", tg: "telegram", wa: "whatsapp" };
    engine.generateAndPreview({
      title: s.title,
      eyebrow: ch.name + " · " + s.locale,
      kind: "post",
      channel: CHANNEL_KEY_MAP[s.ch],
      topicSub: s.sub,
      prompt,
      badges: [
        { label: s.day + " " + s.time, cls: "" },
        { label: s.lang.join("·"), cls: "is-cyan" },
      ],
    });
  };

  const totalImpr = "1.2M", totalClicks = "29,840", totalSign = "168";
  return (
    <React.Fragment>
      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <KpiTile kpi={{ key: "posts", icon: "Megaphone", label: "Posts published · 7d", value: "126", unit: "", delta: "+18", dir: "up", sub: "across 6 channels" }} />
        <KpiTile kpi={{ key: "impr",  icon: "Eye",       label: "Impressions · 7d",     value: "1.2", unit: "M", delta: "+34%", dir: "up", sub: totalImpr + " reached" }} />
        <KpiTile kpi={{ key: "ctr",   icon: "ArrowUpRight", label: "Click-through",     value: "2.49", unit: "%", delta: "+0.4pp", dir: "up", sub: "29,840 clicks" }} />
        <KpiTile kpi={{ key: "sign",  icon: "Users",     label: "Sign-ups attributed", value: "168", unit: "", delta: "+22%", dir: "up", sub: "from social" }} />
        <KpiTile kpi={{ key: "cac",   icon: "DollarSign",label: "Cost / sign-up",       value: "$7.80",unit: "",  delta: "−$1.40", dir: "down", goodDown: true, sub: "vs. paid avg $24" }} />
      </div>

      {/* Channels grid */}
      <div className="channels-grid">
        {CHANNELS.map(c => {
          const IconC = Icon[c.icon];
          return (
            <div key={c.key} className="channel-tile">
              <div className="channel-tile__head">
                <div className="channel-tile__icon" style={{ background: c.color }}><IconC size={13} /></div>
                <div className="channel-tile__name">{c.name}</div>
                <div className="channel-tile__meta" style={{ color: c.status === "live" ? "var(--cb-success)" : "var(--cb-warn)" }}>
                  <span className="dot" style={{ background: c.status === "live" ? "var(--cb-success)" : "var(--cb-warn)" }}></span>
                  {c.status === "live" ? "Live" : "Watch"}
                </div>
              </div>
              <div>
                <div className="channel-tile__big">{c.sign}</div>
                <div className="channel-tile__big-label">Sign-ups · 7d</div>
              </div>
              <div className="channel-tile__row">
                <span>Posts <b>{c.posts}</b></span>
                <span>Impr <b>{c.impr}</b></span>
                <span>Clicks <b>{c.clicks}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-column: published posts + scheduled queue */}
      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Sparkles size={13} /></span>
              Recent agent-published posts
            </div>
            <span className="chip is-success">3 auto · 1 scheduled</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.Filter size={11} /> All channels</button>
            </div>
          </div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {POST_PREVIEWS.map((p, i) => (
              <div key={i} className="post-card">
                <div className="post-card__head">
                  <div className={"post-card__channel " + p.ch}>
                    {React.createElement(Icon[CHANNELS.find(c => c.key === p.ch).icon], { size: 11 })}
                  </div>
                  <div>
                    <div className="post-card__handle">{p.handle}</div>
                    <div className="post-card__time">{p.time}</div>
                  </div>
                  <div className="post-card__status">
                    {p.status === "auto-published"
                      ? <span className="chip is-success" style={{ fontSize: 10 }}><Icon.CheckCircle size={10} /> Auto</span>
                      : <span className="chip is-warn" style={{ fontSize: 10 }}><Icon.Clock size={10} /> Scheduled</span>}
                  </div>
                </div>
                <div className="post-card__body">{p.body}</div>
                <div className="post-card__media">
                  <span className="post-card__media-tag">{p.mediaTag}</span>
                  <span>{p.mediaTitle}</span>
                </div>
                <div className="post-card__stats">
                  {p.stats.map(s => <span key={s.k}>{s.k} <b>{s.v}</b></span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Calendar size={13} /></span>
                Scheduled queue · next 7d
              </div>
              <span className="chip is-cyan">{SCHEDULED.length} posts</span>
              <div className="card__head-right">
                <button className="btn is-sm is-cyan"><Icon.Plus size={11} /> Draft post</button>
              </div>
            </div>
            <div className="card__body is-flush">
              {SCHEDULED.map((s, i) => {
                const ch = CHANNELS.find(c => c.key === s.ch);
                const IconC = Icon[ch.icon];
                return (
                  <div key={i} className="schedule-row" style={{ cursor: "pointer" }} onClick={() => openScheduledPreview(s)} title="Preview the agent-drafted post">
                    <div className="schedule-row__time">{s.time}<span className="day">{s.day}</span></div>
                    <div className={"post-card__channel " + s.ch} style={{ width: 24, height: 24 }}>
                      <IconC size={11} />
                    </div>
                    <div>
                      <div className="schedule-row__title">{s.title}</div>
                      <div className="schedule-row__sub">{s.sub}</div>
                    </div>
                    <div className="schedule-row__lang">{s.lang.join(" · ")}</div>
                    <div className="schedule-row__locale">{s.locale}</div>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn is-sm is-cyan" onClick={() => openScheduledPreview(s)} title="Preview"><Icon.Eye size={11} /></button>
                      <button className="btn is-sm is-ghost" onClick={() => engine?.pushToast({ kind: "info", msg: "Edit composer would open here" })} title="Edit"><Icon.Edit size={11} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.PlayCircle size={13} /></span>
                Active campaigns
              </div>
              <span className="chip is-cyan">4 running</span>
            </div>
            <div className="card__body is-flush">
              {CAMPAIGNS.map((c, i) => (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderBottom: i === CAMPAIGNS.length - 1 ? 0 : "1px solid var(--cb-line)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--cb-ink)" }}>
                      {c.name}
                      {c.status === "warming"
                        ? <span className="chip is-warn" style={{ marginLeft: 6, fontSize: 10 }}>Warming</span>
                        : <span className="chip is-success" style={{ marginLeft: 6, fontSize: 10 }}>Live</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--cb-ink-3)", marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        {c.channels.map(ck => {
                          const ch = CHANNELS.find(cc => cc.key === ck);
                          const IconC = Icon[ch.icon];
                          return <span key={ck} className={"post-card__channel " + ck} style={{ width: 18, height: 18 }}><IconC size={9} /></span>;
                        })}
                      </span>
                      <span>{c.posts} posts · CTR <b style={{ color: "var(--cb-ink)" }}>{c.ctr}</b> · {c.sign} sign-ups</span>
                    </div>
                    <div className="meter" style={{ marginTop: 6, maxWidth: 360 }}>
                      <div className="meter__head">
                        <span>Spend · {c.spentPct}%</span>
                        <b style={{ fontSize: 12 }}>${c.spent} / {c.budget}</b>
                      </div>
                      <div className="meter__bar"><div style={{ width: c.spentPct + "%" }}></div></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                    <button className="btn is-sm is-ghost"><Icon.Pause size={11} /></button>
                    <button className="btn is-sm is-ghost"><Icon.Settings size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════════════════════════════════════════════════════
// RISK & FRAUD
// ════════════════════════════════════════════════════════════════

const FRAUD_SIGNALS = [
  { name: "Duplicate photo hash",   icon: "Image",        sub: "perceptual + EXIF match",      count: 47 },
  { name: "Watermark detected",     icon: "Layers",       sub: "3rd-party portal scrapes",     count: 18 },
  { name: "Geo / GPS mismatch",     icon: "MapPin",       sub: "address ↔ coords ≥ 5km",       count: 12 },
  { name: "Price anomaly",          icon: "TrendingDown", sub: "−40% vs comparables",          count: 9 },
  { name: "Stolen identity",        icon: "Fingerprint",  sub: "KYC ↔ broker license",         count: 4 },
  { name: "Bot-like inquiry burst", icon: "Bot",          sub: "≥20 inquiries in 5 min",       count: 6 },
];

const FRAUD_CASES = [
  { id: "RSK-0421", what: "CMC Villa ↔ @teklu (96% match)", sub: "@yonas.a · Free tier · 2 strikes", conf: 96, age: "47m", state: "pending" },
  { id: "RSK-0420", what: "Megenagna listing — stock photos", sub: "@bekele.m · 1st-time broker", conf: 88, age: "2h", state: "auto-halted" },
  { id: "RSK-0418", what: "Suspicious 24 inquiries from same IP", sub: "Bole Penthouse · @meron.t listing", conf: 73, age: "5h", state: "investigating" },
  { id: "RSK-0414", what: "Broker license number not found in DB", sub: "@new.broker.q · Qatar registry", conf: 81, age: "1d", state: "pending" },
  { id: "RSK-0411", what: "Price 47% below Kazanchis median", sub: "Possible scam listing · @robel.h", conf: 64, age: "1d", state: "pending" },
];

function RiskScreen() {
  return (
    <React.Fragment>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <KpiTile kpi={{ key: "flagged", icon: "AlertTriangle", label: "Flagged · 7d", value: "96", unit: "", delta: "+12", dir: "up", sub: "1.8% of new content" }} />
        <KpiTile kpi={{ key: "conf",    icon: "ShieldCheck",   label: "Confirmed fraud", value: "31", unit: "", delta: "−4", dir: "down", goodDown: true, sub: "32% conversion" }} />
        <KpiTile kpi={{ key: "prev",    icon: "Lock",          label: "Prevented loss",  value: "$84", unit: "k", delta: "+$22k", dir: "up", sub: "est. customer harm" }} />
        <KpiTile kpi={{ key: "ttr",     icon: "Clock",         label: "Avg. time-to-resolve", value: "11", unit: "min", delta: "−4min", dir: "down", goodDown: true, sub: "agent → admin" }} />
        <KpiTile kpi={{ key: "fp",      icon: "HelpCircle",    label: "False positive rate", value: "3.1", unit: "%", delta: "−0.8pp", dir: "down", goodDown: true, sub: "agent quality" }} />
      </div>

      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.ScanSearch size={13} /></span>
              Open investigations
            </div>
            <span className="chip is-error">{FRAUD_CASES.filter(c => c.state === "pending").length} pending admin</span>
            <span className="chip is-warn">1 investigating</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.Filter size={11} /> Filter</button>
            </div>
          </div>
          <div className="card__body is-flush">
            {FRAUD_CASES.map(c => (
              <div key={c.id} className="risk-row">
                <div className={"queue__row-icon t-fraud"}><Icon.ShieldCheck size={14} /></div>
                <div>
                  <div className="risk-row__what">{c.what} <span className="ref" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cb-ink-3)", marginLeft: 4 }}>{c.id}</span></div>
                  <div className="risk-row__sub">{c.sub}</div>
                </div>
                <div className="risk-conf">
                  <div className="b"><div style={{ width: c.conf + "%" }}></div></div>
                  {c.conf}%
                </div>
                <div>
                  {c.state === "pending"      && <span className="chip is-error"><Icon.AlertTriangle size={10} /> Admin review</span>}
                  {c.state === "auto-halted"  && <span className="chip is-warn"><Icon.Pause size={10} /> Auto-halted</span>}
                  {c.state === "investigating"&& <span className="chip is-cyan"><Icon.ScanSearch size={10} /> Gathering data</span>}
                </div>
                <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, color: "var(--cb-ink-3)" }}>{c.age}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn is-sm is-cyan"><Icon.Eye size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Fingerprint size={13} /></span>
                Active detection signals
              </div>
              <span className="card__sub">96 flags · 7d</span>
            </div>
            <div className="card__body">
              <div className="signals">
                {FRAUD_SIGNALS.map(s => {
                  const IconC = Icon[s.icon];
                  return (
                    <div key={s.name} className="signal">
                      <div className="signal__icon"><IconC size={11} /></div>
                      <div>
                        <div className="signal__name">{s.name}</div>
                        <div className="signal__sub">{s.sub}</div>
                      </div>
                      <div className="signal__count">{s.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Crown size={13} /></span>
                Broker trust signals
              </div>
              <span className="card__sub">strike accruals · last 30d</span>
            </div>
            <div className="card__body is-flush">
              {[
                { name: "@yonas.a",   tier: "Free",     strikes: 2, sub: "2 dup listings · 1 photo theft" },
                { name: "@bekele.m",  tier: "Free",     strikes: 1, sub: "1 watermarked photo set" },
                { name: "@robel.h",   tier: "Standard", strikes: 1, sub: "Suspicious price anomaly" },
                { name: "@teklu.b",   tier: "Premium",  strikes: 0, sub: "Clean · trust score 94" },
              ].map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px auto", gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: i === 3 ? 0 : "1px solid var(--cb-line)", fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--cb-ink)" }}>{b.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--cb-ink-3)", marginTop: 1 }}>{b.sub}</div>
                  </div>
                  <span className="chip">{b.tier}</span>
                  <span className={b.strikes === 0 ? "chip is-success" : b.strikes >= 2 ? "chip is-error" : "chip is-warn"}>
                    {b.strikes} {b.strikes === 1 ? "strike" : "strikes"}
                  </span>
                  <button className="btn is-sm is-ghost"><Icon.ArrowRight size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════════════════════════════════════════════════════
// TASK TRACE — drill into a single task's reasoning
// ════════════════════════════════════════════════════════════════

function TaskTraceScreen({ now }) {
  const TRACE = [
    { kind: "think", label: "Plan", t: "08:14:01.040", title: "New listing webhook received · LST-9914",
      body: "Identify task type. Webhook from properties.insert. Need to: validate photos, generate description, translate, set initial visibility, run dup-check." },
    { kind: "tool",  label: "Tool call", t: "08:14:01.110", title: "supabase.properties.select(id=9914)",
      code: `SELECT id, title, address, lat, lng, price, broker_id, status, image_urls
FROM properties WHERE id = 9914;`,
      body: "Confirmed: 12 photos, ETB 11.4M, GPS 9.0181,38.7869, broker @meron.t (Premium · trust 91)" },
    { kind: "tool", label: "Tool call", t: "08:14:01.380", title: "r2.fetch(image_urls[12]) → vision.classify",
      code: `vision.classify({
  bucket: "cobrop-property-img",
  keys: 12,
  checks: ["watermark", "stock", "duplicate", "quality"]
})`,
      body: "All 12 photos clean. No watermark, no stock-photo match, no perceptual-hash collision in 84,210 existing listings." },
    { kind: "think", label: "Decision", t: "08:14:02.012", title: "Photo gate → PASS",
      body: "Confidence 0.94. Listing meets photo policy. Proceed to description + translation." },
    { kind: "tool",  label: "Tool call", t: "08:14:02.080", title: "claude.complete · description draft",
      code: `messages: [{role:"user", content:"Generate 3 description variants (60–80 words) for a 240m² penthouse at Roha Tower, Bole, in CoBrop voice. Highlight: 360° view, 3BR, premium finishes. Price ETB 11.4M..."}]`,
      body: "Returned 3 variants A/B/C. Quality model picks variant B (best inquiry-yield priors)." },
    { kind: "tool",  label: "Tool call", t: "08:14:02.610", title: "translator.batch → AM, AR, FR",
      body: "3 translations generated. Back-translation similarity 0.91, 0.88, 0.92. All pass quality gate." },
    { kind: "data",  label: "DB write", t: "08:14:02.910", title: "supabase.properties.update(id=9914)",
      code: `UPDATE properties SET
  description_en = $1, description_am = $2,
  description_ar = $3, description_fr = $4,
  agent_status = 'validated',
  agent_review_ms = 1870
WHERE id = 9914;`,
      body: "Write succeeded · row affected: 1" },
    { kind: "tool",  label: "Tool call", t: "08:14:03.100", title: "duplicate_check.run(id=9914)",
      body: "Perceptual hash + title-embedding + geo proximity. Top match: LST-9881 (cosine 0.41, geo 2.4km). Below threshold 0.85. No duplicate." },
    { kind: "data",  label: "DB write", t: "08:14:03.420", title: "supabase.agent_actions.insert",
      code: `INSERT INTO agent_actions (
  task_id, type, status, autonomy_level,
  cost_usd, duration_ms, ref_entity
) VALUES (
  'LST-9914', 'listing.onboard', 'auto-completed',
  'assist', 0.012, 2380, 'property:9914'
);`,
      body: "Audit log written. Cost $0.012." },
    { kind: "out",   label: "Output",   t: "08:14:03.580", title: "Task completed · auto-resolved",
      body: "Listing onboarded in 2.38s. Broker @meron.t notified via in-app. Routed to marketing.queue for social-promo eligibility." },
  ];

  const TASK = {
    id: "LST-9914",
    title: "Onboarded \"Roha Tower Penthouse\"",
    type: "listing",
    cost: "$0.012",
    duration: "2.38s",
    tokens: "3,240",
    autonomy: "assist",
    confidence: 0.94,
  };

  const tt = TASK_TYPES[TASK.type];
  const IconHead = Icon[tt.icon];

  return (
    <div className="row-2" style={{ minHeight: 0, gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="card" style={{ minHeight: 0 }}>
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.Brain size={13} /></span>
            Reasoning trace · <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--cb-ink-3)" }}>{TASK.id}</span>
          </div>
          <span className="chip is-success"><Icon.CheckCircle size={11} /> Auto-completed</span>
          <div className="card__head-right">
            <button className="btn is-sm is-ghost"><Icon.Copy size={11} /> Copy JSON</button>
            <button className="btn is-sm is-ghost"><Icon.Repeat size={11} /> Re-run</button>
          </div>
        </div>
        <div className="card__body" style={{ overflow: "auto" }}>
          {TRACE.map((s, i) => (
            <div key={i} className="thinking-step">
              <div className={"thinking-step__icon is-" + s.kind}>
                {s.kind === "think" && <Icon.Brain size={11} />}
                {s.kind === "tool"  && <Icon.Wand size={11} />}
                {s.kind === "data"  && <Icon.Database size={11} />}
                {s.kind === "out"   && <Icon.CheckCircle size={11} />}
              </div>
              <div>
                <div className="thinking-step__head">
                  <span className="lab">{s.label}</span>
                  <span>{s.title}</span>
                  <span className="t">{s.t}</span>
                </div>
                {s.body && <div className="thinking-step__body">{s.body}</div>}
                {s.code && (
                  <pre className="thinking-step__code">
                    {s.code.split(/(SELECT|FROM|WHERE|UPDATE|SET|INSERT INTO|VALUES|messages|vision\.classify)/g).map((part, j) => (
                      ["SELECT","FROM","WHERE","UPDATE","SET","INSERT INTO","VALUES"].includes(part)
                        ? <span key={j} className="k">{part}</span>
                        : part
                    ))}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="detail" style={{ minHeight: 0 }}>
        <div className="detail__head">
          <div className="detail__eyebrow">
            <IconHead size={11} /> {tt.label} · <span style={{ fontFamily: "var(--font-mono)" }}>{TASK.id}</span>
          </div>
          <div className="detail__title">{TASK.title}</div>
          <div className="detail__meta">
            <span className="chip is-success"><Icon.CheckCircle size={10} /> Auto-completed</span>
            <span className="chip is-cyan"><Icon.Sparkles size={10} /> {Math.round(TASK.confidence * 100)}% confidence</span>
            <span className="chip">autonomy: {TASK.autonomy}</span>
          </div>
        </div>
        <div className="detail__body">
          <div>
            <div className="detail__section-title"><Icon.Coins size={11} color="var(--cb-cyan)" /> Resource use</div>
            <div className="evidence">
              <div className="evidence__item"><div className="lab">Total cost</div><div className="val">{TASK.cost}</div></div>
              <div className="evidence__item"><div className="lab">Wall time</div><div className="val">{TASK.duration}</div></div>
              <div className="evidence__item"><div className="lab">Tokens</div><div className="val">{TASK.tokens}</div></div>
              <div className="evidence__item"><div className="lab">Model</div><div className="val">claude-haiku-4-5</div></div>
              <div className="evidence__item"><div className="lab">Tool calls</div><div className="val">5</div></div>
              <div className="evidence__item"><div className="lab">DB writes</div><div className="val">2</div></div>
            </div>
          </div>
          <div>
            <div className="detail__section-title"><Icon.Database size={11} color="var(--cb-cyan)" /> Entities touched</div>
            <div className="evidence" style={{ gridTemplateColumns: "1fr" }}>
              <div className="evidence__item"><div className="lab">properties</div><div className="val">id=9914 · 1 row read, 1 row written</div></div>
              <div className="evidence__item"><div className="lab">profiles</div><div className="val">id=@meron.t · 1 row read</div></div>
              <div className="evidence__item"><div className="lab">agent_actions</div><div className="val">1 row inserted</div></div>
              <div className="evidence__item"><div className="lab">R2 bucket</div><div className="val">cobrop-property-img · 12 keys read</div></div>
            </div>
          </div>
          <div>
            <div className="detail__section-title"><Icon.ListChecks size={11} color="var(--cb-cyan)" /> Downstream queue</div>
            <div className="evidence" style={{ gridTemplateColumns: "1fr" }}>
              <div className="evidence__item">
                <div className="lab">Next agent action</div>
                <div className="val" style={{ fontWeight: 500 }}>marketing.eligibility → if pass, draft 5 social posts for @meron.t approval</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PLAYBOOKS — rules per task type
// ════════════════════════════════════════════════════════════════

const PLAYBOOKS = [
  { type: "lead",      name: "Lead reply & qualify",        rule: "ON properties.inquiries.insert", autonomy: 3, success: 98.4, on: true },
  { type: "routing",   name: "Lead → broker routing",        rule: "ON inquiry.qualified AND broker.online", autonomy: 3, success: 96.1, on: true },
  { type: "listing",   name: "Listing onboarding",           rule: "ON properties.insert OR property.update(photos)", autonomy: 2, success: 92.0, on: true },
  { type: "translate", name: "Multilingual descriptions",    rule: "ON property.validated AND broker.tier ≥ Standard", autonomy: 3, success: 100, on: true },
  { type: "fraud",     name: "Duplicate / fraud detection",  rule: "ON property.insert ∨ property.update(images)", autonomy: 1, success: 96.4, on: true },
  { type: "price",     name: "Price recommendations",        rule: "ON property.daysOnMarket > 7 AND inquiries < 1", autonomy: 2, success: 81.0, on: true },
  { type: "outreach",  name: "Cold broker outreach",         rule: "DAILY at 09:00 local · score ≥ 80",     autonomy: 2, success: 31.4, on: true },
  { type: "nudge",     name: "Broker follow-up nudges",      rule: "ON lead.responseTime > 18h",            autonomy: 3, success: 38.0, on: true },
  { type: "marketing", name: "Social media auto-publish",    rule: "ON property.validated AND broker.consent = true", autonomy: 2, success: 78.6, on: true },
  { type: "fraud",     name: "Account takeover detection",   rule: "ON auth.signin (anomaly)",              autonomy: 1, success: 99.1, on: false },
];

function PlaybooksScreen() {
  return (
    <React.Fragment>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiTile kpi={{ key: "pb",  icon: "FileText", label: "Active playbooks", value: "9", unit: "/ 10", delta: "+1", dir: "up", sub: "1 paused this week" }} />
        <KpiTile kpi={{ key: "fire",icon: "Zap",      label: "Triggers · today", value: "2,732", unit: "", delta: "+18%", dir: "up", sub: "across 9 books" }} />
        <KpiTile kpi={{ key: "succ",icon: "CheckCircle", label: "Avg success rate", value: "84.6", unit: "%", delta: "+1.2pp", dir: "up", sub: "weighted by volume" }} />
        <KpiTile kpi={{ key: "rew", icon: "RotateCw", label: "Rework rate", value: "1.2", unit: "%", delta: "−0.4pp", dir: "down", goodDown: true, sub: "human-reverted actions" }} />
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.FileText size={13} /></span>
            Playbooks
          </div>
          <span className="card__sub">Each playbook listens for a trigger and runs a sequence of agent skills</span>
          <div className="card__head-right">
            <button className="btn is-sm is-ghost"><Icon.Filter size={11} /> Filter</button>
            <button className="btn is-sm is-cyan"><Icon.Plus size={11} /> New playbook</button>
          </div>
        </div>
        <div className="card__body is-flush">
          {/* Header row */}
          <div className="playbook" style={{ background: "var(--cb-bg)", color: "var(--cb-ink-3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", padding: "6px 14px" }}>
            <div></div>
            <div>Playbook · Trigger</div>
            <div>Autonomy</div>
            <div style={{ textAlign: "right" }}>Success</div>
            <div>Volume · 7d</div>
            <div>State</div>
          </div>
          {PLAYBOOKS.map((p, i) => {
            const tt = TT2[p.type];
            const IconC = Icon[tt.icon];
            const autonomyLabels = ["Off", "Approve", "Assist", "Auto-pilot"];
            const ring = {
              "t-lead": { bg: "#E5EEF3", color: "#1c5f7b" },
              "t-listing": { bg: "var(--cb-cyan-soft)", color: "#0a7e93" },
              "t-fraud": { bg: "var(--cb-error-soft)", color: "#b92444" },
              "t-price": { bg: "var(--cb-warn-soft)", color: "#b87a14" },
              "t-outreach": { bg: "var(--cb-success-soft)", color: "#0e8b58" },
              "t-marketing": { bg: "var(--cb-violet-soft)", color: "#5b3fc1" },
              "t-translate": { bg: "#EAF2F5", color: "#455D6A" },
              "t-nudge": { bg: "var(--cb-amber-soft)", color: "#b85a36" },
            }[tt.tone] || { bg: "var(--cb-bg)", color: "var(--cb-ink-2)" };
            const fakeVol = [4210, 3120, 287, 612, 12, 46, 318, 203, 84, 0][i];
            return (
              <div key={i} className="playbook">
                <div className="playbook__icon" style={{ background: ring.bg, color: ring.color }}>
                  <IconC size={14} />
                </div>
                <div>
                  <div className="playbook__name">{p.name}</div>
                  <div className="playbook__rule">{p.rule}</div>
                </div>
                <div className="playbook__autonomy">
                  <div className="playbook__autonomy-bar">
                    <span className={p.autonomy >= 1 ? "on" : ""}></span>
                    <span className={p.autonomy >= 2 ? "on" : ""}></span>
                    <span className={p.autonomy >= 3 ? "on is-strong" : ""}></span>
                  </div>
                  <div className="playbook__autonomy-text">{autonomyLabels[p.autonomy]}</div>
                </div>
                <div>
                  <div className="playbook__success">{p.success}%</div>
                  <div className="playbook__success-lab">Success</div>
                </div>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: "var(--cb-ink)" }}>
                  {fakeVol.toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div className={"playbook__toggle " + (p.on ? "is-on" : "")}></div>
                  <button className="btn is-sm is-ghost"><Icon.ChevronRight size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════════════════════════════════════════════════════
// TOOLS & DATA — access scopes, integrations
// ════════════════════════════════════════════════════════════════

const DB_SCOPES = [
  { icon: "Building", name: "properties",        sub: "supabase.properties",       purpose: "Read all · write title, description, agent_status, visibility, price_recommendation", perms: ["read","write"],          quota: "84,210", quotaSub: "rows accessible", on: true },
  { icon: "MessageCircle", name: "inquiries",    sub: "supabase.inquiries",        purpose: "Read all · auto-create on lead capture · route to broker",                              perms: ["read","write"],          quota: "12,840", quotaSub: "this week", on: true },
  { icon: "Users",    name: "profiles",          sub: "supabase.profiles",         purpose: "Read brokers · cannot modify auth, role, payment fields",                                perms: ["read"],                  quota: "3,217", quotaSub: "broker rows", on: true },
  { icon: "FileText", name: "agreements",        sub: "supabase.agreements",       purpose: "Read · draft proposals only · cannot sign or finalize",                                  perms: ["read","write"],          quota: "612", quotaSub: "drafts in pool", on: true },
  { icon: "DollarSign", name: "transactions",    sub: "supabase.transactions",     purpose: "Read · cannot create, refund, or modify payment intents",                                perms: ["read"],                  quota: "9,114", quotaSub: "rows", on: true },
  { icon: "Calendar", name: "visits",            sub: "supabase.visits",           purpose: "Read · create on broker behalf · cannot delete past visits",                              perms: ["read","write"],          quota: "1,840", quotaSub: "scheduled", on: true },
  { icon: "ShieldCheck", name: "agent_actions",  sub: "supabase.agent_actions",    purpose: "Append-only audit log (cannot UPDATE or DELETE)",                                       perms: ["write"],                 quota: "2.7M", quotaSub: "lifetime", on: true },
  { icon: "Image",    name: "R2 / cobrop-property-img", sub: "Cloudflare R2",      purpose: "Read all property photos · write thumbnails only (no original mutation)",                perms: ["read","write"],          quota: "612 GB", quotaSub: "scanned · 7d", on: true },
];

const API_SCOPES = [
  { icon: "Linkedin",     name: "LinkedIn API",       sub: "linkedin.com/v2",         purpose: "Post on company page · read company analytics · cannot DM",       perms: ["read","write"],         quota: "27 / 100", quotaSub: "posts · 24h cap", on: true },
  { icon: "Facebook",     name: "Meta Graph API",     sub: "graph.facebook.com",      purpose: "Post to Facebook page + IG business · ads (read-only)",            perms: ["read","write"],         quota: "31+24 / 50", quotaSub: "FB+IG · 24h", on: true },
  { icon: "TikTok",       name: "TikTok for Business",sub: "business-api.tiktok.com", purpose: "Upload reels · read analytics · ads spend (read)",                 perms: ["read","write"],         quota: "14 / 20", quotaSub: "uploads · 24h", on: true },
  { icon: "Twitter",      name: "X / Twitter API",    sub: "api.x.com/v2",            purpose: "Post tweets, threads · cannot follow / unfollow",                  perms: ["read","write"],         quota: "18 / 40", quotaSub: "tweets · 24h", on: true },
  { icon: "Telegram",     name: "Telegram Bot",       sub: "api.telegram.org",        purpose: "Post to channels · read broker DMs (consent required)",            perms: ["read","write"],         quota: "12", quotaSub: "channels reached", on: true },
  { icon: "WhatsApp",     name: "WhatsApp Business",  sub: "graph.whatsapp.com",      purpose: "Send approved templates only · cannot start convo without opt-in", perms: ["write"],                quota: "184 / 1k", quotaSub: "messages · 24h", on: true },
  { icon: "DollarSign",   name: "Chapa payments",     sub: "api.chapa.co",            purpose: "Read transaction status only · cannot initiate charges or refunds", perms: ["read"],                 quota: "9,114", quotaSub: "reads · 7d", on: true },
  { icon: "Cloud",        name: "Salesforce CRM",     sub: "salesforce.com/api/v55",  purpose: "Sync leads/contacts both ways · cannot delete records",            perms: ["read","write"],         quota: "612", quotaSub: "syncs · 7d", on: true },
  { icon: "Mail",         name: "Postmark email",     sub: "postmarkapp.com",         purpose: "Send templated emails only · cannot list contacts",                perms: ["write"],                quota: "1,840 / 5k", quotaSub: "sends · 24h", on: true },
];

function ScopeTable({ rows }) {
  return (
    <div className="scopes">
      {/* Header */}
      <div className="scope-row" style={{ background: "var(--cb-bg)", color: "var(--cb-ink-3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", padding: "6px 14px" }}>
        <div></div>
        <div>Resource</div>
        <div>Purpose</div>
        <div>Permissions</div>
        <div style={{ textAlign: "right" }}>Usage</div>
        <div></div>
        <div style={{ textAlign: "center" }}>Active</div>
      </div>
      {rows.map((r, i) => {
        const IconC = Icon[r.icon] || Icon.Database;
        const has = (p) => r.perms.includes(p);
        return (
          <div key={i} className="scope-row">
            <div className="scope-row__icon"><IconC size={14} /></div>
            <div>
              <div className="scope-row__name">{r.name}</div>
              <div className="scope-row__name-sub">{r.sub}</div>
            </div>
            <div className="scope-row__purpose">{r.purpose}</div>
            <div className="scope-perms">
              <span className={"perm-tag " + (has("read") ? "has-read" : "is-off")}><Icon.Eye size={9} /> READ</span>
              <span className={"perm-tag " + (has("write") ? "has-write" : "is-off")}><Icon.Edit size={9} /> WRITE</span>
              <span className={"perm-tag " + (has("admin") ? "has-admin" : "is-off")}><Icon.Crown size={9} /> ADMIN</span>
              <span className={"perm-tag " + (has("delete") ? "has-delete" : "is-off")}><Icon.XCircle size={9} /> DELETE</span>
            </div>
            <div>
              <div className="scope-row__usage">{r.quota}</div>
              <div className="scope-row__usage-sub">{r.quotaSub}</div>
            </div>
            <div></div>
            <div className="scope-row__status">
              <div className={"playbook__toggle " + (r.on ? "is-on" : "")}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToolsDataScreen() {
  return (
    <React.Fragment>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiTile kpi={{ key: "tables", icon: "Database", label: "Database tables",   value: "8", unit: "", delta: "of 14", dir: "flat", sub: "RLS-enforced · row level" }} />
        <KpiTile kpi={{ key: "apis",   icon: "Cloud",    label: "Connected APIs",    value: "9", unit: "", delta: "+2", dir: "up", sub: "social, CRM, payments" }} />
        <KpiTile kpi={{ key: "calls",  icon: "Zap",      label: "API calls · 24h",   value: "42.1", unit: "k", delta: "+8%", dir: "up", sub: "$11.40 cost" }} />
        <KpiTile kpi={{ key: "block",  icon: "Lock",     label: "Blocked actions",   value: "147", unit: "", delta: "−12", dir: "down", goodDown: true, sub: "guardrails enforced" }} />
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.Database size={13} /></span>
            Platform data access
          </div>
          <span className="card__sub">Postgres tables · enforced by Supabase RLS policies + agent role</span>
          <div className="card__head-right">
            <button className="btn is-sm is-ghost"><Icon.Key size={11} /> Rotate keys</button>
            <button className="btn is-sm is-ghost"><Icon.FileText size={11} /> Audit log</button>
          </div>
        </div>
        <div className="card__body is-flush">
          <ScopeTable rows={DB_SCOPES} />
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <div className="card__title">
            <span className="icon"><Icon.Cloud size={13} /></span>
            External integrations
          </div>
          <span className="card__sub">Each token scoped by least-privilege · daily caps apply</span>
          <div className="card__head-right">
            <button className="btn is-sm is-cyan"><Icon.Plus size={11} /> Connect new</button>
          </div>
        </div>
        <div className="card__body is-flush">
          <ScopeTable rows={API_SCOPES} />
        </div>
      </div>
    </React.Fragment>
  );
}

// ════════════════════════════════════════════════════════════════
// AGENT SETTINGS — identity, autonomy matrix, guardrails
// ════════════════════════════════════════════════════════════════

const GUARDRAILS = [
  { name: "Never delete user-generated content",      sub: "Soft-delete only · 30d retention before purge", on: true },
  { name: "Cannot modify authentication / roles",     sub: "auth.users, profiles.role read-only",            on: true },
  { name: "Cannot initiate or refund payments",       sub: "Read-only on transactions · escalate to admin", on: true },
  { name: "Cannot DM brokers without prior opt-in",   sub: "WhatsApp / Telegram require explicit consent",   on: true },
  { name: "Max social spend $50 / day without approval", sub: "Anything above escalates to admin queue",     on: true },
  { name: "Cannot publish on a broker's behalf without consent", sub: "Per-broker auto-publish toggle required", on: true },
  { name: "Re-identifies PII before logging traces",  sub: "Names, phones, emails redacted in audit log",    on: true },
  { name: "Pause everything if rework rate > 5%",     sub: "Tripwire active · auto-pauses agent for review", on: false },
];

function SettingsScreen() {
  const [matrix, setMatrix] = React.useState({
    lead: 3, routing: 3, listing: 2, translate: 3, fraud: 1, price: 2, outreach: 2, nudge: 3, marketing: 2,
  });
  const setLvl = (k, v) => setMatrix(m => ({ ...m, [k]: v }));

  const TASKS = [
    { type: "lead",      name: "Lead reply & qualify",        sub: "auto-replies, qualifies budget, suggests visit" },
    { type: "routing",   name: "Lead → broker routing",       sub: "load-balances by region, expertise, response time" },
    { type: "listing",   name: "Listing onboarding",          sub: "validates photos, GPS, price, generates copy" },
    { type: "translate", name: "Multilingual descriptions",   sub: "EN, AM, AR, SW, FR with back-translation gate" },
    { type: "fraud",     name: "Duplicate / fraud detection", sub: "image hash, GPS, watermark, identity checks" },
    { type: "price",     name: "Price recommendations",       sub: "comparables-based, suggests broker copy" },
    { type: "outreach",  name: "Cold broker outreach",        sub: "scrapes, scores, drafts in local language" },
    { type: "nudge",     name: "Broker follow-up nudges",     sub: "SLA monitoring, in-app and email" },
    { type: "marketing", name: "Social media publishing",     sub: "LinkedIn, FB, IG, TikTok, X, Telegram" },
  ];

  return (
    <React.Fragment>
      {/* Identity */}
      <div className="card">
        <div className="card__body">
          <div className="identity">
            <div className="identity__avatar">CB<span className="live"></span></div>
            <div>
              <div className="identity__name">CoBrop Operations Agent <span style={{ fontSize: 12, color: "var(--cb-ink-3)", fontWeight: 500, marginLeft: 6 }}>v3.4 · prod</span></div>
              <div className="identity__role">
                <span className="chip is-cyan"><Icon.Bot size={10} /> claude-haiku-4-5</span>
                <span className="chip"><Icon.Shield size={10} /> role: <b style={{ marginLeft: 3 }}>platform.agent</b></span>
                <span className="chip is-success"><span className="dot-mini"></span> Online · 99.94% uptime · 30d</span>
                <span className="chip"><Icon.MapPin size={10} /> tenants: 8 markets</span>
              </div>
              <div className="identity__meta">
                <span>Tasks today<b>2,732</b></span>
                <span>Auto-resolved<b>96.4%</b></span>
                <span>Cost today<b>$34.20</b></span>
                <span>Time saved · wk<b>312h</b></span>
                <span>Last deploy<b>2d ago</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row-2" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Autonomy matrix */}
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Sliders size={13} /></span>
              Autonomy by capability
            </div>
            <span className="card__sub">Three modes: Approve · Assist · Auto-pilot</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.RotateCw size={11} /> Reset</button>
            </div>
          </div>
          <div className="card__body is-flush">
            <div className="autonomy-matrix">
              {TASKS.map(t => {
                const tt = TT2[t.type];
                const IconC = Icon[tt.icon];
                return (
                  <div key={t.type} className="autonomy-matrix__row">
                    <div className={"queue__row-icon " + tt.tone}><IconC size={14} /></div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--cb-ink)" }}>{t.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--cb-ink-3)", marginTop: 1 }}>{t.sub}</div>
                    </div>
                    <div></div>
                    <div className="autonomy-segs">
                      <button className={matrix[t.type] === 1 ? "is-active lvl-1" : ""} onClick={() => setLvl(t.type, 1)}>Approve</button>
                      <button className={matrix[t.type] === 2 ? "is-active lvl-2" : ""} onClick={() => setLvl(t.type, 2)}>Assist</button>
                      <button className={matrix[t.type] === 3 ? "is-active lvl-3" : ""} onClick={() => setLvl(t.type, 3)}>Auto-pilot</button>
                    </div>
                    <div className="playbook__toggle is-on"></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card__foot">
            <Icon.HelpCircle size={11} color="var(--cb-cyan)" />
            <span>Changes apply on save · existing pending tasks unaffected</span>
            <button className="btn is-sm is-cyan" style={{ marginLeft: "auto" }}>Save changes</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Guardrails */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Shield size={13} /></span>
                Guardrails
              </div>
              <span className="card__sub">Hard limits on what the agent may do</span>
            </div>
            <div className="card__body is-flush">
              {GUARDRAILS.map((g, i) => (
                <div key={i} className="guardrail">
                  <div className="guardrail__icon">
                    {g.on ? <Icon.Lock size={14} color="var(--cb-success)" /> : <Icon.Unlock size={14} color="var(--cb-warn)" />}
                  </div>
                  <div>
                    <div className="guardrail__name">{g.name}</div>
                    <div className="guardrail__sub">{g.sub}</div>
                  </div>
                  <div className={"playbook__toggle " + (g.on ? "is-on" : "")}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Escalation routing */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.GitMerge size={13} /></span>
                Escalation routing
              </div>
              <span className="card__sub">Where agent sends approval requests</span>
            </div>
            <div className="card__body">
              {[
                { tier: "High risk (fraud · big spend)", who: "Platform admin (you)", channel: "In-app · email · SMS" },
                { tier: "Medium risk (price · outreach copy)", who: "Ops team — @selam.t, @dawit.a", channel: "In-app · Slack #cobrop-agent" },
                { tier: "Low risk (re-uploads · soft-rejects)", who: "Auto-approved if confidence > 90%", channel: "Audit log only" },
              ].map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 10, padding: "8px 0", borderBottom: i === 2 ? 0 : "1px solid var(--cb-line)", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--cb-ink)" }}>{e.tier}</div>
                  <div style={{ color: "var(--cb-ink-2)" }}>{e.who}</div>
                  <div style={{ color: "var(--cb-ink-3)", fontSize: 11 }}>{e.channel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

window.MarketingScreen = MarketingScreen;
window.RiskScreen = RiskScreen;
window.TaskTraceScreen = TaskTraceScreen;
window.PlaybooksScreen = PlaybooksScreen;
window.ToolsDataScreen = ToolsDataScreen;
window.SettingsScreen = SettingsScreen;

// ════════════════════════════════════════════════════════════════
// BLOG & CONTENT — agent manages blog: learns past posts,
// picks topics that match brand voice, schedules consistently
// ════════════════════════════════════════════════════════════════

const PAST_POSTS = [
  { tone: 1, title: "How brokers in Addis split fees with Nairobi (legally)", cat: "Co-brokerage", reads: "8.4k", time: "6m 12s", shares: 184, leads: 23, date: "Mar 18", tag: "top performer", trend: "up" },
  { tone: 2, title: "10 photos every CoBrop listing needs — with examples",   cat: "Listing best-practice", reads: "12.1k", time: "8m 02s", shares: 412, leads: 41, date: "Mar 11", tag: "top performer", trend: "up" },
  { tone: 3, title: "What 30,000 East African inquiries taught us about pricing", cat: "Market data", reads: "6.2k", time: "9m 30s", shares: 144, leads: 18, date: "Mar 04", tag: "evergreen", trend: "flat" },
  { tone: 4, title: "The 2026 East Africa real estate outlook (mid-quarter)",   cat: "Market data", reads: "4.8k", time: "11m 04s", shares: 92, leads: 12, date: "Feb 25", tag: "evergreen", trend: "flat" },
  { tone: 5, title: "Why I left agency life: a Dubai broker's take",            cat: "Founder voice", reads: "2.1k", time: "5m 50s", shares: 38, leads: 4, date: "Feb 18", tag: "low performer", trend: "down" },
  { tone: 1, title: "Cross-border KYC for African real estate: a 2026 guide",   cat: "Compliance", reads: "3.4k", time: "12m 12s", shares: 61, leads: 7, date: "Feb 11", tag: "evergreen", trend: "flat" },
];

const TOPIC_PERF = [
  { name: "Co-brokerage explainers",   score: 92, posts: 6, leads: 124, low: false },
  { name: "Listing best-practice",     score: 88, posts: 8, leads: 96,  low: false },
  { name: "Market data & outlook",     score: 76, posts: 5, leads: 47,  low: false },
  { name: "Broker case studies",       score: 71, posts: 4, leads: 38,  low: false },
  { name: "Compliance & legal",        score: 58, posts: 3, leads: 14,  low: false },
  { name: "Founder voice / opinion",   score: 34, posts: 4, leads: 8,   low: true },
  { name: "Generic real-estate tips",  score: 22, posts: 6, leads: 4,   low: true },
];

const SUGGESTED_TOPICS = [
  {
    title: "Why Kigali ↔ Addis is becoming the East African real estate corridor",
    why: 'Pattern: <b>Co-brokerage explainers</b> + <b>regional case studies</b> drive 3.4× more leads than average. Past post on Addis↔Nairobi hit 8.4k reads. Rwanda traffic on CoBrop +180% since Feb — content gap detected.',
    cat: "Co-brokerage",
    predReads: "9–11k",
    predLeads: "22–28",
    risk: "low",
  },
  {
    title: "10 photos every CoBrop listing needs — the 2026 edition",
    why: 'Refresh of top-performing post (<b>12.1k reads · 41 leads</b>). Engagement now decaying month-over-month (−18%). Annual refresh is a proven pattern: <b>+62% reads</b> on first re-issue.',
    cat: "Listing best-practice",
    predReads: "10–14k",
    predLeads: "35–48",
    risk: "low",
  },
  {
    title: "What 12,000 Dubai → East Africa inquiries told us about pricing",
    why: 'Pairs <b>Market data</b> (76 score) with <b>Co-brokerage</b> (92 score). Dubai cohort grew +112% in Q1. No existing post covers this angle.',
    cat: "Market data",
    predReads: "5–7k",
    predLeads: "12–18",
    risk: "med",
  },
];

function BlogScreen() {
  const engine = window.useAgentEngine && window.useAgentEngine();
  return (
    <React.Fragment>
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <KpiTile kpi={{ key: "posts", icon: "BookOpen", label: "Posts · 30d",       value: "18",   unit: "",  delta: "+6",   dir: "up", sub: "6 by agent, 12 reviewed" }} />
        <KpiTile kpi={{ key: "reads", icon: "Eye",      label: "Reads · 30d",       value: "47.2", unit: "k", delta: "+34%", dir: "up", sub: "avg 7m 18s read time" }} />
        <KpiTile kpi={{ key: "shares",icon: "Share2",   label: "Shares · 30d",      value: "1,140",unit: "",  delta: "+212", dir: "up", sub: "LinkedIn +84%" }} />
        <KpiTile kpi={{ key: "leads", icon: "Users",    label: "Leads attributed",  value: "144",  unit: "",  delta: "+41",  dir: "up", sub: "blog → broker signup" }} />
        <KpiTile kpi={{ key: "consis",icon: "Type",     label: "Brand consistency", value: "94",   unit: "%", delta: "+2pp", dir: "up", sub: "tone · structure · length" }} />
      </div>

      {/* Topic intelligence + suggested next */}
      <div className="row-2">
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Brain size={13} /></span>
              Topic intelligence
            </div>
            <span className="card__sub">What works · what doesn't · based on 24 posts</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.RotateCw size={11} /> Re-analyze</button>
            </div>
          </div>
          <div className="card__body">
            <div className="topics">
              {/* Header */}
              <div className="topic-row" style={{ fontSize: 10, fontWeight: 700, color: "var(--cb-ink-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                <div>Topic</div>
                <div>Engagement · posts · leads</div>
                <div style={{ textAlign: "right" }}>Score</div>
              </div>
              {TOPIC_PERF.map(t => (
                <div key={t.name} className="topic-row">
                  <div>
                    <div className="topic-row__name">{t.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--cb-ink-3)", marginTop: 1 }}>
                      {t.posts} posts · {t.leads} leads
                    </div>
                  </div>
                  <div className={"topic-row__bar" + (t.low ? " is-low" : "")}>
                    <div style={{ width: t.score + "%" }}></div>
                  </div>
                  <div className="topic-row__score" style={{ color: t.low ? "var(--cb-error)" : "var(--cb-ink)" }}>{t.score}</div>
                </div>
              ))}
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12,
              borderTop: "1px solid var(--cb-line)", paddingTop: 12
            }}>
              <div className="evidence__item" style={{ background: "var(--cb-success-soft)", border: "1px solid #BFE6D2" }}>
                <div className="lab" style={{ color: "#0e8b58" }}>What's working</div>
                <div className="val" style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: "#0a3d48" }}>
                  Posts pairing <b>regional data</b> with <b>concrete broker stories</b> outperform by 3.4×. Long-form (8–12 min) beats short (sub-5min) on lead conversion.
                </div>
              </div>
              <div className="evidence__item" style={{ background: "var(--cb-error-soft)", border: "1px solid #F2C2CC" }}>
                <div className="lab" style={{ color: "#b92444" }}>What to stop</div>
                <div className="val" style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: "#8c1b35" }}>
                  Generic tips & first-person founder voice underperform. Cut from rotation. Recover ~6 hrs/wk of agent time.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.Lightbulb size={13} /></span>
              Suggested next posts
            </div>
            <span className="chip is-cyan">3 drafts ready</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.RotateCw size={11} /> More</button>
            </div>
          </div>
          <div className="card__body" style={{ gap: 10 }}>
            {SUGGESTED_TOPICS.map((s, i) => (
              <div key={i} className="suggest-topic">
                <div className="suggest-topic__title">{s.title}</div>
                <div className="suggest-topic__why" dangerouslySetInnerHTML={{ __html: s.why }}></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="chip is-blue">{s.cat}</span>
                  <span className="chip"><Icon.Eye size={10} /> {s.predReads} pred. reads</span>
                  <span className="chip is-success"><Icon.Users size={10} /> {s.predLeads} pred. leads</span>
                  <span className={"risktag is-" + s.risk}>{s.risk} risk</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn is-sm is-cyan"
                    disabled={engine?.agentThinking}
                    onClick={() => engine && engine.draftBlogPost({ title: s.title, category: s.cat })}
                  >
                    <Icon.FileText size={11} /> {engine?.agentThinking ? "Drafting…" : "Draft full post"}
                  </button>
                  <button className="btn is-sm"><Icon.Pencil size={11} /> Edit angle</button>
                  <button className="btn is-sm is-ghost" style={{ marginLeft: "auto" }}><Icon.XCircle size={11} /> Skip</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent posts + style consistency */}
      <div className="row-2" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="card">
          <div className="card__head">
            <div className="card__title">
              <span className="icon"><Icon.BookOpen size={13} /></span>
              Recent posts
            </div>
            <span className="chip is-success">5 published</span>
            <span className="chip is-warn">1 awaiting review</span>
            <div className="card__head-right">
              <button className="btn is-sm is-ghost"><Icon.Filter size={11} /> All categories</button>
              <button className="btn is-sm is-cyan"><Icon.Plus size={11} /> Draft new</button>
            </div>
          </div>
          <div className="card__body is-flush">
            {/* Header */}
            <div className="blog-post" style={{ background: "var(--cb-bg)", color: "var(--cb-ink-3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", padding: "6px 14px" }}>
              <div></div>
              <div>Post · Category · Date</div>
              <div style={{ textAlign: "right" }}>Reads</div>
              <div style={{ textAlign: "right" }}>Read time</div>
              <div style={{ textAlign: "right" }}>Leads</div>
              <div></div>
            </div>
            {PAST_POSTS.map((p, i) => {
              const TrendIcon = p.trend === "up" ? Icon.TrendingUp : p.trend === "down" ? Icon.TrendingDown : Icon.ArrowRight;
              const trendColor = p.trend === "up" ? "var(--cb-success)" : p.trend === "down" ? "var(--cb-error)" : "var(--cb-ink-3)";
              const openPost = () => engine && engine.generateAndPreview({
                title: p.title,
                eyebrow: p.cat,
                kind: "blog",
                prompt: `You are CoBrop's blog writer. CoBrop is a real-estate co-brokerage platform. Brand voice: confident, educational, empowering. NO emoji, NO clichés.

Reconstruct a plausible 4-paragraph excerpt of this previously-published post (it was viewed ${p.reads} times, avg read time ${p.time}).

TITLE: "${p.title}"
CATEGORY: ${p.cat}

Output ONLY the post body. Invent realistic East African real-estate stats if needed.`,
              });
              return (
                <div key={i} className="blog-post" style={{ cursor: "pointer" }} onClick={openPost}>
                  <div className={"blog-post__thumb tone-" + p.tone}>{p.cat.split(" ")[0]}</div>
                  <div>
                    <div className="blog-post__title">{p.title}</div>
                    <div className="blog-post__meta">
                      <span className="chip is-blue" style={{ padding: "1px 6px", fontSize: 10 }}>{p.cat}</span>
                      <span>{p.date}</span>
                      <span className="sep" style={{ color: "var(--cb-line-strong)" }}>·</span>
                      {p.tag === "top performer" && <span className="chip is-success" style={{ padding: "1px 6px", fontSize: 10 }}><Icon.Star size={9} /> Top performer</span>}
                      {p.tag === "evergreen"     && <span className="chip is-cyan"   style={{ padding: "1px 6px", fontSize: 10 }}>Evergreen</span>}
                      {p.tag === "low performer" && <span className="chip is-error"  style={{ padding: "1px 6px", fontSize: 10 }}>Low · cut from rotation</span>}
                    </div>
                  </div>
                  <div>
                    <div className="blog-post__metric" style={{ color: trendColor, display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                      <TrendIcon size={10} color={trendColor} />
                      {p.reads}
                    </div>
                    <div className="blog-post__metric-lab">Reads</div>
                  </div>
                  <div>
                    <div className="blog-post__metric">{p.time}</div>
                    <div className="blog-post__metric-lab">Avg</div>
                  </div>
                  <div>
                    <div className="blog-post__metric" style={{ color: p.leads >= 18 ? "var(--cb-cyan)" : "var(--cb-ink)" }}>{p.leads}</div>
                    <div className="blog-post__metric-lab">Leads</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="btn is-sm is-cyan" onClick={openPost}><Icon.Eye size={11} /></button>
                    <button className="btn is-sm is-ghost" onClick={() => engine?.pushToast({ kind: "info", msg: "Post editor would open here" })}><Icon.Edit size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Brand consistency */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Type size={13} /></span>
                Brand consistency · style check
              </div>
              <span className="card__sub">vs. last 24 posts as ground truth</span>
            </div>
            <div className="card__body">
              <div className="style-grid">
                <div className="style-item">
                  <div className="style-item__head"><span>Tone match</span><b>96%</b></div>
                  <div className="style-item__bar is-success"><div style={{ width: "96%" }}></div></div>
                  <div className="style-item__sub">Confident · educational · empowering. Action verbs lead 78% of paragraphs (target 70%+).</div>
                </div>
                <div className="style-item">
                  <div className="style-item__head"><span>Length</span><b>2,140w</b></div>
                  <div className="style-item__bar"><div style={{ width: "92%" }}></div></div>
                  <div className="style-item__sub">8.5 min read · matches winning band (8–12 min).</div>
                </div>
                <div className="style-item">
                  <div className="style-item__head"><span>Structure</span><b>OK</b></div>
                  <div className="style-item__bar is-success"><div style={{ width: "100%" }}></div></div>
                  <div className="style-item__sub">H2 → 4 sections · stat hook · 2 broker quotes · CTA. Follows winning template.</div>
                </div>
                <div className="style-item">
                  <div className="style-item__head"><span>Data hooks</span><b>3</b></div>
                  <div className="style-item__bar"><div style={{ width: "75%" }}></div></div>
                  <div className="style-item__sub">3 stats cited (target ≥ 2). Avg top post: 4.1.</div>
                </div>
                <div className="style-item">
                  <div className="style-item__head"><span>CTA placement</span><b>2 / 2</b></div>
                  <div className="style-item__bar is-success"><div style={{ width: "100%" }}></div></div>
                  <div className="style-item__sub">Mid + end CTAs · winning pattern from top 5 posts.</div>
                </div>
                <div className="style-item">
                  <div className="style-item__head"><span>Emoji / fluff</span><b>0</b></div>
                  <div className="style-item__bar is-success"><div style={{ width: "100%" }}></div></div>
                  <div className="style-item__sub">No emoji, no clichés. Brand voice rule honored.</div>
                </div>
              </div>
            </div>
            <div className="card__foot">
              <Icon.CheckCircle size={11} color="var(--cb-success)" />
              <span><b style={{ color: "var(--cb-ink)" }}>94% consistency</b> across last 30d · publishable without human review</span>
            </div>
          </div>

          {/* Content calendar (compact) */}
          <div className="card">
            <div className="card__head">
              <div className="card__title">
                <span className="icon"><Icon.Calendar size={13} /></span>
                Editorial calendar · next 4 weeks
              </div>
              <span className="card__sub">1 post / week target</span>
            </div>
            <div className="card__body is-flush">
              {[
                { wk: "Wk 14", date: "Apr 01", title: "Why Kigali ↔ Addis is the new corridor",     cat: "Co-brokerage", state: "drafted" },
                { wk: "Wk 15", date: "Apr 08", title: "10 photos every listing needs · 2026 edition", cat: "Best-practice", state: "drafted" },
                { wk: "Wk 16", date: "Apr 15", title: "12k Dubai inquiries → pricing patterns",       cat: "Market data", state: "outlined" },
                { wk: "Wk 17", date: "Apr 22", title: "TBD · gap detection running",                  cat: "—", state: "open" },
              ].map((c, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "9px 14px",
                  borderBottom: i === 3 ? 0 : "1px solid var(--cb-line)",
                  fontSize: 12
                }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 13, color: "var(--cb-ink)" }}>{c.wk}</div>
                    <div style={{ fontSize: 10.5, color: "var(--cb-ink-3)" }}>{c.date}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: c.state === "open" ? "var(--cb-ink-3)" : "var(--cb-ink)" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--cb-ink-3)", marginTop: 1 }}>{c.cat}</div>
                  </div>
                  <div>
                    {c.state === "drafted" && <span className="chip is-cyan"><Icon.FileText size={10} /> Drafted</span>}
                    {c.state === "outlined" && <span className="chip is-warn"><Icon.Pencil size={10} /> Outlined</span>}
                    {c.state === "open" && <span className="chip"><Icon.Plus size={10} /> Open slot</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

window.BlogScreen = BlogScreen;
