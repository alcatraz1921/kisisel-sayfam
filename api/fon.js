export default async function handler(req, res) {
  const { codes } = req.query;
  if (!codes) return res.status(400).json({ error: 'codes required' });

  const kodlar = codes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  const bugun = new Date();
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const gun3Once = new Date(bugun); gun3Once.setDate(gun3Once.getDate() - 3);

  const prices = {};

  await Promise.all(kodlar.map(async (kod) => {
    try {
      const response = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.tefas.gov.tr',
          'Referer': 'https://www.tefas.gov.tr/',
        },
        body: `fontip=YAT&fonkod=${kod}&bastarih=${fmt(gun3Once)}&bittarih=${fmt(bugun)}`,
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.data || data.data.length === 0) return;
      const latest = data.data.sort((a, b) => {
        const parse = (s) => { const [d,m,y] = s.split('.'); return new Date(y,m-1,d); };
        return parse(b.TARIH) - parse(a.TARIH);
      })[0];
      prices[kod] = parseFloat(latest.FIYAT);
    } catch (_) {}
  }));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.json(prices);
}
