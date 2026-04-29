import { useState, useEffect, useRef } from "react";

// Score out of 100 — uses raw average across all dimensions (not rounded) for differentiation
function scoreToHundred(rawAvg) {
  return Math.round((rawAvg / 10) * 100);
}

function getRank(score100) {
  if (score100 >= 90) return { title: "AI Magnet ✦", color: "#C8FF00", bg: "rgba(200,255,0,0.12)", border: "rgba(200,255,0,0.4)" };
  if (score100 >= 75) return { title: "Citation Ready", color: "#00FFD1", bg: "rgba(0,255,209,0.12)", border: "rgba(0,255,209,0.4)" };
  if (score100 >= 60) return { title: "Getting There", color: "#FFD166", bg: "rgba(255,209,102,0.12)", border: "rgba(255,209,102,0.4)" };
  if (score100 >= 40) return { title: "Needs Polish", color: "#FF9F66", bg: "rgba(255,159,102,0.12)", border: "rgba(255,159,102,0.4)" };
  return { title: "Invisible to AI", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)", border: "rgba(255,107,107,0.4)" };
}

const PLATFORMS = [
  { value: "linkedin_article", label: "LinkedIn Article" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "medium", label: "Medium" },
  { value: "substack", label: "Substack" },
  { value: "reddit", label: "Reddit" },
  { value: "twitter_x", label: "X / Twitter Thread" },
  { value: "twitter_article", label: "X Article (long-form)" },
  { value: "paragraph", label: "Paragraph" },
  { value: "mirror", label: "Mirror.xyz" },
  { value: "blog", label: "Personal / Company Blog" },
  { value: "landing_page", label: "Landing Page" },
  { value: "other", label: "Other" },
];

const PLATFORM_CONTEXT = {
  linkedin_article: "LinkedIn articles (500–1500 words, native, named author) are among the highest-cited sources on ChatGPT and Perplexity for B2B queries. Personal profiles outperform company pages.",
  linkedin_post: "LinkedIn posts are shorter and conversational. They get cited less than articles but can perform well on Perplexity for trending professional topics.",
  medium: "Medium is heavily indexed across all AI engines, especially for how-to and explainer content. Clear headings, concrete examples, and a byline improve citation rates.",
  substack: "Substack is increasingly cited by Perplexity and ChatGPT for niche expert opinion. Long-form, opinionated, specific content performs best.",
  reddit: "Reddit is Perplexity's most-cited source for conversational and comparison queries. Conversational tone, direct answers first, specificity are critical. Brand voice kills Reddit performance.",
  twitter_x: "X threads get cited for breaking opinions and real-time takes. Short, numbered, punchy threads with a clear POV in the first tweet work best.",
  twitter_article: "X Articles (long-form posts on X) are an emerging citation source, particularly on Perplexity. They behave more like blog posts than threads — structure, headers, and a strong byline matter. Still early for AI citation but growing fast.",
  paragraph: "Paragraph is a web3-native blogging platform. Content here gets indexed by Perplexity and occasionally ChatGPT for crypto, web3, and DeFi queries. On-chain publishing and named author identity are strong authority signals.",
  mirror: "Mirror.xyz is heavily cited by Perplexity for web3, DeFi, DAO, and crypto-native queries. Long-form essays with a clear thesis, specific on-chain data, and named author perform best. The decentralised publishing signal adds credibility with AI.",
  blog: "Blog posts are cited when they have strong domain authority, clear structure, and answer a specific query. Schema markup and internal linking help.",
  landing_page: "Landing pages are rarely cited directly but FAQ sections with direct answers have the highest citation potential.",
  other: "Analyze based on content itself and general GEO best practices.",
};

