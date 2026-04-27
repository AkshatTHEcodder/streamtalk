const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getSupabaseAdmin } = require('../lib/supabase');
const { sendMail } = require('../lib/mail');
const { makeToken, sha256, minutesFromNow } = require('../lib/tokens');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const emailSchema = z.string().email().max(320);
const passwordSchema = z.string().min(8).max(200);

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('st_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.get('/me', requireAuth, async (req, res) => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('app_users')
    .select('id,email,verified,created_at')
    .eq('id', req.auth.sub)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB_ERROR' });
  if (!data) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  res.json({ user: data });
});

router.post('/register', async (req, res) => {
  const schema = z.object({ email: emailSchema, password: passwordSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { email, password } = parsed.data;
  const sb = getSupabaseAdmin();

  const { data: existing, error: findErr } = await sb
    .from('app_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (findErr) return res.status(500).json({ error: 'DB_ERROR' });
  if (existing) return res.status(409).json({ error: 'EMAIL_IN_USE' });

  const password_hash = await bcrypt.hash(password, 12);
  const { data: created, error: createErr } = await sb
    .from('app_users')
    .insert({ email: email.toLowerCase(), password_hash, verified: false })
    .select('id,email,verified,created_at')
    .single();
  if (createErr) return res.status(500).json({ error: 'DB_ERROR' });

  const rawToken = makeToken(32);
  const tokenHash = sha256(rawToken);
  await sb.from('email_verification_tokens').insert({
    user_id: created.id,
    token_hash: tokenHash,
    expires_at: minutesFromNow(60),
  });

  const appUrl = process.env.APP_PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174';
  const verifyUrl = `${appUrl}/verify?token=${rawToken}`;
  await sendMail({
    to: created.email,
    subject: 'Verify your Video Platform account',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Verify your email</h2>
        <p>Click this link to verify your account:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 60 minutes.</p>
      </div>
    `,
  });

  res.json({ ok: true });
});

router.post('/verify', async (req, res) => {
  const schema = z.object({ token: z.string().min(10).max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const tokenHash = sha256(parsed.data.token);
  const sb = getSupabaseAdmin();

  const { data: row, error } = await sb
    .from('email_verification_tokens')
    .select('user_id,expires_at,used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB_ERROR' });
  if (!row || row.used_at) return res.status(400).json({ error: 'INVALID_TOKEN' });
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'TOKEN_EXPIRED' });

  await sb.from('app_users').update({ verified: true }).eq('id', row.user_id);
  await sb.from('email_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);

  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const schema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const sb = getSupabaseAdmin();
  const email = parsed.data.email.toLowerCase();
  const { data: user, error } = await sb
    .from('app_users')
    .select('id,email,password_hash,verified')
    .eq('email', email)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB_ERROR' });
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  if (!user.verified) return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });

  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  setAuthCookie(res, token);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('st_token', { path: '/' });
  res.json({ ok: true });
});

router.post('/forgot', async (req, res) => {
  const schema = z.object({ email: emailSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const sb = getSupabaseAdmin();
  const email = parsed.data.email.toLowerCase();
  const { data: user } = await sb.from('app_users').select('id,email').eq('email', email).maybeSingle();

  // Always return ok (avoid account enumeration)
  if (!user) return res.json({ ok: true });

  const rawToken = makeToken(32);
  const tokenHash = sha256(rawToken);
  await sb.from('password_reset_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: minutesFromNow(30),
  });

  const appUrl = process.env.APP_PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174';
  const resetUrl = `${appUrl}/reset?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Video Platform password',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Password reset</h2>
        <p>Use this link to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 30 minutes.</p>
      </div>
    `,
  });

  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  const schema = z.object({ token: z.string().min(10).max(500), password: passwordSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const sb = getSupabaseAdmin();
  const tokenHash = sha256(parsed.data.token);
  const { data: row, error } = await sb
    .from('password_reset_tokens')
    .select('user_id,expires_at,used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB_ERROR' });
  if (!row || row.used_at) return res.status(400).json({ error: 'INVALID_TOKEN' });
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'TOKEN_EXPIRED' });

  const password_hash = await bcrypt.hash(parsed.data.password, 12);
  await sb.from('app_users').update({ password_hash }).eq('id', row.user_id);
  await sb.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);

  res.json({ ok: true });
});

module.exports = router;

