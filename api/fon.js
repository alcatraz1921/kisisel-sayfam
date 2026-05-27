export default async function handler(req, res) {
  const { codes } = req.query;
  if (!codes) return res.status(400).json({ error: 'codes required' });

  const kodlar = codes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  const bugun = new Date();
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const gun3Once = new Date(bugun); gun3Once.setDate(gun3Once.getDate() - 3);

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // TEFAS session cookie al
  let cookies = '';
  try {
    const s = await fetch('https://www.tefas.gov.tr/TarihselVeriler.aspx', { headers: { 'User-Agent': UA } });
    const raw = s.headers.get('set-cookie') || '';
    cookies = raw.split(/,(?=[^ ])/).map(c => c.split(';')[0]).join('; ');
  } catch (_) {}

  const prices = {};
  const errors = {};

  await Promise.all(kodlar.map(async (kod) => {
    try {
      const body = `fontip=YAT&fonkod=${kod}&bastarih=${fmt(gun3Once)}&bittarih=${fmt(bugun)}`;
      const r = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://www.tefas.gov.tr',
          'Referer': 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
          'User-Agent': UA,
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookies ? { Cookie: cookies } : {}),
        },
        body,
      });
      if (!r.ok) { errors[kod] = `HTTP ${r.status}`; return; }
      const data = await r.json();
      if (!data.data || data.data.length === 0) { errors[kod] = 'no_data'; return; }
      const latest = data.data.sort((a, b) => {
        const p = (s) => { const [d,m,y] = s.split('.'); return new Date(y, m-1, d); };
        return p(b.TARIH) - p(a.TARIH);
      })[0];
      prices[kod] = parseFloat(latest.FIYAT);
    } catch (e) { errors[kod] = e.message; }
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ prices, errors });
}
