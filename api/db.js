// FairBounty DB API — Neon Postgres
// Handles all CRUD: profiles, BXP, referrals, bounties, submissions, votes, winners

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;

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
      const { wallet, amount } = req.body;
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
      return res.json({ success: true });
    }

    if (action === "process-referral") {
      const { referrerWallet, referredWallet, referrerAmount, referredAmount } = req.body;
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
      const rows = await sql`SELECT code FROM fb_referral_codes WHERE wallet = ${wallet} LIMIT 1`;
      return res.json({ code: rows[0]?.code || null });
    }

    if (action === "resolve-referral") {
      const { code } = req.query;
      // Check referral codes table first
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
          ${bountyData.title}, ${bountyData.description}, ${bountyData.projectName},
          ${bountyData.category || ""}, ${bountyData.prizeType || "USDC"}, ${bountyData.reward},
          ${bountyData.currency || "USDC"}, ${bountyData.memeToken || ""},
          ${bountyData.nftMint || ""}, ${bountyData.nftName || ""},
          ${bountyData.minTier || 1}, ${JSON.stringify(bountyData.tags || [])},
          ${bountyData.deadline || ""}, ${bountyData.poster}, ${bountyData.posterName},
          ${bountyData.posterTier || 1}, 'open', ${bountyData.contactMethod || ""},
          ${bountyData.contactValue || ""}, ${bountyData.submissionRequirements || ""},
          ${bountyData.evaluationCriteria || ""}, true, NOW()
        ) RETURNING id
      `;
      return res.json({ success: true, id: result[0]?.id });
    }

    if (action === "get-bounties") {
      try {
        const rows = await sql`
          SELECT *, project_name as "projectName", prize_type as "prizeType",
            poster_name as "posterName", poster_tier as "posterTier",
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
        VALUES (${String(bountyId)}, ${wallet}, ${displayName}, ${tier || 1}, ${content}, ${links || ""}, NOW())
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

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error("DB API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
