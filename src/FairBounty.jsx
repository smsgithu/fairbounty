import { useState, useEffect, useCallback, useMemo } from "react";
import { getWallets } from "@wallet-standard/app";

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
  { id: 1, title: "Build Token-Gated Discord Bot", project: "SolanaFM", reward: 800, currency: "USDC", minTier: 3, tags: ["Bot", "Discord", "TypeScript"], submissions: 4, deadline: "2026-02-20", description: "Create a Discord bot that gates channels based on token holdings with real-time verification.", status: "open" },
  { id: 2, title: "Design Landing Page for NFT Collection", project: "Tensor", reward: 200, currency: "USDC", minTier: 2, tags: ["Design", "Frontend", "React"], submissions: 7, deadline: "2026-02-15", description: "Design and implement a responsive landing page for an upcoming NFT collection launch.", status: "open" },
  { id: 3, title: "Smart Contract Audit - Staking Program", project: "Marinade", reward: 3000, currency: "USDC", minTier: 4, tags: ["Rust", "Audit", "Security"], submissions: 1, deadline: "2026-03-01", description: "Full security audit of a Solana staking program written in Anchor/Rust.", status: "open" },
  { id: 4, title: "Create Educational Thread on Compressed NFTs", project: "Metaplex", reward: 75, currency: "USDC", minTier: 1, tags: ["Content", "Education", "cNFTs"], submissions: 12, deadline: "2026-02-12", description: "Write a comprehensive Twitter thread explaining compressed NFTs for beginners.", status: "open" },
  { id: 5, title: "Build Analytics Dashboard for DeFi Protocol", project: "Jupiter", reward: 4500, currency: "USDC", minTier: 5, tags: ["Frontend", "Data", "DeFi"], submissions: 0, deadline: "2026-03-15", description: "Full-stack analytics dashboard showing real-time protocol metrics, TVL, and user activity.", status: "open" },
  { id: 6, title: "Write Integration Guide for Wallet Adapter", project: "Solana Labs", reward: 150, currency: "USDC", minTier: 2, tags: ["Docs", "Tutorial", "TypeScript"], submissions: 3, deadline: "2026-02-18", description: "Step-by-step developer guide for integrating Solana Wallet Adapter into a React application.", status: "open" },
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
// FairScore API Integration — LIVE via FairScale API
// Proxied through /api/fairscore to keep API key server-side
// Docs: https://docs.fairscale.xyz
// ============================================================

// Map FairScale tier names to our 1-5 tier system
const FAIRSCALE_TIER_MAP = {
  unranked: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
};