const buildDimensions = (title, platform) => {
  const titleCtx = title ? `The content title is: "${title}". Check query intent alignment and whether body delivers on title promise.` : "No title provided.";
  const platformCtx = platform && platform !== "other" ? `Platform: ${PLATFORMS.find(p => p.value === platform)?.label}. ${PLATFORM_CONTEXT[platform]}` : "No platform specified — infer from content.";
  return [
    { id: "quotability", label: "Quotability", emoji: "❝", tagline: "Can AI lift a line straight from this?", why: "AI engines love a quotable moment — a crisp stat, a bold claim. Without one, your content gets summarised into oblivion.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for QUOTABILITY. Look for: self-contained stats, memorable one-liners, bold claims, specific data an AI could lift verbatim.\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>" }` },
    { id: "structure", label: "Structure", emoji: "⊞", tagline: "Can AI scan and extract the key point instantly?", why: "AI doesn't read — it extracts. A wall of text with no clear hierarchy gets skipped entirely.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for STRUCTURE. Look for: headers/subheadings, bullet points, numbered lists, direct answers near the top, short paragraphs, clear hierarchy.\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence describing the structure>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>" }` },
    { id: "specificity", label: "Specificity", emoji: "◎", tagline: "Real details or vague fluff?", why: "Vague content never gets cited. AI gravitates toward named examples, real numbers, concrete scenarios.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for SPECIFICITY. Look for: named entities, concrete numbers, real examples, specific scenarios vs vague generalities.\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>" }` },
    { id: "authority", label: "Authority", emoji: "◈", tagline: "Does this feel written by someone who knows?", why: "Named author, clear POV, expertise markers — these make content feel like a primary source, not a generic post.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for AUTHORITY SIGNALS. Look for: named author, first-person expertise, clear point of view, credibility markers, primary source feel.\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>" }` },
    { id: "queryMatch", label: "Query Match", emoji: "⌖", tagline: "Does it answer a real ChatGPT question?", why: "If content isn't mapped to a specific query, AI has no reason to surface it. Answer one question completely — in the first 3 lines.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for QUERY MATCH. Does it directly answer a specific question someone would type into an AI assistant? Is the answer in the first 2-3 sentences?\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>" }` },
    { id: "platformFit", label: "Platform Fit", emoji: "⬡", tagline: "Right format for where it's published?", why: "Perplexity, ChatGPT, Gemini don't cite equally. LinkedIn articles ≠ Reddit threads. Format matters as much as content.", prompt: `${titleCtx}\n${platformCtx}\nAnalyze this content for PLATFORM FIT. Assess tone, length, format, and voice for this platform's citation patterns with AI engines. Include perplexity, chatgpt, gemini, grok, metaai, and claude in platformBreakdown.\nRespond with JSON only, no extra text:\n{ "score": <number 1-10>, "verdict": "<Pass or Weak or Fail>", "finding": "<one sentence>", "fix": "<one specific fix, or null if passing>", "rewrite": "<BEFORE: [example] then AFTER: [improved], or null>", "platformBreakdown": { "perplexity": "<High or Medium or Low>", "chatgpt": "<High or Medium or Low>", "gemini": "<High or Medium or Low>", "grok": "<High or Medium or Low>", "metaai": "<High or Medium or Low>", "claude": "<High or Medium or Low>" } }` },
  ];
};

function encodeResults(data) { try { return btoa(encodeURIComponent(JSON.stringify(data))); } catch { return null; } }
function decodeResults(str) { try { return JSON.parse(decodeURIComponent(atob(str))); } catch { return null; } }

function AnimatedNum({ target, suffix = "" }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    const step = () => { i = Math.min(i + Math.ceil((target - i) / 6 + 1), target); setN(i); if (i < target) setTimeout(step, 25); };
    setTimeout(step, 500);
  }, [target]);
  return <>{n}{suffix}</>;
}

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", color: "#e8e8f0", fontSize: "12px", lineHeight: 1.5, padding: "8px 12px", borderRadius: "8px", width: "220px", zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", pointerEvents: "none", fontFamily: "inherit" }}>
        {text}
        <span style={{ position: "absolute", bottom: "-5px", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #1a1a2e" }} />
      </span>}
    </span>
  );
}

function DoodleBar({ pct, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(pct), 150); }, [pct]);
  return (
    <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden", marginTop: "10px", position: "relative" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: "99px", transition: "width 1s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: `0 0 12px ${color}88` }} />
    </div>
  );
}

// Doodle SVG components
const DoodleArrow = () => (
  <svg width="40" height="24" viewBox="0 0 40 24" fill="none" style={{ display: "inline-block" }}>
    <path d="M2 12 C8 8, 16 6, 28 12" stroke="#C8FF00" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M24 6 L32 12 L24 18" stroke="#C8FF00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const DoodleStar = ({ color = "#C8FF00", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M10 2 L11.5 8.5 L18 10 L11.5 11.5 L10 18 L8.5 11.5 L2 10 L8.5 8.5 Z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.2" strokeLinejoin="round"/>
  </svg>
);

const DoodleCircle = ({ color = "#00FFD1" }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2 C13.4 2 16 5.6 16 9 C16 13.4 12.4 16 9 16 C4.6 16 2 12.4 2 9 C2 4.6 5.6 2 9 2 Z" stroke={color} strokeWidth="1.8" fill="none" strokeDasharray="2 1"/>
  </svg>
);

