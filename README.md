# ◈ Video Platform — Live Video & Translation App

A full-featured video meeting app with real-time AI translation, live streaming, and Supabase integration.

## 🚀 Getting Started

Simply open `index.html` in your browser — no build step required!

## 🧩 MERN-style Auth App (React + Express + SMTP + Supabase)

This repo now also includes a separate **MERN-style authentication app**:

- **Client (React)**: `client/` (Vite + React Router)
- **API (Express/Node)**: `server/` (JWT cookies + Nodemailer SMTP)
- **Database**: Supabase Postgres tables for users + tokens

### 1) Server setup

```bash
cd server
copy .env.example .env
npm run dev
```

### 2) Client setup

```bash
cd client
copy .env.example .env
npm run dev
```

Open the React app at `http://localhost:5174` (Vite will show the exact port).

### 3) Supabase tables (required)

Create these tables in Supabase SQL editor:

```sql
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists email_verification_tokens (
  id bigserial primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists password_reset_tokens (
  id bigserial primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);
```

### 4) SMTP (required for emails)

Set SMTP credentials in `server/.env` (Nodemailer). The API will send:

- Verify email link: `/verify?token=...`
- Reset password link: `/reset?token=...`

## 🔐 Login / SMTP Email / Supabase Auth

This version includes a **Login page** powered by **Supabase Auth**:

- Email + password sign-in
- Create account (email confirmation)
- Magic link sign-in
- Forgot password / reset email

### ✅ SMTP (required for emails)

Supabase sends the emails. To use your own SMTP:

- In Supabase Dashboard go to **Authentication → Providers → Email**
- Configure **SMTP** (host/port/user/pass) and sender name/email
- Ensure your **Site URL / Redirect URLs** include your app URL (for local file usage, use the same page URL you open in the browser)

### ✅ Data stored in Supabase

When logged in, Video Platform writes to:

- `realtime_events`: logs join/leave/chat/translation/stream events
- `active_rooms`: upserts the current room state

If these tables don’t exist yet, create them (example schema):

```sql
create table if not exists realtime_events (
  id bigserial primary key,
  room_id text not null,
  user_id uuid not null,
  user_email text,
  type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists active_rooms (
  room_id text primary key,
  host_user_id uuid not null,
  host_email text,
  translation_active boolean not null default true,
  streaming boolean not null default false,
  updated_at timestamptz not null default now()
);
```

Also add Row Level Security policies appropriate for your app (recommended).

## 📁 Project Structure

```
Video Platform/
├── client/
│   ├── public/video-app/ # Vanilla JS Video App
│   ├── src/              # React MERN Frontend
│   └── package.json
├── server/
│   ├── src/              # Express Backend
│   └── package.json
└── README.md
```

## ✨ Features

### 🎥 Video Room
- 4-participant video grid with animated avatars
- Active speaker detection with glowing ring indicator
- Audio waveform animations per participant
- Mic/Camera/Screen share controls

### 🌐 Live AI Translation
- Auto-detect or manual source language
- Translate to 8 languages: English, Hindi, Spanish, French, German, Japanese, Chinese, Arabic
- Live rolling transcript with original + translated text
- Translation overlays on each video tile

### 📡 Live Streaming
- Toggle broadcast with RTMP stream key input
- Live viewer counter (auto-increments when streaming)
- Stream duration timer
- Toggles: live captions, voice-dubbed audio, cloud recording
- LIVE indicator badge

### 🗄️ Supabase Integration
- Enter your Supabase project URL + anon key on the lobby screen
- `realtime_events` table logs every action in real time
- `active_rooms` table shows room state
- Demo mode works without credentials

### 💬 Chat
- In-room text chat
- Press Enter or click ↑ to send

## 🔧 Production Integration

To make this production-ready, add:

```bash
npm install @supabase/supabase-js
```

**Real WebRTC video:**
```bash
npm install simple-peer  # or mediasoup for SFU
```

**Live translation via Grok API:**
```javascript
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${YOUR_KEY}`, 
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    model: 'grok-2-latest',
    messages: [{ role: 'user', content: `Translate to ${targetLang}: "${transcript}"` }]
  })
});
```

## 🎨 Design

- **Theme**: Dark futuristic / industrial
- **Fonts**: Syne (display), Space Mono (mono), DM Sans (body)
- **Accent**: Cyan (#00e5ff), Purple (#7c3aed), Amber (#f59e0b)
- **Animations**: Waveforms, speaking rings, pulsing indicators, drift orbs
