export default async function handler(req, res) {
  const { codes } = req.query;
  if (!codes) return res.status(400).json({ error: 'codes required' });

  const kodlar = codes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  const bugun = new Date();
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const gun3Once = new Date(bugun); gun3Once.setDate(gun3Once.getDate() - 3);

  const prices = {};

  const errors = {};

  await Promise.all(kodlar.map(async (kod) => {
    try {
      const body = `fontip=YAT&fonkod=${kod}&bastarih=${fmt(gun3Once)}&bittarih=${fmt(bugun)}`;
      const response = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.tefas.gov.tr',
          'Referer': 'https://www.tefas.gov.tr/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body,
      });
      if (!response.ok) { errors[kod] = `HTTP ${response.status}`; return; }
      const data = await response.json();
      if (!data.data || data.data.length === 0) { errors[kod] = 'no_data'; return; }
      const latest = data.data.sort((a, b) => {
        const parse = (s) => { const [d,m,y] = s.split('.'); return new Date(y,m-1,d); };
        return parse(b.TARIH) - parse(a.TARIH);
      })[0];
      prices[kod] = parseFloat(latest.FIYAT);
    } catch (e) { errors[kod] = e.message; }
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ prices, errors, tarihler: { baslangic: fmt(gun3Once), bitis: fmt(bugun) } });
}
