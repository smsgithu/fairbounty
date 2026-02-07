# FairBounty

<p align="center">
  <img src="public/logo.png" alt="FairBounty Logo" width="120" />
</p>

<p align="center">
  <strong>Reputation-Gated Bounty Platform on Solana</strong><br/>
  Built on <a href="https://fairscale.xyz">FairScale</a> reputation infrastructure
</p>

<p align="center">
  <a href="https://fairbounty.vercel.app">Live Platform</a> ·
  <a href="https://x.com/FairBounty">Twitter/X</a> ·
  <a href="https://fairscale.xyz">FairScale</a> ·
  <a href="https://swagger.api.fairscale.xyz/">API Docs</a>
</p>

---

## The Problem

The Solana ecosystem is booming with bounties, grants, and freelance work — but there's no trust layer. Projects waste time and money on unvetted contributors. Developers get scammed by fake bounties. There's no way to prove you're legit without a personal network.

## The Solution

FairBounty uses FairScale's on-chain reputation scoring (**FairScore**) to gate every interaction. Your wallet history becomes your resume. Projects trust contributors because their reputation is transparent, verifiable, and can't be faked.

## How FairScore Powers Everything

FairScore isn't decorative — it's the engine. Every feature is gated, weighted, or enhanced by on-chain reputation.

| Feature | How FairScore is Used |
|---|---|
| **Tier-Gated Access** | Bounties require minimum FairScore tiers (1–5). Higher reputation = access to bigger, more valuable bounties. |
| **Weighted Voting** | Vote weight scales 1x–8x by tier. Tier 5 votes carry 8x the weight of Tier 1. Quality voices shape outcomes. |
| **Dynamic Rewards** | Tier-based bonus rewards on completed bounties — up to +25% bonus USDC for Tier 5 Legends. |
| **Risk Assessment** | Every wallet gets a risk score based on FairScore. Projects see trustworthiness at a glance. |
| **XP Multipliers** | Higher tiers earn XP 1x–3x faster, creating a reputation flywheel. |
| **Referral Gating** | Only Tier 2+ wallets can generate referral links, preventing bot-driven spam. |

### Tier Breakdown

| Tier | Label | Max Bounty | Vote Weight | XP Multiplier | Reward Bonus |
|---|---|---|---|---|---|
| 🌱 Tier 1 | Newcomer | $50 | 1x | 1.0x | +0% |
| 🔍 Tier 2 | Explorer | $250 | 2x | 1.25x | +5% |
| 🔨 Tier 3 | Builder | $1,000 | 3x | 1.5x | +10% |
| ⭐ Tier 4 | Veteran | $5,000 | 5x | 2.0x | +15% |
| 👑 Tier 5 | Legend | Unlimited | 8x | 3.0x | +25% |

## FairScale API Integration

FairBounty integrates with the FairScale REST API to fetch real-time on-chain reputation data.

**Endpoint:** `GET /api/v1/score/{walletAddress}`

