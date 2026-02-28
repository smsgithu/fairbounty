import { useState, useEffect, useCallback, useMemo } from "react";
import { getWallets } from "@wallet-standard/app";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";

// ============================================================
// FAIRBOUNTY — Reputation-Gated Bounty Platform
// Built on FairScale Reputation Infrastructure
// ============================================================

const WALLET_THEMES = {
  phantom: { primary: "#AB9FF2", accent: "#7B61FF", bg: "#1A1430", name: "Phantom" },
  solflare: { primary: "#E8E000", accent: "#F5F030", bg: "#1A1A08", name: "Solflare" },
  backpack: { primary: "#E33E3F", accent: "#FF6B6B", bg: "#1A0C0C", name: "Backpack" },
  jupiter: { primary: "#C7F284", accent: "#95D840", bg: "#0F1A08", name: "Jupiter" },
  glow: { primary: "#B4A0FF", accent: "#8B72FF", bg: "#15102A", name: "Glow" },
  seedvault: { primary: "#00D4AA", accent: "#00F0CC", bg: "#0A1A16", name: "Seed Vault" },
  default: { primary: "#00F0FF", accent: "#00C4CC", bg: "#0A1A1C", name: "FairBounty" },
};

const TIER_CONFIG = {
  1: { label: "Newcomer", color: "#6B7280", emoji: "🌱", xpMultiplier: 1.0, voteWeight: 1, rewardBonus: 0 },
  2: { label: "Explorer", color: "#3B82F6", emoji: "🔍", xpMultiplier: 1.25, voteWeight: 2, rewardBonus: 5 },
  3: { label: "Builder", color: "#8B5CF6", emoji: "🔨", xpMultiplier: 1.5, voteWeight: 3, rewardBonus: 10 },
  4: { label: "Veteran", color: "#F59E0B", emoji: "⭐", xpMultiplier: 2.0, voteWeight: 5, rewardBonus: 15 },
  5: { label: "Legend", color: "#EF4444", emoji: "👑", xpMultiplier: 3.0, voteWeight: 8, rewardBonus: 25 },
};

const RISK_LEVELS = {
  1: { level: "High", color: "#EF4444", label: "High Risk — New wallet, limited history" },
  2: { level: "Medium", color: "#F59E0B", label: "Medium Risk — Some on-chain activity" },
  3: { level: "Low", color: "#3B82F6", label: "Low Risk — Established builder" },
  4: { level: "Very Low", color: "#10B981", label: "Very Low Risk — Verified veteran" },
  5: { level: "Minimal", color: "#22C55E", label: "Minimal Risk — Legendary reputation" },
};

