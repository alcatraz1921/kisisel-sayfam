module.exports = async function handler(req, res) {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids required' });

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=try,usd&include_24hr_change=true`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!r.ok) return res.status(r.status).json({ error: `CoinGecko HTTP ${r.status}` });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
