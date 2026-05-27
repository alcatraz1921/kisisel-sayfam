export default async function handler(req, res) {
  const { codes } = req.query;
  if (!codes) return res.status(400).json({ error: 'codes required' });

  const kodlar = codes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  // Tarih formatlayıcı: YYYYMMDD
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const g = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${g}`;
  };
  const now = new Date();
  const bitTarih = fmt(now);
  // 7 gün geriye git (hafta sonu/tatil günlerini kapsamak için)
  const basTarih = fmt(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

  const prices = {};
  const errors = {};

  // Yeni TEFAS sitesi AJAX API header'ları
  const HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
    'Referer': 'https://www.tefas.gov.tr/',
    'Origin': 'https://www.tefas.gov.tr',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Fon türleri: en yaygından başla
  const FUND_TYPES = ['YAT', 'BYF', 'EMK', 'GYF', 'GSYF'];

  await Promise.all(
    kodlar.map(async (kod) => {
      for (const fonTipi of FUND_TYPES) {
        try {
          const r = await fetch(
            'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir',
            {
              method: 'POST',
              headers: HEADERS,
              body: JSON.stringify({
                fonTipi,
                fonKodu: kod,
                basTarih,
                bitTarih,
                basSira: 1,
                bitSira: 10,
                dil: 'TR',
              }),
            }
          );

          if (!r.ok) continue; // bu türde bulunamadı, sonrakini dene

          const data = await r.json();
          const list = Array.isArray(data?.resultList) ? data.resultList : [];

          if (list.length === 0) continue;

          // En güncel tarihe göre sırala
          list.sort((a, b) =>
            String(b.tarih || '').localeCompare(String(a.tarih || ''))
          );

          const fiyat = list[0]?.fiyat;
          if (fiyat != null) {
            prices[kod] =
              typeof fiyat === 'string'
                ? parseFloat(fiyat.replace(',', '.'))
                : fiyat;
            return; // Fiyat bulundu, diğer türleri denemeye gerek yok
          }

          // fiyat alanı yoksa debug bilgisi ekle
          errors[kod] =
            'fiyat_alani_yok | anahtarlar: ' +
            Object.keys(list[0] || {}).join(', ');
          return;
        } catch (_) {
          // Bu tür için hata oluştu, sonrakini dene
        }
      }

      // Hiçbir türde bulunamadı
      if (prices[kod] == null && !errors[kod]) {
        errors[kod] = 'bulunamadi_tum_turler_denendi';
      }
    })
  );

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ prices, errors });
}
