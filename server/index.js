require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const TIMEOUT = 7000;

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

// Крипто-новости (Cryptopanic, GNews, без дублей, только новые)
app.get('/api/news', async (req, res) => {
  try {
    // Cryptopanic
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true&currencies=BTC,ETH,TON,SOL,BNB`;
    const r = await fetchTimeout(url);
    const js = await r.json();

    let news = [];
    const seen = new Set();
    for (let n of (js.results || [])) {
      if (!seen.has(n.title)) {
        news.push({
          title: n.title,
          url: n.url,
          time: n.published_at ? new Date(n.published_at).toLocaleString() : '',
          source: n.domain || 'cryptopanic',
          impact: n.currencies && n.currencies.length ? n.currencies.join(', ') : ''
        });
        seen.add(n.title);
        if (news.length >= 6) break;
      }
    }

    // GNews (дополнение)
    const gnewsUrl = `https://gnews.io/api/v4/search?q=crypto&token=${process.env.GNEWS_API_KEY}&lang=en&max=6`;
    const gres = await fetchTimeout(gnewsUrl);
    const gjs = await gres.json();
    for (let a of (gjs.articles || [])) {
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

    // Оставить только уникальные и свежие (до 24ч)
    news = news.filter(a => {
      const date = new Date(a.time || 0);
      return Date.now() - date.getTime() < 32 * 3600 * 1000;
    }).slice(0, 9);

    res.json({ articles: news });
  } catch {
    res.json({ articles: [] });
  }
});

// Остальные эндпоинты — без изменений!
app.get('/api/gnews', async (req, res) => {
  try {
    const q = encodeURIComponent(req.query.q || 'crypto');
    const url = `https://gnews.io/api/v4/search?q=${q}&token=${process.env.GNEWS_API_KEY}&lang=en&max=5`;
    const r = await fetchTimeout(url);
    const js = await r.json();
    if (!js.articles) return res.json({ articles: [] });
    const articles = js.articles.map(a => ({
      title: a.title,
      url: a.url,
      time: a.publishedAt ? new Date(a.publishedAt).toLocaleString() : '',
      source: a.source?.name || 'gnews'
    }));
    res.json({ articles });
  } catch {
    res.json({ articles: [] });
  }
});

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
