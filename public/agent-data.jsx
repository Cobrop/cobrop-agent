// agent-data.jsx — Mock data for CoBrop Agent console

const TASK_TYPES = {
  lead:      { label: "Lead reply",      icon: "MessageCircle", tone: "t-lead",      ring: "is-blue" },
  routing:   { label: "Lead routing",    icon: "GitMerge",      tone: "t-lead",      ring: "is-blue" },
  listing:   { label: "Listing onboard", icon: "Building",      tone: "t-listing",   ring: "is-cyan" },
  translate: { label: "Translation",     icon: "Languages",     tone: "t-translate", ring: "is-ghost" },
  describe:  { label: "Description",     icon: "FileText",      tone: "t-listing",   ring: "is-cyan" },
  fraud:     { label: "Fraud / dup",     icon: "ShieldCheck",   tone: "t-fraud",     ring: "is-error" },
  price:     { label: "Pricing",         icon: "DollarSign",    tone: "t-price",     ring: "is-warn" },
  outreach:  { label: "Broker outreach", icon: "Users",         tone: "t-outreach",  ring: "is-success" },
  marketing: { label: "Marketing post",  icon: "Megaphone",     tone: "t-marketing", ring: "is-violet" },
  nudge:     { label: "Follow-up nudge", icon: "Send",          tone: "t-nudge",     ring: "is-amber" },
};

// Activity feed (newest first). `seedMin` = minutes ago at page load.
const ACTIVITY_SEED = [
  { type: "outreach",  seedMin: 0,  title: "Sent intro to Faisal Hassan (Nairobi)", meta: "47 listings · PropZone scrape · score 92", action: "auto", ref: "OUT-3187" },
  { type: "listing",   seedMin: 1,  title: "Onboarded \"Roha Tower Penthouse\"", meta: "12 photos · 3 languages · @meron.t", action: "auto", ref: "LST-9914" },
  { type: "fraud",     seedMin: 3,  title: "Duplicate flagged: CMC Villa ↔ existing @teklu listing", meta: "96% match · same 4 photos · 0.04km apart", action: "pending", ref: "RSK-0421" },
  { type: "marketing", seedMin: 5,  title: "Published carousel to LinkedIn · 4 platforms", meta: "Bole Penthouse · 14 impressions/min", action: "auto", ref: "MKT-7720" },
  { type: "lead",      seedMin: 7,  title: "Replied & qualified inquiry on Sarbet 3BR Apt", meta: "Budget verified · routed to @hewan.s", action: "auto", ref: "LD-12056" },
  { type: "price",     seedMin: 12, title: "Recommended −7% on Kazanchis 2BR", meta: "14d on market · 0 inquiries · 11% above comps", action: "pending", ref: "PR-2241" },
  { type: "outreach",  seedMin: 16, title: "Drafted Arabic outreach to 24 Dubai brokers", meta: "Bayut alumni · avg 80 listings · score ≥ 85", action: "pending", ref: "OUT-3180" },
  { type: "translate", seedMin: 19, title: "Translated 6 listings → AM, AR, FR", meta: "All variants reviewed by quality gate", action: "auto", ref: "TR-5577" },
  { type: "nudge",     seedMin: 24, title: "Nudged @teklu: 3 leads waiting >24h", meta: "SLA breach probable in 6h", action: "auto", ref: "NU-1183" },
  { type: "listing",   seedMin: 27, title: "Validated \"Bole Embassy Row Villa\"", meta: "Photos OK · price within range · GPS verified", action: "auto", ref: "LST-9913" },
  { type: "lead",      seedMin: 31, title: "Auto-replied to inquiry on Lebu Compound", meta: "Sent EN + AM versions · scheduled visit Thu 4pm", action: "auto", ref: "LD-12048" },
  { type: "fraud",     seedMin: 35, title: "Photo reverse-search hit on Megenagna listing", meta: "Stock image detected · halted publish", action: "blocked", ref: "RSK-0420" },
];

