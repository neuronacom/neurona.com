require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const TIMEOUT = 9000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

async function fetchTimeout(url, options = {}, timeout = TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    ),
  ]);
}

// CoinMarketCap API (Топ-5)
app.get('/api/cmc', async (req, res) => {
  try {
    const r = await fetchTimeout(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=5&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }
    );
    const js = await r.json();
    res.json(js);
  } catch (e) {
    res.json({ data: [], error: 'CMC error' });
  }
});

// Крипто-новости: Cryptopanic + GNews, только свежие (24ч), без дублей, время и источник!
app.get('/api/news', async (req, res) => {
  try {
    const news = [];
    const seen = new Set();

    // Cryptopanic (до 6 уникальных)
    const cryptopanicUrl = `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true&currencies=BTC,ETH,TON,SOL,BNB`;
    const cr = await fetchTimeout(cryptopanicUrl);
    const cj = await cr.json();
    for (let n of (cj.results || [])) {
      let link = n.source && n.source.url ? n.source.url : n.url;
      if (!link) continue;
      if (!seen.has(n.title)) {
        news.push({
          title: n.title,
          url: link,
          time: n.published_at ? new Date(n.published_at).toLocaleString() : '',
          source: n.domain || (n.source && n.source.title) || 'cryptopanic',
          impact: n.currencies && n.currencies.length ? n.currencies.join(', ') : ''
        });
        seen.add(n.title);
        if (news.length >= 6) break;
      }
    }

    // GNews (до 6 уникальных)
    const gnewsUrl = `https://gnews.io/api/v4/search?q=crypto&token=${process.env.GNEWS_API_KEY}&lang=en&max=6`;
    const gr = await fetchTimeout(gnewsUrl);
    const gj = await gr.json();
    for (let a of (gj.articles || [])) {
      if (!a.title || !a.url) continue;
      if (!seen.has(a.title)) {
        news.push({
          title: a.title,
          url: a.url,
          time: a.publishedAt ? new Date(a.publishedAt).toLocaleString() : '',
          source: a.source?.name || 'gnews',
          impact: ''
        });
        seen.add(a.title);
        if (news.length >= 12) break;
      }
    }

    // Только свежие (24ч) и сортировка по времени
    const now = Date.now();
    const out = news.filter(a => {
      const t = new Date(a.time || 0).getTime();
      return now - t < 24 * 3600 * 1000;
    }).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 9);

    res.json({ articles: out });
  } catch (e) {
    res.json({ articles: [] });
  }
});

// CoinGecko — любая монета, свежая цена и ссылка
app.get('/api/coingecko', async (req, res) => {
  try {
    const query = (req.query.q || '').trim().toLowerCase();
    if (!query) return res.json({ found: false });
    const cg = await fetchTimeout('https://api.coingecko.com/api/v3/coins/list').then(r => r.json());
    let coin = cg.find(c => c.symbol.toLowerCase() === query) ||
      cg.find(c => c.id.toLowerCase() === query) ||
      cg.find(c => c.name.toLowerCase() === query);
    if (!coin) return res.json({ found: false });
    const market = await fetchTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`
    ).then(r => r.json());
    res.json({
      found: true,
      name: coin.name,
      symbol: coin.symbol,
      price: market[coin.id]?.usd || '0',
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    });
  } catch {
    res.json({ found: false });
  }
});

// Binance — актуальная цена пары
app.get('/api/binance', async (req, res) => {
  try {
    let symbol = (req.query.q || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!symbol) return res.json({ found: false });
    if (!symbol.endsWith('USDT')) symbol = symbol + 'USDT';
    const r = await fetchTimeout(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const js = await r.json();
    if (js && js.price) {
      res.json({ found: true, symbol, price: js.price });
    } else {
      res.json({ found: false });
    }
  } catch {
    res.json({ found: false });
  }
});

// TradingView support/resistance
app.get('/api/tview', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'BTC').toUpperCase();
    const url = `https://www.tradingview.com/symbols/${symbol}USD/technicals/`;
    const page = await fetchTimeout(url).then(r => r.text());
    const support = page.match(/Support[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    const resistance = page.match(/Resistance[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    res.json({ support, resistance, url });
  } catch (e) {
    res.json({ support: null, resistance: null, url: null });
  }
});

// OpenAI (GPT-4o, gpt-4, gpt-3.5-turbo) — безопасно!
app.post('/api/openai', async (req, res) => {
  try {
    const r = await fetchTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    }, 30000);
    const js = await r.json();
    if(js.error && js.error.message){
      return res.status(500).json({ error: js.error.message });
    }
    res.json(js);
  } catch (e) {
    res.status(500).json({ error: 'OpenAI error' });
  }
});

// PWA: index.html fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