**API Documentation:** [swagger.api.fairscale.xyz](https://swagger.api.fairscale.xyz/)

```javascript
// Production integration (src/FairBounty.jsx)
const response = await fetch(`https://api.fairscale.xyz/v1/score/${walletAddress}`, {
  headers: { 'Authorization': `Bearer ${FAIRSCALE_API_KEY}` }
});
const data = await response.json();
// Returns: { tier, score, history, walletAge, txCount, protocolsUsed, ... }
```

The FairScore data is used to:
1. Gate bounty access (tier requirement check)
2. Calculate vote weight for bounty prioritization
3. Determine XP multipliers for platform actions
4. Assess wallet risk level for project trust
5. Compute dynamic reward bonuses on payouts
6. Gate referral link generation (Tier 2+ only)

> **Note:** The demo currently uses simulated FairScore data. Swap the demo mode for production by uncommenting the API call in `src/FairBounty.jsx` and setting `FAIRSCALE_API_KEY`.

## Revenue Model

| Stream | Details |
|---|---|
| **Listing Fees** | 50 USDC per bounty posted — sustainable, predictable revenue |
| **Commission** | 5% cut of all completed bounty payouts |
| **Data Insights** | Anonymized reputation analytics for ecosystem partners (enterprise tier) |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | CSS-in-JS (inline styles, zero external CSS dependencies) |
| Auth | Solana wallet-based (Phantom, Solflare, Jupiter, Backpack, Glow) |
| Reputation | FairScale API (FairScore on-chain reputation scoring) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Database | PostgreSQL via Neon (planned for production persistence) |
| Backend | Node.js serverless functions (planned for bounty management) |

## Features

- **Multi-Wallet Support** — Phantom, Solflare, Jupiter, Backpack, Glow — each with a unique color theme that reskins the entire UI
- **Bounty Board** — Browse, filter by tier, view details, submit work
- **Post Bounties** — Projects can post bounties with tier requirements, tags, deadlines
- **Weighted Voting** — Upvote bounties with tier-scaled vote weight
- **XP & Gamification** — Earn XP for submissions, votes, and referrals with tier multipliers
- **Leaderboard** — Top contributors ranked by XP and bounties completed
- **Risk Assessment** — Every connected wallet shows a FairScore-based risk level
- **Referral System** — Tier-gated referral links with XP rewards
- **Responsive Design** — Full mobile and desktop support

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

```bash
# Clone the repository
git clone https://github.com/FairScale/fairbounty.git
cd fairbounty

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be running at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview  # Preview the production build locally
```

### Deployment (Vercel)

1. Push to GitHub
2. Import repository at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite and deploys — no configuration needed
4. (Optional) Add custom domain in Vercel → Settings → Domains

### Environment Variables (Production)

```env
VITE_FAIRSCALE_API_KEY=your_fairscale_api_key
```

## Project Structure

```
fairbounty/
├── index.html          # Entry HTML with OG meta tags
├── package.json        # Dependencies and scripts
├── vite.config.js      # Vite configuration
├── vercel.json         # Vercel deployment config
├── public/
│   └── logo.png        # FairBounty logo
└── src/
    ├── main.jsx        # React entry point
    └── FairBounty.jsx  # Main application component (all-in-one SPA)
```

## Growth Strategy

| Milestone | Strategy |
|---|---|
| **First 100 users** | Direct outreach to Solana dev communities on X, Discord, Telegram. Seed bounties from existing projects. |
| **First 1,000** | Referral program with XP rewards. Partner with Superteam, Solana Foundation, hackathon organizers. |
| **First 10,000** | Expand to multi-chain via FairScale cross-chain reputation. DAO governance-linked bounties. |
| **Ongoing** | Build-in-public content marketing, ecosystem partnerships, community-driven curation. |

## Competitive Advantage

No other bounty platform on Solana uses on-chain reputation as a core gating mechanism. Superteam Earn relies on manual vetting. Layer3 uses basic task completion. FairBounty automates trust via FairScore, reducing friction for both projects and contributors while creating a self-reinforcing reputation flywheel.

## Team

| Name | Role | Contact |
|---|---|---|
| Sean | Solo Developer & Founder | [X/Twitter](https://x.com/FairBounty) |

**Previous work:** Built and published [SMSai](https://smsai.fun) — a Solana-focused educational AI chatbot — to the Solana dApp Store. Experienced in React, Vite, Vercel, Solana wallet integration, and shipping Web3 products end-to-end.

## Links

- **Live Platform:** [fairbounty.vercel.app](https://fairbounty.vercel.app)
- **FairScale:** [fairscale.xyz](https://fairscale.xyz)
- **FairScale API:** [swagger.api.fairscale.xyz](https://swagger.api.fairscale.xyz/)
- **X/Twitter:** [@fairscalexyz](https://x.com/fairscalexyz)
- **Telegram:** [FairScale Community](https://t.me/+WQlko_c5blJhN2E0)

## License

MIT
