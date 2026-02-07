import { useState, useEffect, useCallback } from "react";

// ============================================================
// FAIRBOUNTY — Reputation-Gated Bounty Platform
// Built on FairScale Reputation Infrastructure
// ============================================================

const WALLET_THEMES = {
  phantom: { primary: "#AB9FF2", accent: "#7B61FF", bg: "#1A1430", name: "Phantom" },
  solflare: { primary: "#FC8E03", accent: "#FFB84D", bg: "#1A1208", name: "Solflare" },
  backpack: { primary: "#E33E3F", accent: "#FF6B6B", bg: "#1A0C0C", name: "Backpack" },
  jupiter: { primary: "#C7F284", accent: "#95D840", bg: "#0F1A08", name: "Jupiter" },
  glow: { primary: "#B4A0FF", accent: "#8B72FF", bg: "#15102A", name: "Glow" },
  default: { primary: "#00F0FF", accent: "#00C4CC", bg: "#0A1A1C", name: "FairBounty" },
};

const TIER_CONFIG = {
  1: { label: "Newcomer", color: "#6B7280", maxBounty: 50, emoji: "🌱", xpMultiplier: 1.0, voteWeight: 1, rewardBonus: 0 },
  2: { label: "Explorer", color: "#3B82F6", maxBounty: 250, emoji: "🔍", xpMultiplier: 1.25, voteWeight: 2, rewardBonus: 5 },
  3: { label: "Builder", color: "#8B5CF6", maxBounty: 1000, emoji: "🔨", xpMultiplier: 1.5, voteWeight: 3, rewardBonus: 10 },
  4: { label: "Veteran", color: "#F59E0B", maxBounty: 5000, emoji: "⭐", xpMultiplier: 2.0, voteWeight: 5, rewardBonus: 15 },
  5: { label: "Legend", color: "#EF4444", maxBounty: null, emoji: "👑", xpMultiplier: 3.0, voteWeight: 8, rewardBonus: 25 },
};

// Risk scoring based on FairScore tier
const RISK_LEVELS = {
  1: { level: "High", color: "#EF4444", label: "High Risk — New wallet, limited history" },
  2: { level: "Medium", color: "#F59E0B", label: "Medium Risk — Some on-chain activity" },
  3: { level: "Low", color: "#3B82F6", label: "Low Risk — Established builder" },
  4: { level: "Very Low", color: "#10B981", label: "Very Low Risk — Verified veteran" },
  5: { level: "Minimal", color: "#22C55E", label: "Minimal Risk — Legendary reputation" },
};

const SAMPLE_BOUNTIES = [
  { id: 1, title: "Build Token-Gated Discord Bot", project: "SolanaFM", reward: 800, currency: "USDC", minTier: 3, tags: ["Bot", "Discord", "TypeScript"], submissions: 4, deadline: "2026-02-20", description: "Create a Discord bot that gates channels based on token holdings with real-time verification.", status: "open", votes: 12, totalVoteWeight: 28 },
  { id: 2, title: "Design Landing Page for NFT Collection", project: "Tensor", reward: 200, currency: "USDC", minTier: 2, tags: ["Design", "Frontend", "React"], submissions: 7, deadline: "2026-02-15", description: "Design and implement a responsive landing page for an upcoming NFT collection launch.", status: "open", votes: 8, totalVoteWeight: 14 },
  { id: 3, title: "Smart Contract Audit - Staking Program", project: "Marinade", reward: 3000, currency: "USDC", minTier: 4, tags: ["Rust", "Audit", "Security"], submissions: 1, deadline: "2026-03-01", description: "Full security audit of a Solana staking program written in Anchor/Rust.", status: "open", votes: 23, totalVoteWeight: 89 },
  { id: 4, title: "Create Educational Thread on Compressed NFTs", project: "Metaplex", reward: 75, currency: "USDC", minTier: 1, tags: ["Content", "Education", "cNFTs"], submissions: 12, deadline: "2026-02-12", description: "Write a comprehensive Twitter thread explaining compressed NFTs for beginners.", status: "open", votes: 5, totalVoteWeight: 7 },
  { id: 5, title: "Build Analytics Dashboard for DeFi Protocol", project: "Jupiter", reward: 4500, currency: "USDC", minTier: 5, tags: ["Frontend", "Data", "DeFi"], submissions: 0, deadline: "2026-03-15", description: "Full-stack analytics dashboard showing real-time protocol metrics, TVL, and user activity.", status: "open", votes: 31, totalVoteWeight: 142 },
  { id: 6, title: "Write Integration Guide for Wallet Adapter", project: "Solana Labs", reward: 150, currency: "USDC", minTier: 2, tags: ["Docs", "Tutorial", "TypeScript"], submissions: 3, deadline: "2026-02-18", description: "Step-by-step developer guide for integrating Solana Wallet Adapter into a React application.", status: "open", votes: 6, totalVoteWeight: 10 },
];

const GlitchText = ({ text }) => {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {glitch && (
        <>
          <span style={{ position: "absolute", left: "-2px", top: "-1px", color: "#ff0040", opacity: 0.7, clipPath: "inset(20% 0 40% 0)" }}>{text}</span>
          <span style={{ position: "absolute", left: "2px", top: "1px", color: "#00f0ff", opacity: 0.7, clipPath: "inset(50% 0 10% 0)" }}>{text}</span>
        </>
      )}
      {text}
    </span>
  );
};

