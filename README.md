# CP Medical × Blueprint · House of Strains HQ

Rooms, schedule, main board, daily feed, stock, orders, records and money for House of Strains, in English, ไทย and हिन्दी.
It opens from a link (LINE, WhatsApp, any browser), installs like an app on phones and computers, and everyone sees changes live.

It runs on two services:
- **Supabase** keeps the data, photos and files, handles sign-in (email code or Google), and pushes changes to every device.
- **Vercel** hosts the site at its own web address.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The whole app, built from the Claude artifact by `port.py`. Don't edit by hand |
| `artifact.html` | The design file: a copy of the Blueprint artifact page |
| `port.py` | Rebuilds `index.html` (adds sign-in, live sync, menu) and writes `vercel.json` |
| `backend.js` | Connects the app to Supabase: sign-in screen, live data, photo uploads, photo reading |
| `install.js` | The ☰ menu: Install app, Share link (LINE / WhatsApp), Who can sign in, Import |
| `config.js` | Supabase address and public key |
| `supabase/schema.sql` | Database, file storage and access rules (only invited emails get in) |
| `supabase/functions/ask/` | Lets the app ask Claude to read board photos, scans and COAs |

Starting data and files are **not** in this repo; they come from a private file and zip.

## Changing the app
1. Make the change in the Blueprint artifact in Claude.
2. Save its page as `artifact.html` here, run `python3 port.py`, commit and push.
3. Vercel redeploys in about a minute.

## Setup (once)
1. **Supabase** → New project `blueprint-hq`, region Singapore → SQL Editor → run `supabase/schema.sql`, then the private `members.sql`.
2. Project Settings → API: copy the Project URL and publishable key into `config.js`, run `python3 port.py`, push.
3. Authentication → Emails: add `Your code: {{ .Token }}` to **Magic Link** and **Confirm signup**. Email OTP length 6.
4. **Vercel** → vercel.com/new → import `blueprint-hq` → Deploy.
5. Supabase → Authentication → URL Configuration: Site URL = the Vercel address; Redirect URLs add `https://<address>/**`.
6. Sign in on the site → ☰ → **Import data** (data file from the Claude version) and **Import photos & files** (unzipped starting files).
7. Photo reading: Supabase → Edge Functions → deploy `ask`, and add the secret `ANTHROPIC_API_KEY`.

## Install on phones
- **iPhone**: open the link in Safari → Share → **Add to Home Screen**. (From LINE: ⋯ → Open in browser first.)
- **Android**: Chrome → ⋮ → **Install app**.
