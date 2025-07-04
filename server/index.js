require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const app     = express();

app.use(express.static(path.join(__dirname,'..','public')));
app.use(express.json());

// CMC
app.get('/api/cmc', async (req, res) => {
  try {
    const r = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=5&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }
    );
    const js = await r.json();
    res.json(js);
  } catch (e) {
    res.status(500).json({ error: 'CMC error' });
  }
});

// CryptoPanic: всегда новые новости
app.get('/api/news', async (req, res) => {
  try {
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=demo&public=true&currencies=BTC,ETH,TON,SOL,BNB`;
    const r = await fetch(url);
    const js = await r.json();
    const seen = new Set();
    const articles = [];
    for (let n of js.results) {
      if (!seen.has(n.title)) {
        articles.push({
          title: n.title,
          url: n.url,
          time: n.published_at ? new Date(n.published_at).toLocaleString() : '',
          source: n.domain || 'news'
        });
        seen.add(n.title);
        if (articles.length >= 7) break;
      }
    }
    res.json({articles});
  } catch {
    res.json({ articles: [] });
  }
});

// CoinGecko — всегда свежая цена (без кэша!)
app.get('/api/coingecko', async (req, res) => {
  try {
    const query = (req.query.q || '').trim().toLowerCase();
    if(!query) return res.json({found:false});
    const cg = await fetch('https://api.coingecko.com/api/v3/coins/list').then(r=>r.json());
    let coin = cg.find(c=>c.symbol.toLowerCase()===query) ||
               cg.find(c=>c.id.toLowerCase()===query) ||
               cg.find(c=>c.name.toLowerCase()===query);
    if(!coin) return res.json({found:false});
    // Нет кэша! Каждый раз свежая цена
    const market = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`).then(r=>r.json());
    res.json({
      found:true,
      name:coin.name,
      symbol:coin.symbol,
      price: market[coin.id]?.usd || '0',
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    });
  } catch {
    res.json({found:false});
  }
});

// TradingView
app.get('/api/tview', async (req, res) => {
  try {
    const symbol = (req.query.symbol||'BTC').toUpperCase();
    const url = `https://www.tradingview.com/symbols/${symbol}USD/technicals/`;
    const page = await fetch(url).then(r=>r.text());
    const support = page.match(/Support[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    const resistance = page.match(/Resistance[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    res.json({ support, resistance, url });
  } catch (e) {
    res.json({ support:null, resistance:null, url:null });
  }
});

// OpenAI
app.post('/api/openai', async (req, res) => {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const js = await r.json();
    res.json(js);
  } catch (e) {
    res.status(500).json({ error: 'OpenAI error' });
  }
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname,'..','public','index.html'));
});

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=>console.log(`Server listening on ${PORT}`));
