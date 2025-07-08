require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Firebase Admin SDK
const admin = require('firebase-admin');

// Firebase Admin initialization - only if proper config is provided
let firebaseInitialized = false;

// Example service account configuration (REPLACE WITH YOUR OWN)
const serviceAccountExample = {
  type: "service_account",
  project_id: "your-project-id",
  private_key_id: "your-private-key-id",
  private_key: "-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  client_id: "your-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com"
};

// Initialize Firebase Admin if environment variables are set
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.log('Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with your Firebase service account JSON');
  }
} else {
  console.log('WARNING: Firebase Admin not initialized - set FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
  console.log('Push notifications will not work until Firebase is properly configured');
}

const TIMEOUT = 12000;

// Store FCM tokens (in production, use a database)
const fcmTokens = new Set();

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

// FCM Token Registration
app.post('/api/fcm-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      fcmTokens.add(token);
      console.log('FCM token registered:', token);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Token is required' });
    }
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get VAPID key
app.get('/api/vapid-key', (req, res) => {
  res.json({ vapidKey: process.env.VAPID_KEY || 'your-vapid-key-here' });
});

// Send Push Notification
async function sendPushNotification(title, body, data = {}) {
  if (!firebaseInitialized) {
    console.log('Firebase not initialized - cannot send push notifications');
    return;
  }
  
  if (fcmTokens.size === 0) {
    console.log('No FCM tokens available');
    return;
  }

  const message = {
    notification: {
      title,
      body,
      icon: 'https://i.ibb.co/XfKRzvcy/27.png'
    },
    data,
    tokens: Array.from(fcmTokens)
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Push notification sent:', response);
    
    // Remove invalid tokens
    response.responses.forEach((resp, idx) => {
      if (resp.error) {
        const token = Array.from(fcmTokens)[idx];
        console.log('Removing invalid token:', token);
        fcmTokens.delete(token);
      }
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Manual push notification endpoint (for testing)
app.post('/api/send-notification', async (req, res) => {
  try {
    const { title, body, data } = req.body;
    await sendPushNotification(title || 'NEURONA', body || 'Test notification', data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Periodic News and Price Monitoring
let lastNewsCheck = 0;
let lastPriceCheck = {};

// Check for new news every 5 minutes
setInterval(async () => {
  try {
    const news = await getAllCryptoNews();
    const newArticles = news.filter(article => {
      const articleTime = new Date(article.time).getTime();
      return articleTime > lastNewsCheck;
    });
    
    if (newArticles.length > 0) {
      lastNewsCheck = Date.now();
      
      // Send notification for new crypto news
      const title = '🚀 Новости криптовалют';
      const body = `${newArticles.length} новых новостей: ${newArticles[0].title}`;
      await sendPushNotification(title, body, {
        type: 'news',
        count: newArticles.length.toString()
      });
    }
  } catch (error) {
    console.error('Error checking news:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// Check for significant price changes every 2 minutes
setInterval(async () => {
  try {
    const coins = ['BTC', 'ETH', 'TON', 'SOL', 'BNB'];
    
    for (const coin of coins) {
      try {
        // Get current price from Binance
        const response = await fetchTimeout(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
        const data = await response.json();
        const currentPrice = parseFloat(data.price);
        
        if (lastPriceCheck[coin]) {
          const priceChange = ((currentPrice - lastPriceCheck[coin]) / lastPriceCheck[coin]) * 100;
          
          // Send notification for significant price changes (>5%)
          if (Math.abs(priceChange) >= 5) {
            const direction = priceChange > 0 ? '📈' : '📉';
            const title = `${direction} ${coin} ${priceChange > 0 ? 'рост' : 'падение'}`;
            const body = `${coin}: $${currentPrice.toLocaleString()} (${priceChange.toFixed(2)}%)`;
            
            await sendPushNotification(title, body, {
              type: 'price',
              coin,
              price: currentPrice.toString(),
              change: priceChange.toFixed(2)
            });
          }
        }
        
        lastPriceCheck[coin] = currentPrice;
      } catch (error) {
        console.error(`Error checking ${coin} price:`, error);
      }
    }
  } catch (error) {
    console.error('Error in price monitoring:', error);
  }
}, 2 * 60 * 1000); // 2 minutes

// PWA: index.html fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log('FCM push notifications enabled');
  console.log('News monitoring: every 5 minutes');
  console.log('Price monitoring: every 2 minutes for BTC, ETH, TON, SOL, BNB');
});