// Approvals (live queue with countdown timers; `slaMs` is total SLA window, `elapsedMs` how much already used)
const APPROVALS = [
  {
    id: "RSK-0421",
    type: "fraud",
    what: "Confirm duplicate listing & take down CMC Villa",
    who: "Listing by @yonas.a (Free tier · 2 prior strikes)",
    risk: "high",
    slaMs: 60 * 60 * 1000,
    elapsedMs: 47 * 60 * 1000,
    confidence: 0.96,
    proposal: "Mark CMC Villa duplicate of @teklu's listing #LST-9844. Notify both brokers, escalate @yonas.a to manual review queue.",
    trace: [
      { state: "done",    title: "Detected image hash collision (4/4 photos match)", t: "08:14:02" },
      { state: "done",    title: "Geo-distance check: 0.04km from #LST-9844", t: "08:14:04" },
      { state: "done",    title: "Listed before: #LST-9844 created 47d earlier", t: "08:14:05" },
      { state: "current", title: "Awaiting admin confirmation to take down", t: "08:14:06" },
    ],
    evidence: [
      { label: "Image match", value: "96.4%" },
      { label: "Same broker?", value: "No · different accounts" },
      { label: "Prior strikes", value: "2 (90d)" },
      { label: "Recommendation", value: "Take down + warn" },
    ],
  },
  {
    id: "PR-2241",
    type: "price",
    what: "Suggest −7% price drop on Kazanchis 2BR",
    who: "Listing by @hewan.s · 14 days on market",
    risk: "med",
    slaMs: 4 * 60 * 60 * 1000,
    elapsedMs: 1.8 * 60 * 60 * 1000,
    confidence: 0.81,
    proposal: "Current ETB 9.5M is 11% above 30d comparables. Suggest ETB 8.83M (−7%) with broker copy: \"Re-priced for serious buyers\". 84% chance of 3+ inquiries within 7d.",
    trace: [
      { state: "done",    title: "Pulled 18 comparable listings (Kazanchis 2BR, 90–110m²)", t: "−1h 48m" },
      { state: "done",    title: "Computed median ETB 8.55M · IQR ETB 8.1–9.0M", t: "−1h 47m" },
      { state: "done",    title: "Built broker-tone copy variant (3 options)", t: "−1h 45m" },
      { state: "current", title: "Waiting admin approval to recommend to @hewan.s", t: "−1h 44m" },
    ],
    evidence: [
      { label: "Comps median", value: "ETB 8.55M" },
      { label: "Above comps", value: "+11%" },
      { label: "Inquiries (14d)", value: "0" },
      { label: "Views (14d)", value: "412" },
    ],
  },
  {
    id: "OUT-3180",
    type: "outreach",
    what: "Send Arabic outreach to 24 Dubai brokers",
    who: "Bayut-sourced cohort · ≥80 listings · cyan-flag score ≥ 85",
    risk: "med",
    slaMs: 8 * 60 * 60 * 1000,
    elapsedMs: 2.4 * 60 * 60 * 1000,
    confidence: 0.88,
    proposal: "Send Arabic intro v3 to 24 brokers (no prior contact). Each receives custom calc of how many of their listings would qualify for the cross-border board. Reply rate ~28% historical.",
    trace: [
      { state: "done",    title: "Scraped Bayut directory · 412 candidates", t: "−2h 26m" },
      { state: "done",    title: "Filtered by activity, listings, response signals → 24", t: "−2h 24m" },
      { state: "done",    title: "Generated Arabic copy in CoBrop voice · 3 variants A/B/C", t: "−2h 22m" },
      { state: "current", title: "Awaiting batch approval", t: "−2h 20m" },
    ],
    evidence: [
      { label: "Cohort size", value: "24 brokers" },
      { label: "Avg listings", value: "112" },
      { label: "Cost", value: "$0.08 each" },
      { label: "Expected joins", value: "5–7" },
    ],
  },
  {
    id: "MKT-7724",
    type: "marketing",
    what: "Launch Q2 LinkedIn campaign · \"Why East African brokers are joining CoBrop\"",
    who: "Reach target: 220k · spend ceiling $1,200 over 14d",
    risk: "high",
    slaMs: 24 * 60 * 60 * 1000,
    elapsedMs: 10 * 60 * 60 * 1000,
    confidence: 0.74,
    proposal: "5-post carousel series, geo-targeted (ET, KE, RW, UG, TZ). Predicted 880 broker profile visits, 90 sign-ups based on Q1 priors. Spend $1,200 ceiling.",
    trace: [
      { state: "done", title: "Drafted 5 posts in EN + AM + SW", t: "−10h" },
      { state: "done", title: "Audience match: 220k LinkedIn members", t: "−9h" },
      { state: "current", title: "Pending admin sign-off on budget", t: "−9h" },
    ],
    evidence: [
      { label: "Budget", value: "$1,200 / 14d" },
      { label: "Reach", value: "220k" },
      { label: "Expected sign-ups", value: "~90" },
      { label: "Cost / sign-up", value: "~$13.30" },
    ],
  },
  {
    id: "LST-9921",
    type: "listing",
    what: "Reject listing photos · request re-upload (Sarbet Studio)",
    who: "Listing by @bekele.m · 1st-time broker",
    risk: "low",
    slaMs: 12 * 60 * 60 * 1000,
    elapsedMs: 2.5 * 60 * 60 * 1000,
    confidence: 0.93,
    proposal: "3 of 5 photos contain watermarks from a 3rd-party portal. Auto-message @bekele.m with re-upload checklist + sample shots from their best listing.",
    trace: [
      { state: "done", title: "Watermark detection on 3 photos", t: "−2h 31m" },
      { state: "done", title: "Cross-checked: photos from CompetitorX (legal risk)", t: "−2h 30m" },
      { state: "current", title: "Awaiting confirmation to soft-reject", t: "−2h 28m" },
    ],
    evidence: [
      { label: "Photos flagged", value: "3 / 5" },
      { label: "Broker tenure", value: "12 days" },
      { label: "Prior issues", value: "0" },
      { label: "Tone", value: "Coaching, friendly" },
    ],
  },
  {
    id: "OUT-3194",
    type: "outreach",
    what: "WhatsApp follow-up to Kigali broker · Mukamuhirwa Chantal",
    who: "Read first email 3d ago · no reply",
    risk: "low",
    slaMs: 24 * 60 * 60 * 1000,
    elapsedMs: 18 * 60 * 60 * 1000,
    confidence: 0.79,
    proposal: "Send Kinyarwanda WhatsApp follow-up at 09:30 local. \"Saw you're listing Nyarutarama villas — here's a 2-min walkthrough of how Addis brokers split fees with Kigali.\"",
    trace: [
      { state: "done", title: "Detected email open Mar 16 · no reply", t: "−3d" },
      { state: "done", title: "Drafted Kinyarwanda short-form message", t: "−18h" },
      { state: "current", title: "Awaiting send approval", t: "−17h" },
    ],
    evidence: [
      { label: "Channel", value: "WhatsApp" },
      { label: "Local time", value: "09:30 CAT" },
      { label: "Open count", value: "3" },
      { label: "Reply odds", value: "31%" },
    ],
  },
];