// Prize type config
const PRIZE_TYPES = {
  USDC: { label: "Stablecoin", icon: "💵", color: "#2775CA", description: "USDC, USDT, or any stablecoin" },
  SOL: { label: "SOL", icon: "◎", color: "#9945FF", description: "Native Solana token", img: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
  MEMECOIN: { label: "Memecoin", icon: "🐸", color: "#F59E0B", description: "BONK, WIF, POPCAT, etc." },
  NFT: { label: "NFT / cNFT", icon: "🖼️", color: "#EC4899", description: "NFT or compressed NFT as prize" },
  COLLECTIBLE: { label: "Collectible", icon: "📦", color: "#10B981", description: "Card packs, Pokémon, physical or digital collectibles" },
};

// ============================================================
// BETA ACCESS CONTROL
// Whitelisted wallets get full beta access — real bounties,
// real submissions, voting, winner selection
// ============================================================
const BETA_WHITELIST = [
  "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD", // Sean — Founder
  // Add beta tester wallets here
];

const ADMIN_WALLETS = [
  "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD", // Sean — Founder
];

const PLATFORM_BADGES_CONFIG = {
  "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD": [
    { id: "founder", label: "Founder", color: "#FFD700", bg: "#FFD70015", border: "#FFD70040" },
    { id: "beta", label: "Beta", color: "#00F0FF", bg: "#00F0FF15", border: "#00F0FF40" },
  ],
};

const SAMPLE_BOUNTIES = [
  { id: "sample_1", title: "Build Token-Gated Discord Bot", project: "SolanaFM", reward: 800, currency: "USDC", prizeType: "USDC", minTier: 3, tags: ["Bot", "Discord", "TypeScript"], submissions: 4, deadline: "2026-02-20", description: "Create a Discord bot that gates channels based on token holdings with real-time verification.", status: "open", isDemo: true, poster: null },
  { id: "sample_2", title: "Design Landing Page for NFT Collection", project: "Tensor", reward: 200, currency: "USDC", prizeType: "USDC", minTier: 2, tags: ["Design", "Frontend", "React"], submissions: 7, deadline: "2026-02-15", description: "Design and implement a responsive landing page for an upcoming NFT collection launch.", status: "open", isDemo: true, poster: null },
  { id: "sample_3", title: "Smart Contract Audit - Staking Program", project: "Marinade", reward: 3000, currency: "USDC", prizeType: "USDC", minTier: 4, tags: ["Rust", "Audit", "Security"], submissions: 1, deadline: "2026-03-01", description: "Full security audit of a Solana staking program written in Anchor/Rust.", status: "open", isDemo: true, poster: null },
  { id: "sample_4", title: "Create Educational Thread on Compressed NFTs", project: "Metaplex", reward: 75, currency: "USDC", prizeType: "USDC", minTier: 1, tags: ["Content", "Education", "cNFTs"], submissions: 12, deadline: "2026-02-12", description: "Write a comprehensive Twitter thread explaining compressed NFTs for beginners.", status: "open", isDemo: true, poster: null },
  { id: "sample_5", title: "Build Analytics Dashboard for DeFi Protocol", project: "Jupiter", reward: 4500, currency: "USDC", prizeType: "USDC", minTier: 5, tags: ["Frontend", "Data", "DeFi"], submissions: 0, deadline: "2026-03-15", description: "Full-stack analytics dashboard showing real-time protocol metrics, TVL, and user activity.", status: "open", isDemo: true, poster: null },
  { id: "sample_6", title: "Write Integration Guide for Wallet Adapter", project: "Solana Labs", reward: 150, currency: "USDC", prizeType: "USDC", minTier: 2, tags: ["Docs", "Tutorial", "TypeScript"], submissions: 3, deadline: "2026-02-18", description: "Step-by-step developer guide for integrating Solana Wallet Adapter into a React application.", status: "open", isDemo: true, poster: null },
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

const PrizeIcon = ({ pt, size = 24, style = {} }) =>
  pt?.img
    ? <img src={pt.img} alt={pt.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", ...style }} />
    : <span style={{ fontSize: size, lineHeight: 1, ...style }}>{pt?.icon}</span>;

const Countdown = ({ deadline, theme }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    if (!deadline) { setTimeLeft("Open"); return; }
    const target = new Date(deadline + (deadline.includes("T") ? "" : "T23:59:59"));
    if (isNaN(target.getTime())) { setTimeLeft(deadline); return; }
    const tick = () => {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("Ended"); setUrgent(true); return; }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setUrgent(days < 2);
      if (days > 0) setTimeLeft(`${days}d ${hrs}h ${mins}m`);
      else if (hrs > 0) setTimeLeft(`${hrs}h ${mins}m ${secs}s`);
      else setTimeLeft(`${mins}m ${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const color = timeLeft === "Ended" ? "#EF4444" : urgent ? "#F59E0B" : timeLeft === "Open" ? "#888" : theme?.primary || "#00F0FF";
  return (
    <span style={{ color, fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", fontSize: "inherit", letterSpacing: "-0.02em" }}>
      {timeLeft === "Ended" ? "⏰ Ended" : timeLeft === "Open" ? "Open" : `⏳ ${timeLeft}`}
    </span>
  );
};

const Logo = ({ size = 28 }) => (
  <img src="/logo.png" alt="FairBounty" style={{
    width: `${size}px`, height: `${size}px`, borderRadius: `${Math.max(4, size / 6)}px`,
    objectFit: "cover",
  }} />
);

const FAIRSCALE_TIER_MAP = {
  unranked: 1, bronze: 2, silver: 3, gold: 4, platinum: 5,
};

// ============================================================
// DATABASE API
// ============================================================
const DbAPI = {
  async getProfile(wallet) {
    try {
      const res = await fetch(`/api/db?action=get-profile&wallet=${wallet}`);
      const data = await res.json();
      return data.profile || null;
    } catch (e) { console.error("DbAPI.getProfile:", e); return null; }
  },
  async saveProfile(wallet, profile) {
    try {
      await fetch("/api/db?action=save-profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, profile }),
      });
    } catch (e) { console.error("DbAPI.saveProfile:", e); }
  },
  async getBxp(wallet) {
    try {
      const res = await fetch(`/api/db?action=get-bxp&wallet=${wallet}`);
      return await res.json();
    } catch (e) { return null; }
  },
  async claimWelcome(wallet, tier) {
    try {
      const res = await fetch("/api/db?action=claim-welcome", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, tier }),
      });
      return await res.json();
    } catch (e) { return { success: false }; }
  },
  async processReferral(referrerWallet, referredWallet, referrerTier, referredTier) {
    try {
      await fetch("/api/db?action=process-referral", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerWallet, referredWallet, referrerTier, referredTier }),
      });
    } catch (e) {}
  },
  async getReferrals(wallet) {
    try {
      const res = await fetch(`/api/db?action=get-referrals&wallet=${wallet}`);
      const data = await res.json();
      return data;
    } catch (e) { return { count: 0, referrals: [] }; }
  },
  async trackWallet(wallet) {
    try {
      await fetch("/api/db?action=track-wallet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
    } catch (e) {}
  },
  async getStats() {
    try {
      const res = await fetch("/api/db?action=get-stats");
      return await res.json();
    } catch (e) { return null; }
  },
  async submitBountyApp(wallet, displayName, fairScore, form) {
    try {
      await fetch("/api/db?action=submit-bounty-app", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, displayName, fairScore, form }),
      });
    } catch (e) {}
  },
  async setReferralCode(wallet, code) {
    try {
      const res = await fetch("/api/db?action=set-referral-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, code }),
      });
      return await res.json();
    } catch (e) { return { code: null }; }
  },
  async getReferralCode(wallet) {
    try {
      const res = await fetch(`/api/db?action=get-referral-code&wallet=${wallet}`);
      const data = await res.json();
      return data.code || null;
    } catch (e) { return null; }
  },
  async resolveReferral(code) {
    try {
      const res = await fetch(`/api/db?action=resolve-referral&code=${encodeURIComponent(code)}`);
      const data = await res.json();
      return data.wallet || null;
    } catch (e) { return null; }
  },
  // Beta bounty CRUD
  async createBounty(bountyData) {
    try {
      const res = await fetch("/api/db?action=create-bounty", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bountyData),
      });
      return await res.json();
    } catch (e) { console.error("DbAPI.createBounty:", e); return { success: false }; }
  },
  async getBounties() {
    try {
      const res = await fetch("/api/db?action=get-bounties");
      return await res.json();
    } catch (e) { return []; }
  },
  async submitWork(bountyId, wallet, displayName, tier, content, links) {
    try {
      const res = await fetch("/api/db?action=submit-work", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId, wallet, displayName, tier, content, links }),
      });
      return await res.json();
    } catch (e) { return { success: false }; }
  },
  async getSubmissions(bountyId) {
    try {
      const res = await fetch(`/api/db?action=get-submissions&bountyId=${bountyId}`);
      return await res.json();
    } catch (e) { return []; }
  },
  async vote(submissionId, voterWallet, voteType, voteWeight) {
    try {
      const res = await fetch("/api/db?action=vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, voterWallet, voteType, voteWeight }),
      });
      return await res.json();
    } catch (e) { return { success: false }; }
  },
  async selectWinner(bountyId, submissionId, posterWallet) {
    try {
      const res = await fetch("/api/db?action=select-winner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId, submissionId, posterWallet }),
      });
      return await res.json();
    } catch (e) { return { success: false }; }
  },
  async checkBetaAccess(wallet) {
    // Check whitelist + allow expansion via DB
    if (BETA_WHITELIST.includes(wallet)) return true;
    try {
      const res = await fetch(`/api/db?action=check-beta&wallet=${wallet}`);
      const data = await res.json();
      return data.hasAccess || false;
    } catch (e) { return false; }
  },
};

const FairScoreAPI = {
  async getScore(walletAddress) {
    try {
      const response = await fetch(`/api/fairscore?wallet=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const tier = FAIRSCALE_TIER_MAP[data.tier] || 1;
      return {
        tier, score: Math.round(data.fairscore || 0),
        fairscoreBase: data.fairscore_base || 0,
        socialScore: data.social_score || 0,
        fairscaleTier: data.tier || "unranked",
        badges: data.badges || [],
        actions: data.actions || [],
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
        _raw: data,
      };
    } catch (err) { return null; }
  },
  assessRisk(scoreData) {
    if (!scoreData) return RISK_LEVELS[1];
    return RISK_LEVELS[scoreData.tier] || RISK_LEVELS[1];
  },
  getRewardBonus(tier) { return TIER_CONFIG[tier]?.rewardBonus || 0; },
  getVoteWeight(tier) { return TIER_CONFIG[tier]?.voteWeight || 1; },
  getXpMultiplier(tier) { return TIER_CONFIG[tier]?.xpMultiplier || 1.0; },
};

export default function FairBounty() {
  const PLATFORM_BADGES = PLATFORM_BADGES_CONFIG;
  const isBetaUser = (addr) => addr && BETA_WHITELIST.includes(addr);

  // ============================================================
  // STATE
  // ============================================================
  const [view, setView] = useState("landing");
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTab, setAdminTab] = useState("bounties");
  const [betaInputWallet, setBetaInputWallet] = useState("");
  const [betaInputNote, setBetaInputNote] = useState("");
  const [lang, setLang] = useState("en");
  const [translatedBounty, setTranslatedBounty] = useState(null);
  const [translating, setTranslating] = useState(false);

  const t = {
    en: {
      bounties: "Bounties", postBounty: "Post Bounty", howItWorks: "How It Works",
      about: "About", leaderboard: "Leaderboard", connect: "Connect Wallet",
      disconnect: "Disconnect", submitWork: "Submit Work →", bookmark: "Bookmark",
      bookmarked: "Bookmarked", tierRequired: "Tier Required", allTiers: "All Tiers",
      liveOnly: "Live Only", demoOnly: "Examples", filterType: "Filter",
      noBounties: "No bounties match your filters.", viewDetails: "View Details",
      deadline: "Deadline", submissions: "Submissions", minTier: "Min Tier",
      prize: "Prize", postedBy: "Posted by", betaOnly: "Beta Access Only",
      betaDesc: "Submissions and voting are live for beta testers. Want in?",
      dmUs: "DM @smsonx on X.", gotIt: "Got it",
      noBookmarks: "No bookmarked bounties yet.", editProfile: "Edit Profile",
      overview: "Overview", skills: "Skills", referrals: "Referrals",
      yourLink: "Your referral link", copy: "Copy", shareX: "Share on X",
      telegram: "Telegram", earned: "BXP earned", joinedDate: "Joined",
      won: "Won", beta: "Beta", tier: "Tier", bxp: "BXP",
      submitForReview: "Submit for Review →", postingAs: "Posting as",
      titleLabel: "Bounty Title", descLabel: "Description", projectLabel: "Project Name",
      rewardLabel: "Prize Amount", deadlineLabel: "Deadline", categoryLabel: "Category",
      contactLabel: "Contact Method", requirementsLabel: "Submission Requirements",
      criteriaLabel: "Evaluation Criteria", cancel: "Cancel",
      approved: "✅ Approved & live!", rejected: "❌ Rejected",
      pending: "Pending", live: "Live", refresh: "🔄 Refresh",
      prizeType: "Prize Type", yourBounty: "Your Bounty", topVoted: "Top Voted",
      prizeTypes: "Prize Types", howFairScore: "How FairScore Powers Everything",
      connectedWallets: "CONNECTED WALLETS", liveBounties: "LIVE BOUNTIES", profiles: "PROFILES",
      tierGated: "Tier-Gated Access", communityReview: "Community Review", dynamicRewards: "Dynamic Rewards",
      riskAssessment: "Risk Assessment", bxpMultipliers: "BXP Multipliers", referralGating: "Referral Gating",
      letsGo: "Let's Go →", home: "Home", backBounties: "Bounties",
      welcomeBonus: "Welcome Bonus", referralEarnings: "Referral Earnings", referredBonus: "Referred Bonus",
      submissionsLabel: "Submissions", bxpBreakdown: "BXP Breakdown",
      yourReferralLink: "Your Referral Link", earnPer: "You earn", perReferral: "BXP per referral · they earn the same",
      linkSlug: "YOUR LINK SLUG", tapEdit: "tap Edit to set your slug",
      shareOnX: "Share on X", referralList: "Who you've referred",
      joinedDate2: "Joined", onChainStats: "On-Chain Stats",
      fairscoreBadges: "FAIRSCALE BADGES", noSubmissionsYet: "No submissions yet",
      postBountyTitle: "Post a Bounty", betaPostNote: "Beta: Bounties go live after founder review.",
      prizeTypeLabel: "Prize Type *", minTierLabel: "Min Tier", tagsLabel: "Tags",
      contactMethod: "Contact Method", contactValue: "Contact / Handle",
      submitReview: "Submit for Review →", livePreview: "Live Preview",
      detected: "Detected", notDetected: "Not Detected",
      connectWalletTitle: "Connect Wallet", connectSubtitle: "Choose your Solana wallet. FairScore fetched automatically.",
      howItWorksTitle: "How It Works", aboutTitle: "About FairBounty",
      setUpProfile: "Set Up Your Profile", basics: "Basics", socials: "Socials",
      skipForNow: "Skip for now", saveProfile: "Save Profile →",
      displayNameLabel: "Display Name *", bioLabel: "Bio", xHandleLabel: "X Handle",
      locationLabel: "Location", worksAtLabel: "Works At",
      adminPanel: "Admin Panel", pendingBounties: "Pending", liveBountiesTab: "Live", rejectedTab: "Rejected",
      intakeForms: "Intake Forms", profilesTab: "Profiles", betaAccess: "Beta Access",
      approve: "Approve", reject: "Reject", delete: "Delete", revoke: "Revoke",
      grantAccess: "Grant Access", walletAddress: "Wallet address",
      winnersLabel: "Winners", leaderboardTitle: "Leaderboard",
      // Remaining UI strings
      adminOnly: "Admin Only", amountLabel: "Amount *", bestContact: "Best Contact",
      bountyTitleLabel: "Bounty Title *", collectibleName: "Collectible Name *",
      connectFirst: "Connect Wallet First", connectToSubmit: "Connect Wallet to Submit",
      contactHandle: "Contact Handle", descriptionLabel: "Description *",
      detailsLink: "Details / Link (optional)", displayName2: "Display Name *",
      exampleBounty: "Example Bounty", fetchingScore: "Fetching FairScore...",
      fillForm: "Fill out the form and submit for review. We'll check the details and get your bounty live.",
      grantsAccess: "{t.grantsAccess}",
      howBxpWorks: "Here's how BXP works", howToEarnBxp: "How to Earn BXP",
      howToIncreaseTier: "How to increase your tier", linksOptional: "Links (optional)",
      leaderboardLaunching: "Live leaderboard launching with full bounty system. Preview below.",
      mintAddress: "Mint Address (optional)", nftName: "NFT Name *",
      noBetaUsers: "No beta users yet", noIntakeForms: "No intake form submissions",
      noLiveBounties: "No live bounties", noPendingBounties: "No pending bounties",
      noRejectedBounties: "No rejected bounties", noSkills: "No skills added yet.",
      onChainActivity: "On-Chain Activity", orSelectWallet: "Or select another wallet:",
      otherToken: "Other Token", platformBxp: "Platform BXP", platformBadges: "Platform Badges",
      postBountySubtitle: "Post bounties with stablecoins, memecoins, NFTs, or collectibles as prizes",
      poweredBy: "Powered by FairScale", prizeTypeStar: "Prize Type *",
      profilePicture: "Profile Picture", projectCompany: "Project / Company *",
      queryingApi: "Querying FairScale API", reputationGated: "Reputation-gated bounties for the Solana ecosystem, powered by FairScale.",
      rewardAmount: "Reward Amount *", solAmount: "SOL Amount *",
      saveProfileEnter: "{t.saveProfileEnter}", socialProfiles: "Social Profiles",
      solanaMadeSimple: "Solana Made Simple", submissionReqsLabel: "Submission Requirements",
      submitApplication: "Submit Application →", submitYourWork: "Submit Your Work",
      submitBountyNote: "Submit your bounty for review. We'll verify the details and get it live on the board.",
      tapToExpand: "Tap to expand.", sampleNote: "{t.sampleNote}",
      founderOnly: "{t.founderOnly}",
      tiersLevelUp: "Tiers & How to Level Up", tokenTicker: "Token Ticker *",
      total: "Total:", translating: "Translating content... ⏳",
      tryFilters: "Try adjusting your filters", uploadImage: "Upload Image",
      voteBeta: "Vote (Beta)", voteWeight: "Vote Weight",
      welcomeTo: "Welcome to FairBounty", worksAt2: "Works at",
      xTwitterDm: "X / Twitter DM", yourSubmissionStar: "Your Submission *",
      yourLinkSlug: "Your link slug",
      reputationEngine: "Your on-chain reputation is the engine. Every feature is gated, weighted, or enhanced by FairScore.",
      reputationKey: "Your on-chain reputation is your key. Here's how FairScore powers every part of FairBounty.",
      fairscoreTierBenefits: "FairScore Tier Benefits", onChainStats2: "On-Chain Activity",
      selectWinner: "🏆 Select as Winner", winner: "🏆 Winner",
      upVote: "Up", downVote: "Down", score: "Score",
      riskLevel: "YOUR RISK LEVEL", escrowNote: "Prize escrow coming soon — for now, prize release is coordinated directly between poster and winner.",
      submissionReqs: "SUBMISSION REQUIREMENTS", evalCriteria: "EVALUATION CRITERIA",
      noSubmissions: "No submissions yet. Be the first!", yourSubmission: "Your Submission",
      submissionPlaceholder: "Describe your work, approach, and results...",
      linksPlaceholder: "Links to your work (GitHub, demo, etc.)",
      alreadySubmitted: "Already submitted", selectWinnerBtn: "Select Winner",
    },
    es: {
      bounties: "Recompensas", postBounty: "Publicar", howItWorks: "Cómo Funciona",
      about: "Acerca de", leaderboard: "Clasificación", connect: "Conectar Wallet",
      disconnect: "Desconectar", submitWork: "Enviar Trabajo →", bookmark: "Guardar",
      bookmarked: "Guardado", tierRequired: "Nivel Requerido", allTiers: "Todos los Niveles",
      liveOnly: "Solo Activos", demoOnly: "Ejemplos", filterType: "Filtrar",
      noBounties: "No hay recompensas que coincidan.", viewDetails: "Ver Detalles",
      deadline: "Fecha Límite", submissions: "Envíos", minTier: "Nivel Mín.",
      prize: "Premio", postedBy: "Publicado por", betaOnly: "Solo Acceso Beta",
      betaDesc: "Los envíos y votos son en vivo para testers beta. ¿Quieres entrar?",
      dmUs: "DM @smsonx en X.", gotIt: "Entendido",
      noBookmarks: "Aún no hay recompensas guardadas.", editProfile: "Editar Perfil",
      overview: "Resumen", skills: "Habilidades", referrals: "Referidos",
      yourLink: "Tu enlace de referido", copy: "Copiar", shareX: "Compartir en X",
      telegram: "Telegram", earned: "BXP ganado", joinedDate: "Se unió",
      won: "Ganado", beta: "Beta", tier: "Nivel", bxp: "BXP",
      submitForReview: "Enviar para Revisión →", postingAs: "Publicando como",
      titleLabel: "Título de la Recompensa", descLabel: "Descripción", projectLabel: "Nombre del Proyecto",
      rewardLabel: "Monto del Premio", deadlineLabel: "Fecha Límite", categoryLabel: "Categoría",
      contactLabel: "Método de Contacto", requirementsLabel: "Requisitos de Envío",
      criteriaLabel: "Criterios de Evaluación", cancel: "Cancelar",
      approved: "✅ ¡Aprobado y en vivo!", rejected: "❌ Rechazado",
      pending: "Pendiente", live: "En Vivo", refresh: "🔄 Actualizar",
      prizeType: "Tipo de Premio", yourBounty: "Tu Recompensa", topVoted: "Más Votado",
      prizeTypes: "Tipos de Premio", howFairScore: "Cómo FairScore Impulsa Todo",
      connectedWallets: "WALLETS CONECTADAS", liveBounties: "RECOMPENSAS EN VIVO", profiles: "PERFILES",
      tierGated: "Acceso por Nivel", communityReview: "Revisión Comunitaria", dynamicRewards: "Recompensas Dinámicas",
      riskAssessment: "Evaluación de Riesgo", bxpMultipliers: "Multiplicadores BXP", referralGating: "Referidos Controlados",
      letsGo: "¡Vamos! →", home: "Inicio", backBounties: "Recompensas",
      welcomeBonus: "Bono de Bienvenida", referralEarnings: "Ganancias por Referido", referredBonus: "Bono de Referido",
      submissionsLabel: "Entregas", bxpBreakdown: "Desglose de BXP",
      yourReferralLink: "Tu Enlace de Referido", earnPer: "Ganas", perReferral: "BXP por referido · ellos ganan lo mismo",
      linkSlug: "TU SLUG DE ENLACE", tapEdit: "toca Editar para configurar tu slug",
      shareOnX: "Compartir en X", referralList: "A quién has referido",
      joinedDate2: "Se unió", onChainStats: "Estadísticas On-Chain",
      fairscoreBadges: "INSIGNIAS FAIRSCALE", noSubmissionsYet: "Aún no hay entregas",
      postBountyTitle: "Publicar Recompensa", betaPostNote: "Beta: Las recompensas se publican tras revisión del fundador.",
      prizeTypeLabel: "Tipo de Premio *", minTierLabel: "Nivel Mínimo", tagsLabel: "Etiquetas",
      contactMethod: "Método de Contacto", contactValue: "Contacto / Usuario",
      submitReview: "Enviar para Revisión →", livePreview: "Vista Previa",
      detected: "Detectado", notDetected: "No Detectado",
      connectWalletTitle: "Conectar Wallet", connectSubtitle: "Elige tu wallet de Solana. FairScore se obtiene automáticamente.",
      howItWorksTitle: "Cómo Funciona", aboutTitle: "Acerca de FairBounty",
      setUpProfile: "Configura Tu Perfil", basics: "Básico", socials: "Redes",
      skipForNow: "Omitir por ahora", saveProfile: "Guardar Perfil →",
      displayNameLabel: "Nombre Visible *", bioLabel: "Bio", xHandleLabel: "Usuario de X",
      locationLabel: "Ubicación", worksAtLabel: "Trabaja en",
      adminPanel: "Panel de Admin", pendingBounties: "Pendientes", liveBountiesTab: "En Vivo", rejectedTab: "Rechazados",
      intakeForms: "Formularios", profilesTab: "Perfiles", betaAccess: "Acceso Beta",
      approve: "Aprobar", reject: "Rechazar", delete: "Eliminar", revoke: "Revocar",
      grantAccess: "Dar Acceso", walletAddress: "Dirección de wallet",
      winnersLabel: "Ganadores", leaderboardTitle: "Clasificación",
      // Remaining UI strings
      adminOnly: "Solo Admin", amountLabel: "Monto *", bestContact: "Mejor Contacto",
      bountyTitleLabel: "Título de Recompensa *", collectibleName: "Nombre del Coleccionable *",
      connectFirst: "Conecta tu Wallet Primero", connectToSubmit: "Conecta Wallet para Enviar",
      contactHandle: "Usuario de Contacto", descriptionLabel: "Descripción *",
      detailsLink: "Detalles / Link (opcional)", displayName2: "Nombre Visible *",
      exampleBounty: "Recompensa de Ejemplo", fetchingScore: "Obteniendo FairScore...",
      fillForm: "Completa el formulario y envía para revisión. Verificaremos los detalles y publicaremos tu recompensa.",
      grantsAccess: "Acceso completo: publicar recompensas, enviar trabajo, votar.",
      howBxpWorks: "Cómo funciona el BXP", howToEarnBxp: "Cómo Ganar BXP",
      howToIncreaseTier: "Cómo subir de nivel", linksOptional: "Links (opcional)",
      leaderboardLaunching: "Clasificación en vivo próximamente con el sistema completo de recompensas.",
      mintAddress: "Dirección del Mint (opcional)", nftName: "Nombre del NFT *",
      noBetaUsers: "Aún no hay usuarios beta", noIntakeForms: "Sin formularios de solicitud",
      noLiveBounties: "Sin recompensas en vivo", noPendingBounties: "Sin recompensas pendientes",
      noRejectedBounties: "Sin recompensas rechazadas", noSkills: "Aún no hay habilidades.",
      onChainActivity: "Actividad On-Chain", orSelectWallet: "O selecciona otra wallet:",
      otherToken: "Otro Token", platformBxp: "BXP de Plataforma", platformBadges: "Insignias de Plataforma",
      postBountySubtitle: "Publica recompensas con stablecoins, memecoins, NFTs o coleccionables",
      poweredBy: "Impulsado por FairScale", prizeTypeStar: "Tipo de Premio *",
      profilePicture: "Foto de Perfil", projectCompany: "Proyecto / Empresa *",
      queryingApi: "Consultando API de FairScale", reputationGated: "Recompensas con reputación para el ecosistema Solana, impulsado por FairScale.",
      rewardAmount: "Monto del Premio *", solAmount: "Monto en SOL *",
      saveProfileEnter: "Guardar Perfil y Entrar →", socialProfiles: "Perfiles Sociales",
      solanaMadeSimple: "Solana Made Simple", submissionReqsLabel: "Requisitos de Envío",
      submitApplication: "Enviar Solicitud →", submitYourWork: "Envía Tu Trabajo",
      submitBountyNote: "Envía tu recompensa para revisión. Verificaremos los detalles y la publicaremos.",
      tapToExpand: "Toca para expandir.", sampleNote: "Esto es un ejemplo. Conéctate para ver recompensas reales de usuarios beta.",
      founderOnly: "Esta página está restringida a la wallet del fundador.",
      tiersLevelUp: "Niveles y Cómo Subir", tokenTicker: "Ticker del Token *",
      total: "Total:", translating: "Traduciendo contenido... ⏳",
      tryFilters: "Intenta ajustar tus filtros", uploadImage: "Subir Imagen",
      voteBeta: "Votar (Beta)", voteWeight: "Peso del Voto",
      welcomeTo: "Bienvenido a FairBounty", worksAt2: "Trabaja en",
      xTwitterDm: "DM por X / Twitter", yourSubmissionStar: "Tu Entrega *",
      yourLinkSlug: "Tu slug de enlace",
      reputationEngine: "Tu reputación on-chain es el motor. Cada función está controlada, ponderada o mejorada por FairScore.",
      reputationKey: "Tu reputación on-chain es tu clave. Así es como FairScore impulsa cada parte de FairBounty.",
      fairscoreTierBenefits: "Beneficios por Nivel FairScore", onChainStats2: "Actividad On-Chain",
      selectWinner: "🏆 Seleccionar Ganador", winner: "🏆 Ganador",
      upVote: "Arriba", downVote: "Abajo", score: "Puntuación",
      riskLevel: "TU NIVEL DE RIESGO", escrowNote: "Depósito de premio próximamente — por ahora, la entrega del premio se coordina directamente entre el publicador y el ganador.",
      submissionReqs: "REQUISITOS DE ENVÍO", evalCriteria: "CRITERIOS DE EVALUACIÓN",
      noSubmissions: "Aún no hay envíos. ¡Sé el primero!", yourSubmission: "Tu Envío",
      submissionPlaceholder: "Describe tu trabajo, enfoque y resultados...",
      linksPlaceholder: "Enlaces a tu trabajo (GitHub, demo, etc.)",
      alreadySubmitted: "Ya enviado", selectWinnerBtn: "Seleccionar Ganador",
    },
  }[lang];
  const [wallet, setWallet] = useState(null);
  const [walletType, setWalletType] = useState("default");

  const [fairScore, setFairScore] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [xp, setXp] = useState(0);
  const [liveBounties, setLiveBounties] = useState([]); // real bounties from DB
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [selectedBountySubmissions, setSelectedBountySubmissions] = useState([]);
  const [filterTier, setFilterTier] = useState(0);
  const [filterType, setFilterType] = useState("all"); // "all" | "live" | "demo"
  const [showReferral, setShowReferral] = useState(false);
  const [notification, setNotification] = useState(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionLinks, setSubmissionLinks] = useState("");
  const [animateIn, setAnimateIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [standardWallets, setStandardWallets] = useState([]);
  const [fullAddress, setFullAddress] = useState(null);
  const [betaAccess, setBetaAccess] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    displayName: "", xHandle: "", bio: "", contact: "", email: "",
    pfpUrl: "", linkedin: "", github: "", website: "", telegram: "", discord: "",
    lookingFor: "", worksAt: "", location: "", skills: [],
  });
  const [bookmarks, setBookmarks] = useState([]);
  const [profileTab, setProfileTab] = useState("overview");
  const [setupTab, setSetupTab] = useState("Basics");
  const [activeStep, setActiveStep] = useState(0);
  const [activeTier, setActiveTier] = useState(null);
  const [bountyApplications, setBountyApplications] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fb_bounty_applications") || "[]"); } catch { return []; }
  });
  const [bountyForm, setBountyForm] = useState({ projectName: "", title: "", description: "", reward: "", currency: "USDC", minTier: 1, deadline: "", category: "", contactMethod: "", contactValue: "" });
  const [connectedWallets, setConnectedWallets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fb_connected_wallets") || "[]"); } catch { return []; }
  });
  const [referredBy, setReferredBy] = useState(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralList, setReferralList] = useState([]);
  const [globalStats, setGlobalStats] = useState({ connectedWallets: 0, profiles: 0, bountyApps: 0 });
  const [referralCode, setReferralCode] = useState(null);
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [bxpBreakdown, setBxpBreakdown] = useState({ welcome: 0, referrals: 0, referred: 0, submissions: 0, wins: 0 });

  // Post Bounty form (beta)
  const [betaBountyForm, setBetaBountyForm] = useState({
    title: "", description: "", projectName: "", category: "",
    prizeType: "USDC", reward: "", currency: "USDC",
    memeToken: "", memeTokenAmount: "",
    nftMint: "", nftName: "", nftImageUrl: "",
    minTier: 1, deadline: "", tags: "",
    contactMethod: "x", contactValue: "",
    submissionRequirements: "",
    evaluationCriteria: "",
  });

  // Load global stats + live bounties on mount
  useEffect(() => {
    DbAPI.getStats().then((stats) => { if (stats) setGlobalStats(stats); });
    DbAPI.getBounties().then((bounties) => { if (Array.isArray(bounties)) setLiveBounties(bounties); });
  }, []);

  // Referral detection
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");
        if (ref) {
          if (ref.length >= 32) setReferredBy(ref);
          else {
            const w = await DbAPI.resolveReferral(ref);
            if (w) setReferredBy(w);
          }
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch (e) {}
    })();
  }, []);

  const isIOS = useMemo(() => /iPhone|iPad|iPod/i.test(navigator.userAgent), []);
  const isMobile = useMemo(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), []);

  useEffect(() => {
    const { get, on } = getWallets();
    setStandardWallets(get());
    const removeListener = on("register", () => setStandardWallets(get()));
    return () => removeListener();
  }, []);

  useEffect(() => {
    registerMwa({
      appIdentity: { name: "FairBounty", uri: "https://fairbounty.vercel.app", icon: "/logo.png" },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: ["solana:mainnet"],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, []);

  const findMwaWallet = useCallback(() => {
    return standardWallets.find(w =>
      w.name?.toLowerCase().includes("mobile wallet adapter") ||
      w.name?.toLowerCase().includes("seed vault") ||
      w.name?.toLowerCase().includes("mwa")
    );
  }, [standardWallets]);

  const findJupiterWallet = useCallback(() => {
    return standardWallets.find(w =>
      w.name?.toLowerCase().includes("jupiter") || w.name?.toLowerCase() === "jup"
    );
  }, [standardWallets]);

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
    { id: "glow", name: "Glow", window: "glow", check: (w) => !!w, downloadUrl: "https://glow.app/" },
    { id: "seedvault", name: "Seed Vault", useStandard: true, isMwa: true },
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

  // Load submissions when bounty detail view opens
  useEffect(() => {
    if (view === "bounty" && selectedBounty && !selectedBounty.isDemo) {
      DbAPI.getSubmissions(selectedBounty.id).then(subs => {
        setSelectedBountySubmissions(Array.isArray(subs) ? subs : []);
      });
    } else if (view !== "bounty") {
      setSelectedBountySubmissions([]);
    }
  }, [view, selectedBounty?.id]);

  // Translate bounty content when lang = es
  useEffect(() => {
    if (lang !== "es" || view !== "bounty" || !selectedBounty) {
      setTranslatedBounty(null);
      return;
    }
    const cacheKey = `fb_tx_es_${selectedBounty.id || selectedBounty.title}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setTranslatedBounty(JSON.parse(cached)); return; }
    } catch (e) {}
    setTranslating(true);
    const fieldsToTranslate = {
      title: selectedBounty.title,
      description: selectedBounty.description,
      submissionRequirements: selectedBounty.submissionRequirements || selectedBounty.submission_requirements || "",
      evaluationCriteria: selectedBounty.evaluationCriteria || selectedBounty.evaluation_criteria || "",
      tags: (selectedBounty.tags || []).join(", "),
    };
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Translate the following bounty fields from English to Spanish. Return ONLY a JSON object with the same keys. Keep technical terms, brand names, wallet addresses, and emojis as-is. Be natural and professional.\n\n${JSON.stringify(fieldsToTranslate)}`,
        }],
      }),
    })
    .then(r => r.json())
    .then(data => {
      const text = (data.content || []).map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setTranslatedBounty(parsed);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch (e) {}
    })
    .catch(() => setTranslatedBounty(null))
    .finally(() => setTranslating(false));
  }, [lang, view, selectedBounty?.id]);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ============================================================
  // WALLET CONNECT
  // ============================================================
  const connectWallet = async (type) => {
    setWalletType(type);
    setLoading(true);
    setShowDemoModal(false);
    // Clear previous wallet's state immediately to prevent bleed
    setReferralCode(null);
    setSlugInput("");
    setSlugEditing(false);
    setReferralCount(0);
    setReferralList([]);
    setBxpBreakdown({ welcome: 0, referrals: 0, referred: 0, submissions: 0, wins: 0 });
    setBookmarks([]);
    const opt = walletOptions.find((w) => w.id === type);
    if (!opt) { setLoading(false); return; }

    try {
      let pubkey = null;

      if (opt.isMwa) {
        const mwaWallet = findMwaWallet();
        if (!mwaWallet) {
          notify("Seed Vault / Mobile Wallet Adapter not available. This wallet is only available on Solana Mobile devices.");
          setLoading(false); return;
        }
        const connectFeature = mwaWallet.features?.["standard:connect"];
        if (!connectFeature) throw new Error("Wallet does not support connect");
        const result = await connectFeature.connect();
        if (result.accounts?.length > 0) pubkey = result.accounts[0].address;
        else throw new Error("No accounts returned");
      } else if (opt.useStandard) {
        const jupiterWallet = findJupiterWallet();
        if (jupiterWallet) {
          const connectFeature = jupiterWallet.features?.["standard:connect"];
          if (connectFeature) {
            const result = await connectFeature.connect();
            const account = result?.accounts?.[0] || jupiterWallet.accounts?.[0];
            if (account?.address) pubkey = account.address;
            else if (account?.publicKey) pubkey = encodeBase58(account.publicKey);
          }
        }
        if (!pubkey && isMobile && opt.mobileLink) { window.location.href = opt.mobileLink; setLoading(false); return; }
        if (!pubkey && !isMobile && opt.downloadUrl) { notify(`${opt.name} not detected. Opening download page...`); window.open(opt.downloadUrl, "_blank"); setLoading(false); return; }
      }

      if (!pubkey && opt.window) {
        const provider = window[opt.window];
        if (provider && (!opt.check || opt.check(provider))) {
          const resp = await provider.connect();
          pubkey = resp?.publicKey?.toString() || provider.publicKey?.toString();
        }
      }
      if (!pubkey && isMobile && opt.mobileLink) { window.location.href = opt.mobileLink; setLoading(false); return; }
      if (!pubkey && !isMobile && opt.downloadUrl) { notify(`${opt.name} not detected. Opening download page...`); window.open(opt.downloadUrl, "_blank"); setLoading(false); return; }

      if (pubkey) {
        const displayAddr = pubkey.length > 20 ? pubkey.slice(0, 6) + "..." + pubkey.slice(-4) : pubkey;
        setWallet(displayAddr);
        setFullAddress(pubkey);

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
          notify(`Connected! FairScore: Tier ${data.tier} (${TIER_CONFIG[data.tier].label})`);
        }

        DbAPI.trackWallet(pubkey);

        // Load bookmarks
        try {
          const saved = localStorage.getItem(`fb_bookmarks_${pubkey}`);
          if (saved) setBookmarks(JSON.parse(saved));
        } catch (e) {}

        // Check beta access
        const hasBeta = await DbAPI.checkBetaAccess(pubkey);
        setBetaAccess(hasBeta);

        // Restore profile
        try {
          // Try localStorage first as immediate fallback
          let dbProfile = null;
          try {
            dbProfile = await DbAPI.getProfile(pubkey);
          } catch (e) {
            console.warn("DB profile fetch failed, trying localStorage:", e);
          }
          // If DB returned null, try localStorage
          if (!dbProfile) {
            const saved = localStorage.getItem(`fb_profile_${pubkey}`);
            if (saved) dbProfile = JSON.parse(saved);
          }
          if (dbProfile) {
            setProfile(dbProfile);
            setProfileForm({ displayName: dbProfile.displayName || "", xHandle: dbProfile.xHandle || "", bio: dbProfile.bio || "", contact: dbProfile.contact || "", email: dbProfile.email || "", pfpUrl: dbProfile.pfpUrl || "", linkedin: dbProfile.linkedin || "", github: dbProfile.github || "", website: dbProfile.website || "", telegram: dbProfile.telegram || "", discord: dbProfile.discord || "", lookingFor: dbProfile.lookingFor || "", worksAt: dbProfile.worksAt || "", location: dbProfile.location || "", skills: dbProfile.skills || [] });
            try {
              const bxpData = await DbAPI.getBxp(pubkey);
              if (bxpData?.bxp) {
                setBxpBreakdown(bxpData.bxp);
                setXp(Object.values(bxpData.bxp).reduce((a, b) => a + b, 0));
              }
            } catch (e) { console.warn("BXP load failed:", e); }
            try {
              const refData = await DbAPI.getReferrals(pubkey);
              setReferralCount(refData?.count || 0);
              setReferralList(refData?.referrals || []);
            } catch (e) { console.warn("Referral count load failed:", e); }
            try { localStorage.setItem(`fb_profile_${pubkey}`, JSON.stringify(dbProfile)); } catch (e) {}
            try {
              const code = await DbAPI.getReferralCode(pubkey);
              if (code) setReferralCode(code);
            } catch (e) { console.warn("Referral code load failed:", e); }
            setLoading(false);
            setView("dashboard");
            return;
          }
        } catch (e) { 
          console.error("Profile restore error:", e, e.stack);
          notify(`Debug: ${e.message?.slice(0,80)}`);
          setLoading(false);
          setView("profile-setup");
          return;
        }

        setLoading(false);
        setView("profile-setup");
        return;
      }

      // Demo fallback — only if truly no wallet found
      notify("No wallet detected — try installing Phantom or Backpack.");
      setLoading(false);
      setView("connect");
    } catch (err) {
      console.log("Wallet connect error:", err.message);
      // Don't fall to demo — show real error so user can retry
      notify(`Connection failed: ${err.message?.slice(0, 60) || "Unknown error"} — please try again.`);
      setLoading(false);
      setView("connect");
    }
  };

  const encodeBase58 = (bytes) => {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let result = "";
    let num = BigInt("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
    while (num > 0n) { result = ALPHABET[Number(num % 58n)] + result; num = num / 58n; }
    for (const b of bytes) { if (b === 0) result = "1" + result; else break; }
    return result;
  };

  // ============================================================
  // PROFILE SAVE
  // ============================================================
  const handleProfileSave = async () => {
    if (!profileForm.displayName.trim()) { notify("Display name is required."); return; }
    const handle = profileForm.xHandle.replace(/^@/, "");
    const profileData = {
      displayName: profileForm.displayName.trim(), xHandle: handle, bio: profileForm.bio.trim(),
      contact: profileForm.contact.trim(), email: profileForm.email.trim(), pfpUrl: profileForm.pfpUrl.trim(),
      linkedin: profileForm.linkedin.trim(), github: profileForm.github.trim(), website: profileForm.website.trim(),
      telegram: profileForm.telegram.trim(), discord: profileForm.discord.trim(),
      lookingFor: profileForm.lookingFor, worksAt: profileForm.worksAt.trim(),
      location: profileForm.location.trim(), skills: profileForm.skills || [],
      joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    };
    setProfile(profileData);
    if (fullAddress) {
      try { localStorage.setItem(`fb_profile_${fullAddress}`, JSON.stringify(profileData)); } catch (e) {}
      DbAPI.saveProfile(fullAddress, profileData);
      const codeBase = (profileForm.displayName || "user").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const codeResult = await DbAPI.setReferralCode(fullAddress, codeBase);
      if (codeResult.code) setReferralCode(codeResult.code);
    }
    const multiplier = FairScoreAPI.getXpMultiplier(fairScore || 1);
    let newBxp = { ...bxpBreakdown };
    let bonusMessages = [];
    const alreadyClaimed = localStorage.getItem(`fb_welcome_${fullAddress}`);
    if (!alreadyClaimed && fullAddress) {
      const welcomeAmount = Math.floor(100 * multiplier);
      const result = await DbAPI.claimWelcome(fullAddress, fairScore || 1);
      if (result.success || result.already_claimed === undefined) {
        newBxp.welcome = result.amount || welcomeAmount;
        bonusMessages.push(`+${newBxp.welcome} BXP welcome bonus`);
        try { localStorage.setItem(`fb_welcome_${fullAddress}`, "1"); } catch (e) {}
      }
    }
    if (referredBy && referredBy !== fullAddress && !localStorage.getItem(`fb_was_referred_${fullAddress}`)) {
      const referredAmount = Math.floor(50 * multiplier);
      newBxp.referred = referredAmount;
      bonusMessages.push(`+${referredAmount} BXP referral bonus`);
      DbAPI.processReferral(referredBy, fullAddress, fairScore || 1, fairScore || 1);
      try { localStorage.setItem(`fb_was_referred_${fullAddress}`, referredBy); } catch (e) {}
    }
    setBxpBreakdown(newBxp);
    const totalBxp = Object.values(newBxp).reduce((a, b) => a + b, 0);
    setXp(totalBxp);
    if (fullAddress) { try { localStorage.setItem(`fb_bxp_${fullAddress}`, JSON.stringify(newBxp)); } catch (e) {} }
    if (fullAddress) { const refData = await DbAPI.getReferrals(fullAddress); setReferralCount(refData.count || 0); setReferralList(refData.referrals || []); }
    notify(`Welcome, ${profileForm.displayName}!${bonusMessages.length ? " " + bonusMessages.join(" · ") : ""}`);
    const seenWelcome = localStorage.getItem(`fb_seen_welcome_${fullAddress}`);
    if (!seenWelcome) setShowWelcomeModal(true);
    setView("dashboard");
  };

  const toggleSkill = (skill) => {
    setProfileForm((prev) => ({ ...prev, skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill] }));
  };
  const toggleBookmark = (bountyId) => {
    setBookmarks((prev) => {
      const updated = prev.includes(bountyId) ? prev.filter((id) => id !== bountyId) : [...prev, bountyId];
      if (fullAddress) { try { localStorage.setItem(`fb_bookmarks_${fullAddress}`, JSON.stringify(updated)); } catch (e) {} }
      return updated;
    });
  };

  const canClaim = (bounty) => fairScore >= bounty.minTier;

  // ============================================================
  // BETA: CREATE REAL BOUNTY
  // ============================================================
  const handleCreateBounty = async () => {
    if (!betaAccess) { notify("Beta access required to post bounties."); return; }
    if (!betaBountyForm.title.trim() || !betaBountyForm.description.trim() || !betaBountyForm.projectName.trim()) {
      notify("Please fill in all required fields."); return;
    }
    const rewardValue = betaBountyForm.prizeType === "MEMECOIN" ? betaBountyForm.memeTokenAmount : betaBountyForm.prizeType === "NFT" ? "1" : betaBountyForm.reward;
    if (!rewardValue) { notify("Prize amount required."); return; }

    setSubmitting(true);
    const bountyData = {
      ...betaBountyForm,
      reward: rewardValue,
      currency: betaBountyForm.prizeType === "MEMECOIN" ? betaBountyForm.memeToken : betaBountyForm.prizeType === "NFT" ? "NFT" : betaBountyForm.currency,
      nftImageUrl: betaBountyForm.nftImageUrl || "",
      tags: betaBountyForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      poster: fullAddress,
      posterName: profile?.displayName || wallet,
      posterTier: fairScore,
      status: ADMIN_WALLETS.includes(fullAddress) ? "open" : "pending",
      isBeta: true,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };

    const result = await DbAPI.createBounty(bountyData);
    setSubmitting(false);

    if (result.success || result.id) {
      notify("✅ Bounty submitted for review! We'll get it live soon.");
      // Refresh live bounties
      const updated = await DbAPI.getBounties();
      if (Array.isArray(updated)) setLiveBounties(updated);
      setBetaBountyForm({
        title: "", description: "", projectName: "", category: "",
        prizeType: "USDC", reward: "", currency: "USDC",
        memeToken: "", memeTokenAmount: "", nftMint: "", nftName: "", nftImageUrl: "",
        minTier: 1, deadline: "", tags: "", contactMethod: "x", contactValue: "",
        submissionRequirements: "", evaluationCriteria: "",
      });
      setView("dashboard");
    } else {
      notify("Failed to post bounty — please try again.");
    }
  };

  // ============================================================
  // BETA: SUBMIT WORK
  // ============================================================
  const handleSubmitWork = async (bountyId) => {
    if (!betaAccess) { setShowDemoModal(true); return; }
    if (!submissionText.trim()) { notify("Please add your submission details."); return; }
    setSubmitting(true);
    const result = await DbAPI.submitWork(
      bountyId, fullAddress, profile?.displayName || wallet,
      fairScore, submissionText, submissionLinks
    );
    setSubmitting(false);
    if (result.success || result.id) {
      notify("✅ Submission received! The community will review it.");
      setSubmissionText(""); setSubmissionLinks("");
      setShowSubmitModal(false);
      // Reload submissions
      const subs = await DbAPI.getSubmissions(bountyId);
      setSelectedBountySubmissions(Array.isArray(subs) ? subs : []);
      // BXP for submission
      const multiplier = FairScoreAPI.getXpMultiplier(fairScore || 1);
      const subBxp = Math.floor(25 * multiplier);
      const newBxp = { ...bxpBreakdown, submissions: (bxpBreakdown.submissions || 0) + subBxp };
      setBxpBreakdown(newBxp);
      setXp(Object.values(newBxp).reduce((a, b) => a + b, 0));
      if (fullAddress) { try { localStorage.setItem(`fb_bxp_${fullAddress}`, JSON.stringify(newBxp)); } catch (e) {} }
    } else {
      notify("Submission failed — please try again.");
    }
  };

  // ============================================================
  // BETA: VOTE ON SUBMISSION
  // ============================================================
  const handleVote = async (submissionId, voteType) => {
    if (!betaAccess) { setShowDemoModal(true); return; }
    const voteWeight = FairScoreAPI.getVoteWeight(fairScore || 1);
    const result = await DbAPI.vote(submissionId, fullAddress, voteType, voteWeight);
    if (result.success) {
      notify(`Vote cast! (Weight: ${voteWeight}x)`);
      // Refresh submissions
      if (selectedBounty) {
        const subs = await DbAPI.getSubmissions(selectedBounty.id);
        setSelectedBountySubmissions(Array.isArray(subs) ? subs : []);
      }
    } else if (result.alreadyVoted) {
      notify("You already voted on this submission.");
    }
  };

  // ============================================================
  // BETA: SELECT WINNER
  // ============================================================
  const handleSelectWinner = async (bountyId, submissionId) => {
    const result = await DbAPI.selectWinner(bountyId, submissionId, fullAddress);
    if (result.success) {
      notify("🏆 Winner selected! Prize release instructions will be sent.");
      setShowWinnerModal(false);
      // Refresh bounties
      const updated = await DbAPI.getBounties();
      if (Array.isArray(updated)) setLiveBounties(updated);
      setView("dashboard");
    } else {
      notify("Failed to select winner.");
    }
  };

  // Combined bounty board — live first, then demo
  const allBounties = useMemo(() => {
    const live = liveBounties.map(b => ({
      ...b,
      isDemo: false,
      minTier: b.minTier ?? b.min_tier ?? 1,
      prizeType: b.prizeType ?? b.prize_type ?? "USDC",
      projectName: b.projectName ?? b.project_name ?? b.project ?? "",
      posterName: b.posterName ?? b.poster_name ?? "",
    }));
    const demo = SAMPLE_BOUNTIES;
    return [...live, ...demo];
  }, [liveBounties]);

  const filteredBounties = useMemo(() => {
    let list = allBounties;
    if (filterType === "live") list = list.filter(b => !b.isDemo);
    if (filterType === "demo") list = list.filter(b => b.isDemo);
    if (filterTier > 0) list = list.filter(b => b.minTier === filterTier);
    return list;
  }, [allBounties, filterTier, filterType]);

  const referralLink = referralCode
    ? `https://fairbounty.vercel.app?ref=${referralCode}`
    : fullAddress ? `https://fairbounty.vercel.app?ref=${fullAddress.slice(0,8)}` : "";
  const riskData = FairScoreAPI.assessRisk(scoreData);
  const rewardBonus = FairScoreAPI.getRewardBonus(fairScore);


  // ============================================================
  // STYLES
  // ============================================================
  const pageStyle = {
    minHeight: "100vh", background: "#0b0b18", color: "#E8E8ED",
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    position: "relative", overflow: "hidden", overflowX: "hidden", WebkitFontSmoothing: "antialiased",
    boxSizing: "border-box",
  };
  const gridOverlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: `radial-gradient(ellipse at 20% 0%, ${theme.primary}0A 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, ${theme.accent}06 0%, transparent 50%)`,
    pointerEvents: "none", zIndex: 0,
  };
  const cardStyle = {
    background: `linear-gradient(135deg, ${theme.primary}08, ${theme.accent}04)`,
    border: `1px solid ${theme.primary}18`, borderRadius: "16px", padding: "20px",
    backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: `0 0 0 0.5px ${theme.primary}0A, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 ${theme.primary}08`,
  };
  const glassCard = {
    ...cardStyle,
    background: `linear-gradient(135deg, ${theme.primary}0C, ${theme.accent}06, rgba(255,255,255,0.02))`,
    border: `1px solid ${theme.primary}20`,
    boxShadow: `0 0 0 0.5px ${theme.primary}0C, 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${theme.primary}0C`,
  };
  const btnPrimary = {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
    border: "none", borderRadius: "12px", padding: "12px 28px", color: "#070710",
    fontWeight: "600", fontFamily: "inherit", cursor: "pointer", fontSize: "14px",
    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: `0 2px 20px ${theme.primary}30, 0 0 40px ${theme.primary}10`,
    letterSpacing: "-0.01em",
  };
  const btnOutline = {
    background: `${theme.primary}08`, border: `1px solid ${theme.primary}25`, borderRadius: "12px",
    padding: "10px 20px", color: "#ddd", fontFamily: "inherit", cursor: "pointer",
    fontSize: "13px", transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    fontWeight: "500", letterSpacing: "-0.01em", backdropFilter: "blur(10px)",
  };
  const btnDanger = {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px",
    padding: "10px 20px", color: "#EF4444", fontFamily: "inherit", cursor: "pointer",
    fontSize: "13px", transition: "all 0.2s ease", fontWeight: "600",
  };
  const inputStyle = {
    background: `${theme.primary}06`, border: `1px solid ${theme.primary}18`, borderRadius: "12px",
    padding: "14px 18px", color: "#E8E8ED", fontFamily: "inherit", fontSize: "14px",
    width: "100%", boxSizing: "border-box", outline: "none",
    transition: "border-color 0.2s ease", letterSpacing: "-0.01em",
  };
  const fadeIn = animateIn
    ? { opacity: 1, transform: "translateY(0)", transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }
    : { opacity: 0, transform: "translateY(16px)" };

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
    @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes betaPulse { 0%, 100% { box-shadow: 0 0 0 0 ${theme.primary}40; } 50% { box-shadow: 0 0 0 6px ${theme.primary}00; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; overflow-x: hidden; }
    body { background: #0b0b18; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; overflow-x: hidden; max-width: 100vw; }
    select option { background: #111; color: #E8E8ED; }
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
    .beta-badge { animation: betaPulse 2s ease-in-out infinite; }
    .nav-icon { display: none; }
    .nav-label { display: inline; }
    .nav-btn { padding: 7px 13px !important; }
    @media (max-width: 900px) {
      .nav-icon { display: inline !important; }
      .nav-label { display: none !important; }
      .nav-btn { padding: 7px 9px !important; font-size: 16px !important; }
      .nav-tabs { width: 100% !important; justify-content: space-around !important; }
      .prize-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; overflow: visible !important; }
      .stats-grid { gap: 10px !important; }
      .stats-grid > div { padding: 14px 8px !important; }
      .stats-grid > div > div:first-child { font-size: 22px !important; }
      .admin-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .form-2col { grid-template-columns: 1fr !important; }
      .how-it-works-grid { grid-template-columns: 1fr !important; }
      .bounty-card-row { flex-direction: column !important; align-items: flex-start !important; }
      .bounty-card-actions { margin-top: 8px !important; width: 100% !important; }
      .profile-stats-row { flex-wrap: wrap !important; gap: 12px !important; }
      .modal-inner { padding: 20px 16px !important; margin: 12px !important; }
      .page-pad { padding: 12px !important; }
      .beta-grant-row { flex-direction: column !important; }
      .beta-grant-row input { width: 100% !important; }
    }
  `;

  // ============================================================
  // SHARED COMPONENTS
  // ============================================================

  const DemoBanner = () => (
    <div style={{
      background: betaAccess ? `linear-gradient(90deg, ${theme.primary}12, ${theme.accent}08)` : `linear-gradient(90deg, ${theme.primary}08, ${theme.accent}06)`,
      border: `1px solid ${betaAccess ? theme.primary + "30" : theme.primary + "15"}`, borderRadius: "12px",
      padding: "12px 20px", marginBottom: "16px", textAlign: "center",
      fontSize: "13px", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(16px)", letterSpacing: "-0.01em",
    }}>
      {betaAccess ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "6px" }}>
          <span style={{ color: theme.primary, fontWeight: "700", fontSize: "14px" }}>⚡ Beta Access</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ color: "#22C55E" }}>✅ Post real bounties</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ color: "#22C55E" }}>✅ Submit work</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ color: "#22C55E" }}>✅ Vote on submissions</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span style={{ color: "#22C55E" }}>✅ Earn live rewards</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontWeight: "600" }}>Powered by FairScale ↗</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#22C55E", fontWeight: "600" }}>✅ Live:</span>
          <span>FairScore · BXP · Referrals · Wallet Count</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span style={{ color: "#F59E0B", fontWeight: "600" }}>⏳ Beta only:</span>
          <span>Test bounties · Test submissions · Voting · Vibes (no live rewards yet)</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span style={{ color: "#F59E0B", cursor: "pointer" }} onClick={() => setShowDemoModal(true)}>⚡ <span style={{ textDecoration: "underline" }}>Request beta access</span></span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontWeight: "600" }}>Powered by FairScale ↗</a>
        </div>
      )}
    </div>
  );

  const [betaSignupHandle, setBetaSignupHandle] = useState("");
  const [betaSignupWallet, setBetaSignupWallet] = useState(fullAddress || "");
  const [betaSignupSent, setBetaSignupSent] = useState(false);
  const [betaSignupSending, setBetaSignupSending] = useState(false);

  const handleBetaSignup = async () => {
    if (!betaSignupHandle.trim()) { notify("Please enter your X handle."); return; }
    const w = betaSignupWallet.trim() || fullAddress || "";
    if (!w) { notify("Please enter your wallet address."); return; }
    setBetaSignupSending(true);
    try {
      await DbAPI.submitBountyApp(w, betaSignupHandle.replace(/^@/, ""), 0, {
        type: "beta_request",
        xHandle: betaSignupHandle.replace(/^@/, ""),
        wallet: w,
        requestedAt: new Date().toISOString(),
      });
      setBetaSignupSent(true);
      notify("✅ Beta request submitted! We'll review it soon.");
    } catch (e) {
      notify("Failed to submit — try again.");
    }
    setBetaSignupSending(false);
  };

  const demoModalJsx = showDemoModal ? (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={() => setShowDemoModal(false)}>
      <div key="beta-modal" style={{ ...glassCard, maxWidth: "460px", width: "100%", padding: "36px" }} onClick={(e) => e.stopPropagation()}>
        {betaSignupSent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px", letterSpacing: "-0.03em" }}>Request Received!</h3>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7", marginBottom: "20px" }}>
              We'll review your request and get back to you on X. Follow <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none" }}>@smsonx</a> for updates.
            </p>
            <button style={btnPrimary} onClick={() => { setShowDemoModal(false); setBetaSignupSent(false); }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚡</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "6px", letterSpacing: "-0.03em" }}>Request Beta Access</h3>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7" }}>
                Get full access to post bounties, submit work, and vote. Drop your X handle and wallet — we'll review and reach out.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>X Handle *</label>
                <input
                  key="beta-x-handle"
                  id="beta-x-handle"
                  autoFocus
                  style={inputStyle}
                  placeholder="@yourhandle"
                  value={betaSignupHandle}
                  onChange={(e) => setBetaSignupHandle(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Wallet Address *</label>
                <input
                  key="beta-wallet"
                  id="beta-wallet"
                  style={{ ...inputStyle, fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}
                  placeholder="Your Solana wallet address"
                  value={betaSignupWallet || fullAddress || ""}
                  onChange={(e) => setBetaSignupWallet(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button style={{ ...btnPrimary, flex: 1 }} disabled={betaSignupSending} onClick={handleBetaSignup}>
                {betaSignupSending ? "Submitting..." : "⚡ Request Access"}
              </button>
              <button style={btnOutline} onClick={() => setShowDemoModal(false)}>Cancel</button>
            </div>
            <div style={{ marginTop: "16px", textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
              Or DM <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none" }}>@smsonx</a> on X directly
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // Submit work modal
  const submitModalJsx = showSubmitModal ? (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={() => setShowSubmitModal(false)}>
      <div style={{ ...glassCard, maxWidth: "560px", width: "100%", padding: "36px", animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}>{t.submitYourWork}</h3>
        <p style={{ fontSize: "12px", color: "#888", marginBottom: "20px" }}>{selectedBounty?.title}</p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Your Submission *</label>
          <textarea
            style={{ ...inputStyle, minHeight: "140px", resize: "vertical" }}
            placeholder="Describe your work, approach, and deliverables. Be thorough — the community will review this..."
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>Links (optional)</label>
          <input
            style={inputStyle}
            placeholder="GitHub, Figma, live demo, video... (comma-separated)"
            value={submissionLinks}
            onChange={(e) => setSubmissionLinks(e.target.value)}
          />
        </div>

        <div style={{ padding: "12px 14px", background: `${theme.primary}08`, borderRadius: "8px", border: `1px solid ${theme.primary}15`, marginBottom: "20px", fontSize: "12px", color: "#888" }}>
          🎯 Your vote weight: <span style={{ color: theme.primary, fontWeight: "700" }}>{FairScoreAPI.getVoteWeight(fairScore || 1)}x</span> · BXP earned: <span style={{ color: theme.primary, fontWeight: "700" }}>+{Math.floor(25 * FairScoreAPI.getXpMultiplier(fairScore || 1))}</span>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button style={{ ...btnPrimary, flex: 1 }} disabled={submitting} onClick={() => handleSubmitWork(selectedBounty?.id)}>
            {submitting ? "Submitting..." : t.submitWork}
          </button>
          <button style={btnOutline} onClick={() => setShowSubmitModal(false)}>{t.cancel}</button>
        </div>
      </div>
    </div>
  ) : null;

  const WelcomeModal = () => showWelcomeModal ? (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto",
    }}>
      <div style={{ ...glassCard, maxWidth: "520px", width: "100%", padding: "40px", animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>⭐</div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "6px", letterSpacing: "-0.04em" }}>{t.welcomeTo}</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{t.howBxpWorks}</p>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: theme.primary, marginBottom: "10px" }}>{t.howToEarnBxp}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "🎁", action: "Profile Setup", amount: "100 BXP", note: "one-time welcome bonus", color: "#22C55E" },
              { icon: "🔗", action: "Refer a Friend", amount: "50 BXP", note: "you AND your friend both earn", color: "#3B82F6" },
              { icon: "📝", action: "Submit Work", amount: "25 BXP", note: "per bounty submission", color: "#8B5CF6" },
              { icon: "🏆", action: "Win a Bounty", amount: "100 BXP", note: "plus the reward payout", color: "#F59E0B" },
            ].map((item) => (
              <div key={item.action} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#0c0c14", borderRadius: "8px", border: `1px solid ${item.color}20` }}>
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{item.action}</span>
                  <span style={{ fontSize: "11px", color: "#666", marginLeft: "6px" }}>— {item.note}</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: item.color }}>{item.amount}</span>
              </div>
            ))}
          </div>
        </div>
        {fairScore && (
          <div style={{ padding: "14px", background: `${theme.primary}10`, borderRadius: "8px", border: `1px solid ${theme.primary}20`, marginBottom: "20px", textAlign: "center" }}>
            <span style={{ fontSize: "20px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
            <span style={{ fontSize: "14px", fontWeight: "700", marginLeft: "8px" }}>You're Tier {fairScore} — {TIER_CONFIG[fairScore]?.xpMultiplier}x BXP multiplier</span>
          </div>
        )}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button style={{ ...btnPrimary, padding: "12px 28px" }} onClick={() => {
            setShowWelcomeModal(false);
            try { localStorage.setItem(`fb_seen_welcome_${fullAddress}`, "1"); } catch (e) {}
          }}>{t.letsGo}</button>
        </div>
      </div>
    </div>
  ) : null;

  const NavBar = ({ showBack, backTo, backLabel }) => {
    const tabStyle = (tabView) => ({
      background: view === tabView ? `${theme.primary}18` : "transparent",
      border: view === tabView ? `1px solid ${theme.primary}30` : "1px solid transparent",
      borderRadius: "10px", padding: "7px 13px",
      color: view === tabView ? "#fff" : "rgba(255,255,255,0.45)",
      fontFamily: "inherit", cursor: "pointer", fontSize: "12px", fontWeight: "500",
      transition: "all 0.2s ease", whiteSpace: "nowrap",
      backdropFilter: view === tabView ? "blur(10px)" : "none",
    });
    const disconnectFn = (e) => {
      e.stopPropagation();
      setWallet(null); setFullAddress(null); setWalletType("default"); setFairScore(null);
      setScoreData(null); setXp(0); setProfile(null); setBetaAccess(false); setBookmarks([]);
      setReferralCode(null); setSlugInput(""); setReferralCount(0); setReferralList([]); setSlugEditing(false); setBxpBreakdown({ welcome: 0, referrals: 0, referred: 0, submissions: 0, wins: 0 });
      setProfileForm({ displayName: "", xHandle: "", bio: "", contact: "", email: "", pfpUrl: "", linkedin: "", github: "", website: "", telegram: "", discord: "", lookingFor: "", worksAt: "", location: "", skills: [] });
      setBookmarks([]); setView("landing");
    };
    return (
      <div style={{ marginBottom: "24px", borderBottom: `1px solid ${theme.primary}15` }}>
        {/* ROW 1: Logo only */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", flexShrink: 0 }} onClick={() => setView("landing")}>
            <Logo size={22} />
            <span style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>FairBounty</span>
            <span style={{ fontSize: "8px", fontWeight: "700", color: theme.primary, background: `${theme.primary}18`, padding: "2px 6px", borderRadius: "100px", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {betaAccess ? "Beta ⚡" : "Beta"}
            </span>
          </div>
          {/* Wallet pill on same row as logo — desktop only via CSS */}
          {wallet ? (
            <div className="wallet-pill-desktop" style={{
              display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px",
              background: `${theme.primary}0C`, border: `1px solid ${theme.primary}20`,
              borderRadius: "12px", fontSize: "11px", cursor: profile ? "pointer" : "default",
              backdropFilter: "blur(16px)", flexShrink: 0, whiteSpace: "nowrap",
            }} onClick={() => profile && setView("profile")}>
              <span style={{ color: TIER_CONFIG[fairScore]?.color }}>{TIER_CONFIG[fairScore]?.emoji}</span>
              <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: "600", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>{profile ? profile.displayName : wallet}</span>
              <span style={{ color: theme.primary, fontWeight: "700" }}>{xp} BXP</span>
              <button onClick={disconnectFn} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "12px", padding: "0", fontFamily: "inherit" }}>✕</button>
            </div>
          ) : (
            <button style={{ ...btnPrimary, fontSize: "12px", padding: "6px 14px" }} onClick={() => setView("connect")}>Connect</button>
          )}
        </div>

        {/* ROW 2: All nav icons — full width, evenly spaced */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", width: "100%", paddingBottom: "6px", gap: "2px" }}>
          {[
            { label: t.bounties, icon: "🎯", view: wallet && profile ? "dashboard" : "landing" },
            { label: t.postBounty, icon: "📋", view: "post-bounty" },
            { label: t.howItWorks, icon: "📖", view: "how-it-works" },
            { label: t.about, icon: "ℹ️", view: "about" },
            { label: "🏆", icon: "🏆", view: "leaderboard" },
          ].map((tab) => (
            <button key={tab.view} className="nav-btn" style={{ ...tabStyle(tab.view) }} onClick={() => {
              if (tab.view === "post-bounty" && wallet && !betaAccess) { setShowDemoModal(true); return; }
              setView(tab.view);
            }}>
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
          {wallet && profile && (
            <button className="nav-btn" style={{ ...tabStyle("profile") }} onClick={() => setView("profile")}>👤</button>
          )}
          {ADMIN_WALLETS.includes(fullAddress) && (
            <button className="nav-btn" style={{ ...tabStyle("admin"), color: view === "admin" ? "#FFD700" : "rgba(255,215,0,0.6)" }} onClick={() => setView("admin")}>⚙️</button>
          )}
        </div>

        {/* ROW 3: Back button left — ES toggle left — Wallet pill right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "38px", paddingBottom: "8px" }}>
          {/* Back button or empty spacer */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            {showBack ? (
              <button onClick={() => setView(backTo || "dashboard")} style={{ ...btnOutline, fontSize: "11px", padding: "5px 12px", whiteSpace: "nowrap" }}>← {backLabel || "Back"}</button>
            ) : (
              <div style={{ width: "1px" }} />
            )}
            <button onClick={() => setLang(l => l === "en" ? "es" : "en")} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px", color: "rgba(255,255,255,0.7)", fontSize: "11px",
              fontWeight: "700", padding: "5px 7px", cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.5px", transition: "all 0.2s",
            }}>{lang === "en" ? "ES" : "EN"}</button>
          </div>
          {/* Wallet pill — always right-aligned, always same row */}
          {wallet ? (
            <div style={{
              display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px",
              background: `${theme.primary}0C`, border: `1px solid ${theme.primary}20`,
              borderRadius: "12px", fontSize: "11px", cursor: profile ? "pointer" : "default",
              backdropFilter: "blur(16px)", boxShadow: `inset 0 1px 0 ${theme.primary}08`,
              flexShrink: 0, whiteSpace: "nowrap",
            }} onClick={() => profile && setView("profile")}>
              <span style={{ color: TIER_CONFIG[fairScore]?.color }}>{TIER_CONFIG[fairScore]?.emoji}</span>
              <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: "600", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile ? profile.displayName : wallet}
              </span>
              <span>
                {fullAddress && PLATFORM_BADGES[fullAddress] && (
                  <span style={{ fontSize: "8px", fontWeight: "700", color: "#FFD700", background: "rgba(255,215,0,0.12)", padding: "2px 5px", borderRadius: "100px" }}>★</span>
                )}
                {betaAccess && (
                  <span style={{ fontSize: "8px", fontWeight: "700", color: theme.primary, background: `${theme.primary}20`, padding: "2px 5px", borderRadius: "100px" }}>⚡</span>
                )}
              </span>
              <span style={{ color: theme.primary, fontWeight: "700" }}>{xp} BXP</span>
              <button onClick={disconnectFn} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "12px", padding: "0", fontFamily: "inherit", lineHeight: "1" }} title="Disconnect">✕</button>
            </div>
          ) : (
            <button style={{ ...btnPrimary, fontSize: "12px", padding: "6px 14px" }} onClick={() => setView("connect")}>Connect</button>
          )}
        </div>
      </div>
    );
  };

  const Footer = () => (
    <div style={{ marginTop: "60px", paddingTop: "32px", borderTop: `1px solid rgba(255,255,255,0.06)`, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "16px", fontSize: "12px", color: "rgba(255,255,255,0.3)", paddingBottom: "32px" }}>
      <div style={{ display: "flex", gap: "20px" }}>
        <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>Built by @smsonx</a>
        <a href="https://smsai.fun" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>smsai.fun</a>
        <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontWeight: "500" }}>FairScale</a>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Logo size={14} />
          <span style={{ letterSpacing: "-0.02em" }}>FairBounty © 2026</span>
        </div>
        <a href="https://smsai.fun" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: "500" }}>
          A <span style={{ color: theme.primary, fontWeight: "600" }}>Solana Made Simple</span> product
        </a>
      </div>
    </div>
  );

  const Notification = () => notification ? (
    <div style={{
      position: "fixed", top: "20px", right: "20px", zIndex: 300, padding: "12px 20px",
      background: `linear-gradient(135deg, ${theme.primary}20, ${theme.accent}20)`,
      border: `1px solid ${theme.primary}40`, borderRadius: "8px", fontSize: "13px",
      color: theme.primary, fontWeight: "600", backdropFilter: "blur(10px)",
      animation: "slideIn 0.3s ease", maxWidth: "340px",
    }}>{notification}</div>
  ) : null;

  // Loading
  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", border: `3px solid ${theme.primary}30`, borderTop: `3px solid ${theme.primary}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: theme.primary, fontSize: "14px", fontWeight: "600" }}>{t.fetchingScore}</div>
          <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>Querying FairScale API</div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // LANDING
  // ============================================================
  if (view === "landing") {
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ position: "absolute", top: "10%", right: "15%", width: "300px", height: "300px", background: `radial-gradient(circle, ${theme.primary}20, transparent 70%)`, borderRadius: "50%", filter: "blur(60px)", animation: "float 6s ease-in-out infinite" }} />
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 16px", textAlign: "center" }}>
            <DemoBanner />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px", flexWrap: "wrap", gap: "12px", ...fadeIn }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Logo size={28} />
                <span style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.5px" }}>FairBounty</span>
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#0c0c14", background: theme.primary, padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Beta</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button style={{ ...btnOutline, fontSize: "11px", padding: "5px 10px" }} onClick={() => setView("about")}>{lang === "es" ? "Acerca de" : "About"}</button>
                <button style={{ ...btnOutline, fontSize: "11px", padding: "5px 10px" }} onClick={() => setView("how-it-works")}>{lang === "es" ? "Cómo Funciona" : "How It Works"}</button>
                <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontSize: "12px", opacity: 0.8 }}>FairScale ↗</a>
                <button onClick={() => setLang(l => l === "en" ? "es" : "en")} style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "rgba(255,255,255,0.7)", fontSize: "11px",
                  fontWeight: "700", padding: "5px 9px", cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: "0.5px",
                }}>{lang === "en" ? "ES" : "EN"}</button>
              </div>
            </div>

            {/* Beta Access CTA */}
            <div style={{
              marginBottom: "24px", padding: "14px 20px", borderRadius: "12px",
              background: `linear-gradient(135deg, ${theme.primary}15, ${theme.accent}0A)`,
              border: `1px solid ${theme.primary}35`, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              flexWrap: "wrap", transition: "all 0.25s ease",
              ...fadeIn, transitionDelay: "0.05s",
            }} onClick={() => setShowDemoModal(true)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${theme.primary}35`; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <span style={{ fontSize: "16px" }}>⚡</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: theme.primary }}>
                {lang === "es" ? "ACCESO BETA" : "BETA ACCESS"}
              </span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>—</span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                {lang === "es" ? "Envía tu X handle y wallet aquí →" : "Submit your X handle & wallet here →"}
              </span>
            </div>

            <div style={{ ...fadeIn, transitionDelay: "0.1s" }}>
              <div style={{ display: "inline-block", padding: "6px 16px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`, borderRadius: "100px", fontSize: "12px", color: theme.primary, marginBottom: "24px", letterSpacing: "1px", textTransform: "uppercase" }}>
                Reputation-Gated Bounties on Solana{lang === "es" && " · Recompensas en Solana"}
              </div>
            </div>

            <h1 style={{ fontSize: "clamp(40px, 7vw, 72px)", fontWeight: "900", lineHeight: "1.05", margin: "0 0 24px", letterSpacing: "-2px", ...fadeIn, transitionDelay: "0.2s" }}>
              <GlitchText text="Earn." /> <span style={{ color: theme.primary }}>Prove.</span><br />Build <span style={{ color: theme.accent }}>Reputation.</span>
            </h1>
            <p style={{ fontSize: "17px", lineHeight: "1.7", color: "#9999A8", maxWidth: "550px", margin: "0 auto 40px", ...fadeIn, transitionDelay: "0.3s" }}>
              {lang === "es"
                ? "Un tablero de recompensas donde tu reputación on-chain desbloquea oportunidades. Premios en stablecoins, memecoins, NFTs o coleccionables. La comunidad vota. El cliente elige al ganador."
                : "A bounty board where your on-chain reputation unlocks opportunities. Prizes in stablecoins, memecoins, NFTs, or collectibles. Community votes. Client picks the winner."
              }
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", ...fadeIn, transitionDelay: "0.4s" }}>
              <button style={btnPrimary} onClick={() => setView("connect")}
                onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 8px 30px ${theme.primary}40`; }}
                onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "none"; }}
              >{lang === "es" ? "Conectar Wallet →" : "Connect Wallet →"}</button>
              <button style={btnOutline} onClick={() => setView("dashboard")}
                onMouseEnter={(e) => e.target.style.background = `${theme.primary}10`}
                onMouseLeave={(e) => e.target.style.background = "transparent"}
              >{lang === "es" ? "Ver Recompensas" : "Browse Bounties"}</button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "24px", marginTop: "60px", ...fadeIn, transitionDelay: "0.5s" }}>
              {[
                { value: globalStats.connectedWallets.toString(), label: t.connectedWallets, live: true },
                { value: (liveBounties.length || globalStats.bountyApps || 0).toString(), label: t.liveBounties, live: true },
                { value: globalStats.profiles.toString(), label: t.profiles, live: true },
              ].map((stat) => (
                <div key={stat.label} style={{ ...cardStyle, padding: "24px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: theme.primary, marginBottom: "4px" }}>{stat.value}</div>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "1px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Prize types */}
            <div style={{ marginTop: "60px", ...fadeIn, transitionDelay: "0.55s" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>{t.prizeTypes}</h2>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>Post bounties with stablecoins, memecoins, NFTs, or collectibles as prizes</p>
              <div className="prize-grid" style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "nowrap" }}>
                {Object.entries(PRIZE_TYPES).map(([key, pt]) => (
                  <div key={key} style={{
                    ...cardStyle, padding: "18px 10px", textAlign: "center",
                    border: `1px solid ${pt.color}25`, flex: "1", minWidth: "0",
                    background: `linear-gradient(135deg, ${pt.color}08, ${pt.color}03)`,
                  }}>
                    <div style={{ marginBottom: "6px", display: "flex", justifyContent: "center" }}><PrizeIcon pt={pt} size={28} /></div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: pt.color, marginBottom: "3px" }}>{pt.label}</div>
                    <div style={{ fontSize: "10px", color: "#777", lineHeight: "1.4" }}>{pt.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* FairScore features */}
            <div style={{ marginTop: "60px", ...fadeIn, transitionDelay: "0.6s" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "12px" }}>{t.howFairScore}</h2>
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "32px", maxWidth: "500px", margin: "0 auto 32px" }}>Your on-chain reputation is the engine. Every feature is gated, weighted, or enhanced by FairScore.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {[
                  { icon: "🔒", title: t.tierGated, desc: lang === "es" ? "Las recompensas requieren niveles mínimos de FairScore. Mayor reputación = mejores recompensas." : "Bounties require minimum FairScore tiers. Higher reputation = bigger bounties." },
                  { icon: "⚖️", title: t.communityReview, desc: lang === "es" ? "La comunidad vota las entregas. Los niveles más altos tienen más influencia. El cliente elige al ganador." : "Community votes on submissions. Higher tiers carry more influence. Client picks winner from top-voted." },
                  { icon: "💎", title: t.dynamicRewards, desc: lang === "es" ? "Hasta +25% de bonificación para Leyendas Tier 5 sobre el monto del premio." : "Up to +25% bonus rewards for Tier 5 Legends on top of the prize amount." },
                  { icon: "🛡️", title: t.riskAssessment, desc: lang === "es" ? "Cada wallet recibe un nivel de riesgo basado en FairScore. Los proyectos filtran con confianza." : "Every wallet gets a risk level based on FairScore. Projects filter with confidence." },
                  { icon: "⚡", title: t.bxpMultipliers, desc: lang === "es" ? "El Tier 5 gana 3x BXP por acción. Construye reputación para construirla más rápido." : "Tier 5 earns 3x BXP per action. Build reputation to build reputation faster." },
                  { icon: "🔗", title: t.referralGating, desc: lang === "es" ? "Solo las wallets Tier 2+ generan enlaces de referido, evitando spam de bots." : "Only Tier 2+ wallets generate referral links, preventing bot-driven spam." },
                ].map((item) => (
                  <div key={item.title} style={{ ...cardStyle, padding: "24px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{item.icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>{item.title}</div>
                    <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.6" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tiers */}
            <div style={{ marginTop: "60px", ...cardStyle, padding: "32px", textAlign: "left", ...fadeIn, transitionDelay: "0.65s" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", textAlign: "center" }}>{t.fairscoreTierBenefits}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                      {["Tier", "BXP Multiplier", "Vote Weight"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "500", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(TIER_CONFIG).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "12px 8px", color: v.color, fontWeight: "600" }}>{v.emoji} Tier {k} — {v.label}</td>
                        <td style={{ padding: "12px 8px" }}>{v.xpMultiplier}x</td>
                        <td style={{ padding: "12px 8px" }}>{v.voteWeight}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer branding card */}
            <div style={{ marginTop: "60px", padding: "24px 32px", background: `linear-gradient(135deg, ${theme.primary}10, ${theme.accent}10)`, border: `1px solid ${theme.primary}25`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", gap: "16px", ...fadeIn, transitionDelay: "0.8s" }}>
              <div>
                <Logo size={40} />
                <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px", marginTop: "8px" }}>FairBounty</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Reputation-gated bounties powered by FairScale</div>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                {[{ href: "https://fairscale.xyz", label: "FairScale ↗" }, { href: "https://smsai.fun", label: "smsai.fun ↗" }, { href: "https://x.com/smsonx", label: "@smsonx ↗" }].map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ ...btnOutline, fontSize: "12px", padding: "8px 16px", textDecoration: "none" }}>{l.label}</a>
                ))}
              </div>
            </div>
            <Footer />
          </div>
        </div>
        {demoModalJsx}
        <Notification />
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // ABOUT
  // ============================================================
  if (view === "about") {
    const integrations = [
      { icon: "🔒", title: "Tier-Gated Access", desc: "Bounties require a minimum FairScore tier. Bots and farmers can't apply — only wallets that have earned access can participate. Higher reputation = access to bigger bounties." },
      { icon: "⚖️", title: "Weighted Community Voting", desc: "Every vote is weighted by the voter's FairScore tier. A Tier 5 Legend's vote carries 8× the weight of a Tier 1 Newcomer. Reputation determines influence." },
      { icon: "💎", title: "Dynamic Reward Bonuses", desc: "Winners earn bonus BXP on top of their prize based on their tier. Up to +25% for Tier 5 Legends — creating a compounding incentive to build reputation." },
      { icon: "🛡️", title: "Risk Assessment", desc: "Every connecting wallet receives a real-time risk assessment from FairScore. Low-reputation wallets are flagged. Clients filter by risk level before reviewing work." },
      { icon: "⚡", title: "BXP Multipliers", desc: "FairBounty's reputation currency (BXP) is earned faster at higher tiers — up to 3× for Tier 5. Higher FairScore → faster BXP → better platform standing → bigger bounties." },
      { icon: "🔗", title: "Referral Gating", desc: "Only Tier 2+ wallets can generate referral links. This prevents bot-driven referral spam and ensures the referral network consists of real, established contributors." },
    ];
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="landing" backLabel={t.home} />
          <div style={fadeIn}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <div style={{ display: "inline-block", padding: "6px 16px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`, borderRadius: "100px", fontSize: "11px", color: theme.primary, marginBottom: "20px", letterSpacing: "1.5px", textTransform: "uppercase" }}>About FairBounty</div>
              <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: "900", lineHeight: "1.1", marginBottom: "16px", letterSpacing: "-1px" }}>
                Reputation is the<br /><span style={{ color: theme.primary }}>New Trust Layer</span>
              </h1>
              <p style={{ fontSize: "15px", color: "#888", maxWidth: "560px", margin: "0 auto", lineHeight: "1.7" }}>
                FairBounty is a reputation-gated bounty platform for Solana. Your on-chain history — verified by FairScale — determines what you can access, how much influence you carry, and how fast you earn.
              </p>
            </div>

            {/* Problem / Solution */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "40px" }}>
              <div style={{ ...cardStyle, borderColor: "#EF444430" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#EF4444", letterSpacing: "1px", marginBottom: "12px", textTransform: "uppercase" }}>🚨 The Problem</div>
                <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", margin: 0 }}>
                  Bounty platforms on Solana have no trust layer. Bots and farmers dilute opportunities for real contributors. Projects waste budget on unvetted work. There's no way to prove you're legit without a personal network.
                </p>
              </div>
              <div style={{ ...cardStyle, borderColor: `${theme.primary}30` }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: theme.primary, letterSpacing: "1px", marginBottom: "12px", textTransform: "uppercase" }}>💡 The Solution</div>
                <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", margin: 0 }}>
                  FairBounty uses FairScale's on-chain reputation (FairScore) as a trust layer. Every interaction is gated, weighted, or enhanced by real reputation. Your wallet history becomes your resume — verifiable, transparent, unfakeable.
                </p>
              </div>
            </div>

            {/* FairScale Integration */}
            <div style={{ marginBottom: "40px" }}>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>6 Deep FairScale Integrations</h2>
                <p style={{ fontSize: "13px", color: "#888" }}>FairScore isn't a badge here — it's the engine powering every feature.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                {integrations.map((item, i) => (
                  <div key={i} style={{ ...cardStyle, padding: "20px" }}>
                    <div style={{ fontSize: "24px", marginBottom: "10px" }}>{item.icon}</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: theme.primary, marginBottom: "8px" }}>{item.title}</div>
                    <p style={{ fontSize: "12px", color: "#888", lineHeight: "1.7", margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive Advantage */}
            <div style={{ ...cardStyle, marginBottom: "24px", background: `linear-gradient(135deg, ${theme.primary}08, ${theme.accent}04)` }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>🏆 Competitive Advantage</h3>
              <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", marginBottom: "12px" }}>
                No other bounty platform on Solana uses on-chain reputation as a core gating mechanism. Superteam Earn relies on manual vetting. Layer3 uses basic task completion. FairBounty automates trust via FairScore — creating a self-reinforcing reputation flywheel that gets stronger as FairScale grows.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["vs Superteam Earn: automated trust, no manual vetting", "vs Layer3: reputation-gated not just task-gated", "Moat: FairScale network effects", "Solana Mobile / Seeker: mobile-first ready"].map((item, i) => (
                  <div key={i} style={{ padding: "6px 12px", background: `${theme.primary}10`, border: `1px solid ${theme.primary}25`, borderRadius: "100px", fontSize: "11px", color: theme.primary }}>{item}</div>
                ))}
              </div>
            </div>

            {/* Business Model */}
            <div style={{ ...cardStyle, marginBottom: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>💰 Business Model</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { phase: "Now", item: "50 USDC listing fee per bounty posted", color: theme.primary },
                  { phase: "Now", item: "5% platform commission on bounty completion", color: theme.primary },
                  { phase: "Soon", item: "Enterprise data insights for DAOs sourcing talent", color: theme.accent },
                  { phase: "Soon", item: "Featured listings for high-value bounties", color: theme.accent },
                  { phase: "Future", item: "Full talent marketplace as FairScale becomes Solana's trust standard", color: "#888" },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "#0c0c14", borderRadius: "8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: row.color, minWidth: "40px" }}>{row.phase}</span>
                    <span style={{ fontSize: "12px", color: "#bbb" }}>{row.item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Solana Mobile */}
            <div style={{ ...cardStyle, marginBottom: "24px", borderColor: "#14F19530" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "28px" }}>📱</span>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700", margin: 0 }}>Solana Mobile — Seeker Ready</h3>
                  <div style={{ fontSize: "11px", color: "#14F195", marginTop: "2px" }}>Built-in · dApp Store publishing planned</div>
                </div>
              </div>
              <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", marginBottom: "12px" }}>
                FairBounty is built with Mobile Wallet Adapter (MWA) from day one — the same infrastructure used for SMSai on the Solana dApp Store. The app works natively in wallet browsers on Solana Mobile devices, with Seed Vault support for the Seeker.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  "✅ Mobile Wallet Adapter (MWA) integrated",
                  "✅ Seed Vault wallet support for Seeker",
                  "✅ Responsive design optimized for mobile",
                  "🔜 Solana dApp Store publishing planned",
                  "🔜 Native Seeker deep links + push notifications",
                ].map((item, i) => (
                  <div key={i} style={{ padding: "8px 14px", background: "#0c0c14", borderRadius: "8px", fontSize: "12px", color: i < 3 ? "#14F195" : "#888", borderLeft: `2px solid ${i < 3 ? "#14F195" : "#333"}40` }}>{item}</div>
                ))}
              </div>
            </div>

            {/* Built by */}
            <div style={{ ...cardStyle, marginBottom: "24px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>👤 Built by</h3>
              <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.8", marginBottom: "16px" }}>
                <span style={{ color: theme.primary, fontWeight: "700" }}>@smsonx</span> — founder of Solana Made Simple, active in the Solana ecosystem since 2021. Previously shipped SMSai to the Solana dApp Store. FairBounty is the second product in the SMS ecosystem, built specifically for the FairScale competition and continuing as a standalone platform.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "𝕏 @smsonx (founder)", url: "https://x.com/smsonx" },
                  { label: "𝕏 @fairbounty (platform)", url: "https://x.com/fairbounty" },
                  { label: "smsai.fun — research & updates", url: "https://smsai.fun" },
                  { label: "Powered by FairScale ↗", url: "https://fairscale.xyz" },
                ].map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                    padding: "10px 14px", background: "#0c0c14", borderRadius: "8px",
                    fontSize: "12px", color: theme.primary, textDecoration: "none",
                    borderLeft: `2px solid ${theme.primary}40`, display: "block",
                    transition: "background 0.2s ease",
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = `${theme.primary}10`}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#0c0c14"}
                  >{link.label}</a>
                ))}
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
  // HOW IT WORKS
  // ============================================================
  if (view === "how-it-works") {
    const howSteps = [
      { num: "01", icon: "🔗", title: "Connect Your Wallet", desc: "Connect your Solana wallet. We automatically fetch your FairScore from the FairScale API. Your on-chain history determines your tier (1–5), which unlocks bounties, perks, and earning potential.", details: ["Jupiter, Phantom, Solflare, Backpack, Glow, Seed Vault supported", "FairScore fetched automatically on connect", "Set up your profile — display name, skills, socials", "Profile persists across devices via Neon Postgres"] },
      { num: "02", icon: "🎯", title: "Find & Claim Bounties", desc: "Browse the bounty board. Each bounty has a minimum tier requirement — you can only claim bounties your FairScore qualifies you for. Higher tier = access to bigger bounties. Prizes include stablecoins, memecoins, NFTs, and collectibles.", details: ["Filter by tier, tags, prize type", "Bookmark bounties to save for later", "Beta testers can post real bounties — coming to everyone soon", "Locked bounties show the tier needed to unlock"] },
      { num: "03", icon: "⚖️", title: "Community Reviews Submissions", desc: "Contributors submit work. The community votes — your tier determines how much your vote counts. Higher-tier wallets carry more influence. The client then picks the winner from top-voted submissions.", details: ["Upvote/downvote submissions with FairScore-weighted votes", "Tier 5 vote = 8x weight vs Tier 1 = 1x", "Client picks winner from top-ranked submissions", "No single person controls the outcome"] },
      { num: "04", icon: "💰", title: "Submit & Earn", desc: "Complete bounties, refer friends, build BXP. All BXP multiplied by your tier.", details: ["🎁 Welcome: 100 BXP × tier multiplier", "🔗 Referrals: 50 BXP × multiplier (both parties)", "📝 Submissions: 25 BXP × multiplier", "🏆 Wins: 100 BXP + prize + tier bonus"] },
    ];
    const tierDetails = {
      1: { xp: "1x", vote: "1x", tip: "Connect your wallet and explore. Build on-chain activity to start climbing." },
      2: { xp: "1.25x", vote: "2x", tip: "Active on-chain. Access mid-range bounties, generate referral links." },
      3: { xp: "1.5x", vote: "3x", tip: "Established. Earn bonus rewards, 3x review weight." },
      4: { xp: "2x", vote: "5x", tip: "Veteran status. 5x review power, 2x BXP acceleration." },
      5: { xp: "3x", vote: "8x", tip: "Legendary reputation. 8x review weight, 3x BXP." },
    };
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="landing" backLabel={t.home} />
          <div style={fadeIn}>
            <div style={{ textAlign: "center", marginBottom: "50px" }}>
              <div style={{ display: "inline-block", padding: "6px 16px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`, borderRadius: "100px", fontSize: "11px", color: theme.primary, marginBottom: "20px", letterSpacing: "1.5px", textTransform: "uppercase" }}>How It Works</div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "900", lineHeight: "1.1", marginBottom: "16px", letterSpacing: "-1px" }}>
                From Wallet to <span style={{ color: theme.primary }}>Earning</span>
              </h1>
              <p style={{ fontSize: "15px", color: "#888", maxWidth: "500px", margin: "0 auto", lineHeight: "1.7" }}>Your on-chain reputation is your key. Here's how FairScore powers every part of FairBounty.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "60px" }}>
              {howSteps.map((step, i) => {
                const isActive = activeStep === i;
                return (
                  <div key={i} onClick={() => setActiveStep(isActive ? -1 : i)} style={{ ...cardStyle, cursor: "pointer", border: isActive ? `1px solid ${theme.primary}60` : `1px solid ${theme.primary}20`, transition: "all 0.3s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0, background: isActive ? `${theme.primary}20` : `${theme.primary}08`, border: `1px solid ${isActive ? theme.primary + "40" : theme.primary + "15"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{step.icon}</div>
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
                            <div key={j} style={{ padding: "10px 14px", background: "#0c0c14", borderRadius: "6px", fontSize: "12px", color: "#999", lineHeight: "1.5", borderLeft: `2px solid ${theme.primary}40`, display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: theme.primary }}>›</span> {d}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: "60px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px", textAlign: "center" }}>{t.tiersLevelUp}</h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "28px" }}>{t.tapToExpand}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                {Object.entries(TIER_CONFIG).map(([k, v]) => {
                  const td = tierDetails[k];
                  const isOpen = activeTier === k;
                  return (
                    <div key={k} onClick={() => setActiveTier(isOpen ? null : k)} style={{ ...cardStyle, cursor: "pointer", border: isOpen ? `1px solid ${v.color}40` : `1px solid rgba(255,255,255,0.07)` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <span style={{ fontSize: "24px" }}>{v.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: "600", color: v.color }}>Tier {k} — {v.label}</div>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                          <span>BXP {td.xp}</span><span>Vote {td.vote}</span>
                        </div>
                      </div>
                      {isOpen && <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${v.color}15` }}><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7" }}>{td.tip}</p></div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ ...cardStyle, padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px" }}>{t.howToIncreaseTier}</h3>
                <div className="how-it-works-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  {[{ icon: "🔄", title: "Use DeFi", desc: "Swap, stake, and provide liquidity" }, { icon: "📊", title: "Stay Active", desc: "Consistent on-chain activity" }, { icon: "🏗️", title: "Win Bounties", desc: "Successful completions build reputation" }, { icon: "⏰", title: "Wallet Age", desc: "Older wallets with history score higher" }, { icon: "🌐", title: "Diversify", desc: "Spread activity across protocols" }, { icon: "🔗", title: "Connect Socials", desc: "Link X to boost social score" }].map((item) => (
                    <div key={item.title} style={{ padding: "18px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: `1px solid ${theme.primary}10` }}>
                      <div style={{ fontSize: "22px", marginBottom: "8px" }}>{item.icon}</div>
                      <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>{item.title}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: "1.5" }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
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
  // CONNECT
  // ============================================================
  if (view === "connect") {
    const walletIcons = { jupiter: "🪐", phantom: "👻", solflare: "🔥", backpack: "🎒", glow: "✨", seedvault: "🔐" };
    const isWalletDetected = (opt) => {
      if (opt.useStandard) return standardWallets.some((w) => w.name?.toLowerCase().includes(opt.name.toLowerCase()));
      if (opt.window) { const p = window[opt.window]; return p && (!opt.check || opt.check(p)); }
      return false;
    };
    const mwaAvailable = !!findMwaWallet();
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "460px", margin: "0 auto", padding: "60px 20px", ...fadeIn }}>
          <button onClick={() => setView("landing")} style={{ ...btnOutline, marginBottom: "40px", fontSize: "12px", padding: "8px 16px" }}>← Back</button>
          <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", letterSpacing: "-0.03em" }}>Connect Wallet</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px" }}>Choose your Solana wallet. FairScore fetched automatically.</p>
          {loading && <div style={{ textAlign: "center", padding: "20px", color: theme.primary, fontSize: "14px" }}><div style={{ fontSize: "28px", marginBottom: "8px", animation: "pulse 1s ease-in-out infinite" }}>⏳</div>Connecting...</div>}
          {mwaAvailable && (
            <div style={{ ...glassCard, marginBottom: "20px", padding: "20px", textAlign: "center", border: `1px solid ${WALLET_THEMES.seedvault.primary}30` }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: WALLET_THEMES.seedvault.primary, marginBottom: "12px", letterSpacing: "0.05em", textTransform: "uppercase" }}>📱 Solana Mobile Detected</div>
              <button onClick={() => !loading && connectWallet("seedvault")} disabled={loading} style={{ ...btnPrimary, width: "100%", padding: "14px 24px", fontSize: "15px", background: `linear-gradient(135deg, ${WALLET_THEMES.seedvault.primary}, ${WALLET_THEMES.seedvault.accent})`, boxShadow: `0 2px 20px ${WALLET_THEMES.seedvault.primary}30` }}>🔐 Connect with Seed Vault</button>
            </div>
          )}
          {isMobile && !mwaAvailable && <div style={{ ...cardStyle, marginBottom: "20px", padding: "14px 16px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>📱 Tap a wallet to open in that wallet's browser</div>}
          {mwaAvailable && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "12px", textAlign: "center" }}>{t.orSelectWallet}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {walletOptions.filter((opt) => !opt.isMwa).map((opt) => {
              const wTheme = WALLET_THEMES[opt.id] || WALLET_THEMES.default;
              const detected = isWalletDetected(opt);
              return (
                <button key={opt.id} onClick={() => !loading && connectWallet(opt.id)} disabled={loading} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", background: `linear-gradient(135deg, ${wTheme.bg}, #0c0c14)`, border: `1px solid ${wTheme.primary}30`, borderRadius: "12px", color: "#E8E8ED", fontFamily: "inherit", cursor: loading ? "wait" : "pointer", fontSize: "15px", fontWeight: "600", transition: "all 0.2s ease", textAlign: "left", opacity: loading ? 0.5 : 1 }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = wTheme.primary; e.currentTarget.style.transform = "translateX(4px)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${wTheme.primary}30`; e.currentTarget.style.transform = "translateX(0)"; }}>
                  <span style={{ fontSize: "24px" }}>{walletIcons[opt.id] || "💳"}</span>
                  <span>{opt.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "10px", padding: "4px 10px", background: detected ? `${wTheme.primary}25` : "#ffffff08", color: detected ? wTheme.primary : "#666", borderRadius: "100px", fontWeight: "600" }}>
                    {detected ? `✓ ${t.detected}` : isMobile && opt.mobileLink ? "↗" : "Solana"}
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
  // PROFILE SETUP
  // ============================================================
  if (view === "profile-setup") {
    const setupTabs = ["Basics", "Socials", "Skills"];
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "540px", margin: "0 auto", padding: "40px 20px" }}>
          <div style={fadeIn}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>{TIER_CONFIG[fairScore]?.emoji}</div>
              <h2 style={{ fontSize: "26px", fontWeight: "800", marginBottom: "4px" }}>{t.setUpProfile}</h2>
              <p style={{ color: "#888", fontSize: "13px" }}>You're <span style={{ color: TIER_CONFIG[fairScore]?.color, fontWeight: "700" }}>Tier {fairScore} — {TIER_CONFIG[fairScore]?.label}</span></p>
            </div>
            <div style={{ ...cardStyle, marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "14px 18px" }}>
              <div><div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wallet</div><div style={{ fontSize: "13px", color: theme.primary, fontWeight: "600", marginTop: "2px" }}>{wallet}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>FairScore</div><div style={{ fontSize: "13px", color: TIER_CONFIG[fairScore]?.color, fontWeight: "600", marginTop: "2px" }}>{scoreData?.score} pts</div></div>
            </div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#0c0c14", borderRadius: "10px", padding: "4px" }}>
              {setupTabs.map((t) => (
                <button key={t} onClick={() => setSetupTab(t)} style={{ flex: 1, padding: "10px", fontSize: "13px", fontWeight: "600", background: setupTab === t ? `${theme.primary}20` : "transparent", border: setupTab === t ? `1px solid ${theme.primary}30` : "1px solid transparent", borderRadius: "8px", color: setupTab === t ? theme.primary : "#888", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease" }}>{t}</button>
              ))}
            </div>
            <div style={cardStyle}>
              {setupTab === "Basics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ textAlign: "center" }}>
                    <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "8px" }}>{t.profilePicture}</label>
                    <div style={{ width: "88px", height: "88px", borderRadius: "50%", margin: "0 auto 12px", background: profileForm.pfpUrl ? `url(${profileForm.pfpUrl}) center/cover` : `linear-gradient(135deg, ${theme.primary}30, ${theme.accent}30)`, border: `3px solid ${theme.primary}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: theme.primary, cursor: "pointer" }} onClick={() => document.getElementById("pfp-upload")?.click()}>
                      {!profileForm.pfpUrl && "👤"}
                    </div>
                    <input id="pfp-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 2 * 1024 * 1024) { notify("Image must be under 2MB"); return; } const reader = new FileReader(); reader.onload = (ev) => setProfileForm((prev) => ({ ...prev, pfpUrl: ev.target.result })); reader.readAsDataURL(file); } }} />
                    <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 16px", marginBottom: "8px" }} onClick={() => document.getElementById("pfp-upload")?.click()}>{t.uploadImage}</button>
                    <div style={{ fontSize: "10px", color: "#555", marginBottom: "6px" }}>or paste a URL below</div>
                    <input style={{ ...inputStyle, fontSize: "12px" }} value={profileForm.pfpUrl?.startsWith("data:") ? "" : profileForm.pfpUrl} onChange={(e) => setProfileForm({ ...profileForm, pfpUrl: e.target.value })} placeholder="https://example.com/image.png" />
                  </div>
                  <div><label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Display Name *</label><input style={inputStyle} value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} placeholder="e.g. CryptoBuilder" /></div>
                  <div><label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Email</label><input style={inputStyle} type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="you@example.com" /></div>
                  <div><label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Bio</label><textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Solana builder, DeFi enthusiast..." /></div>
                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Location</label><input style={inputStyle} value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} placeholder="e.g. United States" /></div>
                    <div><label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "6px" }}>Works at</label><input style={inputStyle} value={profileForm.worksAt} onChange={(e) => setProfileForm({ ...profileForm, worksAt: e.target.value })} placeholder="e.g. Marinade Finance" /></div>
                  </div>
                </div>
              )}
              {setupTab === "Socials" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.socialProfiles}</div>
                  {[{ key: "xHandle", label: "X / Twitter", prefix: "@", placeholder: "yourhandle", icon: "𝕏" }, { key: "discord", label: "Discord", prefix: "", placeholder: "username", icon: "💬" }, { key: "telegram", label: "Telegram", prefix: "@", placeholder: "yourhandle", icon: "✈️" }, { key: "github", label: "GitHub", prefix: "", placeholder: "github.com/you", icon: "🐙" }, { key: "linkedin", label: "LinkedIn", prefix: "", placeholder: "linkedin.com/in/you", icon: "💼" }, { key: "website", label: "Website / Portfolio", prefix: "", placeholder: "https://yoursite.com", icon: "🌐" }].map((s) => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px", width: "24px", textAlign: "center" }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px" }}>{s.label}</label>
                        <div style={{ position: "relative" }}>
                          {s.prefix && <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: "13px" }}>{s.prefix}</span>}
                          <input style={{ ...inputStyle, fontSize: "13px", padding: "10px 14px", paddingLeft: s.prefix ? "26px" : "14px" }} value={profileForm[s.key]} onChange={(e) => setProfileForm({ ...profileForm, [s.key]: e.target.value.replace(/^@/, "") })} placeholder={s.placeholder} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {setupTab === "Skills" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profileForm.skills.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>Selected ({profileForm.skills.length})</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {profileForm.skills.map((s) => (
                          <button key={s} onClick={() => toggleSkill(s)} style={{ padding: "6px 14px", background: `${theme.primary}20`, border: `1px solid ${theme.primary}40`, borderRadius: "100px", fontSize: "12px", color: theme.primary, cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>{s} ✕</button>
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
                          return <button key={s} onClick={() => toggleSkill(s)} style={{ padding: "5px 12px", background: selected ? `${theme.primary}20` : "#0c0c14", border: `1px solid ${selected ? theme.primary + "40" : theme.primary + "15"}`, borderRadius: "100px", fontSize: "11px", color: selected ? theme.primary : "#999", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s ease" }}>{s}</button>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button style={{ ...btnPrimary, flex: 1 }} onClick={handleProfileSave}>{t.saveProfileEnter}</button>
            </div>
            <button style={{ ...btnOutline, width: "100%", marginTop: "8px", fontSize: "12px" }} onClick={() => { setProfile({ displayName: profileForm.displayName.trim() || wallet?.slice(0, 10) || "Anon", xHandle: "", bio: "", contact: "", email: "", pfpUrl: "", linkedin: "", github: "", website: "", telegram: "", discord: "", lookingFor: "", worksAt: "", location: "", skills: [], joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }) }); setView("dashboard"); }}>{t.skipForNow}</button>
          </div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // PROFILE VIEW
  // ============================================================
  if (view === "profile" && wallet) {
    const tier = TIER_CONFIG[fairScore];
    const bookmarkedBounties = allBounties.filter((b) => bookmarks.includes(b.id));
    const socials = [
      { key: "xHandle", icon: "𝕏", url: (v) => `https://x.com/${v}`, label: (v) => `@${v}` },
      { key: "linkedin", icon: "💼", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: () => "LinkedIn" },
      { key: "github", icon: "🐙", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: () => "GitHub" },
      { key: "website", icon: "🌐", url: (v) => v.startsWith("http") ? v : `https://${v}`, label: () => "Website" },
      { key: "telegram", icon: "✈️", url: (v) => `https://t.me/${v}`, label: (v) => `@${v}` },
      { key: "discord", icon: "💬", url: () => null, label: (v) => v },
      { key: "email", icon: "📧", url: (v) => `mailto:${v}`, label: (v) => v },
    ].filter((s) => profile?.[s.key]);

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "650px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel={t.backBounties} />
          {demoModalJsx}
          <Notification />
          <div style={fadeIn}>
            {/* Profile header */}
            <div style={{ ...cardStyle, marginBottom: "20px", padding: "28px" }}>
              <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", flexShrink: 0, background: profile?.pfpUrl ? `url(${profile.pfpUrl}) center/cover` : `linear-gradient(135deg, ${theme.primary}30, ${theme.accent}30)`, border: `3px solid ${tier?.color || theme.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>
                  {!profile?.pfpUrl && tier?.emoji}
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "2px" }}>{profile?.displayName || "Anonymous"}</h2>
                      {profile?.xHandle && <a href={`https://x.com/${profile.xHandle}`} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary, textDecoration: "none", fontSize: "13px" }}>@{profile.xHandle}</a>}
                    </div>
                    <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 14px" }} onClick={() => { setProfileForm({ displayName: profile?.displayName || "", xHandle: profile?.xHandle || "", bio: profile?.bio || "", contact: profile?.contact || "", email: profile?.email || "", pfpUrl: profile?.pfpUrl || "", linkedin: profile?.linkedin || "", github: profile?.github || "", website: profile?.website || "", telegram: profile?.telegram || "", discord: profile?.discord || "", lookingFor: profile?.lookingFor || "", worksAt: profile?.worksAt || "", location: profile?.location || "", skills: profile?.skills || [] }); setView("profile-setup"); }}>{ t.editProfile}</button>
                  </div>
                  {profile?.bio && <p style={{ color: "#999", fontSize: "13px", lineHeight: "1.6", marginTop: "8px" }}>{profile.bio}</p>}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "10px", fontSize: "12px", color: "#888" }}>
                    {profile?.worksAt && <span>🏢 {profile.worksAt}</span>}
                    {profile?.location && <span>📍 {profile.location}</span>}
                  </div>
                  {socials.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      {socials.map((s) => {
                        const val = profile[s.key];
                        const href = s.url(val);
                        return href ? <a key={s.key} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "16px", textDecoration: "none", opacity: 0.7 }} title={s.label(val)}>{s.icon}</a> : <span key={s.key} style={{ fontSize: "16px", opacity: 0.7 }} title={s.label(val)}>{s.icon}</span>;
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15`, flexWrap: "wrap" }}>
                {[
                  { value: `Tier ${fairScore}`, label: tier?.label, color: tier?.color },
                  { value: `${xp}`, label: "BXP", color: theme.primary },
                  { value: betaAccess ? "⚡ Active" : "—", label: "Beta", color: betaAccess ? theme.primary : "#666" },
                  { value: "0", label: "Won", color: "#888" },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.3px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "#0c0c14", borderRadius: "10px", padding: "4px" }}>
              {["overview", "skills", "bookmarks"].map((t) => (
                <button key={t} onClick={() => setProfileTab(t)} style={{ flex: 1, padding: "10px", fontSize: "12px", fontWeight: "600", textTransform: "capitalize", background: profileTab === t ? `${theme.primary}20` : "transparent", border: profileTab === t ? `1px solid ${theme.primary}30` : "1px solid transparent", borderRadius: "8px", color: profileTab === t ? theme.primary : "#888", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s ease" }}>
                  {t === "bookmarks" ? `📌 ${t.referrals === "Referidos" ? "Guardados" : "Bookmarks"} (${bookmarks.length})` : t === "skills" ? `🛠 ${lang === "es" ? "Habilidades" : "Skills"}` : `📊 ${lang === "es" ? "Resumen" : "Overview"}`}
                </button>
              ))}
            </div>

            {profileTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "10px 14px", background: `${theme.primary}08`, border: `1px solid ${theme.primary}20`, borderRadius: "8px", fontSize: "11px", color: theme.primary, textAlign: "center" }}>
                  ✅ Live FairScore data from <a href="https://fairscale.xyz" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary }}>FairScale API</a>
                  {betaAccess && <span style={{ marginLeft: "12px" }}>⚡ Beta access active</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                  {[{ label: "FairScore", value: scoreData?.score || 0, color: tier?.color }, { label: "Prize Access", value: "TBD", color: theme.accent }, { label: "BXP Multiplier", value: `${tier?.xpMultiplier}x`, color: theme.primary }, { label: "Vote Weight", value: `${tier?.voteWeight}x`, color: theme.primary }, { label: "Risk Level", value: riskData.level, color: riskData.color }].map((s) => (
                    <div key={s.label} style={{ ...cardStyle, padding: "14px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>{s.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {scoreData && (
                  <div style={cardStyle}>
                    <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>{t.onChainActivity}</h3>
                    <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[{ label: "FairScale Tier", value: scoreData.fairscaleTier }, { label: "FairScore", value: Math.round(scoreData.score * 10) / 10 }, { label: "Base Score", value: Math.round(scoreData.fairscoreBase * 10) / 10 }, { label: "Social Score", value: Math.round(scoreData.socialScore * 10) / 10 }, { label: "Transactions", value: Math.round(scoreData.txCount) }, { label: "Active Days", value: Math.round(scoreData.activeDays) }, { label: "Platforms", value: Math.round(scoreData.protocolsUsed) }, { label: "Conviction", value: `${(scoreData.convictionRatio * 100).toFixed(0)}%` }].map((d) => (
                        <div key={d.label} style={{ padding: "10px", background: "#0c0c14", borderRadius: "6px" }}>
                          <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>{d.label}</div>
                          <div style={{ fontSize: "14px", fontWeight: "600" }}>{d.value}</div>
                        </div>
                      ))}
                    </div>
                    {fullAddress && PLATFORM_BADGES[fullAddress] && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>{t.platformBadges}</div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {PLATFORM_BADGES[fullAddress].map((badge) => (
                            <span key={badge.id} style={{ padding: "4px 14px", fontSize: "11px", borderRadius: "100px", fontWeight: "700", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>★ {badge.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {scoreData.badges?.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "6px" }}>{t.fairscoreBadges}</div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {scoreData.badges.map((badge) => (
                            <span key={badge.id} style={{ padding: "4px 12px", fontSize: "11px", borderRadius: "100px", fontWeight: "600", background: badge.tier === "gold" ? "#F59E0B15" : badge.tier === "silver" ? "#9CA3AF15" : `${theme.primary}15`, color: badge.tier === "gold" ? "#F59E0B" : badge.tier === "silver" ? "#9CA3AF" : theme.primary, border: `1px solid ${badge.tier === "gold" ? "#F59E0B30" : badge.tier === "silver" ? "#9CA3AF30" : theme.primary + "30"}` }} title={badge.description}>{badge.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px" }}>⭐ BXP Breakdown</h3>
                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[{ label: t.welcomeBonus, value: bxpBreakdown.welcome, icon: "🎁" }, { label: t.referralEarnings, value: bxpBreakdown.referrals, icon: "🔗" }, { label: t.referredBonus, value: bxpBreakdown.referred, icon: "🤝" }, { label: t.submissionsLabel, value: bxpBreakdown.submissions, icon: "📝" }].map((d) => (
                      <div key={d.label} style={{ padding: "10px", background: "#0c0c14", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>{d.icon} {d.label}</div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: d.value > 0 ? theme.primary : "#444" }}>{d.value} BXP</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "10px", padding: "10px", background: `${theme.primary}10`, borderRadius: "6px", textAlign: "center" }}>
                    <span style={{ fontSize: "12px", color: "#888" }}>Total: </span>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: theme.primary }}>{xp} BXP</span>
                    <span style={{ fontSize: "11px", color: "#666", marginLeft: "8px" }}>({tier?.xpMultiplier}x multiplier)</span>
                  </div>
                </div>
                <div style={{ ...glassCard, padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>🔗 Referral Link</h3>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                        You earn <span style={{ color: theme.primary, fontWeight: "600" }}>{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore || 1))} BXP</span> per referral · they earn the same
                      </p>
                    </div>
                    {referralCount > 0 && (
                      <div style={{ padding: "4px 12px", background: `${theme.primary}18`, border: `1px solid ${theme.primary}30`, borderRadius: "100px", fontSize: "12px", fontWeight: "700", color: theme.primary, flexShrink: 0 }}>
                        {referralCount} referral{referralCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {/* Custom slug editor */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Your link slug</div>
                    {slugEditing ? (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#555", whiteSpace: "nowrap" }}>fairbounty.vercel.app?ref=</span>
                        <input
                          value={slugInput}
                          onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                          placeholder={referralCode || "yourname"}
                          style={{ ...inputStyle, flex: 1, fontSize: "12px", padding: "6px 10px" }}
                          maxLength={32}
                          autoFocus
                        />
                        <button style={{ ...btnPrimary, fontSize: "11px", padding: "6px 12px", whiteSpace: "nowrap" }} onClick={async () => {
                          if (!slugInput.trim() || slugInput.length < 3) { notify("Slug must be at least 3 characters"); return; }
                          if (!fullAddress) { notify("Wallet not connected"); return; }
                          try {
                            console.log("[FairBounty] Saving slug:", slugInput.trim(), "for wallet:", fullAddress);
                            const result = await DbAPI.setReferralCode(fullAddress, slugInput.trim());
                            console.log("[FairBounty] Slug save result:", result);
                            if (result?.code) {
                              setReferralCode(result.code);
                              notify(result.code === slugInput.trim() ? "✅ Link updated!" : `⚠️ Taken — saved as "${result.code}"`);
                            } else {
                              notify("❌ Failed to save — try again");
                              console.error("[FairBounty] Slug save failed, result:", result);
                            }
                          } catch (e) {
                            notify("❌ Error saving slug");
                            console.error("[FairBounty] Slug save error:", e);
                          }
                          setSlugEditing(false);
                        }}>Save</button>
                        <button style={{ ...btnOutline, fontSize: "11px", padding: "6px 10px" }} onClick={() => setSlugEditing(false)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 14px", border: `1px solid ${theme.primary}15` }}>
                        <span style={{ fontSize: "11px", color: "#555" }}>…?ref=</span>
                        <span style={{ flex: 1, fontSize: "12px", color: referralCode ? "rgba(255,255,255,0.6)" : "#555", fontWeight: "500", fontStyle: referralCode ? "normal" : "italic" }}>
                          {referralCode || t.tapEdit}
                        </span>
                        <button onClick={() => { setSlugInput(referralCode || ""); setSlugEditing(true); }} style={{ ...btnOutline, fontSize: "10px", padding: "4px 10px", whiteSpace: "nowrap" }}>✏️ Edit</button>
                      </div>
                    )}
                  </div>

                  {/* Full link copy + share */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", border: `1px solid ${theme.primary}15` }}>
                    <input readOnly value={referralLink} style={{ ...inputStyle, border: "none", background: "transparent", flex: 1, fontSize: "11px", color: "rgba(255,255,255,0.5)", padding: "0" }} />
                    <button onClick={() => navigator.clipboard.writeText(referralLink).then(() => notify("Referral link copied!"))} style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px", whiteSpace: "nowrap" }}>📋 Copy</button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: referralList.length > 0 ? "20px" : "0" }}>
                    <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(`I'm earning BXP on @FairBounty — reputation-gated bounties on Solana\n\nJoin with my link:\n${referralLink}\n\nBuilt by @smsonx`)}`} target="_blank" rel="noopener noreferrer" style={{ ...btnPrimary, fontSize: "12px", padding: "10px 20px", textDecoration: "none", flex: 1, textAlign: "center", display: "block" }}>Share on 𝕏</a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join FairBounty — trust-gated bounties on Solana! We both earn BXP.")}`} target="_blank" rel="noopener noreferrer" style={{ ...btnOutline, fontSize: "12px", padding: "10px 20px", textDecoration: "none", flex: 1, textAlign: "center", display: "block" }}>Telegram</a>
                  </div>

                  {/* Referral list */}
                  {referralList.length > 0 && (
                    <div>
                      <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{t.referralList}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                        {referralList.map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0c0c14", borderRadius: "8px", border: `1px solid ${theme.primary}10` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "12px" }}>👤</span>
                              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", fontWeight: "500" }}>
                                {r.display_name || r.referred_wallet?.slice(0, 8) + "..." + r.referred_wallet?.slice(-4)}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "11px", color: theme.primary, fontWeight: "600" }}>+{Math.floor(50 * FairScoreAPI.getXpMultiplier(fairScore || 1))} BXP</span>
                              <span style={{ fontSize: "10px", color: "#555" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {profileTab === "skills" && (
              <div style={cardStyle}>
                {profile?.skills?.length > 0 ? (() => {
                  const grouped = {};
                  profile.skills.forEach((s) => { const cat = Object.entries(SKILL_CATEGORIES).find(([, skills]) => skills.includes(s)); const catName = cat ? cat[0] : "Other"; if (!grouped[catName]) grouped[catName] = []; grouped[catName].push(s); });
                  return Object.entries(grouped).map(([cat, skills]) => (
                    <div key={cat} style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "11px", color: theme.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{cat}</div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{skills.map((s) => <span key={s} style={{ padding: "5px 14px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}25`, borderRadius: "100px", fontSize: "12px", color: theme.primary }}>{s}</span>)}</div>
                    </div>
                  ));
                })() : <div style={{ textAlign: "center", padding: "24px", color: "#666", fontSize: "13px" }}>{t.noSkills}</div>}
              </div>
            )}
            {profileTab === "bookmarks" && (
              <div>
                {bookmarkedBounties.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {bookmarkedBounties.map((b) => {
                      const bTier = TIER_CONFIG[b.minTier];
                      const pt = PRIZE_TYPES[b.prizeType] || PRIZE_TYPES.USDC;
                      return (
                        <div key={b.id} style={{ ...cardStyle, cursor: "pointer", padding: "16px" }} onClick={() => { setSelectedBounty(b); setView("bounty"); }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <div><div style={{ fontSize: "10px", color: "#666" }}>{b.project || b.projectName}</div><div style={{ fontSize: "14px", fontWeight: "700" }}>{b.title}</div></div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "15px", fontWeight: "800", color: pt.color }}><><PrizeIcon pt={pt} size={16} style={{verticalAlign:"middle",marginRight:4}} />{b.reward} {b.currency}</></div>
                              <div style={{ fontSize: "10px", color: bTier.color }}>{bTier.emoji} Tier {b.minTier}+</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <div style={{ ...cardStyle, textAlign: "center", padding: "32px", color: "#666", fontSize: "13px" }}>📌 {t.noBookmarks}</div>}
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
  // BOUNTY DETAIL — with real submissions + voting
  // ============================================================
  if (view === "bounty" && selectedBounty) {
    const b = selectedBounty;
    const tx = translatedBounty; // Spanish translations if available
    const tier = TIER_CONFIG[b.minTier];
    const eligible = wallet ? canClaim(b) : false;
    const bonusReward = wallet ? Math.floor((parseFloat(b.reward) || 0) * (FairScoreAPI.getRewardBonus(fairScore) / 100)) : 0;
    const pt = PRIZE_TYPES[b.prizeType] || PRIZE_TYPES.USDC;
    const isMyBounty = fullAddress && b.poster === fullAddress;
    const sortedSubs = [...selectedBountySubmissions].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Load submissions when entering bounty detail
    // (effect moved to top level — see top of component)

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel={t.backBounties} />
          {demoModalJsx}
          {submitModalJsx}
          <Notification />

          <div style={{ ...cardStyle, ...fadeIn }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", color: "#888" }}>{b.project || b.projectName}</span>
                  {!b.isDemo && <span style={{ fontSize: "9px", fontWeight: "700", color: "#22C55E", background: "#22C55E15", padding: "2px 8px", borderRadius: "100px", border: "1px solid #22C55E30" }}>✅ LIVE</span>}
                  {b.isDemo && <span style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", background: "#F59E0B15", padding: "2px 8px", borderRadius: "100px", border: "1px solid #F59E0B30" }}>⏳ DEMO</span>}
                  {isMyBounty && <span style={{ fontSize: "9px", fontWeight: "700", color: theme.primary, background: `${theme.primary}15`, padding: "2px 8px", borderRadius: "100px" }}>{t.yourBounty}</span>}
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>
                  {translating ? <span style={{ color: "#555" }}>Traduciendo... ⏳</span> : (tx?.title || b.title)}
                </h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "24px", fontWeight: "900", color: pt.color }}><><PrizeIcon pt={pt} size={16} style={{verticalAlign:"middle",marginRight:4}} />{b.reward} {b.currency}</></div>
                {bonusReward > 0 && eligible && <div style={{ fontSize: "12px", color: theme.accent, fontWeight: "600" }}>+{bonusReward} tier bonus</div>}
              </div>
            </div>

            <p style={{ color: "#aaa", fontSize: "14px", lineHeight: "1.7", marginBottom: "20px" }}>
              {translating ? <span style={{ color: "#555", fontStyle: "italic" }}>Traduciendo contenido... ⏳</span> : (tx?.description || b.description)}
            </p>

            {/* NFT Image */}
            {(b.prizeType === "NFT" || b.prize_type === "NFT" || b.prizeType === "COLLECTIBLE" || b.prize_type === "COLLECTIBLE") && (b.nftImageUrl || b.nft_image_url) && (
              <div style={{ marginBottom: "20px", borderRadius: "16px", overflow: "hidden", border: `1px solid ${theme.primary}20`, maxWidth: "320px" }}>
                <img src={b.nftImageUrl || b.nft_image_url} alt={b.nftName || b.nft_name || "NFT Prize"} style={{ width: "100%", display: "block", borderRadius: "16px" }} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                {(b.nftName || b.nft_name) && (
                  <div style={{ padding: "8px 12px", background: "#0c0c14", fontSize: "12px", color: "#aaa", textAlign: "center" }}>
                    🖼️ {b.nftName || b.nft_name}
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
              {(tx?.tags ? tx.tags.split(",").map(t => t.trim()) : Array.isArray(b.tags) ? b.tags : []).map((tag) => (
                <span key={tag} style={{ padding: "4px 12px", background: `${theme.primary}15`, border: `1px solid ${theme.primary}20`, borderRadius: "100px", fontSize: "12px", color: theme.primary }}>{tag}</span>
              ))}
            </div>

            {/* Meta */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: t.prizeType, value: pt.label, color: pt.color },
                { label: lang === "es" ? "Nivel Mín." : "Min Tier", value: `${tier.emoji} ${tier.label}`, color: tier.color },
                { label: lang === "es" ? "Envíos" : "Submissions", value: b.isDemo ? b.submissions : selectedBountySubmissions.length, color: "#888" },
                { label: lang === "es" ? "Tiempo Restante" : "Time Left", value: "__COUNTDOWN__", color: "#888", isCountdown: true },
              ].map((m) => (
                <div key={m.label} style={{ padding: "12px", background: "#0c0c14", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{m.label}</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: m.color }}>
                    {m.isCountdown ? <Countdown deadline={b.deadline} theme={theme} /> : m.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Prize escrow note for live bounties */}
            {!b.isDemo && (
              <div style={{ padding: "12px 16px", marginBottom: "20px", borderRadius: "8px", background: "#22C55E10", border: "1px solid #22C55E30", fontSize: "12px", color: "#22C55E" }}>
                🔐 {t.escrowNote}
              </div>
            )}

            {/* Risk */}
            {wallet && scoreData && (
              <div style={{ padding: "14px 16px", marginBottom: "20px", borderRadius: "8px", background: `${riskData.color}10`, border: `1px solid ${riskData.color}30`, display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: riskData.color, textTransform: "uppercase" }}>🛡️ {t.riskLevel}: {riskData.level}</div>
                <div style={{ fontSize: "11px", color: "#999" }}>{riskData.label}</div>
              </div>
            )}

            {/* Requirements & Criteria — live bounties */}
            {!b.isDemo && (b.submissionRequirements || b.submission_requirements || b.evaluationCriteria || b.evaluation_criteria) && (
              <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {(b.submissionRequirements || b.submission_requirements) && (
                  <div style={{ padding: "16px", background: "#0c0c14", borderRadius: "10px", border: `1px solid ${theme.primary}15` }}>
                    <div style={{ fontSize: "11px", color: theme.primary, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", marginBottom: "8px" }}>
                      {lang === "es" ? "📋 Requisitos de Envío" : "📋 Submission Requirements"}
                    </div>
                    <p style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.6" }}>
                      {translating ? "⏳" : (tx?.submissionRequirements || b.submissionRequirements || b.submission_requirements)}
                    </p>
                  </div>
                )}
                {(b.evaluationCriteria || b.evaluation_criteria) && (
                  <div style={{ padding: "16px", background: "#0c0c14", borderRadius: "10px", border: `1px solid ${theme.primary}15` }}>
                    <div style={{ fontSize: "11px", color: theme.accent, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", marginBottom: "8px" }}>
                      {lang === "es" ? "🏆 Criterios de Evaluación" : "🏆 Evaluation Criteria"}
                    </div>
                    <p style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.6" }}>
                      {translating ? "⏳" : (tx?.evaluationCriteria || b.evaluationCriteria || b.evaluation_criteria)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
              {wallet && <button style={btnOutline} onClick={() => toggleBookmark(b.id)}>{bookmarks.includes(b.id) ? "📌 Bookmarked" : "🔖 Bookmark"}</button>}
              {wallet && eligible && !b.isDemo && !isMyBounty && (
                <button style={btnPrimary} onClick={() => { if (!betaAccess) { setShowDemoModal(true); } else { setShowSubmitModal(true); } }}>{t.submitWork}</button>
              )}
              {wallet && !eligible && !b.isDemo && (
                <div style={{ fontSize: "12px", color: "#ff4040", padding: "12px", background: "#ff404010", borderRadius: "8px", border: "1px solid #ff404030" }}>
                  🔒 Requires Tier {b.minTier}+ (you're Tier {fairScore})
                </div>
              )}
              {!wallet && !b.isDemo && (
                <button style={btnPrimary} onClick={() => setView("connect")}>{t.connectToSubmit}</button>
              )}
              {b.isDemo && (
                <div style={{ padding: "14px", background: `${theme.primary}08`, border: `1px solid ${theme.primary}20`, borderRadius: "10px", width: "100%", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>{t.exampleBounty}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{t.sampleNote}</div>
                </div>
              )}
            </div>
          </div>

          {/* SUBMISSIONS + VOTING — only for live bounties */}
          {!b.isDemo && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>
                  {lang === "es" ? "Envíos" : "Submissions"} {selectedBountySubmissions.length > 0 && <span style={{ color: theme.primary }}>({selectedBountySubmissions.length})</span>}
                </h3>
                {isMyBounty && selectedBountySubmissions.length > 0 && (
                  <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 16px" }} onClick={() => setShowWinnerModal(true)}>
                    🏆 {t.selectWinnerBtn}
                  </button>
                )}
              </div>

              {selectedBountySubmissions.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: "center", padding: "32px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "12px" }}>📝</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>{t.noSubmissions}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{lang === "es" ? "¡Sé el primero en enviar tu trabajo!" : "Be the first to submit your work!"}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sortedSubs.map((sub, idx) => {
                    const subTier = TIER_CONFIG[sub.tier] || TIER_CONFIG[1];
                    const links = sub.links ? sub.links.split(",").map(l => l.trim()).filter(Boolean) : [];
                    return (
                      <div key={sub.id} style={{ ...cardStyle, border: idx === 0 ? `1px solid ${theme.primary}40` : cardStyle.border }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <span style={{ fontSize: "20px" }}>{subTier.emoji}</span>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: "600" }}>{sub.displayName || sub.wallet?.slice(0, 8) + "..."}</div>
                              <div style={{ fontSize: "10px", color: "#888" }}>Tier {sub.tier} · {new Date(sub.createdAt).toLocaleDateString()}</div>
                            </div>
                            {idx === 0 && <span style={{ fontSize: "9px", fontWeight: "700", color: theme.primary, background: `${theme.primary}15`, padding: "2px 8px", borderRadius: "100px" }}>{t.topVoted}</span>}
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: theme.primary }}>{t.score}: {sub.score || 0}</span>
                            {betaAccess && sub.wallet !== fullAddress && (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => handleVote(sub.id, "up")} style={{ ...btnOutline, fontSize: "11px", padding: "5px 10px", color: "#22C55E", borderColor: "#22C55E40" }}>▲ {t.upVote} ({FairScoreAPI.getVoteWeight(fairScore || 1)}x)</button>
                                <button onClick={() => handleVote(sub.id, "down")} style={{ ...btnOutline, fontSize: "11px", padding: "5px 10px", color: "#EF4444", borderColor: "#EF444440" }}>▼ {t.downVote}</button>
                              </div>
                            )}
                            {!betaAccess && <button onClick={() => setShowDemoModal(true)} style={{ ...btnOutline, fontSize: "11px", padding: "5px 10px" }}>{t.voteBeta}</button>}
                          </div>
                        </div>
                        <p style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.7", marginBottom: links.length > 0 ? "12px" : "0", wordBreak: "break-word", overflowWrap: "anywhere" }}>{sub.content}</p>
                        {links.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {links.map((link, i) => (
                              <a key={i} href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: theme.primary, textDecoration: "none", padding: "6px 12px", background: `${theme.primary}10`, borderRadius: "8px", border: `1px solid ${theme.primary}20`, wordBreak: "break-all", display: "block" }}>🔗 {link}</a>
                            ))}
                          </div>
                        )}
                        {isMyBounty && (
                          <button style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px", marginTop: "12px" }} onClick={() => handleSelectWinner(b.id, sub.id)}>
                            {t.selectWinner}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }

  // ============================================================
  // POST BOUNTY — Beta users get real form, others get intake
  // ============================================================
  if (view === "post-bounty") {
    const categories = ["Development", "Design", "Content", "Marketing", "Security Audit", "Community", "Research", "Other"];

    // Beta real bounty form
    if (betaAccess) {
      return (
        <div style={pageStyle}>
          <div style={gridOverlay} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
            <Notification />
            <NavBar />
            <div style={{ ...fadeIn, marginTop: "20px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "900" }}>Post a Bounty</h1>
                <span style={{ fontSize: "11px", fontWeight: "700", color: theme.primary, background: `${theme.primary}15`, padding: "4px 12px", borderRadius: "100px", border: `1px solid ${theme.primary}30` }}>⚡ Beta — Live</span>
              </div>
              <p style={{ color: "#888", fontSize: "14px", marginBottom: "32px" }}>{t.submitBountyNote}</p>

              <div style={{ ...cardStyle, padding: "28px" }}>
                {/* Poster identity */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", padding: "14px", background: `${theme.primary}08`, borderRadius: "8px", border: `1px solid ${theme.primary}15` }}>
                  <span style={{ fontSize: "24px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700" }}>{profile?.displayName}</div>
                    <div style={{ fontSize: "11px", color: "#888" }}>Tier {fairScore} · FairScore: {scoreData?.score || 0} · ⚡ Beta Tester</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Prize Type Selection */}
                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "block" }}>Prize Type *</label>
                    <div className="prize-grid" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {Object.entries(PRIZE_TYPES).map(([key, pt]) => (
                        <button key={key} onClick={() => setBetaBountyForm({ ...betaBountyForm, prizeType: key, currency: key === "USDC" ? "USDC" : key === "SOL" ? "SOL" : betaBountyForm.currency })} style={{
                          flex: "1 1 80px", minWidth: "70px", padding: "12px 6px", borderRadius: "12px", border: `2px solid ${betaBountyForm.prizeType === key ? pt.color : pt.color + "20"}`,
                          background: betaBountyForm.prizeType === key ? `${pt.color}15` : "transparent",
                          cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all 0.2s ease",
                        }}>
                          <div style={{ marginBottom: "4px", display: "flex", justifyContent: "center" }}><PrizeIcon pt={pt} size={22} /></div>
                          <div style={{ fontSize: "11px", fontWeight: "600", color: betaBountyForm.prizeType === key ? pt.color : "#888", whiteSpace: "nowrap" }}>{pt.label}</div>
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>{PRIZE_TYPES[betaBountyForm.prizeType]?.description}</div>
                  </div>

                  {/* Prize details based on type */}
                  {betaBountyForm.prizeType === "USDC" && (
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Amount *</label>
                      <input style={inputStyle} type="number" placeholder="e.g. 500" value={betaBountyForm.reward} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, reward: e.target.value })} />
                    </div>
                  )}
                  {betaBountyForm.prizeType === "SOL" && (
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>SOL Amount *</label>
                      <input style={inputStyle} type="number" placeholder="e.g. 10" value={betaBountyForm.reward} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, reward: e.target.value, currency: "SOL" })} />
                    </div>
                  )}
                  {betaBountyForm.prizeType === "MEMECOIN" && (
                    <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Token Ticker *</label>
                        <input style={inputStyle} placeholder="BONK, WIF, POPCAT..." value={betaBountyForm.memeToken} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, memeToken: e.target.value.toUpperCase() })} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Amount *</label>
                        <input style={inputStyle} placeholder="e.g. 1000000" value={betaBountyForm.memeTokenAmount} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, memeTokenAmount: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {betaBountyForm.prizeType === "NFT" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>NFT Name *</label>
                        <input style={inputStyle} placeholder="e.g. Mad Lads #4200" value={betaBountyForm.nftName} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, nftName: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>NFT Image *</label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <label style={{
                            ...btnOutline, display: "inline-flex", alignItems: "center", gap: "6px",
                            cursor: "pointer", fontSize: "12px", padding: "10px 16px",
                          }}>
                            🖼️ Upload Image
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) { notify("Image must be under 2MB"); return; }
                              const reader = new FileReader();
                              reader.onload = (ev) => setBetaBountyForm(prev => ({ ...prev, nftImageUrl: ev.target.result }));
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                          {betaBountyForm.nftImageUrl && (
                            <button onClick={() => setBetaBountyForm(prev => ({ ...prev, nftImageUrl: "" }))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", padding: "10px 0" }}>✕ Remove</button>
                          )}
                        </div>
                        {betaBountyForm.nftImageUrl && (
                          <div style={{ marginTop: "10px", borderRadius: "12px", overflow: "hidden", border: `1px solid ${theme.primary}20`, maxWidth: "200px" }}>
                            <img src={betaBountyForm.nftImageUrl} alt="NFT Preview" style={{ width: "100%", display: "block", borderRadius: "12px" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "10px 14px", background: "#EC489910", borderRadius: "8px", border: "1px solid #EC489930", fontSize: "12px", color: "#EC4899" }}>
                        🖼️ NFT escrow via smart contract — coming soon. For now, prize transfer coordinated directly with winner.
                      </div>
                    </div>
                  )}

                  {betaBountyForm.prizeType === "COLLECTIBLE" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Collectible Name *</label>
                        <input style={inputStyle} placeholder="e.g. Pokémon booster pack, trading card set, digital pack..." value={betaBountyForm.nftName} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, nftName: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Collectible Image</label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <label style={{
                            ...btnOutline, display: "inline-flex", alignItems: "center", gap: "6px",
                            cursor: "pointer", fontSize: "12px", padding: "10px 16px",
                          }}>
                            📦 Upload Image
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) { notify("Image must be under 2MB"); return; }
                              const reader = new FileReader();
                              reader.onload = (ev) => setBetaBountyForm(prev => ({ ...prev, nftImageUrl: ev.target.result }));
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                          {betaBountyForm.nftImageUrl && (
                            <button onClick={() => setBetaBountyForm(prev => ({ ...prev, nftImageUrl: "" }))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", padding: "10px 0" }}>✕ Remove</button>
                          )}
                        </div>
                        {betaBountyForm.nftImageUrl && (
                          <div style={{ marginTop: "10px", borderRadius: "12px", overflow: "hidden", border: `1px solid ${theme.primary}20`, maxWidth: "200px" }}>
                            <img src={betaBountyForm.nftImageUrl} alt="Collectible Preview" style={{ width: "100%", display: "block", borderRadius: "12px" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "10px 14px", background: "#10B98110", borderRadius: "8px", border: "1px solid #10B98130", fontSize: "12px", color: "#10B981" }}>
                        📦 Prize transfer coordinated directly with winner. Physical items shipped, digital items transferred on-chain or via agreed method.
                      </div>
                    </div>
                  )}

                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Project / Company *</label><input style={inputStyle} placeholder="Your project or company name" value={betaBountyForm.projectName} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, projectName: e.target.value })} /></div>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Bounty Title *</label><input style={inputStyle} placeholder="What needs to be built/created?" value={betaBountyForm.title} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, title: e.target.value })} /></div>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Description *</label><textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} placeholder="Describe the work, deliverables, requirements, tech specs..." value={betaBountyForm.description} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, description: e.target.value })} /></div>

                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Category</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={betaBountyForm.category} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, category: e.target.value })}>
                        <option value="">Select...</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Min Tier</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={betaBountyForm.minTier} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, minTier: Number(e.target.value) })}>
                        {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} Tier {k} — {v.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Tags</label><input style={inputStyle} placeholder="React, Design, Rust..." value={betaBountyForm.tags} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, tags: e.target.value })} /></div>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Deadline</label><input style={inputStyle} type="date" value={betaBountyForm.deadline} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, deadline: e.target.value })} /></div>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Submission Requirements</label>
                    <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} placeholder="What should submissions include? Format, deliverables, quality bar..." value={betaBountyForm.submissionRequirements} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, submissionRequirements: e.target.value })} />
                  </div>

                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Contact Method</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={betaBountyForm.contactMethod} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, contactMethod: e.target.value })}>
                        <option value="x">X / Twitter DM</option>
                        <option value="telegram">Telegram</option>
                        <option value="email">Email</option>
                        <option value="discord">Discord</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Contact Handle</label><input style={inputStyle} placeholder="@handle or address" value={betaBountyForm.contactValue} onChange={(e) => setBetaBountyForm({ ...betaBountyForm, contactValue: e.target.value })} /></div>
                  </div>
                </div>

                <button style={{ ...btnPrimary, width: "100%", marginTop: "24px", padding: "14px", fontSize: "15px" }} disabled={submitting} onClick={handleCreateBounty}>
                  {submitting ? "Submitting..." : "Submit for Review →"}
                </button>
              </div>
            </div>
            <Footer />
          </div>
          <style>{globalStyles}</style>
        </div>
      );
    }

    // Non-beta users: intake form
    const handleBountySubmit = () => {
      if (!wallet || !profile) { notify("Please connect wallet first."); setView("connect"); return; }
      if (!bountyForm.projectName.trim() || !bountyForm.title.trim() || !bountyForm.description.trim() || !bountyForm.reward) { notify("Please fill in all required fields."); return; }
      const application = { ...bountyForm, id: `app_${Date.now()}`, wallet: fullAddress, displayName: profile.displayName, fairScore, submittedAt: new Date().toISOString(), status: "pending" };
      const updated = [...bountyApplications, application];
      setBountyApplications(updated);
      try { localStorage.setItem("fb_bounty_applications", JSON.stringify(updated)); } catch (e) {}
      DbAPI.submitBountyApp(fullAddress, profile.displayName, fairScore, bountyForm);
      notify("Application submitted! We'll review within 24 hours.");
      setView("dashboard");
    };

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "680px", margin: "0 auto", padding: "20px" }}>
          <Notification />
          <NavBar />
          <DemoBanner />
          <div style={{ ...fadeIn, marginTop: "20px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "900", marginBottom: "8px" }}>Post a Bounty</h1>
            <p style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>Fill out the form and submit for review. We'll check the details and get your bounty live. Questions? <a href="https://x.com/smsonx" target="_blank" rel="noopener noreferrer" style={{ color: theme.primary }}>DM @smsonx on X.</a></p>
            {!wallet || !profile ? (
              <div style={{ ...cardStyle, padding: "32px", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>{t.connectFirst}</h3>
                <button style={btnPrimary} onClick={() => setView("connect")}>Connect Wallet →</button>
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", padding: "14px", background: `${theme.primary}08`, borderRadius: "8px", border: `1px solid ${theme.primary}15` }}>
                  <span style={{ fontSize: "24px" }}>{TIER_CONFIG[fairScore]?.emoji}</span>
                  <div><div style={{ fontSize: "14px", fontWeight: "700" }}>{profile.displayName}</div><div style={{ fontSize: "11px", color: "#888" }}>Tier {fairScore} · FairScore: {scoreData?.score || 0}</div></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Project / Company *</label><input style={inputStyle} placeholder="Your project..." value={bountyForm.projectName} onChange={(e) => setBountyForm({ ...bountyForm, projectName: e.target.value })} /></div>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Bounty Title *</label><input style={inputStyle} placeholder="What needs to be built?" value={bountyForm.title} onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })} /></div>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Description *</label><textarea style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }} placeholder="Describe requirements, deliverables..." value={bountyForm.description} onChange={(e) => setBountyForm({ ...bountyForm, description: e.target.value })} /></div>
                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Reward Amount *</label><input style={inputStyle} type="number" placeholder="500" value={bountyForm.reward} onChange={(e) => setBountyForm({ ...bountyForm, reward: e.target.value })} /></div>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Currency</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.currency} onChange={(e) => setBountyForm({ ...bountyForm, currency: e.target.value })}>
                        <option value="USDC">USDC</option><option value="SOL">SOL</option><option value="USDT">USDT</option><option value="Other">Other Token</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Category</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.category} onChange={(e) => setBountyForm({ ...bountyForm, category: e.target.value })}>
                        <option value="">Select...</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Min Tier</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.minTier} onChange={(e) => setBountyForm({ ...bountyForm, minTier: Number(e.target.value) })}>
                        {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} Tier {k} — {v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Deadline</label><input style={inputStyle} type="date" value={bountyForm.deadline} onChange={(e) => setBountyForm({ ...bountyForm, deadline: e.target.value })} /></div>
                  <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Best Contact</label>
                      <select style={{ ...inputStyle, cursor: "pointer" }} value={bountyForm.contactMethod} onChange={(e) => setBountyForm({ ...bountyForm, contactMethod: e.target.value })}>
                        <option value="">Select...</option><option value="telegram">Telegram</option><option value="x">X / Twitter DM</option><option value="email">Email</option><option value="discord">Discord</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Contact Handle</label><input style={inputStyle} placeholder="@handle or email" value={bountyForm.contactValue} onChange={(e) => setBountyForm({ ...bountyForm, contactValue: e.target.value })} /></div>
                  </div>
                </div>
                <div style={{ marginTop: "20px", padding: "14px", background: `${theme.primary}08`, borderRadius: "8px", border: `1px solid ${theme.primary}15`, fontSize: "12px", color: "#888" }}>
                  <div style={{ fontWeight: "700", color: "#ccc", marginBottom: "6px" }}>How it works:</div>
                  We review within 24hrs → bounty goes live → community votes on submissions → you pick the winner.
                </div>
                <button style={{ ...btnPrimary, width: "100%", marginTop: "20px", padding: "14px", fontSize: "15px" }} onClick={handleBountySubmit}>{t.submitApplication}</button>
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
  // LEADERBOARD
  // ============================================================
  if (view === "leaderboard") {
    const leaders = [
      { rank: 1, name: "CryptoBuilder.sol", tier: 5, xp: 2450, bounties: 18, earned: "$45,200" },
      { rank: 2, name: "SolDev42.sol", tier: 4, xp: 1820, bounties: 12, earned: "$28,400" },
      { rank: 3, name: "RustWizard.sol", tier: 4, xp: 1650, bounties: 10, earned: "$21,000" },
      { rank: 4, name: "DeFiHacker.sol", tier: 3, xp: 980, bounties: 7, earned: "$9,100" },
      { rank: 5, name: "NFTArtisan.sol", tier: 3, xp: 750, bounties: 5, earned: "$4,800" },
      ...(wallet ? [{ rank: "?", name: profile?.displayName || wallet, tier: fairScore, xp, bounties: 0, earned: "$0" }] : []),
    ];
    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "700px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel={t.backBounties} />
          <div style={fadeIn}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>🏆 Leaderboard</h2>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "24px" }}>Live leaderboard launching with full bounty system. Preview below.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {leaders.map((l) => {
                const t = TIER_CONFIG[l.tier] || TIER_CONFIG[1];
                const isYou = l.name === (profile?.displayName || wallet);
                return (
                  <div key={l.rank} style={{ ...cardStyle, padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", border: isYou ? `1px solid ${theme.primary}60` : cardStyle.border, background: isYou ? `${theme.primary}10` : cardStyle.background }}>
                    <div style={{ width: "32px", textAlign: "center", fontWeight: "900", fontSize: "16px", color: typeof l.rank === "number" && l.rank <= 3 ? "#FFD700" : "#666" }}>
                      {typeof l.rank === "number" && l.rank <= 3 ? ["🥇", "🥈", "🥉"][l.rank - 1] : `#${l.rank}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>{l.name} {isYou && <span style={{ color: theme.primary, fontSize: "11px" }}>(you)</span>}</div>
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
  // ADMIN VIEW — Founder wallet only
  // ============================================================
  if (view === "admin") {
    const isFounder = ADMIN_WALLETS.includes(fullAddress);
    if (!isFounder) return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <NavBar showBack backTo="dashboard" backLabel="Back" />
          <div style={{ ...cardStyle, padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "8px" }}>Admin Only</h2>
            <p style={{ color: "#888" }}>{t.founderOnly}</p>
          </div>
        </div>
        <style>{globalStyles}</style>
      </div>
    );

    const loadAdmin = async () => {
      setAdminLoading(true);
      try {
        const [mainRes, betaRes] = await Promise.all([
          fetch(`/api/db?action=admin-get-all&wallet=${fullAddress}`),
          fetch(`/api/db?action=admin-get-beta&wallet=${fullAddress}`),
        ]);
        const main = await mainRes.json();
        const beta = await betaRes.json();
        setAdminData({ ...main, betaRows: beta.rows || [] });
      } catch (e) { notify("Failed to load admin data"); }
      setAdminLoading(false);
    };

    const updateBounty = async (id, status) => {
      await fetch(`/api/db?action=admin-update-bounty&wallet=${fullAddress}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      notify(status === "open" ? "✅ Bounty approved & live!" : status === "rejected" ? "❌ Bounty rejected" : "Updated");
      loadAdmin();
    };

    const deleteBounty = async (id) => {
      if (!window.confirm("Delete this bounty permanently?")) return;
      await fetch(`/api/db?action=admin-delete-bounty&wallet=${fullAddress}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      notify("🗑️ Bounty deleted");
      loadAdmin();
    };

    

    if (!adminData && !adminLoading) loadAdmin();

    const pendingBounties = (adminData?.bounties || []).filter(b => b.status === "pending");
    const liveBountiesAdmin = (adminData?.bounties || []).filter(b => b.status === "open");
    const rejectedBounties = (adminData?.bounties || []).filter(b => b.status === "rejected");
    const pendingApps = (adminData?.apps || []).filter(a => !a.status || a.status === "pending");

    const tabBtn = (t, label, count) => (
      <button onClick={() => setAdminTab(t)} style={{
        padding: "8px 16px", borderRadius: "8px", border: "none", fontFamily: "inherit",
        cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "all 0.2s",
        background: adminTab === t ? `${theme.primary}20` : "transparent",
        color: adminTab === t ? theme.primary : "#666",
      }}>
        {label} {count > 0 && <span style={{ background: adminTab === t ? theme.primary : "#444", color: adminTab === t ? "#000" : "#fff", borderRadius: "100px", padding: "1px 6px", fontSize: "10px", marginLeft: "4px" }}>{count}</span>}
      </button>
    );

    const BountyRow = ({ b }) => {
      const [editing, setEditing] = useState(false);
      const [editFields, setEditFields] = useState({ title: b.title, description: b.description, reward: b.reward, prize_type: b.prize_type, min_tier: b.min_tier, deadline: b.deadline || "", tags: Array.isArray(b.tags) ? b.tags.join(", ") : (b.tags || "") });
      const saveEdit = async () => {
        try {
          const res = await fetch(`/api/db?action=admin-update-bounty&wallet=${fullAddress}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.id, ...editFields, tags: typeof editFields.tags === "string" ? editFields.tags.split(",").map(t => t.trim()).filter(Boolean) : (editFields.tags || []), min_tier: parseInt(editFields.min_tier) || 1 }),
          });
          const data = await res.json();
          if (data.success) {
            notify("✅ Bounty updated!"); setEditing(false); loadAdmin();
          } else {
            notify("❌ Update failed: " + (data.error || "unknown error"));
          }
        } catch (e) {
          notify("❌ Error: " + e.message);
        }
      };
      return (
        <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700" }}>{b.title}</span>
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "100px", background: b.status === "open" ? "#22C55E20" : b.status === "rejected" ? "#EF444420" : `${theme.primary}20`, color: b.status === "open" ? "#22C55E" : b.status === "rejected" ? "#EF4444" : theme.primary, fontWeight: "600" }}>{b.status}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}>
                {b.project_name} · {b.poster_name} · {b.prize_type} {b.reward} · Tier {b.min_tier}+
              </div>
              <div style={{ fontSize: "11px", color: "#666", lineHeight: "1.5", maxHeight: "48px", overflow: "hidden" }}>{b.description}</div>
              {b.contact_value && <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>📬 {b.contact_method}: {b.contact_value}</div>}
              <div style={{ fontSize: "10px", color: "#444", marginTop: "4px" }}>{new Date(b.created_at).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
              {b.status !== "open" && <button onClick={() => updateBounty(b.id, "open")} style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px" }}>✅ Approve</button>}
              {b.status === "open" && <button onClick={() => updateBounty(b.id, "pending")} style={{ ...btnOutline, fontSize: "11px", padding: "6px 12px" }}>⏸ Unpublish</button>}
              {b.status !== "rejected" && <button onClick={() => updateBounty(b.id, "rejected")} style={{ background: "#EF444420", border: "1px solid #EF444440", borderRadius: "8px", color: "#EF4444", fontSize: "11px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>❌ Reject</button>}
              <button onClick={() => setEditing(!editing)} style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`, borderRadius: "8px", color: theme.primary, fontSize: "11px", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
              <button onClick={() => deleteBounty(b.id)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#666", fontSize: "11px", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
            </div>
          </div>
          {editing && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}20`, display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Title</label>
                  <input style={inputStyle} value={editFields.title} onChange={e => setEditFields(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Reward Amount</label>
                  <input style={{ ...inputStyle, color: theme.primary, fontWeight: "700" }} value={editFields.reward} onChange={e => setEditFields(f => ({ ...f, reward: e.target.value }))} placeholder="e.g. 25" />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Prize Type</label>
                  <select style={{ ...inputStyle }} value={editFields.prize_type} onChange={e => setEditFields(f => ({ ...f, prize_type: e.target.value }))}>
                    {["Stablecoin", "SOL", "Memecoin", "NFT / cNFT", "Collectible"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Min Tier</label>
                  <select style={inputStyle} value={editFields.min_tier} onChange={e => setEditFields(f => ({ ...f, min_tier: parseInt(e.target.value) }))}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Tier {n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Deadline</label>
                  <input style={inputStyle} type="date" value={editFields.deadline?.slice(0,10)} onChange={e => setEditFields(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Tags</label>
                  <input style={inputStyle} value={editFields.tags} onChange={e => setEditFields(f => ({ ...f, tags: e.target.value }))} placeholder="design, content, dev..." />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} value={editFields.description} onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={saveEdit} style={{ ...btnPrimary, fontSize: "12px" }}>💾 Save Changes</button>
                <button onClick={() => setEditing(false)} style={{ ...btnOutline, fontSize: "12px" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={pageStyle}>
        <div style={gridOverlay} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
          <Notification />
          <NavBar showBack backTo="dashboard" backLabel={t.backBounties} />

          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: "900" }}>⚡ Admin Panel</h1>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "#FFD700", background: "rgba(255,215,0,0.1)", padding: "3px 10px", borderRadius: "100px", border: "1px solid rgba(255,215,0,0.2)" }}>★ Founder</span>
            </div>
            <p style={{ fontSize: "12px", color: "#666" }}>fairbounty.vercel.app · {adminData ? `${adminData.bounties?.length || 0} bounties · ${adminData.profiles?.length || 0} profiles` : "Loading..."}</p>
          </div>

          {/* Stats row */}
          {adminData && (
            <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {[
                { label: "Pending Review", value: pendingBounties.length + pendingApps.length, color: theme.primary, icon: "⏳" },
                { label: "Live Bounties", value: liveBountiesAdmin.length, color: "#22C55E", icon: "✅" },
                { label: "Total Profiles", value: adminData.profiles?.length || 0, color: "#8B5CF6", icon: "👤" },
                { label: "Total BXP Issued", value: (adminData.bxpRows || []).reduce((sum, r) => sum + Object.values(r.bxp || {}).reduce((a, b) => a + b, 0), 0), color: "#F59E0B", icon: "⭐" },
              ].map(s => (
                <div key={s.label} style={{ ...cardStyle, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>{s.icon}</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", background: "#0c0c14", borderRadius: "10px", padding: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
            {tabBtn("bounties", "Pending", pendingBounties.length)}
            {tabBtn("live", "Live", liveBountiesAdmin.length)}
            {tabBtn("rejected", "Rejected", rejectedBounties.length)}
            {tabBtn("apps", "Intake Forms", pendingApps.length)}
            {tabBtn("profiles", "Profiles", adminData?.profiles?.length || 0)}
            {tabBtn("beta", "⚡ Beta Access", adminData?.betaRows?.filter(r => r.active)?.length || 0)}
          </div>

          {adminLoading && <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Loading...</div>}

          {!adminLoading && adminTab === "bounties" && (
            <div>
              {pendingBounties.length === 0
                ? <div style={{ ...cardStyle, padding: "32px", textAlign: "center", color: "#666" }}>{t.noPendingBounties}</div>
                : pendingBounties.map(b => <BountyRow key={b.id} b={b} />)
              }
            </div>
          )}

          {!adminLoading && adminTab === "live" && (
            <div>
              {liveBountiesAdmin.length === 0
                ? <div style={{ ...cardStyle, padding: "32px", textAlign: "center", color: "#666" }}>{t.noLiveBounties}</div>
                : liveBountiesAdmin.map(b => <BountyRow key={b.id} b={b} />)
              }
            </div>
          )}

          {!adminLoading && adminTab === "rejected" && (
            <div>
              {rejectedBounties.length === 0
                ? <div style={{ ...cardStyle, padding: "32px", textAlign: "center", color: "#666" }}>{t.noRejectedBounties}</div>
                : rejectedBounties.map(b => <BountyRow key={b.id} b={b} />)
              }
            </div>
          )}

          {!adminLoading && adminTab === "apps" && (
            <div>
              {pendingApps.length === 0
                ? <div style={{ ...cardStyle, padding: "32px", textAlign: "center", color: "#666" }}>{t.noIntakeForms}</div>
                : pendingApps.map(app => {
                  const isBetaReq = app.form_data?.type === "beta_request";
                  const xHandle = app.form_data?.xHandle || app.display_name || "";
                  const reqWallet = app.form_data?.wallet || app.wallet || "";
                  return (
                  <div key={app.id} style={{ ...cardStyle, padding: "16px 20px", marginBottom: "10px", border: isBetaReq ? `1px solid ${theme.primary}30` : cardStyle.border }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        {isBetaReq ? (
                          <>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                              <span style={{ fontSize: "9px", fontWeight: "700", color: theme.primary, background: `${theme.primary}20`, padding: "2px 8px", borderRadius: "4px" }}>⚡ BETA REQUEST</span>
                            </div>
                            <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>@{xHandle}</div>
                            <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                              {reqWallet}
                              <button onClick={() => { navigator.clipboard.writeText(reqWallet); notify("Copied!"); }} style={{ background: "none", border: "none", color: theme.primary, cursor: "pointer", fontSize: "11px", marginLeft: "6px", fontFamily: "inherit" }}>📋</button>
                            </div>
                            {xHandle && (
                              <a href={`https://x.com/${xHandle}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: theme.primary, textDecoration: "none" }}>View @{xHandle} on X ↗</a>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>{app.form_data?.title || "Untitled"}</div>
                            <div style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}>
                              {app.display_name} · FairScore Tier {app.fair_score} · {app.form_data?.reward} {app.form_data?.currency}
                            </div>
                            <div style={{ fontSize: "11px", color: "#666" }}>{app.form_data?.description}</div>
                          </>
                        )}
                        <div style={{ fontSize: "10px", color: "#444", marginTop: "4px" }}>{new Date(app.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={async () => {
                          await fetch(`/api/db?action=admin-update-app&wallet=${fullAddress}`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: app.id, status: "approved" }),
                          });
                          if (isBetaReq && reqWallet) {
                            await fetch(`/api/db?action=admin-add-beta&wallet=${fullAddress}`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ targetWallet: reqWallet, note: `Beta via signup form — @${xHandle}` }),
                            });
                            notify(`✅ Beta access granted to @${xHandle}!`);
                          } else {
                            notify("✅ Approved");
                          }
                          loadAdmin();
                        }} style={{ ...btnPrimary, fontSize: "11px", padding: "6px 14px" }}>{isBetaReq ? "⚡ Grant Beta" : "✅ Approve"}</button>
                        <button onClick={async () => {
                          await fetch(`/api/db?action=admin-update-app&wallet=${fullAddress}`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: app.id, status: "rejected" }),
                          });
                          notify("❌ Rejected");
                          loadAdmin();
                        }} style={{ background: "#EF444420", border: "1px solid #EF444440", borderRadius: "8px", color: "#EF4444", fontSize: "11px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>❌ Reject</button>
                      </div>
                    </div>
                  </div>
                  );
                })
              }
            </div>
          )}

          {!adminLoading && adminTab === "profiles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(adminData?.profiles || []).map(p => {
                const prof = p.profile || {};
                const bxpRow = adminData.bxpRows?.find(b => b.wallet === p.wallet);
                const totalBxp = bxpRow ? Object.values(bxpRow.bxp || {}).reduce((a, b) => a + b, 0) : 0;
                return (
                  <div key={p.wallet} style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{prof.displayName || "—"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#666", fontFamily: "monospace" }}>{p.wallet?.slice(0, 16)}...{p.wallet?.slice(-8)}</div>
                        <button onClick={() => navigator.clipboard.writeText(p.wallet).then(() => notify("Address copied!"))} style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30`, borderRadius: "4px", color: theme.primary, fontSize: "9px", padding: "2px 6px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>📋 Copy</button>
                        <button onClick={() => { setBetaInputWallet(p.wallet); setAdminTab("beta"); }} style={{ background: "#22C55E15", border: "1px solid #22C55E30", borderRadius: "4px", color: "#22C55E", fontSize: "9px", padding: "2px 6px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⚡ Beta</button>
                      </div>
                      {prof.xHandle && <div style={{ fontSize: "11px", color: theme.primary }}>@{prof.xHandle}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: theme.primary }}>{totalBxp} BXP</div>
                      <div style={{ fontSize: "10px", color: "#555" }}>{new Date(p.updated_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!adminLoading && adminTab === "beta" && (() => {
            const betaRows = adminData?.betaRows || [];
            const active = betaRows.filter(r => r.active);
            const inactive = betaRows.filter(r => !r.active);
            return (
              <div>
                {/* Add new wallet */}
                <div style={{ ...glassCard, padding: "20px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px" }}>⚡ Grant Beta Access</h3>
                  <div className="beta-grant-row" style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      value={betaInputWallet}
                      onChange={e => setBetaInputWallet(e.target.value.trim())}
                      placeholder="Wallet address (44 chars)"
                      style={{ ...inputStyle, flex: 1, fontSize: "12px", fontFamily: "monospace" }}
                    />
                    <input
                      value={betaInputNote}
                      onChange={e => setBetaInputNote(e.target.value)}
                      placeholder="Note (optional)"
                      style={{ ...inputStyle, width: "160px", fontSize: "12px" }}
                    />
                    <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 18px", whiteSpace: "nowrap" }} onClick={async () => {
                      if (!betaInputWallet || betaInputWallet.length < 32) { notify("Enter a valid wallet address"); return; }
                      const res = await fetch(`/api/db?action=admin-add-beta&wallet=${fullAddress}`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ targetWallet: betaInputWallet, note: betaInputNote }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setBetaInputWallet("");
                        setBetaInputNote("");
                        notify("✅ Beta access granted!");
                        loadAdmin();
                      } else {
                        notify("❌ Failed — " + (data.error || "unknown error"));
                      }
                    }}>Grant</button>
                  </div>
                  <p style={{ fontSize: "11px", color: "#555" }}>{t.grantsAccess}</p>
                </div>

                {/* Active list */}
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Active ({active.length})
                </div>
                {active.length === 0
                  ? <div style={{ ...cardStyle, padding: "20px", textAlign: "center", color: "#555", marginBottom: "16px" }}>{t.noBetaUsers}</div>
                  : active.map(r => (
                    <div key={r.wallet} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "monospace", fontSize: "12px", color: theme.primary }}>{r.wallet?.slice(0, 20)}...{r.wallet?.slice(-8)}</div>
                        <div style={{ fontSize: "10px", color: "#555" }}>{r.note || "—"} · Added {new Date(r.added_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={async () => {
                        await fetch(`/api/db?action=admin-remove-beta&wallet=${fullAddress}`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ targetWallet: r.wallet }),
                        });
                        notify("Removed beta access");
                        loadAdmin();
                      }} style={{ background: "#EF444415", border: "1px solid #EF444430", borderRadius: "8px", color: "#EF4444", fontSize: "11px", padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        Revoke
                      </button>
                    </div>
                  ))
                }

                {/* Inactive */}
                {inactive.length > 0 && (
                  <>
                    <div style={{ fontSize: "11px", color: "#444", textTransform: "uppercase", letterSpacing: "0.5px", margin: "16px 0 8px" }}>Revoked ({inactive.length})</div>
                    {inactive.map(r => (
                      <div key={r.wallet} style={{ ...cardStyle, padding: "10px 16px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "12px", opacity: 0.5 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#666" }}>{r.wallet?.slice(0, 20)}...{r.wallet?.slice(-8)}</div>
                        </div>
                        <button onClick={async () => {
                          await fetch(`/api/db?action=admin-add-beta&wallet=${fullAddress}`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ targetWallet: r.wallet, note: r.note }),
                          });
                          notify("✅ Re-granted beta access");
                          loadAdmin();
                        }} style={{ ...btnOutline, fontSize: "10px", padding: "4px 10px" }}>Re-grant</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}

          <div style={{ marginTop: "16px", textAlign: "right" }}>
            <button onClick={loadAdmin} style={{ ...btnOutline, fontSize: "11px", padding: "6px 14px" }}>🔄 Refresh</button>
          </div>
          <Footer />
        </div>
        <style>{globalStyles}</style>
      </div>
    );
  }
  return (
    <div style={pageStyle}>
      <div style={gridOverlay} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
        <Notification />
        <NavBar />
        {demoModalJsx}
        <WelcomeModal />
        <DemoBanner />

        {/* Score card */}
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
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>{t.platformBxp}</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.primary }}>{xp}</div>
                <div style={{ marginTop: "6px", height: "4px", background: "#1a1a2a", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (xp % 200) / 2)}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`, borderRadius: "2px", transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>{FairScoreAPI.getXpMultiplier(fairScore)}x multiplier</div>
              </div>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>{t.voteWeight}</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.accent }}>{FairScoreAPI.getVoteWeight(fairScore || 1)}x</div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>+{rewardBonus}% reward bonus</div>
              </div>
              <div style={{ padding: "8px" }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Access</div>
                <div style={{ fontSize: "14px", fontWeight: "900", color: betaAccess ? theme.primary : "#888" }}>{betaAccess ? "⚡ Beta" : "🔍 Browse"}</div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>{betaAccess ? "Submit · Vote · Post" : "Request beta access ⚡"}</div>
              </div>
            </div>
            {scoreData && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${theme.primary}15` }}>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "11px", color: "#888" }}>
                  <span>🏆 FairScale: <span style={{ color: theme.primary, fontWeight: "600" }}>{scoreData.fairscaleTier}</span></span>
                  <span>📊 Score: {Math.round(scoreData.score * 10) / 10}</span>
                  <span>🔗 Platforms: {Math.round(scoreData.protocolsUsed)}</span>
                  <span>📈 Active days: {Math.round(scoreData.activeDays)}</span>
                  <span>💰 Txns: {Math.round(scoreData.txCount)}</span>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  {fullAddress && PLATFORM_BADGES[fullAddress] && PLATFORM_BADGES[fullAddress].map((badge) => (
                    <span key={badge.id} style={{ padding: "3px 10px", fontSize: "10px", borderRadius: "100px", fontWeight: "700", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>★ {badge.label}</span>
                  ))}
                  {scoreData.badges?.map((badge) => (
                    <span key={badge.id} style={{ padding: "3px 10px", fontSize: "10px", borderRadius: "100px", fontWeight: "600", background: `${theme.primary}15`, color: theme.primary, border: `1px solid ${theme.primary}30` }} title={badge.description}>{badge.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bounty board header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", ...fadeIn, transitionDelay: "0.2s" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800" }}>
              Bounty Board
              {liveBounties.length > 0 && <span style={{ marginLeft: "10px", fontSize: "12px", fontWeight: "600", color: "#22C55E", background: "#22C55E15", padding: "2px 10px", borderRadius: "100px", border: "1px solid #22C55E30" }}>✅ {liveBounties.length} Live</span>}
            </h2>
            <p style={{ fontSize: "12px", color: "#888" }}>{filteredBounties.length} bounties{filterType === "all" ? " (live + demo)" : filterType === "live" ? " (live only)" : " (demo only)"}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {/* Filter by type */}
            <div style={{ display: "flex", gap: "4px", background: "#0c0c14", borderRadius: "8px", padding: "3px" }}>
              {[["all", lang === "es" ? "Todo" : "All"], ["live", `Live ✅`], ["demo", lang === "es" ? "Ejemplos" : "Demo"]].map(([v, l]) => (
                <button key={v} onClick={() => setFilterType(v)} style={{ padding: "5px 10px", fontSize: "11px", background: filterType === v ? `${theme.primary}20` : "transparent", border: filterType === v ? `1px solid ${theme.primary}30` : "1px solid transparent", borderRadius: "6px", color: filterType === v ? theme.primary : "#666", cursor: "pointer", fontFamily: "inherit", fontWeight: "500" }}>{l}</button>
              ))}
            </div>
            <select style={{ ...inputStyle, width: "auto", fontSize: "12px", padding: "8px 12px", cursor: "pointer" }} value={filterTier} onChange={(e) => setFilterTier(Number(e.target.value))}>
              <option value={0}>{t.allTiers}</option>
              {Object.entries(TIER_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} Tier {k}</option>)}
            </select>
            {wallet && (
              <button style={{ ...btnPrimary, fontSize: "12px", padding: "8px 16px" }} onClick={() => { if (!betaAccess) { setShowDemoModal(true); } else { setView("post-bounty"); } }}>+ Post Bounty</button>
            )}
          </div>
        </div>

        {/* Bounty list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", ...fadeIn, transitionDelay: "0.3s" }}>
          {filteredBounties.map((b) => {
            const tier = TIER_CONFIG[b.minTier];
            const eligible = wallet ? canClaim(b) : true;
            const bonus = wallet ? FairScoreAPI.getRewardBonus(fairScore) : 0;
            const pt = PRIZE_TYPES[b.prizeType] || PRIZE_TYPES.USDC;
            const isMyBounty = fullAddress && b.poster === fullAddress;
            return (
              <div key={b.id} style={{ ...cardStyle, cursor: "pointer", opacity: eligible ? 1 : 0.55, position: "relative", overflow: "hidden", border: b.isDemo ? cardStyle.border : `1px solid ${theme.primary}30` }}
                onClick={() => { setSelectedBounty(b); setView("bounty"); }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = b.isDemo ? theme.primary : theme.primary; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = b.isDemo ? `${theme.primary}18` : `${theme.primary}30`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {!eligible && <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "11px", color: "#ff4040", padding: "2px 8px", background: "#ff004015", borderRadius: "4px" }}>🔒 Locked</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#666" }}>{b.project || b.projectName}</span>
                      {!b.isDemo && <span style={{ fontSize: "9px", fontWeight: "700", color: "#22C55E", background: "#22C55E15", padding: "1px 6px", borderRadius: "4px" }}>✅ LIVE</span>}
                      {isMyBounty && <span style={{ fontSize: "9px", fontWeight: "700", color: theme.primary, background: `${theme.primary}15`, padding: "1px 6px", borderRadius: "4px" }}>{t.yourBounty}</span>}
                      {lang === "es" && <span style={{ fontSize: "9px", color: "#888", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: "4px" }}>🌐 ES disponible</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      {(b.prizeType === "NFT" || b.prize_type === "NFT" || b.prizeType === "COLLECTIBLE" || b.prize_type === "COLLECTIBLE") && (b.nftImageUrl || b.nft_image_url) && (
                        <img src={b.nftImageUrl || b.nft_image_url} alt="" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${theme.primary}20`, flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />
                      )}
                      <div style={{ fontSize: "16px", fontWeight: "700" }}>{b.title}</div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {(Array.isArray(b.tags) ? b.tags : []).slice(0, 4).map((tag) => (
                        <span key={tag} style={{ padding: "2px 8px", background: `${theme.primary}10`, borderRadius: "4px", fontSize: "11px", color: `${theme.primary}BB` }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "18px", fontWeight: "900", color: pt.color }}><><PrizeIcon pt={pt} size={16} style={{verticalAlign:"middle",marginRight:4}} />{b.reward} {b.currency}</></div>
                    {bonus > 0 && eligible && <div style={{ fontSize: "10px", color: theme.accent }}>+{bonus}% bonus</div>}
                    <div style={{ fontSize: "11px", color: tier.color, marginTop: "4px" }}>{tier.emoji} Tier {b.minTier}+</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "11px", color: "#666", alignItems: "center" }}>
                  <span>📝 {b.isDemo ? b.submissions : (b.submissionCount || 0)} submissions</span>
                  <span>⏰ {b.deadline || "Open"}</span>
                  {wallet && (
                    <button onClick={(e) => { e.stopPropagation(); toggleBookmark(b.id); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: "0", fontFamily: "inherit" }} title={bookmarks.includes(b.id) ? "Remove bookmark" : "Bookmark"}>
                      {bookmarks.includes(b.id) ? "📌" : "🔖"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredBounties.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>{t.noBounties}</div>
              <div style={{ fontSize: "12px", color: "#888" }}>Try adjusting your filters</div>
            </div>
          )}
        </div>
        <Footer />
      </div>
      <style>{globalStyles}</style>
    </div>
  );
}
