// /api/db.js — Vercel Serverless Function
// Handles all database operations for FairBounty
// Uses Neon Postgres via POSTGRES_URL environment variable

import { neon } from "@neondatabase/serverless";

let sql;
function getDb() {
  if (!sql) {
    sql = neon(process.env.POSTGRES_URL);
  }
  return sql;
}

// Initialize tables on first call
async function initTables() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS fb_profiles (
      wallet TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      x_handle TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      email TEXT DEFAULT '',
      pfp_url TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      github TEXT DEFAULT '',
      website TEXT DEFAULT '',
      telegram TEXT DEFAULT '',
      discord TEXT DEFAULT '',
      looking_for TEXT DEFAULT '',
      works_at TEXT DEFAULT '',
      location TEXT DEFAULT '',
      skills TEXT DEFAULT '[]',
      joined_date TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS fb_bxp (
      wallet TEXT PRIMARY KEY,
      welcome INTEGER DEFAULT 0,
      referrals INTEGER DEFAULT 0,
      referred INTEGER DEFAULT 0,
      submissions INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      welcome_claimed BOOLEAN DEFAULT FALSE,
      referred_by TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS fb_referrals (
      id SERIAL PRIMARY KEY,
      referrer_wallet TEXT NOT NULL,
      referred_wallet TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(referrer_wallet, referred_wallet)
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS fb_wallets (
      wallet TEXT PRIMARY KEY,
      first_connected TIMESTAMP DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS fb_bounty_apps (
      id SERIAL PRIMARY KEY,
      wallet TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      fair_score INTEGER DEFAULT 1,
      project_name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      reward TEXT DEFAULT '',
      currency TEXT DEFAULT 'USDC',
      min_tier INTEGER DEFAULT 1,
      deadline TEXT DEFAULT '',
      category TEXT DEFAULT '',
      contact_method TEXT DEFAULT '',
      contact_value TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await initTables();
    const db = getDb();
    const { action } = req.query;

    // ============================================
    // GET PROFILE
    // ============================================
    if (action === "get-profile" && req.method === "GET") {
      const { wallet } = req.query;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      const rows = await db`SELECT * FROM fb_profiles WHERE wallet = ${wallet}`;
      if (rows.length === 0) return res.status(200).json({ profile: null });

      const p = rows[0];
      return res.status(200).json({
        profile: {
          displayName: p.display_name,
          xHandle: p.x_handle,
          bio: p.bio,
          contact: p.contact,
          email: p.email,
          pfpUrl: p.pfp_url,
          linkedin: p.linkedin,
          github: p.github,
          website: p.website,
          telegram: p.telegram,
          discord: p.discord,
          lookingFor: p.looking_for,
          worksAt: p.works_at,
          location: p.location,
          skills: JSON.parse(p.skills || "[]"),
          joinedDate: p.joined_date,
        },
      });
    }

    // ============================================
    // SAVE PROFILE
    // ============================================
    if (action === "save-profile" && req.method === "POST") {
      const { wallet, profile } = req.body;
      if (!wallet || !profile) return res.status(400).json({ error: "wallet and profile required" });

      await db`
        INSERT INTO fb_profiles (wallet, display_name, x_handle, bio, contact, email, pfp_url, linkedin, github, website, telegram, discord, looking_for, works_at, location, skills, joined_date, updated_at)
        VALUES (${wallet}, ${profile.displayName || ""}, ${profile.xHandle || ""}, ${profile.bio || ""}, ${profile.contact || ""}, ${profile.email || ""}, ${profile.pfpUrl || ""}, ${profile.linkedin || ""}, ${profile.github || ""}, ${profile.website || ""}, ${profile.telegram || ""}, ${profile.discord || ""}, ${profile.lookingFor || ""}, ${profile.worksAt || ""}, ${profile.location || ""}, ${JSON.stringify(profile.skills || [])}, ${profile.joinedDate || ""}, NOW())
        ON CONFLICT (wallet) DO UPDATE SET
          display_name = ${profile.displayName || ""},
          x_handle = ${profile.xHandle || ""},
          bio = ${profile.bio || ""},
          contact = ${profile.contact || ""},
          email = ${profile.email || ""},
          pfp_url = ${profile.pfpUrl || ""},
          linkedin = ${profile.linkedin || ""},
          github = ${profile.github || ""},
          website = ${profile.website || ""},
          telegram = ${profile.telegram || ""},
          discord = ${profile.discord || ""},
          looking_for = ${profile.lookingFor || ""},
          works_at = ${profile.worksAt || ""},
          location = ${profile.location || ""},
          skills = ${JSON.stringify(profile.skills || [])},
          joined_date = ${profile.joinedDate || ""},
          updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    }

    // ============================================
    // GET BXP
    // ============================================
    if (action === "get-bxp" && req.method === "GET") {
      const { wallet } = req.query;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      const rows = await db`SELECT * FROM fb_bxp WHERE wallet = ${wallet}`;
      if (rows.length === 0) {
        return res.status(200).json({ bxp: { welcome: 0, referrals: 0, referred: 0, submissions: 0, wins: 0 }, welcomeClaimed: false, referredBy: null });
      }
      const b = rows[0];
      return res.status(200).json({
        bxp: { welcome: b.welcome, referrals: b.referrals, referred: b.referred, submissions: b.submissions, wins: b.wins },
        welcomeClaimed: b.welcome_claimed,
        referredBy: b.referred_by,
      });
    }

    // ============================================
    // CLAIM WELCOME BONUS
    // ============================================
    if (action === "claim-welcome" && req.method === "POST") {
      const { wallet, amount } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      // Check if already claimed
      const existing = await db`SELECT welcome_claimed FROM fb_bxp WHERE wallet = ${wallet}`;
      if (existing.length > 0 && existing[0].welcome_claimed) {
        return res.status(200).json({ success: false, already_claimed: true });
      }

      await db`
        INSERT INTO fb_bxp (wallet, welcome, welcome_claimed, updated_at)
        VALUES (${wallet}, ${amount || 100}, TRUE, NOW())
        ON CONFLICT (wallet) DO UPDATE SET
          welcome = ${amount || 100},
          welcome_claimed = TRUE,
          updated_at = NOW()
      `;
      return res.status(200).json({ success: true });
    }

    // ============================================
    // PROCESS REFERRAL
    // ============================================
    if (action === "process-referral" && req.method === "POST") {
      const { referrerWallet, referredWallet, referrerAmount, referredAmount } = req.body;
      if (!referrerWallet || !referredWallet) return res.status(400).json({ error: "both wallets required" });
      if (referrerWallet === referredWallet) return res.status(400).json({ error: "cannot self-refer" });

      // Check if already referred
      const existing = await db`SELECT id FROM fb_referrals WHERE referrer_wallet = ${referrerWallet} AND referred_wallet = ${referredWallet}`;
      if (existing.length > 0) {
        return res.status(200).json({ success: false, already_referred: true });
      }

      // Record referral
      await db`INSERT INTO fb_referrals (referrer_wallet, referred_wallet) VALUES (${referrerWallet}, ${referredWallet})`;

      // Credit referrer
      await db`
        INSERT INTO fb_bxp (wallet, referrals, updated_at)
        VALUES (${referrerWallet}, ${referrerAmount || 50}, NOW())
        ON CONFLICT (wallet) DO UPDATE SET
          referrals = fb_bxp.referrals + ${referrerAmount || 50},
          updated_at = NOW()
      `;

      // Credit referred user
      await db`
        INSERT INTO fb_bxp (wallet, referred, referred_by, updated_at)
        VALUES (${referredWallet}, ${referredAmount || 50}, ${referrerWallet}, NOW())
        ON CONFLICT (wallet) DO UPDATE SET
          referred = fb_bxp.referred + ${referredAmount || 50},
          referred_by = ${referrerWallet},
          updated_at = NOW()
      `;

      return res.status(200).json({ success: true });
    }

    // ============================================
    // GET REFERRAL COUNT
    // ============================================
    if (action === "get-referrals" && req.method === "GET") {
      const { wallet } = req.query;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      const rows = await db`SELECT COUNT(*) as count FROM fb_referrals WHERE referrer_wallet = ${wallet}`;
      return res.status(200).json({ count: parseInt(rows[0].count) });
    }

    // ============================================
    // TRACK WALLET CONNECTION
    // ============================================
    if (action === "track-wallet" && req.method === "POST") {
      const { wallet } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      await db`
        INSERT INTO fb_wallets (wallet) VALUES (${wallet})
        ON CONFLICT (wallet) DO NOTHING
      `;
      return res.status(200).json({ success: true });
    }

    // ============================================
    // GET GLOBAL STATS
    // ============================================
    if (action === "get-stats" && req.method === "GET") {
      const wallets = await db`SELECT COUNT(*) as count FROM fb_wallets`;
      const profiles = await db`SELECT COUNT(*) as count FROM fb_profiles`;
      const bountyApps = await db`SELECT COUNT(*) as count FROM fb_bounty_apps`;
      return res.status(200).json({
        connectedWallets: parseInt(wallets[0].count),
        profiles: parseInt(profiles[0].count),
        bountyApps: parseInt(bountyApps[0].count),
      });
    }

    // ============================================
    // SUBMIT BOUNTY APPLICATION
    // ============================================
    if (action === "submit-bounty-app" && req.method === "POST") {
      const { wallet, displayName, fairScore, form } = req.body;
      if (!wallet || !form) return res.status(400).json({ error: "wallet and form required" });

      await db`
        INSERT INTO fb_bounty_apps (wallet, display_name, fair_score, project_name, title, description, reward, currency, min_tier, deadline, category, contact_method, contact_value)
        VALUES (${wallet}, ${displayName || ""}, ${fairScore || 1}, ${form.projectName || ""}, ${form.title || ""}, ${form.description || ""}, ${form.reward || ""}, ${form.currency || "USDC"}, ${form.minTier || 1}, ${form.deadline || ""}, ${form.category || ""}, ${form.contactMethod || ""}, ${form.contactValue || ""})
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action: " + action });

  } catch (err) {
    console.error("DB API error:", err.message);
    return res.status(500).json({ error: "Database error", details: err.message });
  }
}
