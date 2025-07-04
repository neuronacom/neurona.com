require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const app     = express();

app.use(express.static(path.join(__dirname,'..','public')));
app.use(express.json());

app.get('/api/cmc', async (req, res) => {
  try {
    const r = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=5&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }
    );
    const js = await r.json();
    res.json(js);
  } catch (e) {
    console.error('CMC error', e);
    res.status(500).json({ error: 'CMC error' });
  }
});

// Новый endpoint: TradingView simple parser (support/resistance)
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
    console.error('OpenAI error', e);
    res.status(500).json({ error: 'OpenAI error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname,'..','public','index.html'));
});

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=>console.log(`Server listening on ${PORT}`));