const Logo = ({ size = 28 }) => (
  <img src="/logo.png" alt="FairBounty" style={{
    width: `${size}px`, height: `${size}px`, borderRadius: `${Math.max(4, size / 6)}px`,
    objectFit: "cover",
  }} />
);

// ============================================================
// FairScore API Integration
// In production, this calls the real FairScale API at
// https://swagger.api.fairscale.xyz/
// ============================================================
const FairScoreAPI = {
  // Fetch reputation tier for a wallet address
  // Production: GET /api/v1/score/{walletAddress}
  async getScore(walletAddress) {
    try {
      // --- PRODUCTION CODE (uncomment when API key is configured) ---
      // const response = await fetch(`https://api.fairscale.xyz/v1/score/${walletAddress}`, {
      //   headers: { 'Authorization': `Bearer ${FAIRSCALE_API_KEY}` }
      // });
      // const data = await response.json();
      // return { tier: data.tier, score: data.score, history: data.history };
      // --- END PRODUCTION CODE ---

      // Demo mode: simulate API response
      await new Promise((r) => setTimeout(r, 800));
      const tier = Math.ceil(Math.random() * 5);
      return {
        tier,
        score: tier * 180 + Math.floor(Math.random() * 100),
        walletAge: Math.floor(Math.random() * 730) + 30,
        txCount: tier * 200 + Math.floor(Math.random() * 500),
        protocolsUsed: tier * 3 + Math.floor(Math.random() * 5),
        nftHoldings: Math.floor(Math.random() * 50),
        defiActivity: tier > 2,
      };
    } catch (err) {
      console.error("FairScore API error:", err);
      return null;
    }
  },

  // Calculate risk level from FairScore data
  assessRisk(scoreData) {
    if (!scoreData) return RISK_LEVELS[1];
    return RISK_LEVELS[scoreData.tier] || RISK_LEVELS[1];
  },

  // Calculate dynamic reward bonus based on tier
  getRewardBonus(tier) {
    return TIER_CONFIG[tier]?.rewardBonus || 0;
  },

  // Get vote weight for a tier
  getVoteWeight(tier) {
    return TIER_CONFIG[tier]?.voteWeight || 1;
  },

  // Get XP multiplier for tier
  getXpMultiplier(tier) {
    return TIER_CONFIG[tier]?.xpMultiplier || 1.0;
  },
};

