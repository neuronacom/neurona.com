require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Firebase Admin SDK for push notifications
const admin = require('firebase-admin');

// Initialize Firebase Admin (in production, use service account key)
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'neurona-push'
    });
  } else {
    console.log('Firebase service account not configured - push notifications disabled');
  }
} catch (error) {
  console.log('Firebase initialization error:', error);
}

// Store FCM tokens (in production, use database)
const fcmTokens = new Set();

// Cache for notification throttling
let lastNewsNotification = 0;
let lastPriceNotification = 0;
const NOTIFICATION_THROTTLE = 30 * 60 * 1000; // 30 minutes

const TIMEOUT = 12000;

// Для Cointelegraph/Coindesk RSS
const Parser = require('rss-parser');
const parser = new Parser();

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

async function getAllCryptoNews() {
  let news = [];
  const seen = new Set();

  // 1. Cryptopanic
  try {
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true&currencies=BTC,ETH,TON,SOL,BNB`;
    const res = await fetchTimeout(url);
    const js = await res.json();
    (js.results || []).forEach(n => {
      const key = (n.title || '') + (n.url || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: n.title,
          url: n.source && n.source.url ? n.source.url : n.url,
          time: n.published_at,
          source: n.domain || (n.source && n.source.title) || 'cryptopanic',
          impact: n.currencies && n.currencies.length ? n.currencies.join(', ') : ''
        });
      }
    });
  } catch {}

  // 2. GNews
  try {
    const url = `https://gnews.io/api/v4/search?q=crypto&token=${process.env.GNEWS_API_KEY}&lang=en&max=7`;
    const res = await fetchTimeout(url);
    const js = await res.json();
    (js.articles || []).forEach(a => {
      const key = (a.title || '') + (a.url || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: a.title,
          url: a.url,
          time: a.publishedAt,
          source: a.source?.name || 'gnews',
          impact: ''
        });
      }
    });
  } catch {}

  // 3. CryptoCompare News (EN)
  try {
    const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN';
    const res = await fetchTimeout(url);
    const js = await res.json();
    (js.Data || []).forEach(a => {
      const key = (a.title || '') + (a.url || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: a.title,
          url: a.url,
          time: a.published_on ? new Date(a.published_on * 1000).toISOString() : '',
          source: a.source || 'CryptoCompare',
          impact: a.categories || ''
        });
      }
    });
  } catch {}

  // 4. Cointelegraph RSS
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    (feed.items || []).forEach(a => {
      const key = (a.title || '') + (a.link || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: a.title,
          url: a.link,
          time: a.pubDate,
          source: 'Cointelegraph',
          impact: ''
        });
      }
    });
  } catch {}

  // 5. CoinDesk RSS
  try {
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    (feed.items || []).forEach(a => {
      const key = (a.title || '') + (a.link || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: a.title,
          url: a.link,
          time: a.pubDate,
          source: 'CoinDesk',
          impact: ''
        });
      }
    });
  } catch {}

  // 6. Investing.com (через Cryptopanic)
  try {
    const url = 'https://cryptopanic.com/api/v1/posts/?auth_token=' + process.env.CRYPTOPANIC_API_KEY + '&public=true&currencies=BTC,ETH,TON,SOL,BNB&kind=news';
    const res = await fetchTimeout(url);
    const js = await res.json();
    (js.results || []).forEach(n => {
      const key = (n.title || '') + (n.url || '');
      if (!seen.has(key)) {
        seen.add(key);
        news.push({
          title: n.title,
          url: n.url,
          time: n.published_at,
          source: 'Investing',
          impact: ''
        });
      }
    });
  } catch {}

  // Сортировка, свежесть (24ч), максимум 12 новостей
  const now = Date.now();
  return news
    .filter(a => {
      const t = new Date(a.time || 0).getTime();
      return now - t < 25 * 3600 * 1000;
    })
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 12);
}

// -- API endpoints --

app.get('/api/news', async (req, res) => {
  try {
    const news = await getAllCryptoNews();
    
    // Send notification for fresh news (throttled)
    if (news.length > 0 && Date.now() - lastNewsNotification > NOTIFICATION_THROTTLE) {
      const latestNews = news[0];
      if (latestNews && latestNews.title) {
        await sendPushNotification(
          'Новая криптоновость',
          latestNews.title,
          latestNews.url || '/',
          { type: 'news', source: latestNews.source }
        );
        lastNewsNotification = Date.now();
      }
    }
    
    res.json({ articles: news });
  } catch (e) {
    res.json({ articles: [] });
  }
});

// CoinMarketCap API (Топ-5)
app.get('/api/cmc', async (req, res) => {
  try {
    const r = await fetchTimeout(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=5&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY } }
    );
    const js = await r.json();
    
    // Send notification for significant price changes (throttled)
    if (js.data && js.data.length > 0 && Date.now() - lastPriceNotification > NOTIFICATION_THROTTLE) {
      const btc = js.data.find(coin => coin.symbol === 'BTC');
      if (btc && btc.quote && btc.quote.USD && btc.quote.USD.percent_change_24h) {
        const change = btc.quote.USD.percent_change_24h;
        if (Math.abs(change) > 5) { // Notify for changes > 5%
          const direction = change > 0 ? '📈' : '📉';
          await sendPushNotification(
            'Изменение цены Bitcoin',
            `${direction} Bitcoin ${change > 0 ? '+' : ''}${change.toFixed(2)}% за 24ч`,
            '/',
            { type: 'price', symbol: 'BTC', change: change }
          );
          lastPriceNotification = Date.now();
        }
      }
    }
    
    res.json(js);
  } catch (e) {
    res.json({ data: [], error: 'CMC error' });
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

// === Push Notification Endpoints ===

// Register FCM token
app.post('/api/register-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      fcmTokens.add(token);
      console.log('FCM token registered:', token.substring(0, 20) + '...');
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Token required' });
    }
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Send push notification
async function sendPushNotification(title, body, url = '/', data = {}) {
  if (!admin.apps.length || fcmTokens.size === 0) {
    console.log('Firebase not initialized or no tokens registered');
    return;
  }

  const message = {
    notification: {
      title: title,
      body: body,
      icon: 'https://i.ibb.co/XfKRzvcy/27.png'
    },
    data: {
      url: url,
      ...data
    },
    tokens: Array.from(fcmTokens)
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Push notification sent:', response.successCount, 'successful,', response.failureCount, 'failed');
    
    // Remove invalid tokens
    if (response.responses) {
      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const token = Array.from(fcmTokens)[idx];
          if (resp.error.code === 'messaging/invalid-registration-token' || 
              resp.error.code === 'messaging/registration-token-not-registered') {
            fcmTokens.delete(token);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Endpoint to trigger notifications (for testing)
app.post('/api/send-notification', async (req, res) => {
  try {
    const { title, body, url, data } = req.body;
    await sendPushNotification(title, body, url, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// OpenAI (GPT-4o)
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
