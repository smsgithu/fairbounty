# FairBounty

**Reputation-gated bounty platform for the Solana ecosystem, powered by FairScale.**

🌐 **Live:** https://fairbounty.vercel.app  
🐦 **Twitter:** [@smsonx](https://x.com/smsonx)  
🏗️ **Built by:** [@smsonx](https://x.com/smsonx) · [smsai.fun](https://smsai.fun) · A [Solana Made Simple](https://smsai.fun) product

---

## What is FairBounty?

FairBounty solves one of Web3's most persistent problems: **bounty extraction**. Bots, farmers, and low-quality contributors dilute opportunities for legitimate ecosystem contributors — driving away the clients who fund them.

FairBounty uses FairScale's on-chain reputation infrastructure (FairScore) as a trust layer. Every interaction — posting a bounty, submitting work, casting a vote — is gated, weighted, or enhanced by the contributor's real on-chain reputation. The result is a bounty platform where reputation is currency.

> Competing with Superteam Earn and Layer3, with a unique moat: **FairScore-native trust.**

---

## FairScale Integration (6 Deep Integrations)

FairScore isn't a badge here — it's the engine. Every core feature runs through it.

### 1. Tier-Gated Bounty Access
Bounties specify a minimum FairScore tier. Contributors below the threshold can't apply. No bots, no farmers — only wallets that have earned access.

| Tier | Label | Access |
|------|-------|--------|
| 1 | Newcomer | Entry-level bounties |
| 2 | Rising | Mid-range bounties + referral links |
| 3 | Established | Standard bounties |
| 4 | Veteran | High-value bounties |
| 5 | Legend | All bounties + maximum rewards |

### 2. FairScore-Weighted Community Voting
When the community votes on submissions, votes are weighted by tier. A Tier 5 Legend's vote carries 8× the weight of a Tier 1 Newcomer. Reputation determines influence.

| Tier | Vote Weight |
|------|-------------|
| 1 | 1× |
| 2 | 2× |
| 3 | 3× |
| 4 | 5× |
| 5 | 8× |

### 3. Dynamic Reward Bonuses
Winners receive bonus BXP on top of their prize based on their tier. Tier 5 Legends earn up to +25% bonus. Higher reputation = bigger rewards, creating a flywheel incentive to build reputation.

### 4. Risk Assessment Per Wallet
Every wallet connecting to FairBounty receives a real-time risk assessment powered by FairScore data. Low-reputation wallets are flagged. Clients can filter contributors by risk level before reviewing submissions.

### 5. BXP Multipliers
FairBounty's internal reputation currency (BXP) is earned faster at higher tiers:
- Tier 1: 1× · Tier 2: 1.25× · Tier 3: 1.5× · Tier 4: 2× · Tier 5: 3×

This creates a compounding incentive: higher FairScore → faster BXP accumulation → better platform standing → access to better bounties.

### 6. Referral Gating
Only Tier 2+ wallets can generate referral links. This prevents bot-driven referral spam and ensures the referral network is made up of real, established contributors.

---

## Technical Stack

```
Frontend:     React (Vite) — single-file component architecture
Backend:      Vercel Serverless Functions (Node.js)
Database:     Neon Postgres (cross-device persistence)
Blockchain:   Solana — wallet connection via @wallet-standard/app
Reputation:   FairScale API — real-time FairScore lookups (server-proxied)
Deployment:   Vercel (auto-deploy on GitHub push)
```

### Supported Wallets
Phantom · Solflare · Jupiter · Backpack · Glow · Seed Vault (Mobile Wallet Adapter for Solana Seeker)

### API Architecture
FairScore lookups are proxied through `/api/fairscore.js` — the API key never touches the client. All DB operations go through `/api/db.js`.

### Database Schema
```
fb_profiles     — contributor profiles (display name, bio, skills, socials)
fb_bxp          — BXP balances and breakdown per wallet
fb_referrals    — referral tracking (referrer → referred)
fb_referral_codes — custom referral slugs
fb_wallets      — connected wallet registry (global stats)
fb_bounty_apps  — client bounty intake forms
fb_bounties     — live bounty listings
fb_submissions  — contributor work submissions
fb_votes        — weighted community votes
fb_beta_access  — beta whitelist
```

---

## Live Features

- ✅ Real-time FairScore fetch on wallet connect
- ✅ 5-tier system mapped from FairScale tier names
- ✅ Live bounty posting (beta, founder-reviewed)
- ✅ Work submission workflow
- ✅ FairScore-weighted community voting
- ✅ Winner selection by bounty poster
- ✅ BXP reward system with tier multipliers
- ✅ Referral system with custom slugs
- ✅ Contributor profiles with on-chain stats
- ✅ Risk assessment display per wallet
- ✅ Beta access whitelist (admin panel)
- ✅ Cross-device persistence (Neon Postgres)
- ✅ Mobile-responsive + Solana Mobile support
- ✅ English / Spanish i18n

---

## Business Model

FairBounty's revenue model is built around the trust layer it provides:

**Near-term:**
- **Listing fee** — 50 USDC per bounty posted (covers review + platform costs)
- **Platform commission** — 5% of bounty prize on completion

**Medium-term:**
- **Enterprise data insights** — aggregated contributor reputation data for DAOs and protocols sourcing talent
- **Featured listings** — priority placement for high-value bounties

**Long-term:**
- Expand to full talent marketplace as FairScale reputation becomes the Solana-native trust standard
- Cross-chain expansion as FairScale grows

The moat is the reputation layer — other platforms can copy the bounty mechanics, but FairScale integration creates a defensible trust infrastructure that improves as the FairScale network grows.

---

## File Structure

```
fairbounty/
├── api/
│   ├── fairscore.js    — FairScale API proxy (API key server-side)
│   └── db.js           — Neon Postgres CRUD
├── public/
│   └── logo.png
├── src/
│   ├── FairBounty.jsx  — Full app (~3000 lines)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `FAIRSCALE_API_KEY` | FairScale API key for score lookups |
| `POSTGRES_URL` | Neon Postgres connection string |

---

## Roadmap

- [ ] Smart contract escrow (SOL/USDC locked on-chain at bounty creation)
- [ ] On-chain winner payout
- [ ] Leaderboard (top contributors by BXP + wins)
- [ ] Multi-prize support (memecoins, NFTs live in UI, escrow coming)
- [ ] DAO/protocol enterprise accounts
- [ ] Multi-chain expansion (as FairScale expands)

---

## About the Builder

Built by **[@smsonx](https://x.com/smsonx)** — founder of [Solana Made Simple](https://smsai.fun), active in the Solana ecosystem since 2021. Previously shipped [SMSai](https://smsai.fun) to the Solana dApp Store. FairBounty is the second product in the SMS ecosystem.

---

*FairBounty · A Solana Made Simple product · Built on FairScale*