const verdictConfig = {
  Pass: { color: "#C8FF00", bg: "rgba(200,255,0,0.08)", border: "rgba(200,255,0,0.3)", label: "Pass ✓" },
  Weak: { color: "#FFD166", bg: "rgba(255,209,102,0.08)", border: "rgba(255,209,102,0.3)", label: "Weak ~" },
  Fail: { color: "#FF6B6B", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.3)", label: "Fail ✗" },
};
const likelihoodConfig = {
  High: { color: "#C8FF00", bg: "rgba(200,255,0,0.1)" },
  Medium: { color: "#FFD166", bg: "rgba(255,209,102,0.1)" },
  Low: { color: "#FF6B6B", bg: "rgba(255,107,107,0.1)" },
};

export default function AIProofChecker() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [platformOther, setPlatformOther] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [results, setResults] = useState(null);
  const [engineResults, setEngineResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(-1);
  const [error, setError] = useState("");
  const [expandedDim, setExpandedDim] = useState(null);
  const [shareMsg, setShareMsg] = useState("");
  const [sharedView, setSharedView] = useState(null);
  const [focused, setFocused] = useState(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) { const d = decodeResults(hash); if (d) setSharedView(d); }
  }, []);

  const callAPI = async (system, user) => {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  };

  const analyze = async () => {
    if (!body.trim() || body.trim().length < 50) { setError("Paste your content body first — at least a paragraph."); return; }
    setError(""); setLoading(true); setResults(null); setEngineResults(null); setSharedView(null);
    const hasOther = platforms.includes("other");
    const namedPlatforms = platforms.filter(p => p !== "other");
    const effectivePlatforms = [...namedPlatforms, ...(hasOther && platformOther ? [platformOther] : [])];
    const platformLabels = effectivePlatforms.map(p => PLATFORMS.find(x => x.value === p)?.label || p).join(", ");
    const platformCtxStr = effectivePlatforms.length > 0
      ? effectivePlatforms.map(p => PLATFORM_CONTEXT[p] || "").filter(Boolean).join(" ")
      : "";
    const effectivePlatform = effectivePlatforms[0] || ""; // primary for buildDimensions
    const DIMS = buildDimensions(title, effectivePlatform);
    const truncatedBody = body.trim().slice(0, 3000);
    const fullContent = `${title ? `TITLE: ${title}\n\n` : ""}${platformLabels ? `PLATFORMS: ${platformLabels}\n\n` : ""}BODY:\n${truncatedBody}`;
    const dimResults = {};
    for (let i = 0; i < DIMS.length; i++) {
      setLoadingIndex(i);
      try { dimResults[DIMS[i].id] = await callAPI("You are a GEO expert. Respond ONLY with valid JSON, no markdown, no backticks.", `${DIMS[i].prompt}\n\nCONTENT:\n"""\n${fullContent}\n"""`); }
      catch { dimResults[DIMS[i].id] = { score: 5, verdict: "Weak", finding: "Could not analyze.", fix: null, rewrite: null }; }
    }
    setResults(dimResults);
    if (targetQuery.trim()) {
      setLoadingIndex(DIMS.length);
      try {
        setEngineResults(await callAPI("You are a GEO expert. Respond ONLY with valid JSON, no markdown.",
          `Given content, title "${title || "untitled"}", platforms "${platformLabels || "unspecified"}", and query "${targetQuery}", assess citation likelihood for each AI engine.\nRespond with JSON only:\n{ "perplexity": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" }, "chatgpt": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" }, "gemini": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" }, "grok": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" }, "metaai": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" }, "claude": { "likelihood": "<High or Medium or Low>", "reason": "<one sentence>" } }\nContent:\n"""\n${fullContent}\n"""`
        ));
      } catch { setEngineResults(null); }
    }
    setLoading(false); setLoadingIndex(-1);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const DIMS = buildDimensions(title, platforms[0] || "");
  const rawAvg = results ? Object.values(results).reduce((s, r) => s + (r.score || 0), 0) / DIMS.length : null;
  const overallScore = rawAvg ? Math.round(rawAvg) : null;
  const score100 = rawAvg ? scoreToHundred(rawAvg) : null;
  const rank = score100 ? getRank(score100) : null;
  const fixes = results ? DIMS.filter(d => results[d.id]?.fix).map(d => ({ ...d, ...results[d.id] })) : [];
  const totalSteps = DIMS.length + (targetQuery.trim() ? 1 : 0);
  const progressPct = loading ? Math.round(((loadingIndex + 1) / totalSteps) * 100) : 0;

  const handleShare = () => {
    if (!results) return;
    const encoded = encodeResults({ results, engineResults, overallScore, score100, rank, targetQuery, title, platforms, platformOther });
    if (!encoded) return;
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${encoded}`);
    setShareMsg("Link copied! 🎉"); setTimeout(() => setShareMsg(""), 3000);
  };

  const fieldStyle = (name) => ({
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1.5px solid ${focused === name ? "#C8FF00" : "rgba(255,255,255,0.12)"}`,
    boxShadow: focused === name ? "0 0 0 3px rgba(200,255,0,0.08)" : "none",
    borderRadius: "12px", padding: "13px 16px",
    fontSize: "14px", color: "#f0f0f8",
    outline: "none", fontFamily: "inherit",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  });

  const renderResults = (res, eng, score, s100, rnk, query, fx, titleVal, platVals, platOther) => {
    if (!rnk) return null;
    const platArray = Array.isArray(platVals) ? platVals : platVals ? [platVals] : [];
    const RenderDIMS = buildDimensions(titleVal, platArray[0] || "");
    return (
      <div>
        {/* Score hero */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: `2px solid ${rnk.border}`, borderRadius: "20px", padding: "36px 32px", marginBottom: "16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "16px", left: "20px", opacity: 0.4 }}><DoodleStar color={rnk.color} size={24} /></div>
          <div style={{ position: "absolute", top: "20px", right: "24px", opacity: 0.3 }}><DoodleCircle color={rnk.color} /></div>
          <div style={{ position: "absolute", bottom: "16px", right: "20px", opacity: 0.25 }}><DoodleStar color={rnk.color} size={16} /></div>
          <div style={{ position: "absolute", bottom: "20px", left: "24px", opacity: 0.2 }}><DoodleCircle color="#FFD166" /></div>
          {titleVal && <div style={{ fontSize: "12px", color: "rgba(240,240,248,0.4)", fontStyle: "italic", marginBottom: "14px" }}>"{titleVal}"</div>}
          <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>LLM Friendliness Score</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "4px", marginBottom: "8px" }}>
            <div style={{ fontSize: "clamp(64px, 14vw, 100px)", fontWeight: "700", color: rnk.color, lineHeight: 1, fontFamily: "'Space Mono', monospace", textShadow: `0 0 40px ${rnk.color}44` }}>
              <AnimatedNum target={s100} />
            </div>
            <div style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: "700", color: "rgba(240,240,248,0.3)", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>/100</div>
          </div>
          <div style={{ fontSize: "15px", color: "rgba(240,240,248,0.7)", marginBottom: "20px" }}>
            Your content scored <span style={{ color: rnk.color, fontWeight: "700" }}>{s100}/100</span> for LLM friendliness
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: rnk.bg, border: `1.5px solid ${rnk.border}`, borderRadius: "99px", padding: "8px 22px" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: rnk.color, fontFamily: "'Space Mono', monospace", letterSpacing: "0.02em" }}>{rnk.title}</span>
          </div>
          <div style={{ marginTop: "24px" }}>
            <DoodleBar pct={s100} color={rnk.color} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "rgba(240,240,248,0.3)" }}>
              <span>Invisible to AI</span><span>AI Magnet ✦</span>
            </div>
          </div>
        </div>

        {/* Engine likelihood */}
        {eng && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "20px 22px", marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>Citation likelihood — "{query}"</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["perplexity", "chatgpt", "gemini", "grok", "metaai", "claude"].filter(e => eng[e]).map(e => {
                const d = eng[e]; if (!d) return null;
                const lc = likelihoodConfig[d.likelihood] || {};
                return (
                  <div key={e} style={{ flex: "1", minWidth: "140px", background: lc.bg, border: `1px solid ${lc.color}33`, borderRadius: "10px", padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#f0f0f8", textTransform: "capitalize", fontFamily: "'Syne', sans-serif" }}>{e === "metaai" ? "Meta AI" : e === "chatgpt" ? "ChatGPT" : e.charAt(0).toUpperCase() + e.slice(1)}</span>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: lc.color }}>{d.likelihood}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.5)", lineHeight: 1.55 }}>{d.reason}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Platform breakdown fallback */}
        {!eng && res.platformFit?.platformBreakdown && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "18px 20px", marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>General citation likelihood by engine</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(res.platformFit.platformBreakdown).filter(([engine]) => ["perplexity", "chatgpt", "gemini", "grok", "metaai", "claude"].includes(engine)).map(([engine, likelihood]) => {
                const lc = likelihoodConfig[likelihood] || {};
                return (
                  <div key={engine} style={{ display: "flex", alignItems: "center", gap: "6px", background: lc.bg, borderRadius: "8px", padding: "6px 12px" }}>
                    <span style={{ fontSize: "12px", color: "#f0f0f8" }}>{engine === "metaai" ? "Meta AI" : engine === "chatgpt" ? "ChatGPT" : engine.charAt(0).toUpperCase() + engine.slice(1)}</span>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: lc.color }}>{likelihood}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dimension cards */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Breakdown — tap to expand</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {RenderDIMS.map(dim => {
              const r = res[dim.id]; if (!r) return null;
              const vc = verdictConfig[r.verdict] || verdictConfig.Weak;
              const isOpen = expandedDim === dim.id;
              return (
                <div key={dim.id} onClick={() => setExpandedDim(isOpen ? null : dim.id)}
                  style={{ background: "rgba(255,255,255,0.03)", border: `1.5px solid ${isOpen ? vc.color + "55" : "rgba(255,255,255,0.08)"}`, borderRadius: "14px", padding: "16px 18px", cursor: "pointer", transition: "all 0.2s", userSelect: "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "15px" }}>{dim.emoji}</span>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#f0f0f8", fontFamily: "'Space Mono', monospace" }}>{dim.label}</span>
                        <span style={{ fontSize: "11px", color: "rgba(240,240,248,0.35)", fontStyle: "italic" }}>{dim.tagline}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "rgba(240,240,248,0.6)", lineHeight: 1.55 }}>{r.finding}</div>
                      <DoodleBar pct={(r.score / 10) * 100} color={vc.color} />
                    </div>
                    <div style={{ textAlign: "right", minWidth: "64px" }}>
                      <div style={{ display: "inline-block", background: vc.bg, color: vc.color, border: `1px solid ${vc.border}`, borderRadius: "8px", padding: "3px 10px", fontSize: "11px", fontWeight: "700", marginBottom: "5px", fontFamily: "'Space Mono', monospace" }}>{vc.label}</div>
                      <div style={{ fontSize: "22px", fontWeight: "700", color: "#f0f0f8", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{r.score}<span style={{ fontSize: "11px", color: "rgba(240,240,248,0.3)" }}>/10</span></div>
                      <div style={{ fontSize: "10px", color: "rgba(240,240,248,0.25)", marginTop: "4px" }}>{isOpen ? "▲ close" : "▼ expand"}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Why it matters</div>
                      <div style={{ fontSize: "13px", color: "rgba(240,240,248,0.6)", lineHeight: 1.65, marginBottom: r.fix ? "12px" : 0 }}>{dim.why}</div>
                      {r.fix && <div style={{ background: "rgba(255,209,102,0.08)", border: "1px solid rgba(255,209,102,0.25)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#FFD166", lineHeight: 1.6, marginBottom: r.rewrite ? "8px" : 0 }}>✏️ <strong>Fix:</strong> {r.fix}</div>}
                      {r.rewrite && <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "rgba(240,240,248,0.5)", lineHeight: 1.7, fontStyle: "italic" }}>{r.rewrite}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fix list */}
        {fx.length > 0 && (
          <div style={{ background: "rgba(200,255,0,0.04)", border: "1.5px solid rgba(200,255,0,0.15)", borderRadius: "16px", padding: "22px 26px", marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px" }}>
              🛠 Your fix list — {fx.length} {fx.length === 1 ? "thing" : "things"} to work on
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {fx.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "start" }}>
                  <div style={{ minWidth: "26px", height: "26px", background: "rgba(200,255,0,0.1)", border: "1.5px solid rgba(200,255,0,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#C8FF00", fontWeight: "700", fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#C8FF00", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "3px" }}>{f.label}</div>
                    <div style={{ fontSize: "13px", color: "rgba(240,240,248,0.65)", lineHeight: 1.65 }}>{f.fix}</div>
                    {f.rewrite && <div style={{ fontSize: "12px", color: "rgba(240,240,248,0.35)", fontStyle: "italic", marginTop: "6px", lineHeight: 1.6 }}>{f.rewrite}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: "11px", color: "rgba(240,240,248,0.22)", lineHeight: 1.7, padding: "0 2px" }}>
          GEO and AEO are not deterministic. No tool can guarantee AI citations — this scores structural properties that correlate with citation, not a guarantee of outcome.
        </div>
      </div>
    );
  };

  if (sharedView) {
    const { results: sr, engineResults: se, overallScore: ss, score100: s100, rank: srk, targetQuery: sq, title: st, platforms: spls, platformOther: spo } = sharedView;
    const sfixes = buildDimensions(st, (spls || [])[0] || "").filter(d => sr[d.id]?.fix).map(d => ({ ...d, ...sr[d.id] }));
    const srk2 = srk || getRank(s100 || 50);
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#f0f0f8", fontFamily: "'Syne', sans-serif" }}>
        <style>{styles}</style>
        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "40px 20px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "12px", color: "rgba(240,240,248,0.4)", marginBottom: "8px", letterSpacing: "0.08em" }}>Someone shared their GEO score with you</div>
            <div style={{ fontSize: "26px", fontWeight: "900", color: "#C8FF00" }}>Content Report ✦</div>
          </div>
          {renderResults(sr, se, ss, s100 || 50, srk2, sq, sfixes, st, spls || [], spo)}
          <div style={{ textAlign: "center", marginTop: "32px", background: "rgba(200,255,0,0.05)", border: "1.5px solid rgba(200,255,0,0.2)", borderRadius: "16px", padding: "28px" }}>
            <div style={{ fontSize: "18px", fontWeight: "900", color: "#C8FF00", marginBottom: "8px" }}>Check your own content →</div>
            <div style={{ fontSize: "13px", color: "rgba(240,240,248,0.5)", marginBottom: "18px" }}>See how LLM-friendly your writing really is.</div>
            <button onClick={() => { setSharedView(null); window.location.hash = ""; }} style={{ background: "#C8FF00", color: "#0d0d1a", border: "none", borderRadius: "10px", padding: "13px 28px", fontSize: "14px", fontFamily: "'Syne', sans-serif", cursor: "pointer", fontWeight: "800" }}>
              Try it now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#f0f0f8", fontFamily: "'Syne', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{styles}</style>

      {/* Grid background like Scribble */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      {/* Glow */}
      <div style={{ position: "fixed", top: "-200px", right: "-100px", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(200,255,0,0.06) 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-150px", left: "-100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(0,255,209,0.05) 0%, transparent 65%)", zIndex: 0, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "0 20px 100px" }}>

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C8FF00", boxShadow: "0 0 8px #C8FF00" }} />
            <span style={{ fontSize: "12px", color: "rgba(240,240,248,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Powered by ScribbleAI</span>
          </div>
          <a href="https://scribble.network" target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "rgba(240,240,248,0.35)", textDecoration: "none", letterSpacing: "0.06em" }}>scribble.network ↗</a>
        </div>

        {/* Hero */}
        <div style={{ padding: "56px 0 48px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(200,255,0,0.08)", border: "1px solid rgba(200,255,0,0.25)", borderRadius: "99px", padding: "5px 16px", fontSize: "11px", color: "#C8FF00", letterSpacing: "0.12em", marginBottom: "24px", textTransform: "uppercase" }}>
            <DoodleStar size={12} /> GEO · AEO · AI Search
          </div>

          <div style={{ position: "relative", marginBottom: "20px" }}>
            <h1 style={{ fontSize: "clamp(32px, 7vw, 56px)", fontWeight: "700", lineHeight: 1.1, color: "#f0f0f8", margin: 0, letterSpacing: "-0.01em", fontFamily: "'Space Mono', monospace" }}>
              Is your writing<br />
              <span style={{ color: "#C8FF00", display: "inline-block", position: "relative" }}>
                invisible to AI?
                <svg style={{ position: "absolute", bottom: "-6px", left: 0, width: "100%", height: "8px" }} viewBox="0 0 200 8" preserveAspectRatio="none">
                  <path d="M2 5 C40 2, 80 7, 120 4 C160 1, 180 6, 198 4" stroke="#C8FF00" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6"/>
                </svg>
              </span>
            </h1>
            {/* Floating doodles */}
            <div style={{ position: "absolute", top: "0px", right: "-10px", opacity: 0.5 }}><DoodleStar color="#FFD166" size={28} /></div>
          </div>

          <p style={{ fontSize: "15px", color: "rgba(240,240,248,0.55)", lineHeight: 1.75, margin: "0 0 32px", maxWidth: "480px" }}>
            When someone asks ChatGPT or Perplexity a question in your space — does your content get cited? Most doesn't. Not bad writing. Just not built for AI. <DoodleArrow />
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {[
              { emoji: "🔍", title: "AI is the new Google", body: "40%+ of searches now start with an AI. Not cited = doesn't exist." },
              { emoji: "📝", title: "Good writing still fails", body: "Well-written content structured wrong never gets quoted." },
              { emoji: "✦", title: "GEO ≠ SEO", body: "SEO = ranked. GEO = cited. They overlap 70% — the 30% is everything." }
            ].map((c, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", transition: "border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(200,255,0,0.25)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
              >
                <div style={{ fontSize: "20px", marginBottom: "8px" }}>{c.emoji}</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#f0f0f8", marginBottom: "5px", fontFamily: "'Space Mono', monospace" }}>{c.title}</div>
                <div style={{ fontSize: "12px", color: "rgba(240,240,248,0.45)", lineHeight: 1.6 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Input form */}
        <div style={{ padding: "40px 0 0" }}>
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#f0f0f8", margin: "0 0 6px", fontFamily: "'Space Mono', monospace" }}>Check your content</h2>
            <p style={{ fontSize: "13px", color: "rgba(240,240,248,0.45)", margin: 0, lineHeight: 1.6 }}>All fields optional except body — more context = sharper analysis.</p>
          </div>

          <div style={{ background: "rgba(255,255,255,0.025)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "24px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Title */}
            <div>
              <label style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                Title
                <Tooltip text="Your headline. We check if it signals the right query intent — a good title alone lifts citation chances.">
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "rgba(240,240,248,0.5)", fontSize: "10px", cursor: "help" }}>?</span>
                </Tooltip>
                <span style={{ fontSize: "10px", color: "rgba(240,240,248,0.25)", textTransform: "none", letterSpacing: 0, fontStyle: "italic" }}>optional</span>
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Why AI Engines Are Ignoring Your Content"
                style={fieldStyle("title")} onFocus={() => setFocused("title")} onBlur={() => setFocused(null)} />
            </div>

            {/* Body */}
            <div>
              <label style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                Content body
                <span style={{ fontSize: "10px", color: "#C8FF00", textTransform: "none", letterSpacing: 0, fontStyle: "italic", background: "rgba(200,255,0,0.1)", borderRadius: "4px", padding: "1px 6px" }}>required</span>
              </label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the body of your content here — blog post, article, landing page, thread..."
                style={{ ...fieldStyle("body"), minHeight: "170px", resize: "vertical", lineHeight: 1.75, display: "block" }}
                onFocus={() => setFocused("body")} onBlur={() => setFocused(null)} />
            </div>

            {/* Platform */}
            <div>
              <label style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                Platform
                <Tooltip text="Where this is published. Select all that apply — Reddit posts get cited differently from LinkedIn articles. More context = sharper analysis.">
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "rgba(240,240,248,0.5)", fontSize: "10px", cursor: "help" }}>?</span>
                </Tooltip>
                <span style={{ fontSize: "10px", color: "rgba(240,240,248,0.25)", textTransform: "none", letterSpacing: 0, fontStyle: "italic" }}>optional — select all that apply</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PLATFORMS.map(p => {
                  const selected = platforms.includes(p.value);
                  return (
                    <button key={p.value} type="button"
                      onClick={() => setPlatforms(prev => selected ? prev.filter(x => x !== p.value) : [...prev, p.value])}
                      style={{
                        background: selected ? "rgba(200,255,0,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${selected ? "rgba(200,255,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: "99px", padding: "6px 14px",
                        fontSize: "12px", color: selected ? "#C8FF00" : "rgba(240,240,248,0.5)",
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "all 0.15s",
                        boxShadow: selected ? "0 0 10px rgba(200,255,0,0.12)" : "none",
                        display: "flex", alignItems: "center", gap: "5px"
                      }}>
                      {selected && <span style={{ fontSize: "10px" }}>✓</span>}
                      {p.label}
                    </button>
                  );
                })}
              </div>
              {platforms.includes("other") && (
                <input value={platformOther} onChange={e => setPlatformOther(e.target.value)} placeholder="Describe the platform (e.g. Quora, podcast page)"
                  style={{ ...fieldStyle("platformOther"), marginTop: "10px", display: "block" }}
                  onFocus={() => setFocused("platformOther")} onBlur={() => setFocused(null)} />
              )}
            </div>

            {/* Target query */}
            <div>
              <label style={{ fontSize: "11px", color: "rgba(240,240,248,0.4)", textTransform: "uppercase", letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                Target query
                <Tooltip text="The specific question you want AI to answer using your content — e.g. 'how do I get cited on Perplexity'. Adding this unlocks per-engine scoring across ChatGPT, Perplexity, and Gemini.">
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "rgba(240,240,248,0.5)", fontSize: "10px", cursor: "help" }}>?</span>
                </Tooltip>
                <span style={{ fontSize: "10px", color: "rgba(240,240,248,0.25)", textTransform: "none", letterSpacing: 0, fontStyle: "italic" }}>optional — unlocks per-engine scoring</span>
              </label>
              <input value={targetQuery} onChange={e => setTargetQuery(e.target.value)} placeholder="e.g. how do I get my content cited on ChatGPT"
                style={fieldStyle("targetQuery")} onFocus={() => setFocused("targetQuery")} onBlur={() => setFocused(null)} />
            </div>
          </div>

          {error && <div style={{ color: "#FF6B6B", fontSize: "13px", marginBottom: "14px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: "8px", padding: "10px 14px" }}>{error}</div>}

          <button onClick={analyze} disabled={loading} style={{
            background: loading ? "rgba(255,255,255,0.04)" : "#C8FF00",
            color: loading ? "rgba(240,240,248,0.4)" : "#0d0d1a",
            border: loading ? "1.5px solid rgba(255,255,255,0.1)" : "none",
            borderRadius: "12px", padding: "15px 36px", fontSize: "15px",
            fontWeight: "700", fontFamily: "'Space Mono', monospace",
            cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: "10px", letterSpacing: "0.02em",
            boxShadow: loading ? "none" : "0 0 24px rgba(200,255,0,0.25)"
          }}>
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(240,240,248,0.5)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                {loadingIndex < DIMS.length ? `Checking ${DIMS[loadingIndex]?.label}...` : "Checking engine likelihood..."}
              </>
            ) : "Analyze my content ✦"}
          </button>

          {loading && (
            <div style={{ marginTop: "16px", marginBottom: "36px" }}>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", marginBottom: "10px" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "#C8FF00", borderRadius: "2px", transition: "width 0.5s ease", boxShadow: "0 0 10px rgba(200,255,0,0.5)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "rgba(240,240,248,0.35)" }}>{loadingIndex < DIMS.length ? DIMS[loadingIndex]?.label : "Engine likelihood"}...</span>
                <span style={{ fontSize: "12px", color: "#C8FF00" }}>{progressPct}%</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {DIMS.map((d, i) => (
                  <div key={d.id} style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "11px", background: i < loadingIndex ? "rgba(200,255,0,0.1)" : i === loadingIndex ? "rgba(200,255,0,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${i <= loadingIndex ? "rgba(200,255,0,0.35)" : "rgba(255,255,255,0.07)"}`, color: i < loadingIndex ? "#C8FF00" : i === loadingIndex ? "#C8FF00" : "rgba(240,240,248,0.25)", transition: "all 0.3s" }}>
                    {i < loadingIndex ? "✓ " : ""}{d.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div ref={resultsRef} style={{ animation: "fadeUp 0.5s ease", paddingTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "rgba(200,255,0,0.05)", border: "1.5px solid rgba(200,255,0,0.15)", borderRadius: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "13px", color: "rgba(240,240,248,0.55)" }}>Share your score — anyone with the link sees your exact results.</span>
              <button onClick={handleShare} style={{ background: "rgba(200,255,0,0.12)", border: "1px solid rgba(200,255,0,0.3)", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", color: "#C8FF00", cursor: "pointer", fontFamily: "'Space Mono', monospace", fontWeight: "700" }}>
                {shareMsg || "Copy share link ↗"}
              </button>
            </div>

            {renderResults(results, engineResults, overallScore, score100, rank, targetQuery, fixes, title, platforms, platformOther)}

            {/* CTA */}
            <div style={{ background: "rgba(200,255,0,0.04)", border: "1.5px solid rgba(200,255,0,0.15)", borderRadius: "16px", padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginTop: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#f0f0f8", marginBottom: "5px", fontFamily: "'Space Mono', monospace" }}>Want AI search visibility at scale?</div>
                <div style={{ fontSize: "12px", color: "rgba(240,240,248,0.45)", lineHeight: 1.6, maxWidth: "360px" }}>Scribble connects brands with 50,000+ creators to build GEO-optimised content across the platforms AI actually cites.</div>
              </div>
              <a href="https://scribble.network" target="_blank" rel="noopener noreferrer" style={{ background: "#C8FF00", color: "#0d0d1a", borderRadius: "10px", padding: "11px 22px", fontSize: "13px", fontFamily: "'Space Mono', monospace", textDecoration: "none", fontWeight: "700", whiteSpace: "nowrap" }}>
                scribble.network →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  textarea::placeholder, input::placeholder { color: rgba(240,240,248,0.22); font-family: 'Syne', sans-serif; }
  select option { background: #1a1a2e; color: #f0f0f8; }
  select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23C8FF00' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
`;