export default function FairBounty() {
  const [view, setView] = useState("landing");
  const [wallet, setWallet] = useState(null);
  const [walletType, setWalletType] = useState("default");
  const [fairScore, setFairScore] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [xp, setXp] = useState(0);
  const [bounties, setBounties] = useState(SAMPLE_BOUNTIES);
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [filterTier, setFilterTier] = useState(0);
  const [showReferral, setShowReferral] = useState(false);
  const [notification, setNotification] = useState(null);
  const [postForm, setPostForm] = useState({ title: "", description: "", reward: "", currency: "USDC", minTier: 1, tags: "", deadline: "" });
  const [submissionText, setSubmissionText] = useState("");
  const [animateIn, setAnimateIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const theme = WALLET_THEMES[walletType] || WALLET_THEMES.default;

  useEffect(() => {
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(t);
  }, [view]);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const connectWallet = async (type) => {
    setWalletType(type);
    setLoading(true);
    const mockAddress = "F" + Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("") + "...";
    setWallet(mockAddress);

    // Fetch FairScore from API
    const data = await FairScoreAPI.getScore(mockAddress);
    if (data) {
      setFairScore(data.tier);
      setScoreData(data);
      setXp(Math.floor(data.score / 2));
      notify(`Connected via ${WALLET_THEMES[type].name}! FairScore: Tier ${data.tier} (${TIER_CONFIG[data.tier].label})`);
    }
    setLoading(false);
    setView("dashboard");
  };

  const canClaim = (bounty) => fairScore >= bounty.minTier;

  const handleSubmit = (bountyId) => {
    if (!submissionText.trim()) return;
    const multiplier = FairScoreAPI.getXpMultiplier(fairScore);
    const xpEarned = Math.floor(25 * multiplier);
    setXp((prev) => prev + xpEarned);
    setBounties((prev) => prev.map((b) => b.id === bountyId ? { ...b, submissions: b.submissions + 1 } : b));
    notify(`+${xpEarned} XP (${multiplier}x Tier ${fairScore} bonus)! Submission received.`);
    setSubmissionText("");
    setView("dashboard");
  };

  const handleVote = (bountyId) => {
    const weight = FairScoreAPI.getVoteWeight(fairScore);
    const xpEarned = Math.floor(5 * FairScoreAPI.getXpMultiplier(fairScore));
    setBounties((prev) => prev.map((b) => b.id === bountyId ? { ...b, votes: b.votes + 1, totalVoteWeight: b.totalVoteWeight + weight } : b));
    setXp((prev) => prev + xpEarned);
    notify(`+${xpEarned} XP! Vote cast (weight: ${weight}x from Tier ${fairScore}).`);
  };

  const handlePostBounty = () => {
    if (!postForm.title || !postForm.reward || !postForm.description) {
      notify("Fill in all required fields.");
      return;
    }
    const newBounty = {
      id: bounties.length + 1,
      title: postForm.title,
      project: "Your Project",
      reward: Number(postForm.reward),
      currency: postForm.currency,
      minTier: postForm.minTier,
      tags: postForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      submissions: 0,
      deadline: postForm.deadline || "2026-03-30",
      description: postForm.description,
      status: "open",
      votes: 0,
      totalVoteWeight: 0,
    };
    setBounties((prev) => [newBounty, ...prev]);
    setPostForm({ title: "", description: "", reward: "", currency: "USDC", minTier: 1, tags: "", deadline: "" });
    notify("Bounty posted! -50 USDC listing fee applied.");
    setView("dashboard");
  };

  const referralLink = `https://fairbounty.xyz/ref/${wallet?.slice(0, 8) || "anon"}`;
  const filteredBounties = filterTier > 0 ? bounties.filter((b) => b.minTier === filterTier) : bounties;
  const riskData = FairScoreAPI.assessRisk(scoreData);
  const rewardBonus = FairScoreAPI.getRewardBonus(fairScore);

  // Shared styles
  const pageStyle = {
    minHeight: "100vh",
    background: `linear-gradient(135deg, ${theme.bg} 0%, #0a0a0f 50%, #0d0d14 100%)`,
    color: "#E8E8ED",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    position: "relative",
    overflow: "hidden",
  };
  const gridOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `linear-gradient(${theme.primary}08 1px, transparent 1px), linear-gradient(90deg, ${theme.primary}08 1px, transparent 1px)`,
    backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0,
  };
  const cardStyle = {
    background: `linear-gradient(145deg, ${theme.bg}CC, #0a0a0fDD)`,
    border: `1px solid ${theme.primary}30`, borderRadius: "12px", padding: "20px",
    backdropFilter: "blur(10px)", transition: "all 0.3s ease",
  };
  const btnPrimary = {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
    border: "none", borderRadius: "8px", padding: "12px 24px", color: "#0a0a0f",
    fontWeight: "bold", fontFamily: "inherit", cursor: "pointer", fontSize: "14px",
    transition: "all 0.2s ease",
  };
  const btnOutline = {
    background: "transparent", border: `1px solid ${theme.primary}50`, borderRadius: "8px",
    padding: "10px 20px", color: theme.primary, fontFamily: "inherit", cursor: "pointer",
    fontSize: "13px", transition: "all 0.2s ease",
  };
  const inputStyle = {
    background: "#0a0a0f", border: `1px solid ${theme.primary}30`, borderRadius: "8px",
    padding: "12px 16px", color: "#E8E8ED", fontFamily: "inherit", fontSize: "14px",
    width: "100%", boxSizing: "border-box", outline: "none",
  };
  const fadeIn = animateIn
    ? { opacity: 1, transform: "translateY(0)", transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }
    : { opacity: 0, transform: "translateY(20px)" };

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800;900&display=swap');
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-30px); } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::selection { background: ${theme.primary}40; color: white; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0a0a0f; }
    ::-webkit-scrollbar-thumb { background: ${theme.primary}40; border-radius: 3px; }
    select option { background: #0a0a0f; color: #E8E8ED; }
  `;

  // Demo banner
  const DemoBanner = () => (
    <div style={{
      background: `linear-gradient(90deg, ${theme.primary}15, ${theme.accent}15)`,
      border: `1px solid ${theme.primary}25`, borderRadius: "8px",
      padding: "10px 16px", marginBottom: "12px", textAlign: "center",
      fontSize: "12px", color: "#999",
    }}>
      🚧 <span style={{ color: theme.primary, fontWeight: "600" }}>Demo Mode</span> — Bounties shown are examples. FairScore data is simulated. Built for the{" "}
      <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none" }}>FairScale</a> competition.
    </div>
  );

  // Nav bar component
  const NavBar = ({ showBack, backTo, backLabel }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 0", marginBottom: "24px", borderBottom: `1px solid ${theme.primary}15`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {showBack && (
          <button onClick={() => setView(backTo || "dashboard")} style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }}>
            ← {backLabel || "Back"}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => setView("landing")}>
          <Logo size={28} />
          <span style={{ fontSize: "16px", fontWeight: "700" }}>FairBounty</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }} onClick={() => setView("about")}>About</button>
        <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }} onClick={() => setView("leaderboard")}>🏆</button>
        {wallet ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px",
            background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`,
            borderRadius: "8px", fontSize: "12px",
          }}>
            <span style={{ color: TIER_CONFIG[fairScore]?.color }}>{TIER_CONFIG[fairScore]?.emoji}</span>
            <span style={{ color: "#ccc" }}>{wallet}</span>
            <span style={{ color: theme.primary, fontWeight: "700" }}>{xp} XP</span>
            <button onClick={() => { setWallet(null); setWalletType("default"); setFairScore(null); setScoreData(null); setXp(0); setView("landing"); }}
              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "14px", padding: "0 0 0 4px", fontFamily: "inherit", lineHeight: "1" }}
              title="Disconnect wallet"
            >✕</button>
          </div>
        ) : (
          <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 16px" }} onClick={() => setView("connect")}>Connect</button>
        )}
      </div>
    </div>
  );

  const Footer = () => (
    <div style={{
      marginTop: "40px", paddingTop: "24px", borderTop: `1px solid ${theme.primary}15`,
      display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "12px",
      fontSize: "12px", color: "#666", paddingBottom: "24px",
    }}>
      <div style={{ display: "flex", gap: "16px" }}>
        <a href="https://x.com/fairscalexyz" target="_blank" rel="noopener noreferrer" style={{ color: "#888", textDecoration: "none" }}>@fairscalexyz</a>
        <a href="https://t.me/+WQlko_c5blJhN2E0" target="_blank" rel="noopener noreferrer" style={{ color: "#888", textDecoration: "none" }}>Telegram</a>
        <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: "#888", textDecoration: "none" }}>FairScale</a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Logo size={16} />
        <span>FairBounty © 2026 · Powered by{" "}
        <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none" }}>FairScale</a>
        {" "}reputation infrastructure</span>
      </div>
    </div>
  );

  // Loading spinner
  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", border: `3px solid ${theme.primary}30`,
            borderTop: `3px solid ${theme.primary}`, borderRadius: "50%",
            animation: "spin 1s linear infinite", margin: "0 auto 16px",
          }} />
          <div style={{ color: theme.primary, fontSize: "14px", fontWeight: "600" }}>Fetching FairScore...</div>
          <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>Analyzing on-chain reputation</div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // LANDING PAGE
  // ============================================================
  if (view === "landing") {
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            position: "absolute", top: "10%", right: "15%", width: "300px", height: "300px",
            background: `radial-gradient(circle, ${theme.primary}20, transparent 70%)`,
            borderRadius: "50%", filter: "blur(60px)", animation: "float 6s ease-in-out infinite",
          }} />

          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
            <DemoBanner />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "80px", ...fadeIn }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Logo size={32} />
                <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.5px" }}>FairBounty</span>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <button style={{ ...btnOutline, fontSize: "12px", padding: "6px 14px" }} onClick={() => setView("about")}>About</button>
                <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontSize: "13px", opacity: 0.8 }}>
                  Powered by FairScale ↗
                </a>
              </div>
            </div>

            <div style={{ ...fadeIn, transitionDelay: "0.1s" }}>
              <div style={{
                display: "inline-block", padding: "6px 16px",
                background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`,
                borderRadius: "100px", fontSize: "12px", color: theme.primary,
                marginBottom: "24px", letterSpacing: "1px", textTransform: "uppercase",
              }}>
                Reputation-Gated Bounties on Solana
              </div>
            </div>

            <h1 style={{
              fontSize: "clamp(40px, 7vw, 72px)", fontWeight: "900", lineHeight: "1.05",
              margin: "0 0 24px", letterSpacing: "-2px", ...fadeIn, transitionDelay: "0.2s",
            }}>
              <GlitchText text="Earn." /> <span style={{ color: theme.primary }}>Prove.</span>
              <br />Build <span style={{ color: theme.accent }}>Reputation.</span>
            </h1>

            <p style={{
              fontSize: "17px", lineHeight: "1.7", color: "#9999A8", maxWidth: "550px",
              margin: "0 auto 40px", ...fadeIn, transitionDelay: "0.3s",
            }}>
              A bounty board where your on-chain reputation unlocks opportunities.
              Higher FairScore = bigger bounties, weighted votes, and bonus rewards.
            </p>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", ...fadeIn, transitionDelay: "0.4s" }}>
              <button style={btnPrimary} onClick={() => setView("connect")}
                onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 8px 30px ${theme.primary}40`; }}
                onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "none"; }}
              >Connect Wallet →</button>
              <button style={btnOutline} onClick={() => setView("dashboard")}
                onMouseEnter={(e) => e.target.style.background = `${theme.primary}10`}
                onMouseLeave={(e) => e.target.style.background = "transparent"}
              >Browse Bounties</button>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginTop: "80px", ...fadeIn, transitionDelay: "0.5s" }}>
              {[
                { value: "$12,775", label: "Total Bounties" },
                { value: "6", label: "Active Bounties" },
                { value: "27", label: "Submissions" },
              ].map((stat) => (
                <div key={stat.label} style={{ ...cardStyle, padding: "24px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: theme.primary, marginBottom: "4px" }}>{stat.value}</div>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "1px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* How FairScore Powers FairBounty */}
            <div style={{ marginTop: "80px", ...fadeIn, transitionDelay: "0.6s" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "12px", textAlign: "center" }}>How FairScore Powers Everything</h2>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "32px", textAlign: "center", maxWidth: "500px", margin: "0 auto 32px" }}>
                FairScore isn't decorative — it's the engine. Every feature is gated, weighted, or enhanced by your on-chain reputation.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {[
                  { icon: "🔒", title: "Tier-Gated Access", desc: "Bounties are locked by minimum FairScore tier. Higher reputation = access to bigger, more valuable bounties." },
                  { icon: "⚖️", title: "Weighted Voting", desc: "Your vote counts more as your tier rises. Tier 5 votes carry 8x the weight of Tier 1. Quality voices matter." },
                  { icon: "💎", title: "Dynamic Rewards", desc: "Earn bonus rewards on completed bounties. Up to +25% bonus USDC for Tier 5 Legends." },
                  { icon: "🛡️", title: "Risk Management", desc: "Every wallet gets a risk assessment based on FairScore. Projects can filter low-reputation submissions." },
                  { icon: "⚡", title: "XP Multipliers", desc: "Higher tiers earn XP faster. Tier 5 earns 3x XP per action. Build reputation to build reputation." },
                  { icon: "🔗", title: "Referral Gating", desc: "Only Tier 2+ wallets can generate referral links, preventing bot-driven referral spam." },
                ].map((item) => (
                  <div key={item.title} style={{ ...cardStyle, padding: "24px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{item.icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>{item.title}</div>
                    <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.6" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Breakdown */}
            <div style={{ marginTop: "60px", ...cardStyle, padding: "32px", textAlign: "left", ...fadeIn, transitionDelay: "0.65s" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", textAlign: "center" }}>🏅 FairScore Tier Benefits</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.primary}20` }}>
                      {["Tier", "Max Bounty", "Vote Weight", "XP Multiplier", "Reward Bonus"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#888", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(TIER_CONFIG).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: `1px solid ${theme.primary}10` }}>
                        <td style={{ padding: "10px 8px", color: v.color, fontWeight: "700" }}>{v.emoji} Tier {k} — {v.label}</td>
                        <td style={{ padding: "10px 8px" }}>{v.maxBounty ? `$${v.maxBounty.toLocaleString()}` : "Unlimited"}</td>
                        <td style={{ padding: "10px 8px" }}>{v.voteWeight}x</td>
                        <td style={{ padding: "10px 8px" }}>{v.xpMultiplier}x</td>
                        <td style={{ padding: "10px 8px", color: theme.primary }}>+{v.rewardBonus}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revenue Model */}
            <div style={{ marginTop: "60px", ...cardStyle, padding: "32px", textAlign: "left", ...fadeIn, transitionDelay: "0.7s" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>💰 Revenue Model</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
                {[
                  { title: "Listing Fees", desc: "Projects pay a flat rate to post bounties", amount: "50 USDC/bounty" },
                  { title: "Commission", desc: "Small cut of completed bounty payouts", amount: "5% of rewards" },
                  { title: "Data Insights", desc: "Anonymized ecosystem reputation analytics", amount: "Enterprise tier" },
                ].map((r) => (
                  <div key={r.title} style={{ padding: "16px", background: "#0a0a0f", borderRadius: "8px", border: `1px solid ${theme.primary}15` }}>
                    <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{r.title}</div>
                    <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>{r.desc}</div>
                    <div style={{ fontSize: "13px", color: theme.primary, fontWeight: "600" }}>{r.amount}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Built on FairScale */}
            <div style={{
              marginTop: "60px", padding: "24px 32px",
              background: `linear-gradient(135deg, ${theme.primary}10, ${theme.accent}10)`,
              border: `1px solid ${theme.primary}25`, borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              textAlign: "center", gap: "16px", ...fadeIn, transitionDelay: "0.8s",
            }}>
              <div>
                <Logo size={40} />
                <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px", marginTop: "8px" }}>Built on FairScale</div>
                <div style={{ fontSize: "12px", color: "#999" }}>Reputation infrastructure for the Solana ecosystem</div>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  { href: "https://fairscale.xyz", label: "fairscale.xyz ↗" },
                  { href: "https://x.com/fairscalexyz", label: "@fairscalexyz ↗" },
                  { href: "https://t.me/+WQlko_c5blJhN2E0", label: "Telegram ↗" },
                ].map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                    style={{ ...btnOutline, fontSize: "12px", padding: "8px 16px", textDecoration: "none" }}>{l.label}</a>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "60px", paddingBottom: "40px", fontSize: "12px", color: "#666", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <Logo size={16} />
              <span>FairBounty © 2026 · Powered by{" "}
              <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none" }}>FairScale</a>
              {" "}reputation infrastructure</span>
            </div>
          </div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // ABOUT PAGE — Business Viability, Problem, Audience, Growth
  // ============================================================
  if (view === "about") {
    const sections = [
      {
        title: "🎯 The Problem",
        content: "The Solana ecosystem is booming with bounties, grants, and freelance work — but there's no trust layer. Projects waste time and money on unvetted contributors. Developers get scammed by fake bounties. There's no way to prove you're legit without a personal network.",
      },
      {
        title: "💡 The Solution",
        content: "FairBounty uses FairScale's on-chain reputation scoring (FairScore) to gate every interaction. Your wallet history becomes your resume. Projects trust contributors because their reputation is transparent, verifiable, and can't be faked.",
      },
      {
        title: "👥 Target Audience",
        content: "Solana projects needing vetted contributors (devs, designers, auditors, community managers). Web3 freelancers who want to build verifiable on-chain reputation. DAOs looking for accountable talent. NFT projects needing trusted collaborators.",
      },
      {
        title: "📊 FairScore Integration (Core Logic)",
        items: [
          "Tier-Gated Access — Bounties require minimum FairScore tiers. Can't claim what you haven't earned.",
          "Weighted Voting — Higher tiers get more vote weight (1x–8x). Quality voices shape outcomes.",
          "Dynamic Rewards — Tier-based bonus rewards up to +25% on completed bounties.",
          "Risk Assessment — Every wallet gets a risk score. Projects see trustworthiness at a glance.",
          "XP Multipliers — Higher tiers earn XP 1x–3x faster, accelerating reputation growth.",
          "Referral Gating — Only Tier 2+ can refer, preventing bot-driven growth.",
        ],
      },
      {
        title: "💰 Revenue Model",
        items: [
          "Listing Fees — 50 USDC per bounty posted. Sustainable, predictable revenue.",
          "Commission — 5% cut of all completed bounty payouts.",
          "Data Insights — Anonymized reputation analytics sold to ecosystem partners.",
        ],
      },
      {
        title: "🚀 Growth Strategy",
        items: [
          "First 100 users — Direct outreach to Solana developer communities on X, Discord, and Telegram. Seed bounties from existing projects.",
          "First 1,000 — Referral program with XP rewards. Partner with Superteam, Solana Foundation, and hackathon organizers.",
          "First 10,000 — Expand to multi-chain via FairScale's cross-chain reputation. Integrate with DAOs for governance-linked bounties.",
          "Ongoing — Content marketing (build-in-public threads), ecosystem partnerships, and community-driven bounty curation.",
        ],
      },
      {
        title: "🏗️ Technical Architecture",
        items: [
          "Frontend — React + Vite + Tailwind, deployed on Vercel.",
          "Backend — Node.js serverless functions for bounty management.",
          "Database — PostgreSQL (Neon) for bounties, submissions, XP, and user data.",
          "Auth — Solana wallet-based (Phantom, Solflare, Jupiter, Backpack, Glow).",
          "FairScore — Real-time API integration via FairScale REST API.",
          "Scalability — Stateless architecture, CDN-delivered frontend, auto-scaling serverless backend.",
        ],
      },
      {
        title: "🤝 Competitive Advantage",
        content: "No other bounty platform on Solana uses on-chain reputation as a core gating mechanism. Superteam Earn relies on manual vetting. Layer3 uses basic task completion. FairBounty automates trust via FairScore, reducing friction for both projects and contributors while creating a self-reinforcing reputation flywheel.",
      },
    ];

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="landing" backLabel="Home" />

          <div style={{ ...fadeIn }}>
            <h1 style={{ fontSize: "32px", fontWeight: "900", marginBottom: "8px" }}>About FairBounty</h1>
            <p style={{ color: "#888", fontSize: "14px", marginBottom: "40px" }}>
              Reputation-gated bounties for the Solana ecosystem, powered by FairScale.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {sections.map((s) => (
                <div key={s.title} style={cardStyle}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>{s.title}</h3>
                  {s.content && <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8" }}>{s.content}</p>}
                  {s.items && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {s.items.map((item, i) => (
                        <div key={i} style={{
                          padding: "10px 14px", background: "#0a0a0f", borderRadius: "6px",
                          fontSize: "12px", color: "#bbb", lineHeight: "1.6",
                          borderLeft: `2px solid ${theme.primary}40`,
                        }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // WALLET CONNECT
  // ============================================================
  if (view === "connect") {
    const wallets = [
      { id: "solflare", icon: "🔥" },
      { id: "jupiter", icon: "🪐" },
      { id: "phantom", icon: "👻" },
      { id: "backpack", icon: "🎒" },
      { id: "glow", icon: "✨" },
    ];
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "460px", margin: "0 auto", padding: "60px 20px", ...fadeIn }}>
          <button onClick={() => setView("landing")} style={{ ...btnOutline, marginBottom: "40px", fontSize: "12px", padding: "8px 16px" }}>← Back</button>
          <h2 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>Connect Wallet</h2>
          <p style={{ color: "#888", fontSize: "14px", marginBottom: "32px" }}>Choose your Solana wallet. Your FairScore will be fetched automatically.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {wallets.map((w) => {
              const wTheme = WALLET_THEMES[w.id];
              return (
                <button key={w.id} onClick={() => connectWallet(w.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px",
                    background: `linear-gradient(135deg, ${wTheme.bg}, #0a0a0f)`,
                    border: `1px solid ${wTheme.primary}30`, borderRadius: "12px", color: "#E8E8ED",
                    fontFamily: "inherit", cursor: "pointer", fontSize: "15px", fontWeight: "600",
                    transition: "all 0.2s ease", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = wTheme.primary; e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 0 20px ${wTheme.primary}20`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${wTheme.primary}30`; e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: "24px" }}>{w.icon}</span>
                  <span>{wTheme.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", padding: "4px 10px", background: `${wTheme.primary}20`, color: wTheme.primary, borderRadius: "100px" }}>Solana</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "#9999A8", fontWeight: "500" }}>
            Each wallet gets a unique color theme 🎨
          </div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // BOUNTY DETAIL
  // ============================================================
  if (view === "bounty" && selectedBounty) {
    const b = selectedBounty;
    const tier = TIER_CONFIG[b.minTier];
    const eligible = wallet ? canClaim(b) : false;
    const voteWeight = wallet ? FairScoreAPI.getVoteWeight(fairScore) : 0;
    const bonusReward = wallet ? Math.floor(b.reward * (FairScoreAPI.getRewardBonus(fairScore) / 100)) : 0;

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Bounties" />

          <div style={{ ...cardStyle, ...fadeIn }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>{b.project}</div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>{b.title}</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "24px", fontWeight: "900", color: theme.primary }}>{b.reward} {b.currency}</div>
                {bonusReward > 0 && (
                  <div style={{ fontSize: "12px", color: theme.accent, fontWeight: "600" }}>+{bonusReward} bonus (Tier {fairScore})</div>
                )}
              </div>
            </div>

            <p style={{ color: "#aaa", fontSize: "14px", lineHeight: "1.7", marginBottom: "20px" }}>{b.description}</p>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
              {b.tags.map((tag) => (
                <span key={tag} style={{ padding: "4px 12px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}20`, borderRadius: "100px", fontSize: "12px", color: theme.primary }}>{tag}</span>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "Min Tier", value: `${tier.emoji} ${tier.label}`, color: tier.color },
                { label: "Submissions", value: b.submissions, color: "#888" },
                { label: "Votes", value: b.votes, color: "#888" },
                { label: "Vote Weight", value: b.totalVoteWeight, color: theme.primary },
                { label: "Deadline", value: b.deadline, color: "#888" },
              ].map((m) => (
                <div key={m.label} style={{ padding: "12px", background: "#0a0a0f", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{m.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Risk Assessment */}
            {wallet && scoreData && (
              <div style={{
                padding: "14px 16px", marginBottom: "20px", borderRadius: "8px",
                background: `${riskData.color}10`, border: `1px solid ${riskData.color}30`,
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: riskData.color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🛡️ Your Risk Level: {riskData.level}
                </div>
                <div style={{ fontSize: "11px", color: "#999" }}>{riskData.label}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
              {wallet && (
                <button style={btnOutline} onClick={() => handleVote(b.id)}
                  onMouseEnter={(e) => e.target.style.background = `${theme.primary}10`}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  ▲ Upvote ({b.votes}) · Your weight: {voteWeight}x
                </button>
              )}
            </div>

            {wallet ? (
              eligible ? (
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Submit Work</h3>
                  <p style={{ fontSize: "11px", color: "#888", marginBottom: "12px" }}>
                    XP multiplier: {FairScoreAPI.getXpMultiplier(fairScore)}x · Reward bonus: +{rewardBonus}%
                  </p>
                  <textarea value={submissionText} onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Describe your submission, include links to your work..."
                    style={{ ...inputStyle, minHeight: "120px", resize: "vertical", marginBottom: "12px" }} />
                  <button style={btnPrimary} onClick={() => handleSubmit(b.id)}>
                    Submit (+{Math.floor(25 * FairScoreAPI.getXpMultiplier(fairScore))} XP)
                  </button>
                </div>
              ) : (
                <div style={{ padding: "20px", background: "#1a0a0a", border: "1px solid #ff004030", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#ff4040", fontWeight: "600", marginBottom: "4px" }}>🔒 Tier {b.minTier}+ Required</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>Your FairScore is Tier {fairScore}. Build more on-chain reputation to unlock this bounty.</div>
                </div>
              )
            ) : (
              <button style={btnPrimary} onClick={() => setView("connect")}>Connect Wallet to Submit</button>
            )}
          </div>

          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // POST BOUNTY
  // ============================================================
  if (view === "post") {
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Bounties" />

          <div style={fadeIn}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>Post a Bounty</h2>
            <p style={{ color: "#888", fontSize: "13px", marginBottom: "32px" }}>Flat listing fee: 50 USDC per bounty. 5% commission on completed rewards.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Title *</label>
                <input style={inputStyle} value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} placeholder="e.g. Build a DeFi Dashboard" />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Description *</label>
                <textarea style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} value={postForm.description} onChange={(e) => setPostForm({ ...postForm, description: e.target.value })} placeholder="Describe the bounty requirements..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Reward (USDC) *</label>
                  <input style={inputStyle} type="number" value={postForm.reward} onChange={(e) => setPostForm({ ...postForm, reward: e.target.value })} placeholder="500" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Min FairScore Tier</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={postForm.minTier} onChange={(e) => setPostForm({ ...postForm, minTier: Number(e.target.value) })}>
                    {Object.entries(TIER_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} Tier {k} - {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Tags (comma separated)</label>
                  <input style={inputStyle} value={postForm.tags} onChange={(e) => setPostForm({ ...postForm, tags: e.target.value })} placeholder="React, TypeScript, DeFi" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Deadline</label>
                  <input style={inputStyle} type="date" value={postForm.deadline} onChange={(e) => setPostForm({ ...postForm, deadline: e.target.value })} />
                </div>
              </div>
              <button style={{ ...btnPrimary, marginTop: "8px" }} onClick={handlePostBounty}>Post Bounty (50 USDC listing fee)</button>
            </div>
          </div>

          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // LEADERBOARD
  // ============================================================
  if (view === "leaderboard") {
    const leaders = [
      { rank: 1, name: "CryptoBuilder.sol", tier: 5, xp: 2450, bounties: 18, earned: "$45,200" },
      { rank: 2, name: "SolDev42.sol", tier: 4, xp: 1820, bounties: 12, earned: "$28,400" },
      { rank: 3, name: "RustWizard.sol", tier: 4, xp: 1650, bounties: 10, earned: "$21,000" },
      { rank: 4, name: "DeFiHacker.sol", tier: 3, xp: 980, bounties: 7, earned: "$9,100" },
      { rank: 5, name: "NFTArtisan.sol", tier: 3, xp: 750, bounties: 5, earned: "$4,800" },
      ...(wallet ? [{ rank: 6, name: wallet, tier: fairScore, xp, bounties: 0, earned: "$0" }] : []),
    ];
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Bounties" />

          <div style={fadeIn}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "24px" }}>🏆 Leaderboard</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {leaders.map((l) => {
                const t = TIER_CONFIG[l.tier];
                const isYou = l.name === wallet;
                return (
                  <div key={l.rank} style={{
                    ...cardStyle, padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px",
                    border: isYou ? `1px solid ${theme.primary}60` : cardStyle.border,
                    background: isYou ? `${theme.primary}10` : cardStyle.background,
                  }}>
                    <div style={{ width: "32px", textAlign: "center", fontWeight: "900", fontSize: "16px", color: l.rank <= 3 ? "#FFD700" : "#666" }}>
                      {l.rank <= 3 ? ["🥇", "🥈", "🥉"][l.rank - 1] : `#${l.rank}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>
                        {l.name} {isYou && <span style={{ color: theme.primary, fontSize: "11px" }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: "11px", color: t.color }}>{t.emoji} {t.label} · {l.bounties} bounties · {l.earned} earned</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: theme.primary }}>{l.xp} XP</div>
                      <div style={{ fontSize: "10px", color: "#666" }}>{t.xpMultiplier}x multiplier</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  return (
    <div style={pageStyle}>
      <div style={gridOverlay} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        {notification && (
          <div style={{
            position: "fixed", top: "20px", right: "20px", zIndex: 100, padding: "12px 20px",
            background: `linear-gradient(135deg, ${theme.primary}20, ${theme.accent}20)`,
            border: `1px solid ${theme.primary}40`, borderRadius: "8px", fontSize: "13px",
            color: theme.primary, fontWeight: "600", backdropFilter: "blur(10px)", animation: "slideIn 0.3s ease",
          }}>
            {notification}
          </div>
        )}

        <NavBar />
        <DemoBanner />

        {/* Referral */}
        {showReferral && wallet && fairScore >= 2 && (
          <div style={{ ...cardStyle, marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>🔗 Refer Friends → Earn XP</div>
              <div style={{ fontSize: "12px", color: "#888" }}>Share your link. +{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore))} XP for each signup (Tier {fairScore} bonus).</div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{ fontSize: "12px", padding: "6px 12px", background: "#0a0a0f", borderRadius: "6px", color: theme.primary }}>{referralLink}</code>
              <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }} onClick={() => { navigator.clipboard?.writeText(referralLink); notify("Link copied!"); }}>Copy</button>
            </div>
          </div>
        )}
        {showReferral && wallet && fairScore < 2 && (
          <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center", padding: "16px" }}>
            <div style={{ fontSize: "13px", color: "#F59E0B" }}>🔒 Referrals require Tier 2+. Your current tier: {fairScore}</div>
          </div>
        )}

        {/* Score Card */}
        {wallet && (
          <div style={{ ...cardStyle, marginBottom: "24px", ...fadeIn, transitionDelay: "0.1s" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px" }}>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>FairScore</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "28px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: TIER_CONFIG[fairScore]?.color }}>Tier {fairScore}</div>
                    <div style={{ fontSize: "12px", color: "#888" }}>{TIER_CONFIG[fairScore]?.label}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Platform XP</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.primary }}>{xp}</div>
                <div style={{ marginTop: "6px", height: "4px", background: "#1a1a2a", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (xp % 200) / 2)}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, borderRadius: "2px", transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>{FairScoreAPI.getXpMultiplier(fairScore)}x multiplier active</div>
              </div>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Max Bounty</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.accent }}>
                  {TIER_CONFIG[fairScore]?.maxBounty ? `$${TIER_CONFIG[fairScore].maxBounty.toLocaleString()}` : "Unlimited"}
                </div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>+{rewardBonus}% reward bonus</div>
              </div>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Risk Level</div>
                <div style={{ fontSize: "16px", fontWeight: "900", color: riskData.color }}>{riskData.level}</div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Vote weight: {FairScoreAPI.getVoteWeight(fairScore)}x</div>
              </div>
            </div>

            {/* On-chain stats from FairScore */}
            {scoreData && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15`, display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "11px", color: "#888" }}>
                <span>🕐 Wallet age: {scoreData.walletAge} days</span>
                <span>📊 Transactions: {scoreData.txCount}</span>
                <span>🔗 Protocols: {scoreData.protocolsUsed}</span>
                <span>🖼️ NFTs: {scoreData.nftHoldings}</span>
                {scoreData.defiActivity && <span style={{ color: theme.primary }}>✅ DeFi Active</span>}
              </div>
            )}
          </div>
        )}

        {/* Bounty Board Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px", flexWrap: "wrap", gap: "12px", ...fadeIn, transitionDelay: "0.2s",
        }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800" }}>Bounty Board</h2>
            <p style={{ fontSize: "12px", color: "#888" }}>{filteredBounties.length} bounties available</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }} onClick={() => setShowReferral(!showReferral)}>🔗 Refer</button>
            <select style={{ ...inputStyle, width: "auto", fontSize: "12px", padding: "8px 12px", cursor: "pointer" }}
              value={filterTier} onChange={(e) => setFilterTier(Number(e.target.value))}>
              <option value={0}>All Tiers</option>
              {Object.entries(TIER_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} Tier {k}</option>
              ))}
            </select>
            {wallet && (
              <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 16px" }} onClick={() => setView("post")}>+ Post Bounty</button>
            )}
          </div>
        </div>

        {/* Bounty List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", ...fadeIn, transitionDelay: "0.3s" }}>
          {filteredBounties.map((b) => {
            const tier = TIER_CONFIG[b.minTier];
            const eligible = wallet ? canClaim(b) : true;
            const bonus = wallet ? FairScoreAPI.getRewardBonus(fairScore) : 0;
            return (
              <div key={b.id} style={{ ...cardStyle, cursor: "pointer", opacity: eligible ? 1 : 0.5, position: "relative", overflow: "hidden" }}
                onClick={() => { setSelectedBounty(b); setView("bounty"); }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${theme.primary}30`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {!eligible && (
                  <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "11px", color: "#ff4040", padding: "2px 8px", background: "#ff004015", borderRadius: "4px" }}>🔒 Locked</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>{b.project}</div>
                    <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>{b.title}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {b.tags.map((tag) => (
                        <span key={tag} style={{ padding: "2px 8px", background: `${theme.primary}10`, borderRadius: "4px", fontSize: "11px", color: `${theme.primary}BB` }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: theme.primary }}>{b.reward} {b.currency}</div>
                    {bonus > 0 && eligible && <div style={{ fontSize: "10px", color: theme.accent }}>+{bonus}% bonus</div>}
                    <div style={{ fontSize: "11px", color: tier.color, marginTop: "4px" }}>{tier.emoji} Tier {b.minTier}+</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "11px", color: "#666" }}>
                  <span>📝 {b.submissions} submissions</span>
                  <span>▲ {b.votes} votes ({b.totalVoteWeight} weighted)</span>
                  <span>⏰ {b.deadline}</span>
                </div>
              </div>
            );
          })}
        </div>

        <Footer />
      </div>
      <style>{globalStyles}</style>
    </div>
  );
}