// Capabilities health strip
const CAPABILITIES = [
  { key: "leads",     name: "Lead reply & routing",   icon: "MessageCircle", ring: "t-lead",     today: "1,124", subtext: "auto-handled", health: "ok" },
  { key: "listings",  name: "Listing onboarding",     icon: "Building",      ring: "t-listing",  today: "287",   subtext: "validated", health: "ok" },
  { key: "fraud",     name: "Fraud & duplicates",     icon: "ShieldCheck",   ring: "t-fraud",    today: "12",    subtext: "flagged · 9 confirmed", health: "warn" },
  { key: "price",     name: "Price recommendations",  icon: "DollarSign",    ring: "t-price",    today: "46",    subtext: "suggested · $4.2M repriced", health: "ok" },
  { key: "outreach",  name: "Broker outreach",        icon: "Users",         ring: "t-outreach", today: "318",   subtext: "sent · 71 replied", health: "ok" },
  { key: "marketing", name: "Marketing & social",     icon: "Megaphone",     ring: "t-marketing",today: "84",    subtext: "posts published", health: "ok" },
  { key: "translate", name: "Description & translate",icon: "Languages",     ring: "t-translate",today: "612",   subtext: "translations served", health: "ok" },
  { key: "nudge",     name: "Follow-up nudges",       icon: "Send",          ring: "t-nudge",    today: "203",   subtext: "delivered · 38% acted", health: "ok" },
];

// Task mix breakdown (today)
const TASK_MIX = [
  { type: "lead",      count: 1124, pct: 38, autoPct: 99.1 },
  { type: "translate", count: 612,  pct: 21, autoPct: 100  },
  { type: "outreach",  count: 318,  pct: 11, autoPct: 87.4 },
  { type: "listing",   count: 287,  pct: 10, autoPct: 92.0 },
  { type: "nudge",     count: 203,  pct: 7,  autoPct: 100  },
  { type: "marketing", count: 84,   pct: 3,  autoPct: 78.6 },
  { type: "price",     count: 46,   pct: 2,  autoPct: 61.0 },
  { type: "fraud",     count: 12,   pct: 1,  autoPct: 25.0 },
];

