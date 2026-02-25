// FairBounty DB API — Neon Postgres
// Handles all CRUD: profiles, BXP, referrals, bounties, submissions, votes, winners

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL);

const ALLOWED_ORIGIN = "https://fairbounty.vercel.app";
const MAX_TEXT = 5000;
const MAX_SHORT = 200;
const sanitize = (str, max = MAX_SHORT) => str ? String(str).slice(0, max).trim() : "";

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [ALLOWED_ORIGIN, "http://localhost:5173", "http://localhost:3000"];
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;
  const FOUNDER_WALLET = "VNJ1Jm1Nbm3sRTjD21uxv44couFoQHWVDCntJSv9QCD";

  try {
    // ============================================================
    // EXISTING ENDPOINTS (unchanged)
    // ============================================================

    if (action === "get-profile") {
      const { wallet } = req.query;
      const rows = await sql`SELECT profile FROM fb_profiles WHERE wallet = ${wallet} LIMIT 1`;
      if (rows.length === 0) return res.json({ profile: null });
      return res.json({ profile: rows[0].profile });
    }

    if (action === "save-profile") {
      const { wallet, profile } = req.body;
      await sql`
        INSERT INTO fb_profiles (wallet, profile, updated_at)
        VALUES (${wallet}, ${JSON.stringify(profile)}, NOW())
        ON CONFLICT (wallet) DO UPDATE
        SET profile = ${JSON.stringify(profile)}, updated_at = NOW()
      `;
      return res.json({ success: true });
    }

    if (action === "get-bxp") {
      const { wallet } = req.query;
      const rows = await sql`SELECT bxp FROM fb_bxp WHERE wallet = ${wallet} LIMIT 1`;
      if (rows.length === 0) return res.json({ bxp: null });
      return res.json({ bxp: rows[0].bxp });
    }

    if (action === "claim-welcome") {
      const { wallet, tier } = req.body;
      if (!wallet) return res.status(400).json({ error: "Missing wallet" });
      const multipliers = { 1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0, 5: 3.0 };
      const amount = Math.floor(100 * (multipliers[tier] || 1.0));
      const existing = await sql`SELECT id FROM fb_bxp WHERE wallet = ${wallet} LIMIT 1`;
      if (existing.length > 0) {
        const current = await sql`SELECT bxp FROM fb_bxp WHERE wallet = ${wallet} LIMIT 1`;
        const bxp = current[0].bxp || {};
        if (bxp.welcome) return res.json({ already_claimed: true });
        bxp.welcome = amount;
        await sql`UPDATE fb_bxp SET bxp = ${JSON.stringify(bxp)}, updated_at = NOW() WHERE wallet = ${wallet}`;
      } else {
        const bxp = { welcome: amount, referrals: 0, referred: 0, submissions: 0, wins: 0 };
        await sql`INSERT INTO fb_bxp (wallet, bxp, updated_at) VALUES (${wallet}, ${JSON.stringify(bxp)}, NOW())`;
      }
      return res.json({ success: true, amount });
    }

    if (action === "process-referral") {
      const { referrerWallet, referredWallet, referredTier, referrerTier } = req.body;
      if (!referrerWallet || !referredWallet) return res.status(400).json({ error: "Missing wallets" });
      if (referrerWallet === referredWallet) return res.status(400).json({ error: "Self-referral" });
      const multipliers = { 1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0, 5: 3.0 };
      const referrerAmount = Math.floor(50 * (multipliers[referrerTier] || 1.0));
      const referredAmount = Math.floor(50 * (multipliers[referredTier] || 1.0));
      // Update referrer BXP
      const referrerRows = await sql`SELECT bxp FROM fb_bxp WHERE wallet = ${referrerWallet} LIMIT 1`;
      if (referrerRows.length > 0) {
        const bxp = referrerRows[0].bxp || {};
        bxp.referrals = (bxp.referrals || 0) + referrerAmount;
        await sql`UPDATE fb_bxp SET bxp = ${JSON.stringify(bxp)}, updated_at = NOW() WHERE wallet = ${referrerWallet}`;
      } else {
        const bxp = { welcome: 0, referrals: referrerAmount, referred: 0, submissions: 0, wins: 0 };
        await sql`INSERT INTO fb_bxp (wallet, bxp, updated_at) VALUES (${referrerWallet}, ${JSON.stringify(bxp)}, NOW())`;
      }
      // Track referral in fb_referrals
      await sql`
        INSERT INTO fb_referrals (referrer_wallet, referred_wallet, created_at)
        VALUES (${referrerWallet}, ${referredWallet}, NOW())
        ON CONFLICT DO NOTHING
      `;
      return res.json({ success: true });
    }

    if (action === "get-referrals") {
      const { wallet } = req.query;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_referrals (
          id SERIAL PRIMARY KEY,
          referrer_wallet TEXT NOT NULL,
          referred_wallet TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(referrer_wallet, referred_wallet)
        )
      `;
      const rows = await sql`
        SELECT r.referred_wallet, r.created_at, p.display_name
        FROM fb_referrals r
        LEFT JOIN fb_profiles p ON p.wallet = r.referred_wallet
        WHERE r.referrer_wallet = ${wallet}
        ORDER BY r.created_at DESC
      `;
      return res.json({ count: rows.length, referrals: rows });
    }

    if (action === "track-wallet") {
      const { wallet } = req.body;
      await sql`
        INSERT INTO fb_wallets (wallet, first_seen, last_seen)
        VALUES (${wallet}, NOW(), NOW())
        ON CONFLICT (wallet) DO UPDATE SET last_seen = NOW()
      `;
      return res.json({ success: true });
    }

    if (action === "get-stats") {
      const [wallets, profiles, apps, liveBounties] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM fb_wallets`,
        sql`SELECT COUNT(*) as count FROM fb_profiles`,
        sql`SELECT COUNT(*) as count FROM fb_bounty_apps`,
        sql`SELECT COUNT(*) as count FROM fb_bounties WHERE status = 'open'`.catch(() => [{ count: 0 }]),
      ]);
      return res.json({
        connectedWallets: parseInt(wallets[0].count) || 0,
        profiles: parseInt(profiles[0].count) || 0,
        bountyApps: parseInt(apps[0].count) || 0,
        liveBounties: parseInt(liveBounties[0].count) || 0,
      });
    }

    if (action === "submit-bounty-app") {
      const { wallet, displayName, fairScore, form } = req.body;
      await sql`
        INSERT INTO fb_bounty_apps (wallet, display_name, fair_score, form_data, created_at)
        VALUES (${wallet}, ${displayName}, ${fairScore}, ${JSON.stringify(form)}, NOW())
      `;
      return res.json({ success: true });
    }

    if (action === "set-referral-code") {
      const { wallet, code } = req.body;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_referral_codes (
          wallet TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      // Also ensure fb_referrals exists
      await sql`
        CREATE TABLE IF NOT EXISTS fb_referrals (
          id SERIAL PRIMARY KEY,
          referrer_wallet TEXT NOT NULL,
          referred_wallet TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(referrer_wallet, referred_wallet)
        )
      `;
      // Check if code already taken by another wallet
      const existing = await sql`SELECT wallet FROM fb_referral_codes WHERE code = ${code} AND wallet != ${wallet} LIMIT 1`;
      let finalCode = code;
      if (existing.length > 0) {
        // Append random digits
        finalCode = code + Math.floor(100 + Math.random() * 900);
      }
      await sql`
        INSERT INTO fb_referral_codes (wallet, code, created_at)
        VALUES (${wallet}, ${finalCode}, NOW())
        ON CONFLICT (wallet) DO UPDATE SET code = ${finalCode}, updated_at = NOW()
      `;
      return res.json({ code: finalCode });
    }

    if (action === "get-referral-code") {
      const { wallet } = req.query;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_referral_codes (
          wallet TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      const rows = await sql`SELECT code FROM fb_referral_codes WHERE wallet = ${wallet} LIMIT 1`;
      return res.json({ code: rows[0]?.code || null });
    }

    if (action === "resolve-referral") {
      const { code } = req.query;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_referral_codes (
          wallet TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      const codeRows = await sql`SELECT wallet FROM fb_referral_codes WHERE code = ${code} LIMIT 1`;
      if (codeRows.length > 0) return res.json({ wallet: codeRows[0].wallet });
      // Fallback: check if it's a wallet address directly in profiles
      const profileRows = await sql`SELECT wallet FROM fb_profiles WHERE wallet = ${code} LIMIT 1`;
      if (profileRows.length > 0) return res.json({ wallet: profileRows[0].wallet });
      return res.json({ wallet: null });
    }

    // ============================================================
    // NEW: BETA ACCESS CHECK
    // ============================================================
    if (action === "check-beta") {
      const { wallet } = req.query;
      try {
        const rows = await sql`SELECT wallet FROM fb_beta_access WHERE wallet = ${wallet} AND active = true LIMIT 1`;
        return res.json({ hasAccess: rows.length > 0 });
      } catch (e) {
        // Table might not exist yet — return false
        return res.json({ hasAccess: false });
      }
    }

    // ============================================================
    // NEW: LIVE BOUNTIES
    // ============================================================
    if (action === "create-bounty") {
      const bountyData = req.body;
      // Ensure table exists
      await sql`
        CREATE TABLE IF NOT EXISTS fb_bounties (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          project_name TEXT,
          category TEXT,
          prize_type TEXT DEFAULT 'USDC',
          reward TEXT,
          currency TEXT DEFAULT 'USDC',
          meme_token TEXT,
          nft_mint TEXT,
          nft_name TEXT,
          min_tier INTEGER DEFAULT 1,
          tags JSONB DEFAULT '[]',
          deadline TEXT,
          poster TEXT,
          poster_name TEXT,
          poster_tier INTEGER,
          status TEXT DEFAULT 'open',
          contact_method TEXT,
          contact_value TEXT,
          submission_requirements TEXT,
          evaluation_criteria TEXT,
          submission_count INTEGER DEFAULT 0,
          winner_submission_id INTEGER,
          is_beta BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      const result = await sql`
        INSERT INTO fb_bounties (
          title, description, project_name, category, prize_type, reward, currency,
          meme_token, nft_mint, nft_name, min_tier, tags, deadline, poster, poster_name,
          poster_tier, status, contact_method, contact_value, submission_requirements,
          evaluation_criteria, is_beta, created_at
        ) VALUES (
          ${sanitize(bountyData.title, 120)}, ${sanitize(bountyData.description, MAX_TEXT)}, ${sanitize(bountyData.projectName, 80)},
          ${sanitize(bountyData.category, 50)}, ${sanitize(bountyData.prizeType, 20) || "USDC"}, ${sanitize(bountyData.reward, 30)},
          ${sanitize(bountyData.currency, 20) || "USDC"}, ${sanitize(bountyData.memeToken, 50)},
          ${sanitize(bountyData.nftMint, 100)}, ${sanitize(bountyData.nftName, 80)},
          ${Math.min(Math.max(parseInt(bountyData.minTier) || 1, 1), 5)}, ${JSON.stringify((bountyData.tags || []).slice(0, 10).map(t => sanitize(t, 30)))},
          ${sanitize(bountyData.deadline, 20)}, ${sanitize(bountyData.poster, 50)}, ${sanitize(bountyData.posterName, 80)},
          ${Math.min(Math.max(parseInt(bountyData.posterTier) || 1, 1), 5)}, ${bountyData.status === "open" ? "open" : "pending"}, ${sanitize(bountyData.contactMethod, 20)},
          ${sanitize(bountyData.contactValue, 100)}, ${sanitize(bountyData.submissionRequirements, MAX_TEXT)},
          ${sanitize(bountyData.evaluationCriteria, MAX_TEXT)}, true, NOW()
        ) RETURNING id
      `;
      return res.json({ success: true, id: result[0]?.id });
    }

    if (action === "get-bounties") {
      try {
        const rows = await sql`
          SELECT *, project_name as "projectName", prize_type as "prizeType",
            poster_name as "posterName", poster_tier as "posterTier",
            min_tier as "minTier",
            submission_count as "submissionCount",
            winner_submission_id as "winnerSubmissionId",
            contact_method as "contactMethod", contact_value as "contactValue",
            submission_requirements as "submissionRequirements",
            evaluation_criteria as "evaluationCriteria",
            is_beta as "isBeta", created_at as "createdAt"
          FROM fb_bounties
          WHERE status = 'open'
          ORDER BY created_at DESC
          LIMIT 100
        `;
        return res.json(rows);
      } catch (e) {
        return res.json([]);
      }
    }

    // ============================================================
    // NEW: SUBMISSIONS
    // ============================================================
    if (action === "submit-work") {
      const { bountyId, wallet, displayName, tier, content, links } = req.body;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_submissions (
          id SERIAL PRIMARY KEY,
          bounty_id TEXT NOT NULL,
          wallet TEXT NOT NULL,
          display_name TEXT,
          tier INTEGER DEFAULT 1,
          content TEXT NOT NULL,
          links TEXT,
          score INTEGER DEFAULT 0,
          upvotes INTEGER DEFAULT 0,
          downvotes INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      // Check if already submitted
      const existing = await sql`
        SELECT id FROM fb_submissions WHERE bounty_id = ${String(bountyId)} AND wallet = ${wallet} LIMIT 1
      `;
      if (existing.length > 0) return res.json({ success: false, error: "Already submitted" });

      const result = await sql`
        INSERT INTO fb_submissions (bounty_id, wallet, display_name, tier, content, links, created_at)
        VALUES (${String(bountyId).slice(0,20)}, ${sanitize(wallet,50)}, ${sanitize(displayName,80)}, ${Math.min(Math.max(parseInt(tier)||1,1),5)}, ${sanitize(content,MAX_TEXT)}, ${sanitize(links||"",500)}, NOW())
        RETURNING id
      `;
      // Update submission count
      await sql`UPDATE fb_bounties SET submission_count = submission_count + 1 WHERE id = ${parseInt(bountyId)}`.catch(() => {});
      return res.json({ success: true, id: result[0]?.id });
    }

    if (action === "get-submissions") {
      const { bountyId } = req.query;
      try {
        const rows = await sql`
          SELECT *, display_name as "displayName", bounty_id as "bountyId", created_at as "createdAt"
          FROM fb_submissions
          WHERE bounty_id = ${String(bountyId)} AND status = 'active'
          ORDER BY score DESC, created_at ASC
        `;
        return res.json(rows);
      } catch (e) {
        return res.json([]);
      }
    }

    // ============================================================
    // NEW: VOTING
    // ============================================================
    if (action === "vote") {
      const { submissionId, voterWallet, voteType, voteWeight } = req.body;
      await sql`
        CREATE TABLE IF NOT EXISTS fb_votes (
          id SERIAL PRIMARY KEY,
          submission_id INTEGER NOT NULL,
          voter_wallet TEXT NOT NULL,
          vote_type TEXT NOT NULL,
          vote_weight INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(submission_id, voter_wallet)
        )
      `;
      // Check if already voted
      const existing = await sql`
        SELECT id FROM fb_votes WHERE submission_id = ${submissionId} AND voter_wallet = ${voterWallet} LIMIT 1
      `;
      if (existing.length > 0) return res.json({ success: false, alreadyVoted: true });

      // Record vote
      await sql`
        INSERT INTO fb_votes (submission_id, voter_wallet, vote_type, vote_weight, created_at)
        VALUES (${submissionId}, ${voterWallet}, ${voteType}, ${voteWeight || 1}, NOW())
      `;

      // Update submission score
      const scoreDelta = voteType === "up" ? (voteWeight || 1) : -(voteWeight || 1);
      if (voteType === "up") {
        await sql`UPDATE fb_submissions SET score = score + ${voteWeight || 1}, upvotes = upvotes + 1 WHERE id = ${submissionId}`;
      } else {
        await sql`UPDATE fb_submissions SET score = score - ${voteWeight || 1}, downvotes = downvotes + 1 WHERE id = ${submissionId}`;
      }
      return res.json({ success: true });
    }

    // ============================================================
    // NEW: SELECT WINNER
    // ============================================================
    if (action === "select-winner") {
      const { bountyId, submissionId, posterWallet } = req.body;
      // Verify caller is the bounty poster
      const bountyRows = await sql`SELECT poster FROM fb_bounties WHERE id = ${parseInt(bountyId)} LIMIT 1`;
      if (bountyRows.length === 0) return res.json({ success: false, error: "Bounty not found" });
      if (bountyRows[0].poster !== posterWallet) return res.json({ success: false, error: "Not authorized" });

      // Mark winner
      await sql`
        UPDATE fb_bounties
        SET winner_submission_id = ${submissionId}, status = 'completed', updated_at = NOW()
        WHERE id = ${parseInt(bountyId)}
      `;
      await sql`
        UPDATE fb_submissions SET status = 'winner' WHERE id = ${submissionId}
      `;

      // Add winner BXP (100 BXP × tier)
      const winnerRows = await sql`SELECT wallet, tier FROM fb_submissions WHERE id = ${submissionId} LIMIT 1`;
      if (winnerRows.length > 0) {
        const { wallet: winnerWallet, tier } = winnerRows[0];
        const multipliers = { 1: 1.0, 2: 1.25, 3: 1.5, 4: 2.0, 5: 3.0 };
        const multiplier = multipliers[tier] || 1.0;
        const winBxp = Math.floor(100 * multiplier);
        const winnerBxpRows = await sql`SELECT bxp FROM fb_bxp WHERE wallet = ${winnerWallet} LIMIT 1`;
        if (winnerBxpRows.length > 0) {
          const bxp = winnerBxpRows[0].bxp || {};
          bxp.wins = (bxp.wins || 0) + winBxp;
          await sql`UPDATE fb_bxp SET bxp = ${JSON.stringify(bxp)}, updated_at = NOW() WHERE wallet = ${winnerWallet}`;
        }
      }

      return res.json({ success: true });
    }

    if (action === "admin-get-beta") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      await sql`CREATE TABLE IF NOT EXISTS fb_beta_access (
        wallet TEXT PRIMARY KEY, active BOOLEAN DEFAULT true,
        added_by TEXT, added_at TIMESTAMPTZ DEFAULT NOW(), note TEXT
      )`;
      const rows = await sql`SELECT * FROM fb_beta_access ORDER BY added_at DESC`;
      return res.json({ rows });
    }

    if (action === "admin-add-beta") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      const { targetWallet, note } = req.body;
      await sql`CREATE TABLE IF NOT EXISTS fb_beta_access (
        wallet TEXT PRIMARY KEY, active BOOLEAN DEFAULT true,
        added_by TEXT, added_at TIMESTAMPTZ DEFAULT NOW(), note TEXT
      )`;
      await sql`
        INSERT INTO fb_beta_access (wallet, active, added_by, note)
        VALUES (${targetWallet}, true, ${wallet}, ${note || ""})
        ON CONFLICT (wallet) DO UPDATE SET active = true, note = ${note || ""}
      `;
      return res.json({ success: true });
    }

    if (action === "admin-remove-beta") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      const { targetWallet } = req.body;
      await sql`UPDATE fb_beta_access SET active = false WHERE wallet = ${targetWallet}`;
      return res.json({ success: true });
    }

    if (action === "admin-get-all") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });

      // Ensure tables exist
      await sql`CREATE TABLE IF NOT EXISTS fb_bounties (
        id SERIAL PRIMARY KEY, title TEXT, description TEXT, project_name TEXT,
        category TEXT, prize_type TEXT DEFAULT 'USDC', reward TEXT, currency TEXT DEFAULT 'USDC',
        meme_token TEXT, nft_mint TEXT, nft_name TEXT, min_tier INTEGER DEFAULT 1,
        tags JSONB DEFAULT '[]', deadline TEXT, poster TEXT, poster_name TEXT, poster_tier INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending', contact_method TEXT, contact_value TEXT,
        submission_requirements TEXT, evaluation_criteria TEXT,
        submission_count INTEGER DEFAULT 0, winner_submission_id INTEGER,
        is_beta BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS fb_bounty_apps (
        id SERIAL PRIMARY KEY, wallet TEXT, display_name TEXT, fair_score INTEGER,
        form_data JSONB, created_at TIMESTAMPTZ DEFAULT NOW(), status TEXT DEFAULT 'pending'
      )`;

      const [bounties, apps, profiles, bxpRows] = await Promise.all([
        sql`SELECT *, project_name as "projectName", prize_type as "prizeType", poster_name as "posterName", min_tier as "minTier", contact_method as "contactMethod", contact_value as "contactValue", is_beta as "isBeta", created_at as "createdAt" FROM fb_bounties ORDER BY created_at DESC`,
        sql`SELECT * FROM fb_bounty_apps ORDER BY created_at DESC`,
        sql`SELECT wallet, profile, updated_at FROM fb_profiles ORDER BY updated_at DESC LIMIT 50`,
        sql`SELECT wallet, bxp FROM fb_bxp`,
      ]);

      return res.json({ bounties, apps, profiles, bxpRows });
    }

    if (action === "admin-update-bounty") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      const { id, status } = req.body;
      await sql`UPDATE fb_bounties SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
      return res.json({ success: true });
    }

    if (action === "admin-delete-bounty") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      const { id } = req.body;
      await sql`DELETE FROM fb_bounties WHERE id = ${id}`;
      return res.json({ success: true });
    }

    if (action === "admin-update-app") {
      const { wallet } = req.query;
      if (wallet !== FOUNDER_WALLET) return res.status(403).json({ error: "Unauthorized" });
      const { id, status } = req.body;
      await sql`UPDATE fb_bounty_apps SET status = ${status} WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error("DB API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
