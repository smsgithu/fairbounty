export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: "wallet parameter required" });
  }

  if (wallet.length < 32 || wallet.length > 44) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  try {
    const response = await fetch(
      `https://api2.fairscale.xyz/score?wallet=${encodeURIComponent(wallet)}`,
      {
        headers: {
          "fairkey": process.env.FAIRSCALE_API_KEY,
        },
      }
    );

    if (response.status === 404) {
      return res.status(200).json({
        wallet,
        fairscore: 0,
        fairscore_base: 0,
        social_score: 0,
        tier: "unranked",
        badges: [],
        actions: [],
        features: {},
        _fallback: true,
      });
    }

    if (!response.ok) {
      return res.status(502).json({ error: "FairScale API error", status: response.status });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