// Regional outreach pipeline
const REGIONS = [
  { code: "ET", flag: "🇪🇹", name: "Ethiopia",     sub: "Addis Ababa · Hawassa · Bahir Dar", sourced: 2840, contacted: 1612, responded: 488, onboarded: 167, listed: 142, active: true },
  { code: "KE", flag: "🇰🇪", name: "Kenya",        sub: "Nairobi · Mombasa · Kisumu",        sourced: 1920, contacted: 1108, responded: 312, onboarded: 94,  listed: 81,  active: true },
  { code: "AE", flag: "🇦🇪", name: "UAE",          sub: "Dubai · Abu Dhabi · Sharjah",       sourced: 1612, contacted: 870,  responded: 268, onboarded: 78,  listed: 71,  active: true },
  { code: "RW", flag: "🇷🇼", name: "Rwanda",       sub: "Kigali · Musanze",                   sourced: 612,  contacted: 380,  responded: 122, onboarded: 41,  listed: 33,  active: true },
  { code: "ZA", flag: "🇿🇦", name: "South Africa", sub: "Cape Town · Johannesburg · Durban", sourced: 1240, contacted: 612,  responded: 184, onboarded: 52,  listed: 44,  active: true },
  { code: "QA", flag: "🇶🇦", name: "Qatar",        sub: "Doha · Lusail",                      sourced: 488,  contacted: 247,  responded: 76,  onboarded: 22,  listed: 19,  active: true },
  { code: "TZ", flag: "🇹🇿", name: "Tanzania",     sub: "Dar es Salaam · Arusha · Zanzibar", sourced: 720,  contacted: 410,  responded: 130, onboarded: 38,  listed: 31,  active: true },
  { code: "UG", flag: "🇺🇬", name: "Uganda",       sub: "Kampala · Entebbe",                  sourced: 514,  contacted: 286,  responded: 92,  onboarded: 28,  listed: 22,  active: true },
];

// Suggested outreach cards (agent-drafted, pending or auto-sent)
const SUGGESTED_BROKERS = [
  {
    id: "OUT-3201",
    name: "Faisal Hassan",
    initials: "FH",
    location: "Nairobi, Kenya",
    sourcedFrom: "PropZone",
    tenure: "4 yrs · 47 active listings",
    score: 92,
    preview: "Habari Faisal, your Karen Estate listings caught our attention. 14 Addis brokers actively look for Nairobi inventory — would you split a referral fee on a 6-month trial? Setup is 7 min.",
    tags: ["English", "Karen / Lavington focus", "High-end"],
    risk: "low",
    status: "auto-sent",
  },
  {
    id: "OUT-3199",
    name: "Layla Al-Rashid",
    initials: "LR",
    location: "Dubai, UAE",
    sourcedFrom: "Bayut alumni",
    tenure: "6 yrs · 112 active · DLD verified",
    score: 88,
    preview: "السلام عليكم Layla — your Dubai Marina inventory aligns with 36 active East-African buyer searches on CoBrop this week. 5-min onboarding, cross-border KYC handled by our team.",
    tags: ["Arabic", "Marina · JBR", "Verified"],
    risk: "med",
    status: "pending",
  },
  {
    id: "OUT-3196",
    name: "Mukamuhirwa Chantal",
    initials: "MC",
    location: "Kigali, Rwanda",
    sourcedFrom: "Direct referral",
    tenure: "2 yrs · 28 listings",
    score: 84,
    preview: "Muraho Chantal — Faisal in Nairobi joined CoBrop last month and already split fees on 2 deals. Your Nyarutarama villas match a search we're seeing daily from Addis. 10 min to onboard.",
    tags: ["Kinyarwanda", "Nyarutarama", "Referral"],
    risk: "low",
    status: "auto-sent",
  },
];

// Top KPI snapshots
const KPIS = [
  { key: "tasks",     label: "Tasks today",     icon: "Activity",      value: "2,732", unit: "", delta: "+18.4%", dir: "up",   sub: "vs. yesterday" },
  { key: "auto",      label: "Auto-resolved",   icon: "Zap",           value: "96.4",  unit: "%", delta: "+0.6pp", dir: "up",   sub: "1.2% rework rate" },
  { key: "pending",   label: "Awaiting approval", icon: "Inbox",       value: "18",    unit: "", delta: "−4",      dir: "down", sub: "since 1h ago", goodDown: true },
  { key: "sla",       label: "SLA at risk",     icon: "AlertTriangle", value: "4",     unit: "", delta: "+1",      dir: "up",   sub: "<30m to breach", alert: true },
  { key: "savings",   label: "Time saved · wk", icon: "Clock",         value: "312",   unit: "h", delta: "+24h",   dir: "up",   sub: "13 broker FTEs" },
  { key: "brokers",   label: "Brokers onboarded · wk", icon: "Users",  value: "23",    unit: "", delta: "+9",      dir: "up",   sub: "8 countries" },
];

window.CB_DATA = { TASK_TYPES, ACTIVITY_SEED, APPROVALS, CAPABILITIES, TASK_MIX, REGIONS, SUGGESTED_BROKERS, KPIS };
