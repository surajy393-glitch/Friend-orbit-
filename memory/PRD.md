# Friend Orbit - Product Requirements Document

## Original Problem Statement
Build an MVP for a Telegram-based social relationship manager called "Friend Orbit" - a system where users manage their relationships as a universe, with friends/family as planets orbiting around them based on interaction frequency.

## User Token
`TELEGRAM_BOT_TOKEN=8051818960:AAEDhFC2eqZpp01Ef6Ukq0sTN7Ylv2TaRw4`
Bot Username: `@Friendorbitbot`

## Core Features (MVP)
1. **Telegram Bot Integration** - Entry point via Telegram
2. **Web App** - Space-themed UI for managing relationships
3. **Gravity System** - Relationships decay over time without interaction
4. **Battery Check** - Daily mood/energy logging with suggestions
5. **Notifications** - Server-side cron for reminders

## Product Requirements
1. **LLM Integration:** No AI for MVP - rule-based suggestions only
2. **Data Persistence:** MongoDB with minimal data storage
3. **Privacy:** Soft delete/archive, basic privacy note
4. **Notifications:**
   - Daily battery prompt: 10:00 AM IST
   - Weekly drift digest: Sunday 7:00 PM IST

## What's Been Implemented ✅

### Backend (FastAPI + MongoDB)
- User authentication (Telegram + demo mode)
- People (planets) CRUD operations
- Meteor (memories) CRUD operations
- Battery logging with suggestions
- Invite system for connecting users
- Gravity decay calculations with archetype/strictness multipliers
- Telegram webhook handler with /start, callbacks
- APScheduler for gravity decay, battery prompts, and drift digest cron jobs
- Debug endpoint `/api/debug/frontend` for deployment verification
- Robust frontend build discovery (`find_frontend_build_dir()`)
- Proper CORS configuration with allowed origins from env

### Frontend (React + TailwindCSS)
- Space-themed UI design
- Onboarding wizard (3 steps)
- Universe map view with orbiting planets
- Person profile view
- Battery prompt modal
- Add planet modal
- Settings page
- HashRouter for Telegram WebApp compatibility

### Telegram Bot ✅
- Webhook configured and active
- /start command with welcome message
- "Open Friend Orbit" Web App button
- "How it works" and "Privacy" info buttons
- Invite acceptance flow

## What's Pending

### P1 - Important  
- [ ] Verify scheduled Telegram prompts (battery & digests) are actually sending
- [ ] Test Web App launch from within Telegram app

### P2 - Nice to Have
- [ ] Partner "Moon" visual representation in UI
- [ ] Memory "Meteors" preview before opening chat
- [ ] Family clustering in UI
- [ ] Configurable notification timings
- [ ] Proper JWT-based authentication (instead of X-User-Id header)
- [ ] AI-powered suggestions (Phase 2)

## Technical Architecture
```
/app
├── backend/
│   ├── server.py       # FastAPI main app with all routes + static serving
│   ├── requirements.txt
│   └── .env            # Contains TELEGRAM_BOT_TOKEN, MONGO_URL, ALLOWED_ORIGINS
├── frontend/
│   ├── build/          # Production build (served via 'serve -s build')
│   ├── src/
│   │   ├── components/ # React components (15+)
│   │   └── App.js      # Main router (HashRouter)
│   ├── public/
│   │   └── index.html  # Entry point with Telegram SDK
│   └── package.json
└── memory/
    └── PRD.md          # This file
```

## API Endpoints
- `POST /api/auth/telegram` - Telegram auth
- `GET /api/debug/frontend` - Verify frontend build in production
- `POST /api/users` - Create user
- `GET/POST /api/people` - Manage planets
- `POST /api/people/{id}/interaction` - Log interaction
- `GET/POST /api/meteors` - Manage memories
- `POST /api/battery` - Log battery score
- `POST /api/invites` - Generate invite
- `POST /api/telegram/webhook/{secret}` - Telegram updates

## Database Schema
- **users**: id, telegram_id, display_name, timezone, onboarded, last_battery
- **people**: id, user_id, name, relationship_type, archetype, gravity_score, pinned, archived
- **meteors**: id, person_id, user_id, content, tag, done, archived
- **battery_logs**: id, user_id, score, created_at
- **invites**: id, token, inviter_id, person_id, status, expires_at

## Session Updates

### Feb 4, 2026 (Latest - Blank Screen Fix)
- ✅ **ROOT CAUSE IDENTIFIED & FIXED: PostHog analytics was blocking JavaScript execution in Telegram's restricted iframe**
  - PostHog's `recordCrossOriginIframes: true` caused fatal errors in Telegram WebApp's sandboxed environment
  - **Fix**: Disabled PostHog entirely when running inside Telegram WebApp (created no-op stub)
  - Modified `/app/frontend/public/index.html` to detect Telegram context and skip analytics
- ✅ **Fixed webhook URL mismatch**: Webhook was pointing to wrong domain, updated to correct `webapp-secure.preview.emergentagent.com`
- ✅ Added robust `find_frontend_build_dir()` function for production debugging
- ✅ Added `/api/debug/frontend` endpoint to verify build in production
- ✅ Fixed CORS configuration (proper list handling)
- ✅ Started frontend service with `serve -s build` on port 3000

### Earlier (Feb 4, 2026)
- ✅ Fixed gravity decay logic (partner decays slowest, not fastest)
- ✅ Fixed timezone bug in battery logging
- ✅ Secured API endpoints with user scoping
- ✅ Implemented archetype/strictness gravity multipliers
- ✅ Scheduled battery prompts and drift digest cron jobs
- ✅ Switched to HashRouter for WebApp stability
- ✅ Removed "Made with Emergent" badge

### Earlier Session
- ✅ Set up Telegram webhook - bot responding to /start
- ✅ Updated page title and description to "Friend Orbit"
