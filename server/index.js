require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { relay } = require('./relay');

const PORT = process.env.PORT || 3000;
const COURSE_PASSWORD = process.env.COURSE_PASSWORD;
const COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COURSE_PASSWORD || !COOKIE_SECRET) {
  console.error('Missing COURSE_PASSWORD or COOKIE_SECRET. Copy .env.example to .env and fill both in.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireSession(req, res, next) {
  if (req.signedCookies.session === 'ok') return next();
  res.status(401).json({ error: 'Not logged in. Enter the course password first.' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== COURSE_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password.' });
  }
  res.cookie('session', 'ok', {
    httpOnly: true,
    sameSite: 'strict',
    signed: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 hours, long enough for one course day
  });
  res.json({ ok: true });
});

app.post('/api/relay', requireSession, async (req, res) => {
  const { target } = req.body || {};
  if (!target || typeof target !== 'object') {
    return res.status(400).json({ error: 'Missing target { url, method, headers, body }.' });
  }
  try {
    const result = await relay(target);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.statusCode || 502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`OpenAI API course tool listening on http://localhost:${PORT}`);
});
