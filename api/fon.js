export default async function handler(req, res) {
  const { codes } = req.query;
  if (!codes) return res.status(400).json({ error: 'codes required' });

  const kodlar = codes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const prices = {};
  const errors = {};

  await Promise.all(kodlar.map(async (kod) => {
    try {
      const r = await fetch(`https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${kod}`, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'tr-TR,tr;q=0.9',
        },
      });
      if (!r.ok) { errors[kod] = `HTTP ${r.status}`; return; }
      const html = await r.text();

      // Birim pay değeri (NAV) çıkar
      const patterns = [
        /class="[^"]*price[^"]*"[^>]*>\s*([\d]+[,.][\d]+)/i,
        /BirimPayDegeri[^>]*>\s*([\d]+[,.][\d]+)/i,
        /pay de[gğ]eri[^<]{0,80}([\d]+[,.][\d]{2,6})/i,
        /"fiyat"[^:]*:\s*"?([\d]+[,.][\d]+)"?/i,
        /\b(\d+,\d{6})\b/,
      ];

      let found = false;
      for (const p of patterns) {
        const m = html.match(p);
        if (m) {
          prices[kod] = parseFloat(m[1].replace(',', '.'));
          found = true;
          break;
        }
      }

      if (!found) {
        // debug: ilk 2000 char döndür
        errors[kod] = 'not_found | html_preview: ' + html.slice(0, 2000).replace(/\s+/g, ' ');
      }
    } catch (e) { errors[kod] = e.message; }
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ prices, errors });
}
