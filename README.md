# Hue are you?

Scan a QR code, answer five questions, get a color. Raise your phone, find the people showing the same color, and turn a room of strangers into small communities with a first ritual and an origin story written by Grok.

Built for the Grok Hackathon Toronto, theme: *"Build something that tells your story."*

## Why

Most of us are immigrants in Toronto who work from home, and it gets lonely. An activity like running, cooking or building side projects means little on its own. Doing it with a community gives it meaning. This app finds that community in a room of 400 people in ten minutes and gives it a reason to meet again.

## Run of show

1. **Scan** (QR on the projector at `/wall`). Five multiple-choice questions plus first name and home country. About a minute.
2. **Reveal.** Your phone floods with your color (8 tribes: Red / Sunrise Sweat, Orange / The Long Table, Yellow / Night Builders, …) and Grok writes one line about you from your answers.
3. **Raise your phone.** Full-screen color plus a circle number (circles of 8 inside each color so groups stay small enough to talk). Same color, same number: that's your group.
4. **Talk.** The phone shows conversation prompts for your tribe and lists who's in your circle (first name + flag).
5. **Make it real.** One person per tribe names the tribe, picks a first ritual (what / when / where), and pastes a WhatsApp/Telegram/Discord invite link. Every phone in that color updates with a "Join the group chat" button. The wall announces it.
6. **Finale.** On the wall, the admin presses *Write stories with Grok*. Grok writes an origin story for each tribe from everyone's answers (countries, names, what they miss from home, their ritual), then a closing story for the whole room. Story mode plays them full-screen, one color at a time.

The ritual is what keeps the community going after the event: the group chat exists and the first meetup is on the calendar.

## Pages

- `/`: the phone app
- `/wall`: projector view (live tribe tiles, flags, QR, join feed, seal announcements). Press **S** for story mode, arrow keys to step, Esc to exit.
- `/wall?admin=ADMIN_KEY`: same view plus admin controls (fade in on hover, bottom right): write stories, story mode, seed 30 fake people, remove fakes, reset.

## Stack

Cloudflare Worker + static assets + one Durable Object (SQLite-backed) holding all state. Phones poll every 5s, the wall every 2s. No build step, no framework.

Grok via the xAI API (`https://api.x.ai/v1/chat/completions`). Without `XAI_API_KEY`, everything still works with template-based lines and stories.

## Develop

```sh
npm install
echo "ADMIN_KEY=dev" > .dev.vars          # add XAI_API_KEY=... to use Grok locally
npm run dev                               # http://localhost:8787 and /wall?admin=dev
```

## Deploy

```sh
npx wrangler deploy
npx wrangler secret put ADMIN_KEY
npx wrangler secret put XAI_API_KEY
```

Config in `wrangler.jsonc` → `vars`: `EVENT_NAME`, `XAI_MODEL` (default `grok-4-1-fast-non-reasoning`), `CIRCLE_SIZE` (default 8).

Questions, tribes, prompts and suggested rituals live in `src/data.js`.

**Before the live demo:** open `/wall?admin=…` and press *Reset everything* (click twice) to clear test data.