const FairScoreAPI = {
  // Fetch reputation data for a wallet address via our serverless proxy
  async getScore(walletAddress) {
    try {
      const response = await fetch(`/api/fairscore?wallet=${encodeURIComponent(walletAddress)}`);

      if (!response.ok) {
        console.error("FairScore proxy error:", response.status);
        return null;
      }

      const data = await response.json();

      // Map FairScale response to our internal format
      const tier = FAIRSCALE_TIER_MAP[data.tier] || 1;

      return {
        tier,
        score: Math.round(data.fairscore || 0),
        fairscoreBase: data.fairscore_base || 0,
        socialScore: data.social_score || 0,
        fairscaleTier: data.tier || "unranked",
        badges: data.badges || [],
        actions: data.actions || [],
        // Map features to our display fields
        walletAge: data.features?.wallet_age_score || 0,
        txCount: data.features?.tx_count || 0,
        protocolsUsed: data.features?.platform_diversity || 0,
        activeDays: data.features?.active_days || 0,
        nativesolPercentile: data.features?.native_sol_percentile || 0,
        lstPercentile: data.features?.lst_percentile_score || 0,
        stablePercentile: data.features?.stable_percentile_score || 0,
        convictionRatio: data.features?.conviction_ratio || 0,
        noInstantDumps: data.features?.no_instant_dumps || 0,
        netSolFlow30d: data.features?.net_sol_flow_30d || 0,
        _raw: data, // Keep raw response for debugging
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

  // Get BXP multiplier for tier
  getXpMultiplier(tier) {
    return TIER_CONFIG[tier]?.xpMultiplier || 1.0;
  },
};

export default function FairBounty() {
  // ============================================================
  // ACCESS CONTROL & BADGES
  // Everyone can connect + make a profile + browse
  // Whitelist = tester badges and future feature access
  // ============================================================
  const WHITELIST = [
    "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD", // Sean — Founder
  ];

  // Platform badges (separate from FairScale badges)
  const PLATFORM_BADGES = {
    "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD": [
      { id: "founder", label: "Founder", color: "#FFD700", bg: "#FFD70015", border: "#FFD70040" },
    ],
  };

  const isWhitelisted = (addr) => WHITELIST.includes(addr);

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
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [standardWallets, setStandardWallets] = useState([]);
  const [fullAddress, setFullAddress] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    displayName: "", xHandle: "", bio: "", contact: "", email: "",
    pfpUrl: "", linkedin: "", github: "", website: "", telegram: "", discord: "",
    lookingFor: "", worksAt: "", location: "",
    skills: [],
  });
  const [bookmarks, setBookmarks] = useState([]);
  const [profileTab, setProfileTab] = useState("overview");
  const [setupTab, setSetupTab] = useState("Basics");
  const [activeStep, setActiveStep] = useState(0);
  const [activeTier, setActiveTier] = useState(null);
  const [bountyApplications, setBountyApplications] = useState(() => {
    try {
      const saved = localStorage.getItem("fb_bounty_applications");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [bountyForm, setBountyForm] = useState({
    projectName: "", title: "", description: "", reward: "", currency: "USDC",
    minTier: 1, deadline: "", category: "", contactMethod: "", contactValue: "",
  });
  const [connectedWallets, setConnectedWallets] = useState(() => {
    try {
      const saved = localStorage.getItem("fb_connected_wallets");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [referredBy, setReferredBy] = useState(null);
  const [referralCount, setReferralCount] = useState(0);
  const [bxpBreakdown, setBxpBreakdown] = useState({ welcome: 0, referrals: 0, referred: 0, submissions: 0, wins: 0 });

  // Detect referral code from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && ref.length >= 32) {
        setReferredBy(ref);
        // Clean URL without reload
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (e) {}
  }, []);

  // Detect iOS for deep links
  const isIOS = useMemo(() => /iPhone|iPad|iPod/i.test(navigator.userAgent), []);
  const isMobile = useMemo(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), []);

  // Initialize wallet-standard detection (same as SMSai)
  useEffect(() => {
    const { get, on } = getWallets();
    setStandardWallets(get());
    const removeListener = on("register", () => setStandardWallets(get()));
    return () => removeListener();
  }, []);

  // Wallet options matching SMSai pattern
  const walletOptions = useMemo(() => [
    {
      id: "jupiter", name: "Jupiter", useStandard: true,
      mobileLink: isIOS
        ? "jupiter://browse/https://fairbounty.vercel.app"
        : "intent://browse/https://fairbounty.vercel.app#Intent;scheme=jupiter;package=ag.jup.jupiter.android;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dag.jup.jupiter.android;end",
      downloadUrl: "https://chromewebstore.google.com/detail/jupiter-wallet/iledlaeogohbilgbfhmbgkgmpplbfboh",
    },
    {
      id: "phantom", name: "Phantom", window: "solana", check: (w) => w?.isPhantom,
      mobileLink: `https://phantom.app/ul/browse/${encodeURIComponent("https://fairbounty.vercel.app")}?ref=${encodeURIComponent("https://fairbounty.vercel.app")}`,
      downloadUrl: "https://phantom.app/",
    },
    {
      id: "solflare", name: "Solflare", window: "solflare", check: (w) => !!w,
      mobileLink: `https://solflare.com/ul/v1/browse/${encodeURIComponent("https://fairbounty.vercel.app")}?ref=${encodeURIComponent("https://fairbounty.vercel.app")}`,
      downloadUrl: "https://solflare.com/",
    },
    {
      id: "backpack", name: "Backpack", window: "backpack", check: (w) => w?.isBackpack || (w && typeof w.connect === "function"),
      mobileLink: `https://backpack.app/ul/v1/browse/${encodeURIComponent("https://fairbounty.vercel.app")}?ref=${encodeURIComponent("https://fairbounty.vercel.app")}`,
      downloadUrl: "https://backpack.app/",
    },
    {
      id: "glow", name: "Glow", window: "glow", check: (w) => !!w,
      downloadUrl: "https://glow.app/",
    },
  ], [isIOS]);

  const SKILL_CATEGORIES = {
    Development: ["Rust", "TypeScript", "React", "Solidity", "Anchor", "Node.js", "Python", "Frontend", "Backend", "Full-Stack", "Smart Contracts"],
    Design: ["UI/UX", "Graphic Design", "Figma", "Branding", "Web Design", "Motion Graphics"],
    Community: ["Community Manager", "Moderator", "Ambassador", "Events", "Partnerships"],
    Content: ["Writing", "Video", "Social Media", "Documentation", "Education", "Threads"],
    Growth: ["Marketing", "SEO", "Analytics", "Business Development", "Growth Hacking"],
    Security: ["Auditing", "Pen Testing", "Code Review", "Security Research"],
    Other: ["Product Management", "Project Management", "Data Analysis", "Research", "Consulting"],
  };

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

    const opt = walletOptions.find((w) => w.id === type);
    if (!opt) { setLoading(false); return; }

    try {
      let pubkey = null;

      // 1. Try wallet-standard (Jupiter, etc)
      if (opt.useStandard) {
        const stdWallet = standardWallets.find((w) =>
          w.name?.toLowerCase().includes(opt.name.toLowerCase())
        );
        if (stdWallet) {
          const connectFeature = stdWallet.features?.["standard:connect"];
          if (connectFeature) {
            const result = await connectFeature.connect();
            const account = result?.accounts?.[0] || stdWallet.accounts?.[0];
            if (account?.address) {
              pubkey = account.address;
            } else if (account?.publicKey) {
              // publicKey is a Uint8Array, encode as base58
              pubkey = encodeBase58(account.publicKey);
            }
          }
        }
      }

      // 2. Try window provider (Phantom, Solflare, Backpack, Glow)
      if (!pubkey && opt.window) {
        const provider = window[opt.window];
        if (provider && (!opt.check || opt.check(provider))) {
          const resp = await provider.connect();
          pubkey = resp?.publicKey?.toString() || provider.publicKey?.toString();
        }
      }

      // 3. Mobile deep link fallback
      if (!pubkey && isMobile && opt.mobileLink) {
        window.location.href = opt.mobileLink;
        setLoading(false);
        return;
      }

      // 4. Desktop — wallet not installed, open download
      if (!pubkey && !isMobile && opt.downloadUrl) {
        notify(`${opt.name} not detected. Opening download page...`);
        window.open(opt.downloadUrl, "_blank");
        setLoading(false);
        return;
      }

      // Got a real public key — finish connect
      if (pubkey) {
        const displayAddr = pubkey.length > 20
          ? pubkey.slice(0, 6) + "..." + pubkey.slice(-4)
          : pubkey;
        setWallet(displayAddr);
        setFullAddress(pubkey);

        // Track unique wallet connection
        try {
          const wallets = JSON.parse(localStorage.getItem("fb_connected_wallets") || "[]");
          if (!wallets.includes(pubkey)) {
            wallets.push(pubkey);
            localStorage.setItem("fb_connected_wallets", JSON.stringify(wallets));
            setConnectedWallets(wallets);
          }
        } catch (e) {}

        const data = await FairScoreAPI.getScore(pubkey);
        if (data) {
          setFairScore(data.tier);
          setScoreData(data);
          setXp(Math.floor(data.score / 2));
          notify(`Connected via ${WALLET_THEMES[type]?.name || opt.name}! FairScore: Tier ${data.tier} (${TIER_CONFIG[data.tier].label}) — ${data.fairscaleTier}`);
        }

        // Restore saved profile for this wallet
        try {
          const saved = localStorage.getItem(`fb_profile_${pubkey}`);
          if (saved) {
            const p = JSON.parse(saved);
            setProfile(p);
            setProfileForm({
              displayName: p.displayName || "", xHandle: p.xHandle || "", bio: p.bio || "",
              contact: p.contact || "", email: p.email || "", pfpUrl: p.pfpUrl || "",
              linkedin: p.linkedin || "", github: p.github || "", website: p.website || "",
              telegram: p.telegram || "", discord: p.discord || "", lookingFor: p.lookingFor || "",
              worksAt: p.worksAt || "", location: p.location || "", skills: p.skills || [],
            });
            const savedBookmarks = localStorage.getItem(`fb_bookmarks_${pubkey}`);
            if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
            // Restore BXP data
            const savedBxp = localStorage.getItem(`fb_bxp_${pubkey}`);
            if (savedBxp) {
              const bxp = JSON.parse(savedBxp);
              setBxpBreakdown(bxp);
              setXp(Object.values(bxp).reduce((a, b) => a + b, 0));
            }
            const savedRefs = localStorage.getItem(`fb_referrals_${pubkey}`);
            if (savedRefs) setReferralCount(JSON.parse(savedRefs).length);
            setLoading(false);
            setView("dashboard");
            return;
          }
        } catch (e) { /* localStorage not available */ }

        setLoading(false);
        setView("profile-setup");
        return;
      }

      // No wallet found — demo fallback
      notify("No wallet detected — using demo mode.");
      const demoAddr = "F" + Array.from({ length: 8 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]
      ).join("") + "...";
      setWallet(demoAddr);
      const data = await FairScoreAPI.getScore(demoAddr);
      if (data) {
        setFairScore(data.tier);
        setScoreData(data);
        setXp(Math.floor(data.score / 2));
      }
      setLoading(false);
      setView("profile-setup");

    } catch (err) {
      console.log("Wallet connect error:", err.message);
      notify("Connection failed — using demo mode.");
      const demoAddr = "F" + Array.from({ length: 8 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]
      ).join("") + "...";
      setWallet(demoAddr);
      const data = await FairScoreAPI.getScore(demoAddr);
      if (data) {
        setFairScore(data.tier);
        setScoreData(data);
        setXp(Math.floor(data.score / 2));
      }
      setLoading(false);
      setView("profile-setup");
    }
  };

  // Simple base58 encoder for Uint8Array public keys
  const encodeBase58 = (bytes) => {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "";
    let num = BigInt("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
    while (num > 0n) {
      result = ALPHABET[Number(num % 58n)] + result;
      num = num / 58n;
    }
    for (const b of bytes) { if (b === 0) result = "1" + result; else break; }
    return result;
  };

  const handleProfileSave = () => {
    if (!profileForm.displayName.trim()) {
      notify("Display name is required.");
      return;
    }
    const handle = profileForm.xHandle.replace(/^@/, "");
    const profileData = {
      displayName: profileForm.displayName.trim(),
      xHandle: handle,
      bio: profileForm.bio.trim(),
      contact: profileForm.contact.trim(),
      email: profileForm.email.trim(),
      pfpUrl: profileForm.pfpUrl.trim(),
      linkedin: profileForm.linkedin.trim(),
      github: profileForm.github.trim(),
      website: profileForm.website.trim(),
      telegram: profileForm.telegram.trim(),
      discord: profileForm.discord.trim(),
      lookingFor: profileForm.lookingFor,
      worksAt: profileForm.worksAt.trim(),
      location: profileForm.location.trim(),
      skills: profileForm.skills || [],
      joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    };
    setProfile(profileData);

    // Persist to localStorage
    if (fullAddress) {
      try {
        localStorage.setItem(`fb_profile_${fullAddress}`, JSON.stringify(profileData));
      } catch (e) { /* storage full or unavailable */ }
    }

    // BXP REWARDS
    const multiplier = FairScoreAPI.getXpMultiplier(fairScore || 1);
    let newBxp = { ...bxpBreakdown };
    let bonusMessages = [];

    // Welcome bonus (only first time — check if already claimed)
    const alreadyClaimed = localStorage.getItem(`fb_welcome_${fullAddress}`);
    if (!alreadyClaimed && fullAddress) {
      const welcomeAmount = Math.floor(100 * multiplier);
      newBxp.welcome = welcomeAmount;
      bonusMessages.push(`+${welcomeAmount} BXP welcome bonus`);
      try { localStorage.setItem(`fb_welcome_${fullAddress}`, "1"); } catch (e) {}
    }

    // Referred bonus — you get 50 BXP for signing up via someone's link
    if (referredBy && referredBy !== fullAddress && !localStorage.getItem(`fb_was_referred_${fullAddress}`)) {
      const referredAmount = Math.floor(50 * multiplier);
      newBxp.referred = referredAmount;
      bonusMessages.push(`+${referredAmount} BXP referral bonus`);
      try {
        localStorage.setItem(`fb_was_referred_${fullAddress}`, referredBy);
        // Credit the referrer
        const referrerRefs = JSON.parse(localStorage.getItem(`fb_referrals_${referredBy}`) || "[]");
        if (!referrerRefs.includes(fullAddress)) {
          referrerRefs.push(fullAddress);
          localStorage.setItem(`fb_referrals_${referredBy}`, JSON.stringify(referrerRefs));
          // Add BXP to referrer's breakdown
          const referrerBxp = JSON.parse(localStorage.getItem(`fb_bxp_${referredBy}`) || '{"welcome":0,"referrals":0,"referred":0,"submissions":0,"wins":0}');
          const referrerMultiplier = FairScoreAPI.getXpMultiplier(fairScore || 1); // approximate
          referrerBxp.referrals += Math.floor(50 * referrerMultiplier);
          localStorage.setItem(`fb_bxp_${referredBy}`, JSON.stringify(referrerBxp));
        }
      } catch (e) {}
    }

    // Save BXP breakdown
    setBxpBreakdown(newBxp);
    const totalBxp = Object.values(newBxp).reduce((a, b) => a + b, 0);
    setXp(totalBxp);
    if (fullAddress) {
      try { localStorage.setItem(`fb_bxp_${fullAddress}`, JSON.stringify(newBxp)); } catch (e) {}
    }

    // Load referral count
    if (fullAddress) {
      try {
        const refs = JSON.parse(localStorage.getItem(`fb_referrals_${fullAddress}`) || "[]");
        setReferralCount(refs.length);
      } catch (e) {}
    }

    const bonusText = bonusMessages.length > 0 ? ` ${bonusMessages.join(" · ")}` : "";
    notify(`Welcome, ${profileForm.displayName}!${bonusText}`);

    // Show BXP welcome guide if first time
    const seenWelcome = localStorage.getItem(`fb_seen_welcome_${fullAddress}`);
    if (!seenWelcome) {
      setShowWelcomeModal(true);
    }

    setView("dashboard");
  };

  const toggleSkill = (skill) => {
    setProfileForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const toggleBookmark = (bountyId) => {
    setBookmarks((prev) => {
      const updated = prev.includes(bountyId) ? prev.filter((id) => id !== bountyId) : [...prev, bountyId];
      if (fullAddress) {
        try { localStorage.setItem(`fb_bookmarks_${fullAddress}`, JSON.stringify(updated)); } catch (e) {}
      }
      return updated;
    });
  };

  const canClaim = (bounty) => fairScore >= bounty.minTier;

  const handleSubmit = (bountyId) => {
    setShowDemoModal(true);
    return;
  };

  const handleVote = (bountyId) => {
    setShowDemoModal(true);
    return;
  };

  const handlePostBounty = () => {
    setShowDemoModal(true);
    return;
  };

  const referralLink = fullAddress ? `https://fairbounty.vercel.app?ref=${fullAddress}` : "";
  const filteredBounties = filterTier > 0 ? bounties.filter((b) => b.minTier === filterTier) : bounties;
  const riskData = FairScoreAPI.assessRisk(scoreData);
  const rewardBonus = FairScoreAPI.getRewardBonus(fairScore);

  // Shared styles — liquid glass / modern minimal
  const pageStyle = {
    minHeight: "100vh",
    background: `linear-gradient(160deg, #050508 0%, ${theme.bg}40 30%, #08080c 60%, #0a0a10 100%)`,
    color: "#E8E8ED",
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
    WebkitFontSmoothing: "antialiased",
  };
  const gridOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `radial-gradient(circle at 20% 50%, ${theme.primary}06 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${theme.accent}04 0%, transparent 40%)`,
    pointerEvents: "none", zIndex: 0,
  };
  const cardStyle = {
    background: `rgba(255,255,255,0.03)`,
    border: `1px solid rgba(255,255,255,0.06)`,
    borderRadius: "16px", padding: "20px",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: `0 0 0 0.5px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.3)`,
  };
  const glassCard = {
    ...cardStyle,
    background: `linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`,
    border: `1px solid rgba(255,255,255,0.08)`,
    boxShadow: `0 0 0 0.5px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
  };
  const btnPrimary = {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
    border: "none", borderRadius: "12px", padding: "12px 28px", color: "#0a0a0f",
    fontWeight: "600", fontFamily: "inherit", cursor: "pointer", fontSize: "14px",
    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: `0 2px 12px ${theme.primary}30`,
    letterSpacing: "-0.01em",
  };
  const btnOutline = {
    background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: "12px",
    padding: "10px 20px", color: "#ccc", fontFamily: "inherit", cursor: "pointer",
    fontSize: "13px", transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    fontWeight: "500", letterSpacing: "-0.01em",
    backdropFilter: "blur(10px)",
  };
  const inputStyle = {
    background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: "12px",
    padding: "14px 18px", color: "#E8E8ED", fontFamily: "inherit", fontSize: "14px",
    width: "100%", boxSizing: "border-box", outline: "none",
    transition: "border-color 0.2s ease",
    letterSpacing: "-0.01em",
  };
  const fadeIn = animateIn
    ? { opacity: 1, transform: "translateY(0)", transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }
    : { opacity: 0, transform: "translateY(16px)" };

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes glow { 0%, 100% { box-shadow: 0 0 20px ${theme.primary}10; } 50% { box-shadow: 0 0 40px ${theme.primary}20; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
    ::selection { background: ${theme.primary}30; color: white; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    select option { background: #111; color: #E8E8ED; }
    input:focus, textarea:focus, select:focus { border-color: ${theme.primary}60 !important; }
    a { transition: opacity 0.2s ease; }
    a:hover { opacity: 0.8; }
    button:hover { transform: translateY(-1px); }
    button:active { transform: translateY(0); }
  `;

  // Demo banner
  const DemoBanner = () => (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid rgba(255,255,255,0.06)`, borderRadius: "12px",
      padding: "10px 16px", marginBottom: "16px", textAlign: "center",
      fontSize: "12px", color: "rgba(255,255,255,0.4)",
      backdropFilter: "blur(10px)", letterSpacing: "-0.01em",
    }}>
      <span style={{ color: "#22C55E", fontWeight: "500" }}>✅ Live:</span> FairScore · BXP · Referrals · Wallet Count{" "}
      <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>{" "}
      <span style={{ color: "#F59E0B", fontWeight: "500" }}>⏳ Demo:</span> Bounty listings are examples{" "}
      <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>{" "}
      <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontWeight: "500" }}>Powered by FairScale</a>
    </div>
  );

  // Demo modal overlay
  const DemoModal = () => showDemoModal ? (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }} onClick={() => setShowDemoModal(false)}>
      <div style={{
        ...glassCard, maxWidth: "420px", width: "100%", padding: "36px",
        textAlign: "center", animation: "slideIn 0.3s ease",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🚧</div>
        <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px", letterSpacing: "-0.03em" }}>Demo Mode</h3>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7", marginBottom: "24px" }}>
          This action isn't available yet. Wallet connection, FairScore, BXP, and referrals are live.
          Bounty submissions and voting are coming soon.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button style={btnPrimary} onClick={() => setShowDemoModal(false)}>Got it</button>
          <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer"
            style={{ ...btnOutline, textDecoration: "none", display: "flex", alignItems: "center" }}>Follow @smsonx</a>
        </div>
      </div>
    </div>
  ) : null;

  // BXP Welcome Modal — shows on first connect
  const WelcomeModal = () => showWelcomeModal ? (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", overflowY: "auto",
    }}>
      <div style={{
        ...glassCard, maxWidth: "520px", width: "100%", padding: "40px",
        animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>⭐</div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "6px", letterSpacing: "-0.04em" }}>
            Welcome to FairBounty
          </h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Here's how BXP works</p>
        </div>

        {/* What is BXP */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: theme.primary, marginBottom: "8px" }}>What is BXP?</h3>
          <p style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.7" }}>
            BXP (Bounty Experience) measures your activity on FairBounty. It's earned through actions on the platform and multiplied by your FairScore tier. The more on-chain reputation you have, the faster you earn.
          </p>
        </div>

        {/* How to earn */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: theme.primary, marginBottom: "10px" }}>How to Earn BXP</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "🎁", action: "Profile Setup", amount: "100 BXP", note: "one-time welcome bonus", color: "#22C55E" },
              { icon: "🔗", action: "Refer a Friend", amount: "50 BXP", note: "you AND your friend both earn", color: "#3B82F6" },
              { icon: "📝", action: "Submit Work", amount: "25 BXP", note: "per bounty submission", color: "#8B5CF6" },
              { icon: "🏆", action: "Win a Bounty", amount: "100 BXP", note: "plus the reward payout", color: "#F59E0B" },
            ].map((item) => (
              <div key={item.action} style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px",
                background: "#0a0a0f", borderRadius: "8px", border: `1px solid ${item.color}20`,
              }}>
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{item.action}</span>
                  <span style={{ fontSize: "11px", color: "#666", marginLeft: "6px" }}>— {item.note}</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: item.color }}>{item.amount}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "#666", marginTop: "8px", textAlign: "center" }}>
            All BXP amounts are multiplied by your tier: Tier 1 = 1x, Tier 2 = 1.25x, Tier 3 = 1.5x, Tier 4 = 2x, Tier 5 = 3x
          </p>
        </div>

        {/* Your status */}
        {fairScore && (
          <div style={{
            padding: "14px", background: `${theme.primary}10`, borderRadius: "8px",
            border: `1px solid ${theme.primary}20`, marginBottom: "20px", textAlign: "center",
          }}>
            <span style={{ fontSize: "20px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
            <span style={{ fontSize: "14px", fontWeight: "700", marginLeft: "8px" }}>
              You're Tier {fairScore} ({TIER_CONFIG[fairScore]?.label})
            </span>
            <span style={{ fontSize: "12px", color: "#888", marginLeft: "8px" }}>
              {TIER_CONFIG[fairScore]?.xpMultiplier}x BXP multiplier active
            </span>
          </div>
        )}

        {/* Quick start */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: theme.primary, marginBottom: "8px" }}>Quick Start</h3>
          <div style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.8" }}>
            1. ✅ <span style={{ color: "#22C55E" }}>Profile created — 100 BXP earned!</span><br />
            2. 🔗 Share your referral link to earn 50 BXP per signup<br />
            3. 📋 Browse example bounties to see what's coming<br />
            4. 📈 Build on-chain activity to raise your FairScore tier
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button style={{ ...btnPrimary, padding: "12px 28px", fontSize: "14px" }} onClick={() => {
            setShowWelcomeModal(false);
            try { localStorage.setItem(`fb_seen_welcome_${fullAddress}`, "1"); } catch (e) {}
          }}>
            Let's Go →
          </button>
        </div>
        <button onClick={() => {
          setShowWelcomeModal(false);
          try { localStorage.setItem(`fb_seen_welcome_${fullAddress}`, "1"); } catch (e) {}
        }} style={{
          background: "none", border: "none", color: "#555", cursor: "pointer",
          fontSize: "12px", fontFamily: "inherit", marginTop: "12px", width: "100%", textAlign: "center",
        }}>
          Don't show this again
        </button>
      </div>
    </div>
  ) : null;

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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => setView("landing")}>
          <Logo size={24} />
          <span style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.03em" }}>FairBounty</span>
          <span style={{ fontSize: "8px", fontWeight: "600", color: theme.primary, background: `${theme.primary}15`, padding: "2px 8px", borderRadius: "100px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Beta</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
        {[
          { label: "Bounties", view: wallet && profile ? "dashboard" : "landing" },
          { label: "Post a Bounty", view: "post-bounty" },
          { label: "How It Works", view: "how-it-works" },
          { label: "About", view: "about" },
          { label: "🏆", view: "leaderboard" },
        ].map((tab) => (
          <button key={tab.label} style={{
            background: view === tab.view ? `rgba(255,255,255,0.08)` : "transparent",
            border: "none", borderRadius: "10px",
            padding: "7px 14px", color: view === tab.view ? "#fff" : "rgba(255,255,255,0.45)",
            fontFamily: "inherit", cursor: "pointer", fontSize: "12px", fontWeight: "500",
            transition: "all 0.2s ease", letterSpacing: "-0.01em",
          }} onClick={() => setView(tab.view)}>{tab.label}</button>
        ))}
        {wallet && profile && (
          <button style={{
            background: view === "profile" ? `rgba(255,255,255,0.08)` : "transparent",
            border: "none", borderRadius: "10px", padding: "7px 12px",
            color: view === "profile" ? "#fff" : "rgba(255,255,255,0.45)",
            fontFamily: "inherit", cursor: "pointer", fontSize: "12px",
            transition: "all 0.2s ease",
          }} onClick={() => setView("profile")}>👤</button>
        )}
        {wallet ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "6px 14px",
            background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: "12px", fontSize: "12px", cursor: profile ? "pointer" : "default",
            backdropFilter: "blur(10px)", marginLeft: "4px",
          }} onClick={() => profile && setView("profile")}>
            <span style={{ color: TIER_CONFIG[fairScore]?.color }}>{TIER_CONFIG[fairScore]?.emoji}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: "500" }}>{profile ? profile.displayName : wallet}</span>
            {fullAddress && PLATFORM_BADGES[fullAddress] && (
              <span style={{ fontSize: "9px", fontWeight: "600", color: "#FFD700", background: "rgba(255,215,0,0.1)", padding: "2px 8px", borderRadius: "100px" }}>★ Founder</span>
            )}
            <span style={{ color: theme.primary, fontWeight: "600", fontSize: "11px" }}>{xp} BXP</span>
            <button onClick={(e) => { e.stopPropagation(); setWallet(null); setFullAddress(null); setWalletType("default"); setFairScore(null); setScoreData(null); setXp(0); setProfile(null); setProfileForm({ displayName: "", xHandle: "", bio: "", contact: "", email: "", pfpUrl: "", linkedin: "", github: "", website: "", telegram: "", discord: "", lookingFor: "", worksAt: "", location: "", skills: [] }); setBookmarks([]); setView("landing"); }}
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
      marginTop: "60px", paddingTop: "32px", borderTop: `1px solid rgba(255,255,255,0.06)`,
      display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "16px",
      fontSize: "12px", color: "rgba(255,255,255,0.3)", paddingBottom: "32px",
    }}>
      <div style={{ display: "flex", gap: "20px" }}>
        <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>built by @smsonx</a>
        <a href="https://smsai.fun" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>smsai.fun</a>
        <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>FairScale</a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Logo size={14} />
          <span style={{ letterSpacing: "-0.02em" }}>FairBounty © 2026</span>
        </div>
        <a href="https://smsai.fun" target="_blank" rel="noopener noreferrer" style={{
          color: "rgba(255,255,255,0.25)", textDecoration: "none", fontSize: "11px",
          letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: "500",
        }}>
          A <span style={{ color: theme.primary, fontWeight: "600" }}>Solana Made Simple</span> product
        </a>
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
          <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>Querying FairScale API</div>
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
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#0a0a0f", background: theme.primary, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Beta</span>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <button style={{ ...btnOutline, fontSize: "12px", padding: "6px 14px" }} onClick={() => setView("about")}>About</button>
                <button style={{ ...btnOutline, fontSize: "12px", padding: "6px 14px" }} onClick={() => setView("how-it-works")}>How It Works</button>
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
                { value: connectedWallets.length.toString(), label: "Connected Wallets", live: true },
                { value: "0", label: "Bounties Posted", live: true },
                { value: "0", label: "Submissions", live: true },
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
                  { icon: "⚖️", title: "Community Review", desc: "Submissions are upvoted/downvoted by the community. Higher-tier wallets carry more influence. Client picks the winner from top-voted work." },
                  { icon: "💎", title: "Dynamic Rewards", desc: "Earn bonus rewards on completed bounties. Up to +25% bonus USDC for Tier 5 Legends." },
                  { icon: "🛡️", title: "Risk Management", desc: "Every wallet gets a risk assessment based on FairScore. Projects can filter low-reputation submissions." },
                  { icon: "⚡", title: "BXP Multipliers", desc: "Higher tiers earn BXP faster. Tier 5 earns 3x BXP per action. Build reputation to build reputation." },
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
                      {["Tier", "Max Bounty", "BXP Multiplier", "Reward Bonus"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#888", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(TIER_CONFIG).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: `1px solid ${theme.primary}10` }}>
                        <td style={{ padding: "10px 8px", color: v.color, fontWeight: "700" }}>{v.emoji} Tier {k} — {v.label}</td>
                        <td style={{ padding: "10px 8px" }}>{v.maxBounty ? `$${v.maxBounty.toLocaleString()}` : "Unlimited"}</td>
                        <td style={{ padding: "10px 8px" }}>{v.xpMultiplier}x</td>
                        <td style={{ padding: "10px 8px", color: theme.primary }}>+{v.rewardBonus}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          "Community Review — Submissions are upvoted/downvoted Reddit-style. Higher tiers have more influence. Client picks winner from top-voted work.",
          "Dynamic Rewards — Tier-based bonus rewards up to +25% on completed bounties.",
          "Risk Assessment — Every wallet gets a risk score. Projects see trustworthiness at a glance.",
          "BXP Multipliers — Higher tiers earn BXP 1x–3x faster, accelerating reputation growth.",
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
          "First 1,000 — Referral program with BXP rewards. Partner with Superteam, Solana Foundation, and hackathon organizers.",
          "First 10,000 — Expand to multi-chain via FairScale's cross-chain reputation. Integrate with DAOs for governance-linked bounties.",
          "Ongoing — Content marketing (build-in-public threads), ecosystem partnerships, and community-driven bounty curation.",
        ],
      },
      {
        title: "🏗️ Technical Architecture",
        items: [
          "Frontend — React + Vite + Tailwind, deployed on Vercel.",
          "Backend — Node.js serverless functions for bounty management.",
          "Database — PostgreSQL (Neon) for bounties, submissions, BXP, and user data.",
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
  // HOW IT WORKS
  // ============================================================
  if (view === "how-it-works") {

    const howSteps = [
      {
        num: "01", icon: "🔗", title: "Connect Your Wallet",
        desc: "Connect your Solana wallet to FairBounty. We automatically fetch your FairScore from the FairScale API — no extra steps. Your on-chain history determines your tier (1–5), which unlocks bounties, perks, and earning potential.",
        details: ["Jupiter, Phantom, Solflare, Backpack, Glow supported", "FairScore fetched automatically on connect", "Set up your profile — display name, skills, socials", "Your profile persists across sessions"],
      },
      {
        num: "02", icon: "🎯", title: "Find & Claim Bounties",
        desc: "Browse the bounty board. Each bounty has a minimum tier requirement — you can only claim bounties your FairScore qualifies you for. Higher tier = access to bigger, more valuable bounties.",
        details: ["Filter bounties by tier, tags, reward amount", "Bookmark bounties to save for later", "See how many submissions each bounty has", "Locked bounties show what tier you need"],
      },
      {
        num: "03", icon: "⚖️", title: "Community Reviews Submissions",
        desc: "Once contributors submit work, the community votes on submissions Reddit-style — upvote good work, downvote low effort. Your tier determines how much your vote counts. The client then picks the winner from the top-voted submissions. This keeps things fair: the community surfaces the best work, and the client makes the final call.",
        details: ["Upvote/downvote submissions like Reddit", "Higher-tier wallets have more voting influence", "Client picks the winner from top-ranked submissions", "No single person controls the outcome"],
      },
      {
        num: "04", icon: "💰", title: "Submit & Earn",
        desc: "Complete bounties, refer friends, and build your BXP (Bounty Experience). BXP tracks your total platform activity — the more you contribute, the more you earn.",
        details: [
          "🎁 Welcome bonus: 100 BXP × tier multiplier (first profile setup)",
          "🔗 Referrals: 50 BXP × tier multiplier (you AND your friend both earn)",
          "📝 Submissions: 25 BXP × tier multiplier (per bounty submission)",
          "🏆 Wins: 100 BXP × tier multiplier (plus the bounty reward + tier bonus)",
          "💡 Example: Tier 3 (Builder, 1.5x) wins $500 USDC → $550 payout + 150 BXP",
        ],
      },
      {
        num: "05", icon: "📈", title: "Level Up",
        desc: "As you use more Solana protocols, hold NFTs, participate in DeFi, and complete bounties — your on-chain activity grows. FairScale tracks this and your FairScore tier increases over time, unlocking higher bounties.",
        details: ["Use more DeFi protocols (Jupiter, Raydium, Marinade...)", "Hold and trade NFTs", "Increase transaction volume", "Maintain consistent on-chain activity", "Complete bounties to build reputation"],
      },
    ];

    const tierDetails = {
      1: { xp: "1x", vote: "1x", bonus: "+0%", tip: "🌱 Just getting started. Connect your wallet and explore smaller bounties to begin building reputation." },
      2: { xp: "1.25x", vote: "2x", bonus: "+5%", tip: "🔍 You've been active on-chain. You can now access mid-range bounties, generate referral links, and your submission reviews carry 2x weight." },
      3: { xp: "1.5x", vote: "3x", bonus: "+10%", tip: "🔨 Established builder. Access bounties up to $1,000, earn 10% bonus rewards, and your 3x review weight helps surface the best submissions." },
      4: { xp: "2x", vote: "5x", bonus: "+15%", tip: "⭐ Veteran status. You've proven yourself on-chain. $5K bounties, 15% bonus, 5x review power, and 2x BXP acceleration." },
      5: { xp: "3x", vote: "8x", bonus: "+25%", tip: "👑 Legendary reputation. Unlimited bounty access, 25% bonus rewards, 8x review weight, 3x BXP. You're the top of the ecosystem." },
    };

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="landing" backLabel="Home" />

          <div style={fadeIn}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "50px" }}>
              <div style={{
                display: "inline-block", padding: "6px 16px",
                background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`,
                borderRadius: "100px", fontSize: "11px", color: theme.primary,
                marginBottom: "20px", letterSpacing: "1.5px", textTransform: "uppercase",
              }}>
                How It Works
              </div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "900", lineHeight: "1.1", marginBottom: "16px", letterSpacing: "-1px" }}>
                From Wallet to <span style={{ color: theme.primary }}>Earning</span>
              </h1>
              <p style={{ fontSize: "15px", color: "#888", maxWidth: "500px", margin: "0 auto", lineHeight: "1.7" }}>
                Your on-chain reputation is your key. Here's how FairScore powers every part of FairBounty.
              </p>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "60px" }}>
              {howSteps.map((step, i) => {
                const isActive = activeStep === i;
                return (
                  <div key={i} onClick={() => setActiveStep(isActive ? -1 : i)}
                    style={{
                      ...cardStyle, cursor: "pointer",
                      border: isActive ? `1px solid ${theme.primary}60` : `1px solid ${theme.primary}20`,
                      transition: "all 0.3s ease",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{
                        width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
                        background: isActive ? `${theme.primary}20` : `${theme.primary}08`,
                        border: `1px solid ${isActive ? theme.primary + "40" : theme.primary + "15"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "24px", transition: "all 0.3s ease",
                      }}>
                        {step.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "10px", color: theme.primary, fontWeight: "700", letterSpacing: "1px", marginBottom: "2px" }}>STEP {step.num}</div>
                        <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>{step.title}</h3>
                      </div>
                      <div style={{ fontSize: "18px", color: theme.primary, transition: "transform 0.3s ease", transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
                    </div>
                    {isActive && (
                      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15` }}>
                        <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", marginBottom: "16px" }}>{step.desc}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {step.details.map((d, j) => (
                            <div key={j} style={{
                              padding: "10px 14px", background: "#0a0a0f", borderRadius: "6px",
                              fontSize: "12px", color: "#999", lineHeight: "1.5",
                              borderLeft: `2px solid ${theme.primary}40`,
                              display: "flex", alignItems: "center", gap: "8px",
                            }}>
                              <span style={{ color: theme.primary }}>›</span> {d}
                            </div>
                          ))}
                        </div>
                        {step.actionUrl && (
                          <a href={step.actionUrl} target="_blank" rel="noopener noreferrer"
                            style={{ ...btnPrimary, display: "inline-block", marginTop: "16px", textDecoration: "none", fontSize: "13px" }}>
                            {step.action}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tier Breakdown */}
            <div style={{ textAlign: "center", margin: "0 0 32px" }}>
              <div style={{
                display: "inline-block", padding: "8px 20px",
                background: `${theme.primary}10`, border: `1px solid ${theme.primary}25`,
                borderRadius: "100px", fontSize: "12px", color: theme.primary, fontWeight: "600",
              }}>
                ↓ Understand the Tiers ↓
              </div>
            </div>

            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px", textAlign: "center" }}>🏅 Tier Breakdown</h2>
            <p style={{ fontSize: "13px", color: "#888", textAlign: "center", marginBottom: "32px" }}>Tap a tier to see what it unlocks</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "60px" }}>
              {Object.entries(TIER_CONFIG).map(([k, v]) => {
                const td = tierDetails[k];
                const isOpen = activeTier === k;
                return (
                  <div key={k} onClick={() => setActiveTier(isOpen ? null : k)}
                    style={{
                      ...cardStyle, cursor: "pointer",
                      border: isOpen ? `1px solid ${v.color}50` : `1px solid ${theme.primary}15`,
                      transition: "all 0.3s ease",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span style={{ fontSize: "28px" }}>{v.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "15px", fontWeight: "700", color: v.color }}>Tier {k} — {v.label}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: "800", color: theme.primary }}>{v.maxBounty ? `$${v.maxBounty.toLocaleString()}` : "Unlimited"}</div>
                        <div style={{ fontSize: "10px", color: "#666" }}>max bounty</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${v.color}20` }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                          {[
                            { label: "Review Weight", value: td.vote, icon: "⚖️" },
                            { label: "BXP Multiplier", value: td.xp, icon: "⚡" },
                            { label: "Reward Bonus", value: td.bonus, icon: "💎" },
                          ].map((stat) => (
                            <div key={stat.label} style={{
                              padding: "14px", background: "#0a0a0f", borderRadius: "8px", textAlign: "center",
                              border: `1px solid ${v.color}15`,
                            }}>
                              <div style={{ fontSize: "16px", marginBottom: "4px" }}>{stat.icon}</div>
                              <div style={{ fontSize: "16px", fontWeight: "800", color: v.color }}>{stat.value}</div>
                              <div style={{ fontSize: "9px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>{stat.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          marginTop: "12px", padding: "12px", background: `${v.color}08`,
                          border: `1px solid ${v.color}15`, borderRadius: "8px",
                          fontSize: "12px", color: "#999", lineHeight: "1.6",
                        }}>
                          {td.tip}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* How to Level Up */}
            <div style={{ ...cardStyle, marginBottom: "60px", padding: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "20px", textAlign: "center" }}>📈 How to Increase Your Tier</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {[
                  { icon: "🔄", title: "Use DeFi Protocols", desc: "Swap on Jupiter, stake with Marinade, provide liquidity on Raydium. Each protocol interaction builds your score." },
                  { icon: "🖼️", title: "Collect & Trade NFTs", desc: "Active NFT participation shows ecosystem engagement. Buy, sell, and hold across marketplaces." },
                  { icon: "📊", title: "Increase Activity", desc: "More transactions over time = higher trust. Consistent, legitimate activity matters more than volume." },
                  { icon: "🏗️", title: "Complete Bounties", desc: "Successfully completed bounties on FairBounty feed back into your on-chain reputation." },
                  { icon: "⏰", title: "Wallet Age", desc: "Older wallets with consistent history score higher. Time in the ecosystem demonstrates commitment." },
                  { icon: "🌐", title: "Diversify", desc: "Don't just use one protocol. Spread activity across lending, swapping, staking, governance, and NFTs." },
                ].map((item) => (
                  <div key={item.title} style={{ padding: "20px", background: "#0a0a0f", borderRadius: "10px", border: `1px solid ${theme.primary}10` }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>{item.icon}</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>{item.title}</div>
                    <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.6" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{
              textAlign: "center", padding: "40px 32px",
              background: `linear-gradient(135deg, ${theme.primary}10, ${theme.accent}10)`,
              border: `1px solid ${theme.primary}25`, borderRadius: "16px", marginBottom: "20px",
            }}>
              <h2 style={{ fontSize: "24px", fontWeight: "900", marginBottom: "8px" }}>Ready to Start?</h2>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>Get your FairScore, connect your wallet, and start earning.</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer"
                  style={{ ...btnPrimary, textDecoration: "none" }}>Get Your FairScore ↗</a>
                <button style={btnOutline} onClick={() => setView("connect")}>Connect Wallet →</button>
              </div>
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
    const walletIcons = { jupiter: "🪐", phantom: "👻", solflare: "🔥", backpack: "🎒", glow: "✨" };

    // Check which wallets are detected
    const isWalletDetected = (opt) => {
      if (opt.useStandard) return standardWallets.some((w) => w.name?.toLowerCase().includes(opt.name.toLowerCase()));
      if (opt.window) { const p = window[opt.window]; return p && (!opt.check || opt.check(p)); }
      return false;
    };

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "460px", margin: "0 auto", padding: "60px 20px", ...fadeIn }}>
          <button onClick={() => setView("landing")} style={{ ...btnOutline, marginBottom: "40px", fontSize: "12px", padding: "8px 16px" }}>← Back</button>
          <h2 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>Connect Wallet</h2>
          <p style={{ color: "#888", fontSize: "14px", marginBottom: "32px" }}>Choose your Solana wallet. Your FairScore will be fetched automatically.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading && (
              <div style={{ textAlign: "center", padding: "20px", color: theme.primary, fontSize: "14px" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px", animation: "pulse 1s ease-in-out infinite" }}>⏳</div>
                Connecting wallet...
              </div>
            )}
            {walletOptions.map((opt) => {
              const wTheme = WALLET_THEMES[opt.id] || WALLET_THEMES.default;
              const detected = isWalletDetected(opt);
              return (
                <button key={opt.id} onClick={() => !loading && connectWallet(opt.id)} disabled={loading}
                  style={{
                    display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px",
                    background: `linear-gradient(135deg, ${wTheme.bg}, #0a0a0f)`,
                    border: `1px solid ${wTheme.primary}30`, borderRadius: "12px", color: "#E8E8ED",
                    fontFamily: "inherit", cursor: loading ? "wait" : "pointer", fontSize: "15px", fontWeight: "600",
                    transition: "all 0.2s ease", textAlign: "left", opacity: loading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = wTheme.primary; e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 0 20px ${wTheme.primary}20`; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${wTheme.primary}30`; e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: "24px" }}>{walletIcons[opt.id] || "💳"}</span>
                  <span>{opt.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "10px", padding: "4px 10px", background: detected ? `${wTheme.primary}25` : "#ffffff08", color: detected ? wTheme.primary : "#666", borderRadius: "100px", fontWeight: "600" }}>
                    {detected ? "✓ Detected" : "Solana"}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // ============================================================
  // PROFILE SETUP — After wallet connect (tabbed form)
  // ============================================================
  if (view === "profile-setup") {
    const setupTabs = ["Basics", "Socials", "Skills"];

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "540px", margin: "0 auto", padding: "40px 20px" }}>
          <div style={fadeIn}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>{TIER_CONFIG[fairScore]?.emoji}</div>
              <h2 style={{ fontSize: "26px", fontWeight: "800", marginBottom: "4px" }}>Set Up Your Profile</h2>
              <p style={{ color: "#888", fontSize: "13px" }}>
                You're <span style={{ color: TIER_CONFIG[fairScore]?.color, fontWeight: "700" }}>Tier {fairScore} — {TIER_CONFIG[fairScore]?.label}</span>
              </p>
            </div>

            {/* Wallet summary */}
            <div style={{ ...cardStyle, marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "14px 18px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wallet</div>
                <div style={{ fontSize: "13px", color: theme.primary, fontWeight: "600", marginTop: "2px" }}>{wallet}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>FairScore</div>
                <div style={{ fontSize: "13px", color: TIER_CONFIG[fairScore]?.color, fontWeight: "600", marginTop: "2px" }}>{scoreData?.score} pts</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#0a0a0f", borderRadius: "10px", padding: "4px" }}>
              {setupTabs.map((t) => (
                <button key={t} onClick={() => setSetupTab(t)}
                  style={{
                    flex: 1, padding: "10px", fontSize: "13px", fontWeight: "600",
                    background: setupTab === t ? `${theme.primary}20` : "transparent",
                    border: setupTab === t ? `1px solid ${theme.primary}30` : "1px solid transparent",
                    borderRadius: "8px", color: setupTab === t ? theme.primary : "#888",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
                  }}>{t}</button>
              ))}
            </div>

            <div style={cardStyle}>
              {/* BASICS TAB */}
              {setupTab === "Basics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* PFP Upload */}
                  <div style={{ textAlign: "center" }}>
                    <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "8px" }}>Profile Picture</label>
                    <div style={{
                      width: "88px", height: "88px", borderRadius: "50%", margin: "0 auto 12px",
                      background: profileForm.pfpUrl ? `url(${profileForm.pfpUrl}) center/cover` : `linear-gradient(135deg, ${theme.primary}30, ${theme.accent}30)`,
                      border: `3px solid ${theme.primary}40`, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "32px", color: theme.primary, cursor: "pointer", position: "relative", overflow: "hidden",
                    }} onClick={() => document.getElementById("pfp-upload")?.click()}>
                      {!profileForm.pfpUrl && "👤"}
                      {profileForm.pfpUrl && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0}>
                          <span style={{ fontSize: "14px", color: "#fff" }}>Change</span>
                        </div>
                      )}
                    </div>
                    <input id="pfp-upload" type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) { notify("Image must be under 2MB"); return; }
                          const reader = new FileReader();
                          reader.onload = (ev) => setProfileForm((prev) => ({ ...prev, pfpUrl: ev.target.result }));
                          reader.readAsDataURL(file);
                        }
                      }} />
                    <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 16px", marginBottom: "8px" }}
                      onClick={() => document.getElementById("pfp-upload")?.click()}>
                      Upload Image
                    </button>
                    <div style={{ fontSize: "10px", color: "#555", marginBottom: "6px" }}>or paste a URL below</div>
                    <input style={{ ...inputStyle, fontSize: "12px" }} value={profileForm.pfpUrl?.startsWith("data:") ? "" : profileForm.pfpUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, pfpUrl: e.target.value })}
                      placeholder="https://example.com/your-image.png" />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Display Name *</label>
                    <input style={inputStyle} value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} placeholder="e.g. CryptoBuilder" />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Email *</label>
                    <input style={inputStyle} type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="you@example.com" />
                    <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Used for notifications and newsletters. Never shared publicly.</div>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Bio</label>
                    <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Solana builder, DeFi enthusiast..." />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Location</label>
                      <input style={inputStyle} value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} placeholder="e.g. United States" />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Works at</label>
                      <input style={inputStyle} value={profileForm.worksAt} onChange={(e) => setProfileForm({ ...profileForm, worksAt: e.target.value })} placeholder="e.g. Marinade Finance" />
                    </div>
                  </div>

                  <div style={{ padding: "10px 14px", background: `${theme.primary}08`, border: `1px solid ${theme.primary}15`, borderRadius: "8px", fontSize: "11px", color: "#888", lineHeight: "1.6" }}>
                    🔒 Your information is stored securely and never shared with third parties. Email is used only for platform notifications. Contact info is only visible on your public profile if you choose to add it.
                  </div>
                </div>
              )}

              {/* SOCIALS TAB */}
              {setupTab === "Socials" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Social Profiles</div>
                  {[
                    { key: "xHandle", label: "X / Twitter", prefix: "@", placeholder: "yourhandle", icon: "𝕏" },
                    { key: "discord", label: "Discord", prefix: "", placeholder: "username", icon: "💬" },
                    { key: "telegram", label: "Telegram", prefix: "@", placeholder: "yourhandle", icon: "✈️" },
                    { key: "github", label: "GitHub", prefix: "", placeholder: "github.com/you", icon: "🐙" },
                    { key: "linkedin", label: "LinkedIn", prefix: "", placeholder: "linkedin.com/in/you", icon: "💼" },
                    { key: "website", label: "Website / Portfolio", prefix: "", placeholder: "https://yoursite.com", icon: "🌐" },
                  ].map((s) => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px" }}>{s.label}</label>
                        <div style={{ position: "relative" }}>
                          {s.prefix && <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: "13px" }}>{s.prefix}</span>}
                          <input style={{ ...inputStyle, fontSize: "13px", padding: "10px 14px", paddingLeft: s.prefix ? "26px" : "14px" }}
                            value={profileForm[s.key]} onChange={(e) => setProfileForm({ ...profileForm, [s.key]: e.target.value.replace(/^@/, "") })} placeholder={s.placeholder} />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={{ borderTop: `1px solid ${theme.primary}15`, paddingTop: "16px", marginTop: "4px" }}>
                    <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>Contact Info</div>
                    {[
                      { key: "contact", label: "Phone / WhatsApp", prefix: "", placeholder: "+1 (555) 123-4567", icon: "📱" },
                      { key: "email", label: "Public Email", prefix: "", placeholder: "contact@you.com", icon: "📧", note: "Separate from your account email — this one is visible on your profile" },
                    ].map((s) => (
                      <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
                        <span style={{ fontSize: "18px", width: "24px", textAlign: "center", marginTop: "6px" }}>{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px" }}>{s.label}</label>
                          <input style={{ ...inputStyle, fontSize: "13px", padding: "10px 14px" }}
                            value={profileForm[s.key]} onChange={(e) => setProfileForm({ ...profileForm, [s.key]: e.target.value })} placeholder={s.placeholder} />
                          {s.note && <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>{s.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SKILLS TAB */}
              {setupTab === "Skills" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profileForm.skills.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>Selected ({profileForm.skills.length})</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {profileForm.skills.map((s) => (
                          <button key={s} onClick={() => toggleSkill(s)} style={{
                            padding: "6px 14px", background: `${theme.primary}20`, border: `1px solid ${theme.primary}40`,
                            borderRadius: "100px", fontSize: "12px", color: theme.primary, cursor: "pointer",
                            fontFamily: "inherit", fontWeight: "600", transition: "all 0.15s ease",
                          }}>{s} ✕</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.entries(SKILL_CATEGORIES).map(([cat, skills]) => (
                    <div key={cat}>
                      <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{cat}</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {skills.map((s) => {
                          const selected = profileForm.skills.includes(s);
                          return (
                            <button key={s} onClick={() => toggleSkill(s)} style={{
                              padding: "5px 12px", background: selected ? `${theme.primary}20` : "#0a0a0f",
                              border: `1px solid ${selected ? theme.primary + "40" : theme.primary + "15"}`,
                              borderRadius: "100px", fontSize: "11px", color: selected ? theme.primary : "#999",
                              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s ease",
                            }}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button style={{ ...btnPrimary, flex: 1 }} onClick={handleProfileSave}>
                Save Profile & Enter →
              </button>
            </div>
            <button style={{ ...btnOutline, width: "100%", marginTop: "8px", fontSize: "12px" }} onClick={() => {
              setProfile({
                displayName: profileForm.displayName.trim() || wallet?.slice(0, 10) || "Anon",
                xHandle: profileForm.xHandle.replace(/^@/, "").trim() || "",
                bio: "", contact: "", email: "", pfpUrl: "", linkedin: "", github: "",
                website: "", telegram: "", discord: "", lookingFor: "", worksAt: "", location: "",
                skills: [], joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              });
              setView("dashboard");
            }}>Skip for now</button>
          </div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // PROFILE VIEW (tabbed: Overview, Skills, Bookmarks)
  // ============================================================
  if (view === "profile" && wallet) {
    const tier = TIER_CONFIG[fairScore];
    const customReferral = `https://fairbounty.vercel.app/ref/${profile?.xHandle || wallet?.slice(0, 8)}`;
    const xShareText = encodeURIComponent(`I'm a ${tier?.label} (Tier ${fairScore}) on @FairBounty — reputation-gated bounties on Solana powered by @fairscalexyz\n\nCheck your FairScore: ${customReferral}`);
    const bookmarkedBounties = bounties.filter((b) => bookmarks.includes(b.id));
    const socials = [
      { key: "xHandle", icon: "𝕏", url: (v) => `https://x.com/${v}`, label: (v) => `@${v}` },
      { key: "linkedin", icon: "💼", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: (v) => "LinkedIn" },
      { key: "github", icon: "🐙", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: (v) => "GitHub" },
      { key: "website", icon: "🌐", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: (v) => "Website" },
      { key: "telegram", icon: "✈️", url: (v) => `https://t.me/${v}`, label: (v) => `@${v}` },
      { key: "discord", icon: "💬", url: (v) => null, label: (v) => v },
      { key: "contact", icon: "📱", url: (v) => null, label: (v) => v },
      { key: "email", icon: "📧", url: (v) => `mailto:${v}`, label: (v) => v },
    ].filter((s) => profile?.[s.key]);

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "650px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Bounties" />
          <DemoModal />

          <div style={fadeIn}>
            {/* Profile Header Card */}
            <div style={{ ...cardStyle, marginBottom: "20px", padding: "28px" }}>
              <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* PFP */}
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%", flexShrink: 0,
                  background: profile?.pfpUrl ? `url(${profile.pfpUrl}) center/cover` : `linear-gradient(135deg, ${theme.primary}30, ${theme.accent}30)`,
                  border: `3px solid ${tier?.color || theme.primary}`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "32px",
                }}>
                  {!profile?.pfpUrl && tier?.emoji}
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "2px" }}>{profile?.displayName || "Anonymous"}</h2>
                      {profile?.xHandle && (
                        <a href={`https://x.com/${profile.xHandle}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: theme.primary, textDecoration: "none", fontSize: "13px" }}>@{profile.xHandle}</a>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 14px" }} onClick={() => {
                        setProfileForm({
                          displayName: profile?.displayName || "", xHandle: profile?.xHandle || "", bio: profile?.bio || "",
                          contact: profile?.contact || "", email: profile?.email || "", pfpUrl: profile?.pfpUrl || "",
                          linkedin: profile?.linkedin || "", github: profile?.github || "", website: profile?.website || "",
                          telegram: profile?.telegram || "", discord: profile?.discord || "", lookingFor: profile?.lookingFor || "",
                          worksAt: profile?.worksAt || "", location: profile?.location || "", skills: profile?.skills || [],
                        });
                        setView("profile-setup");
                      }}>Edit Profile</button>
                    </div>
                  </div>
                  {profile?.bio && <p style={{ color: "#999", fontSize: "13px", lineHeight: "1.6", marginTop: "8px" }}>{profile.bio}</p>}

                  {/* Details row */}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "10px", fontSize: "12px", color: "#888" }}>
                    {profile?.worksAt && <span>🏢 {profile.worksAt}</span>}
                    {profile?.location && <span>📍 {profile.location}</span>}
                  </div>

                  {/* Socials row */}
                  {socials.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      {socials.map((s) => {
                        const val = profile[s.key];
                        const href = s.url(val);
                        return href ? (
                          <a key={s.key} href={href} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "16px", textDecoration: "none", opacity: 0.7, transition: "opacity 0.2s" }}
                            onMouseEnter={(e) => e.target.style.opacity = 1} onMouseLeave={(e) => e.target.style.opacity = 0.7}
                            title={s.label(val)}>{s.icon}</a>
                        ) : (
                          <span key={s.key} style={{ fontSize: "16px", opacity: 0.7 }} title={s.label(val)}>{s.icon}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row at bottom of card */}
              <div style={{ display: "flex", gap: "24px", marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15`, flexWrap: "wrap" }}>
                {[
                  { value: `Tier ${fairScore}`, label: tier?.label, color: tier?.color },
                  { value: `${xp}`, label: "BXP", color: theme.primary },
                  { value: "0", label: "Earned", color: "#888" },
                  { value: "0", label: "Submissions", color: "#888" },
                  { value: "0", label: "Won", color: "#888" },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.3px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "#0a0a0f", borderRadius: "10px", padding: "4px" }}>
              {["overview", "skills", "bookmarks"].map((t) => (
                <button key={t} onClick={() => setProfileTab(t)}
                  style={{
                    flex: 1, padding: "10px", fontSize: "12px", fontWeight: "600", textTransform: "capitalize",
                    background: profileTab === t ? `${theme.primary}20` : "transparent",
                    border: profileTab === t ? `1px solid ${theme.primary}30` : "1px solid transparent",
                    borderRadius: "8px", color: profileTab === t ? theme.primary : "#888",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease",
                  }}>
                  {t === "bookmarks" ? `📌 Bookmarks (${bookmarks.length})` : t === "skills" ? `🛠 Skills` : `📊 Overview`}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {profileTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* FairScore source */}
                <div style={{
                  padding: "10px 14px", background: `${theme.primary}08`, border: `1px solid ${theme.primary}20`,
                  borderRadius: "8px", fontSize: "11px", color: theme.primary, lineHeight: "1.6", textAlign: "center",
                }}>
                  ✅ Live FairScore data from <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "underline" }}>FairScale API</a> — your on-chain reputation, verified in real-time.
                </div>
                {/* On-chain stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                  {[
                    { label: "FairScore", value: scoreData?.score || 0, color: tier?.color },
                    { label: "Max Bounty", value: tier?.maxBounty ? `$${tier.maxBounty.toLocaleString()}` : "∞", color: theme.accent },
                    { label: "BXP Multiplier", value: `${tier?.xpMultiplier}x`, color: theme.primary },
                    { label: "Reward Bonus", value: `+${tier?.rewardBonus}%`, color: theme.primary },
                    { label: "Risk Level", value: riskData.level, color: riskData.color },
                  ].map((s) => (
                    <div key={s.label} style={{ ...cardStyle, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>{s.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* On-chain activity */}
                {scoreData && (
                  <div style={cardStyle}>
                    <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>On-Chain Activity</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "FairScale Tier", value: scoreData.fairscaleTier },
                        { label: "FairScore", value: scoreData.score },
                        { label: "Base Score", value: scoreData.fairscoreBase },
                        { label: "Social Score", value: scoreData.socialScore },
                        { label: "Transactions", value: scoreData.txCount },
                        { label: "Active Days", value: scoreData.activeDays },
                        { label: "Platforms", value: scoreData.protocolsUsed },
                        { label: "Conviction", value: `${(scoreData.convictionRatio * 100).toFixed(0)}%` },
                      ].map((d) => (
                        <div key={d.label} style={{ padding: "10px", background: "#0a0a0f", borderRadius: "6px" }}>
                          <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>{d.label}</div>
                          <div style={{ fontSize: "14px", fontWeight: "600" }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Platform Badges (Founder, etc) */}
                    {fullAddress && PLATFORM_BADGES[fullAddress] && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>Platform Badges</div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {PLATFORM_BADGES[fullAddress].map((badge) => (
                            <span key={badge.id} style={{
                              padding: "4px 14px", fontSize: "11px", borderRadius: "100px", fontWeight: "700",
                              background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                              letterSpacing: "0.5px",
                            }}>
                              ★ {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* FairScale Badges */}
                    {scoreData.badges && scoreData.badges.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>Badges</div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {scoreData.badges.map((badge) => (
                            <span key={badge.id} style={{
                              padding: "4px 12px", fontSize: "11px", borderRadius: "100px", fontWeight: "600",
                              background: badge.tier === "gold" ? "#F59E0B15" : badge.tier === "silver" ? "#9CA3AF15" : `${theme.primary}15`,
                              color: badge.tier === "gold" ? "#F59E0B" : badge.tier === "silver" ? "#9CA3AF" : theme.primary,
                              border: `1px solid ${badge.tier === "gold" ? "#F59E0B30" : badge.tier === "silver" ? "#9CA3AF30" : theme.primary + "30"}`,
                            }} title={badge.description}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Actions — what FairScale recommends to improve score */}
                    {scoreData.actions && scoreData.actions.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>Improve Your Score</div>
                        {scoreData.actions.map((action) => (
                          <div key={action.id} style={{
                            padding: "8px 12px", marginBottom: "6px", background: "#0a0a0f", borderRadius: "6px",
                            borderLeft: `2px solid ${action.priority === "high" ? "#EF4444" : action.priority === "medium" ? "#F59E0B" : theme.primary}40`,
                            fontSize: "12px", color: "#999",
                          }}>
                            <span style={{ fontWeight: "600", color: "#ccc" }}>{action.label}</span> — {action.cta}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Referral */}
                {/* BXP Breakdown */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>⭐ BXP Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { label: "Welcome Bonus", value: bxpBreakdown.welcome, icon: "🎁" },
                      { label: "Referral Earnings", value: bxpBreakdown.referrals, icon: "🔗" },
                      { label: "Referred Bonus", value: bxpBreakdown.referred, icon: "🤝" },
                      { label: "Submissions", value: bxpBreakdown.submissions, icon: "📝" },
                    ].map((d) => (
                      <div key={d.label} style={{ padding: "10px", background: "#0a0a0f", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>{d.icon} {d.label}</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: d.value > 0 ? theme.primary : "#444" }}>{d.value} BXP</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "10px", padding: "10px", background: `${theme.primary}10`, borderRadius: "6px", textAlign: "center" }}>
                    <span style={{ fontSize: "12px", color: "#888" }}>Total: </span>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: theme.primary }}>{xp} BXP</span>
                    <span style={{ fontSize: "11px", color: "#666", marginLeft: "8px" }}>({tier?.xpMultiplier}x multiplier active)</span>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>🔗 Referral Link</h3>
                  <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
                    Share FairBounty and earn <span style={{ color: theme.primary, fontWeight: "600" }}>{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore || 1))} BXP</span> per signup. They earn the same.
                    {referralCount > 0 && <span style={{ color: theme.primary, fontWeight: "600" }}> · {referralCount} referral{referralCount !== 1 ? "s" : ""} so far</span>}
                  </p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#0a0a0f", borderRadius: "8px", padding: "10px 14px", marginBottom: "10px" }}>
                    <input readOnly value={referralLink} style={{ ...inputStyle, border: "none", background: "transparent", flex: 1, fontSize: "12px", color: "#aaa", padding: "0" }} />
                    <button onClick={() => navigator.clipboard.writeText(referralLink).then(() => notify("Referral link copied!"))}
                      style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px", whiteSpace: "nowrap" }}>📋 Copy</button>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(`I'm building my on-chain reputation on FairBounty — a trust-gated bounty platform powered by @FairScale_xyz.\n\nJoin with my link and we both earn BXP:\n${referralLink}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...btnOutline, fontSize: "12px", padding: "8px 18px", textDecoration: "none" }}>Share on 𝕏 →</a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join FairBounty — trust-gated bounties powered by FairScale!")}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...btnOutline, fontSize: "12px", padding: "8px 18px", textDecoration: "none" }}>Telegram</a>
                  </div>
                </div>
              </div>
            )}

            {/* SKILLS TAB */}
            {profileTab === "skills" && (
              <div style={cardStyle}>
                {profile?.skills?.length > 0 ? (
                  <div>
                    {(() => {
                      const grouped = {};
                      profile.skills.forEach((s) => {
                        const cat = Object.entries(SKILL_CATEGORIES).find(([, skills]) => skills.includes(s));
                        const catName = cat ? cat[0] : "Other";
                        if (!grouped[catName]) grouped[catName] = [];
                        grouped[catName].push(s);
                      });
                      return Object.entries(grouped).map(([cat, skills]) => (
                        <div key={cat} style={{ marginBottom: "16px" }}>
                          <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{cat}</div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {skills.map((s) => (
                              <span key={s} style={{
                                padding: "5px 14px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}25`,
                                borderRadius: "100px", fontSize: "12px", color: theme.primary,
                              }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px", color: "#666", fontSize: "13px" }}>
                    No skills added yet.{" "}
                    <button style={{ color: theme.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", textDecoration: "underline" }}
                      onClick={() => {
                        setProfileForm({ ...profileForm, displayName: profile?.displayName || "", xHandle: profile?.xHandle || "", bio: profile?.bio || "", skills: profile?.skills || [], email: profile?.email || "", pfpUrl: profile?.pfpUrl || "", linkedin: profile?.linkedin || "", github: profile?.github || "", website: profile?.website || "", telegram: profile?.telegram || "", discord: profile?.discord || "", lookingFor: profile?.lookingFor || "", worksAt: profile?.worksAt || "", location: profile?.location || "", contact: profile?.contact || "" });
                        setView("profile-setup");
                      }}>Add skills</button>
                  </div>
                )}
              </div>
            )}

            {/* BOOKMARKS TAB */}
            {profileTab === "bookmarks" && (
              <div>
                {bookmarkedBounties.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {bookmarkedBounties.map((b) => {
                      const bTier = TIER_CONFIG[b.minTier];
                      return (
                        <div key={b.id} style={{ ...cardStyle, cursor: "pointer", padding: "16px" }}
                          onClick={() => { setSelectedBounty(b); setView("bounty"); }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.primary}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = `${theme.primary}30`}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <div>
                              <div style={{ fontSize: "10px", color: "#666" }}>{b.project}</div>
                              <div style={{ fontSize: "14px", fontWeight: "700" }}>{b.title}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "15px", fontWeight: "800", color: theme.primary }}>{b.reward} {b.currency}</div>
                              <div style={{ fontSize: "10px", color: bTier.color }}>{bTier.emoji} Tier {b.minTier}+</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ ...cardStyle, textAlign: "center", padding: "32px", color: "#666", fontSize: "13px" }}>
                    📌 No bookmarked bounties yet. Tap the bookmark icon on any bounty to save it here.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: "16px", fontSize: "11px", color: "#555", textAlign: "center" }}>Joined {profile?.joinedDate || "Feb 2026"}</div>
          </div>

          <Footer />
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
    const bonusReward = wallet ? Math.floor(b.reward * (FairScoreAPI.getRewardBonus(fairScore) / 100)) : 0;

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Bounties" />
          <DemoModal />

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
                { label: "Reward", value: `${b.reward} ${b.currency}`, color: theme.primary },
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
                <button style={btnOutline} onClick={() => toggleBookmark(b.id)}
                  onMouseEnter={(e) => e.target.style.background = `${theme.primary}10`}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  {bookmarks.includes(b.id) ? "📌 Bookmarked" : "🔖 Bookmark"}
                </button>
              )}
            </div>

            {wallet ? (
              <div style={{
                padding: "24px", background: `${theme.primary}08`, border: `1px solid ${theme.primary}20`,
                borderRadius: "10px", textAlign: "center",
              }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚧</div>
                <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "6px" }}>Submissions Coming Soon</div>
                <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.6" }}>
                  This is an example bounty. Real bounty submissions will open once the platform launches.
                  {eligible && <span style={{ color: theme.primary }}> Your Tier {fairScore} qualifies for this bounty!</span>}
                  {!eligible && <span style={{ color: "#ff4040" }}> This bounty requires Tier {b.minTier}+.</span>}
                </div>
              </div>
            ) : (
              <button style={btnPrimary} onClick={() => setView("connect")}>Connect Wallet to View</button>
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
      ...(wallet ? [{ rank: 6, name: profile?.displayName || wallet, tier: fairScore, xp, bounties: 0, earned: "$0", xHandle: profile?.xHandle }] : []),
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
                const isYou = l.name === (profile?.displayName || wallet);
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
                      <div style={{ fontWeight: "700", fontSize: "14px", color: theme.primary }}>{l.xp} BXP</div>
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
  // POST A BOUNTY — Client intake form
  // ============================================================
  if (view === "post-bounty") {
    const handleBountySubmit = () => {
      if (!wallet || !profile) {
        notify("Please connect your wallet and set up a profile first.");
        setView("connect");
        return;
      }
      if (!bountyForm.projectName.trim() || !bountyForm.title.trim() || !bountyForm.description.trim() || !bountyForm.reward) {
        notify("Please fill in all required fields.");
        return;
      }
      const application = {
        ...bountyForm,
        id: `app_${Date.now()}`,
        wallet: fullAddress,
        displayName: profile.displayName,
        fairScore: fairScore,
        fairscaleTier: scoreData?.fairscaleTier || "unknown",
        score: scoreData?.score || 0,
        submittedAt: new Date().toISOString(),
        status: "pending",
      };
      const updated = [...bountyApplications, application];
      setBountyApplications(updated);
      try { localStorage.setItem("fb_bounty_applications", JSON.stringify(updated)); } catch (e) {}
      setBountyForm({ projectName: "", title: "", description: "", reward: "", currency: "USDC", minTier: 1, deadline: "", category: "", contactMethod: "", contactValue: "" });
      notify("Bounty application submitted! We'll review and get back to you.");
      setView("dashboard");
    };

    const categories = ["Development", "Design", "Content", "Marketing", "Security Audit", "Community", "Research", "Other"];

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "680px", margin: "0 auto", padding: "20px" }}>
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

          <div style={{ ...fadeIn, marginTop: "20px" }}>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: "900", marginBottom: "8px" }}>Post a Bounty</h1>
              <p style={{ fontSize: "14px", color: "#888", lineHeight: "1.6" }}>
                List your project's work on FairBounty. Submissions are gated by on-chain reputation
                via <span style={{ color: theme.primary }}>FairScale</span>, so you only get quality contributors.
              </p>
            </div>

            {!wallet || !profile ? (
              <div style={{ ...cardStyle, padding: "32px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>Connect & Create Profile First</h3>
                <p style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>
                  You need a wallet and FairScore profile to post bounties. This helps us verify your on-chain reputation.
                </p>
                <button style={btnPrimary} onClick={() => setView("connect")}>Connect Wallet →</button>
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: "28px" }}>
                {/* Poster identity */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px",
                  padding: "14px", background: `${theme.primary}08`, borderRadius: "8px", border: `1px solid ${theme.primary}15`,
                }}>
                  <span style={{ fontSize: "24px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700" }}>{profile.displayName}</div>
                    <div style={{ fontSize: "11px", color: "#888" }}>
                      Tier {fairScore} ({TIER_CONFIG[fairScore]?.label}) · FairScore: {scoreData?.score || 0} · {scoreData?.fairscaleTier || "unranked"}
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Project / Company Name *</label>
                    <input style={inputStyle} placeholder="e.g. Jupiter, Marinade, your DAO..." value={bountyForm.projectName}
                      onChange={(e) => setBountyForm({ ...bountyForm, projectName: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Bounty Title *</label>
                    <input style={inputStyle} placeholder="e.g. Build a staking dashboard UI" value={bountyForm.title}
                      onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Description *</label>
                    <textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                      placeholder="Describe the work needed, deliverables, requirements, and any technical specs..."
                      value={bountyForm.description}
                      onChange={(e) => setBountyForm({ ...bountyForm, description: e.target.value })} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Reward Amount *</label>
                      <input style={inputStyle} type="number" placeholder="500" value={bountyForm.reward}
                        onChange={(e) => setBountyForm({ ...bountyForm, reward: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Currency</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.currency}
                        onChange={(e) => setBountyForm({ ...bountyForm, currency: e.target.value })}>
                        <option value="USDC">USDC</option>
                        <option value="SOL">SOL</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Category</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.category}
                        onChange={(e) => setBountyForm({ ...bountyForm, category: e.target.value })}>
                        <option value="">Select...</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Minimum Tier Required</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.minTier}
                        onChange={(e) => setBountyForm({ ...bountyForm, minTier: Number(e.target.value) })}>
                        {Object.entries(TIER_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.emoji} Tier {k} — {v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Deadline</label>
                    <input style={inputStyle} type="date" value={bountyForm.deadline}
                      onChange={(e) => setBountyForm({ ...bountyForm, deadline: e.target.value })} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Best Way to Reach You</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.contactMethod}
                        onChange={(e) => setBountyForm({ ...bountyForm, contactMethod: e.target.value })}>
                        <option value="">Select...</option>
                        <option value="telegram">Telegram</option>
                        <option value="x">X / Twitter DM</option>
                        <option value="email">Email</option>
                        <option value="discord">Discord</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Contact Handle / Address</label>
                      <input style={inputStyle} placeholder="@yourhandle or email" value={bountyForm.contactValue}
                        onChange={(e) => setBountyForm({ ...bountyForm, contactValue: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Pricing info */}
                <div style={{
                  marginTop: "20px", padding: "14px", background: `${theme.primary}08`,
                  borderRadius: "8px", border: `1px solid ${theme.primary}15`, fontSize: "12px", color: "#888",
                }}>
                  <div style={{ fontWeight: "700", color: "#ccc", marginBottom: "6px" }}>How it works:</div>
                  <div style={{ lineHeight: "1.8" }}>
                    → We review your application within 24 hours<br />
                    → Approved bounties go live on the board<br />
                    → Contributors submit work, community votes on best submissions<br />
                    → You pick the winner and release payment<br />
                    → <span style={{ color: theme.primary }}>Listing fee: 50 USDC</span> · <span style={{ color: theme.primary }}>Commission: 5% of reward</span>
                  </div>
                </div>

                <button style={{ ...btnPrimary, width: "100%", marginTop: "20px", padding: "14px", fontSize: "15px" }}
                  onClick={handleBountySubmit}>
                  Submit Bounty Application →
                </button>
              </div>
            )}
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
        <DemoModal />
        <WelcomeModal />
        <DemoBanner />

        {/* Referral */}
        {showReferral && wallet && (
          <div style={{ ...cardStyle, marginBottom: "20px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>🔗 Refer Friends → Earn BXP</div>
                <div style={{ fontSize: "12px", color: "#888" }}>
                  You earn <span style={{ color: theme.primary, fontWeight: "600" }}>+{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore || 1))} BXP</span> per referral · They earn <span style={{ color: theme.primary, fontWeight: "600" }}>+{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore || 1))} BXP</span> too
                </div>
              </div>
              {referralCount > 0 && (
                <div style={{ padding: "6px 14px", background: `${theme.primary}15`, borderRadius: "100px", fontSize: "12px", fontWeight: "700", color: theme.primary }}>
                  {referralCount} referral{referralCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#0a0a0f", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px" }}>
              <input
                readOnly
                value={referralLink}
                style={{ ...inputStyle, border: "none", background: "transparent", flex: 1, fontSize: "12px", color: "#aaa", padding: "0" }}
              />
              <button style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px", whiteSpace: "nowrap" }}
                onClick={() => {
                  navigator.clipboard.writeText(referralLink).then(() => notify("Referral link copied!"));
                }}>
                📋 Copy
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(`I'm building my on-chain reputation on FairBounty — a trust-gated bounty platform powered by @FairScale_xyz.\n\nJoin with my link and we both earn BXP:\n${referralLink}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...btnOutline, fontSize: "11px", padding: "6px 14px", textDecoration: "none", textAlign: "center" }}>
                Share on 𝕏
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join FairBounty — trust-gated bounties powered by FairScale. We both earn BXP!")}`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...btnOutline, fontSize: "11px", padding: "6px 14px", textDecoration: "none", textAlign: "center" }}>
                Telegram
              </a>
            </div>
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
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Platform BXP</div>
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
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>Tier {fairScore} risk assessment</div>
              </div>
            </div>

            {/* On-chain stats from FairScore */}
            {scoreData && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15` }}>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "11px", color: "#888", marginBottom: "10px" }}>
                  <span>🏆 FairScale: <span style={{ color: theme.primary, fontWeight: "600" }}>{scoreData.fairscaleTier}</span></span>
                  <span>📊 Score: {scoreData.score} (base: {scoreData.fairscoreBase})</span>
                  <span>🔗 Platforms: {scoreData.protocolsUsed}</span>
                  <span>📈 Active days: {scoreData.activeDays}</span>
                  <span>💰 Txns: {scoreData.txCount}</span>
                </div>
                {/* Badges */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {/* Platform badges */}
                  {fullAddress && PLATFORM_BADGES[fullAddress] && PLATFORM_BADGES[fullAddress].map((badge) => (
                    <span key={badge.id} style={{
                      padding: "3px 10px", fontSize: "10px", borderRadius: "100px", fontWeight: "700",
                      background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                    }}>
                      ★ {badge.label}
                    </span>
                  ))}
                  {/* FairScale badges */}
                  {scoreData.badges && scoreData.badges.length > 0 && scoreData.badges.map((badge) => (
                      <span key={badge.id} style={{
                        padding: "3px 10px", fontSize: "10px", borderRadius: "100px", fontWeight: "600",
                        background: badge.tier === "gold" ? "#F59E0B15" : badge.tier === "silver" ? "#9CA3AF15" : badge.tier === "platinum" ? "#818CF815" : `${theme.primary}15`,
                        color: badge.tier === "gold" ? "#F59E0B" : badge.tier === "silver" ? "#9CA3AF" : badge.tier === "platinum" ? "#818CF8" : theme.primary,
                        border: `1px solid ${badge.tier === "gold" ? "#F59E0B30" : badge.tier === "silver" ? "#9CA3AF30" : badge.tier === "platinum" ? "#818CF830" : theme.primary + "30"}`,
                      }} title={badge.description}>
                        {badge.label}
                      </span>
                    ))}
                </div>
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
            <h2 style={{ fontSize: "20px", fontWeight: "800" }}>Example Bounties</h2>
            <p style={{ fontSize: "12px", color: "#888" }}>{filteredBounties.length} sample bounties — real ones coming soon</p>
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
              <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 16px" }} onClick={() => setView("post-bounty")}>+ Post Bounty</button>
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
                <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "11px", color: "#666", alignItems: "center" }}>
                  <span>📝 {b.submissions} submissions</span>
                  <span>⏰ {b.deadline}</span>
                  {wallet && (
                    <button onClick={(e) => { e.stopPropagation(); toggleBookmark(b.id); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: "0", fontFamily: "inherit" }}
                      title={bookmarks.includes(b.id) ? "Remove bookmark" : "Bookmark"}>
                      {bookmarks.includes(b.id) ? "📌" : "🔖"}
                    </button>
                  )}
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
