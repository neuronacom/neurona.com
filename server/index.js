require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const app     = express();

app.use(express.static(path.join(__dirname,'..','public')));
app.use(express.json());

// CoinMarketCap — Топ-5
app.get('/api/cmc', async (req, res) => {
  try {
    const r = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=5&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }
    );
    const js = await r.json();
    res.json(js);
  } catch (e) {
    console.error('/api/cmc error:', e);
    res.status(500).json({ error: 'CMC error' });
  }
});

// CryptoPanic — только свежие новости
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
  } catch (e) {
    console.error('/api/news error:', e);
    res.json({ articles: [] });
  }
});

// GNews — резервный источник новостей
app.get('/api/gnews', async (req, res) => {
  try {
    const q = encodeURIComponent(req.query.q || 'crypto');
    const url = `https://gnews.io/api/v4/search?q=${q}&token=${process.env.GNEWS_API_KEY}&lang=en&max=5`;
    const r = await fetch(url);
    const js = await r.json();
    if (!js.articles) return res.json({ articles: [] });
    const articles = js.articles.map(a => ({
      title: a.title,
      url: a.url,
      time: a.publishedAt ? new Date(a.publishedAt).toLocaleString() : '',
      source: a.source?.name || 'gnews'
    }));
    res.json({ articles });
  } catch (e) {
    console.error('/api/gnews error:', e);
    res.json({ articles: [] });
  }
});

// CoinGecko — точная цена
app.get('/api/coingecko', async (req, res) => {
  try {
    const query = (req.query.q || '').trim().toLowerCase();
    if(!query) return res.json({found:false});
    let url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(query)}&order=market_cap_desc&per_page=1&page=1`;
    let cg = await fetch(url).then(r=>r.json());
    if(!cg.length){
      const coinList = await fetch('https://api.coingecko.com/api/v3/coins/list').then(r=>r.json());
      let coin = coinList.find(c=>c.symbol.toLowerCase()===query) ||
                 coinList.find(c=>c.id.toLowerCase()===query) ||
                 coinList.find(c=>c.name.toLowerCase()===query);
      if(!coin) return res.json({found:false});
      const cg2 = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin.id}&order=market_cap_desc&per_page=1&page=1`).then(r=>r.json());
      if(!cg2.length) return res.json({found:false});
      cg = cg2;
    }
    const coin = cg[0];
    res.json({
      found:true,
      name:coin.name,
      symbol:coin.symbol,
      price: coin.current_price,
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    });
  } catch (e) {
    console.error('/api/coingecko error:', e);
    res.json({found:false});
  }
});

// BINANCE — моментальная цена на тикер
app.get('/api/binance', async (req, res) => {
  try {
    let symbol = (req.query.q||'').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!symbol) return res.json({found:false});
    if (!symbol.endsWith('USDT')) symbol = symbol + 'USDT';
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const js = await r.json();
    if(js && js.price){
      res.json({found:true, symbol, price:js.price});
    } else {
      res.json({found:false});
    }
  } catch (e) {
    console.error('/api/binance error:', e);
    res.json({found:false});
  }
});

// TradingView — поддержка/сопротивление
app.get('/api/tview', async (req, res) => {
  try {
    const symbol = (req.query.symbol||'BTC').toUpperCase();
    const url = `https://www.tradingview.com/symbols/${symbol}USD/technicals/`;
    const page = await fetch(url).then(r=>r.text());
    const support = page.match(/Support[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    const resistance = page.match(/Resistance[\s\S]*?(\$[0-9,]+)/i)?.[1] || null;
    res.json({ support, resistance, url });
  } catch (e) {
    console.error('/api/tview error:', e);
    res.json({ support:null, resistance:null, url:null });
  }
});

// OpenAI — GPT-4o
app.post('/api/openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
    }
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const js = await r.json();
    if (js.error) {
      console.error('OpenAI error:', js.error);
      return res.status(500).json({ error: js.error.message || 'OpenAI error' });
    }
    res.json(js);
  } catch (e) {
    console.error('/api/openai error:', e);
    res.status(500).json({ error: 'OpenAI error' });
  }
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname,'..','public','index.html'));
});

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=>console.log(`Server listening on ${PORT}`));
