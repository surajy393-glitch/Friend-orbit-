# Friend Orbit - Telegram Bot & WebApp

## Overview
Friend Orbit is a Telegram mini-app that visualizes your relationships as a solar system. You're the sun, and your friends, family, and partner orbit around you based on how close you stay in touch.

## Project Structure
```
├── backend/
│   ├── server.py          # FastAPI server with all API endpoints
│   ├── .env               # Environment configuration
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── build/             # Built React app
│   ├── src/               # React source code
│   ├── craco.config.js    # Craco webpack config for path aliases
│   └── package.json       # Frontend dependencies
└── replit.md              # This file
```

## Tech Stack
- **Backend**: FastAPI (Python 3.11)
- **Frontend**: React 19 with Tailwind CSS
- **Database**: PostgreSQL (Replit built-in)
- **Bot Platform**: Telegram Bot API

## Database Tables
- `users` - User accounts linked to Telegram
- `people` - Contacts (planets) in user's universe
- `meteors` - Tasks/reminders for people
- `battery_logs` - Daily social battery scores
- `invites` - Connection invites to other users
- `interaction_logs` - History of interactions with people

## Running the App
The workflow "Friend Orbit Bot" runs the FastAPI server which:
1. Serves the React frontend
2. Provides REST API endpoints
3. Handles Telegram webhook callbacks

## Key Features
- Add people (planets) to your universe
- Track relationship health via "gravity score"
- Daily social battery check with suggestions
- Invite friends to connect via Telegram
- Scheduled reminders and weekly drift reports
- Export all data as JSON
- View interaction history and battery trends
- Archive/restore people
- Filter by tags, archetype, relationship type

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `TELEGRAM_BOT_USERNAME` - Bot username for links
- `WEBAPP_URL` - Public URL for the webapp
- `WEBHOOK_SECRET` - Secret for Telegram webhook validation

## API Endpoints

### Authentication
- `POST /api/auth/telegram` - Authenticate user via Telegram WebApp

### Users
- `POST /api/users` - Create user
- `GET /api/users/{telegram_id}` - Get user by Telegram ID
- `PATCH /api/users/{user_id}` - Update user settings
- `PATCH /api/users/{user_id}/avatar` - Update avatar URL (auth required)
- `POST /api/users/{user_id}/onboard` - Mark user as onboarded
- `DELETE /api/users/{user_id}/data` - Delete all user data
- `DELETE /api/users/telegram/{telegram_id}/data` - Delete by Telegram ID

### People (Planets)
- `GET /api/people` - List all contacts (auth required)
- `POST /api/people` - Add new person (auth required)
- `GET /api/people/{person_id}` - Get person details
- `PATCH /api/people/{person_id}` - Update person
- `DELETE /api/people/{person_id}` - Archive person
- `POST /api/people/{person_id}/restore` - Restore archived person
- `POST /api/people/{person_id}/interaction` - Log interaction (boosts gravity)
- `GET /api/people/archived` - List archived people (auth required)
- `GET /api/people/filter` - Filter by tag/archetype/type/zone (auth required)

### Meteors (Tasks)
- `GET /api/meteors` - List meteors
- `POST /api/meteors` - Create meteor
- `PATCH /api/meteors/{meteor_id}` - Update meteor
- `DELETE /api/meteors/{meteor_id}` - Archive meteor

### Battery & Suggestions
- `GET /api/battery` - Get current battery status (auth required)
- `GET /api/battery/{user_id}` - Get battery by user ID
- `POST /api/battery` - Log daily battery score
- `GET /api/battery/history/{user_id}` - Get battery trends (auth required)

### Interactions & Nudges
- `GET /api/interactions/{user_id}` - Get interaction history (auth required)
- `POST /api/nudge/{person_id}` - Send nudge notification (auth required)

### Export & Stats
- `GET /api/export/{user_id}` - Export all data as JSON (auth required)
- `GET /api/stats/{user_id}` - Get statistics (orbit zones, types, drifting)

### Invites
- `POST /api/invites` - Create invite link (auth required)
- `POST /api/invites/{token}/accept` - Accept invite

### Telegram
- `POST /api/telegram/webhook/{secret}` - Handle Telegram updates

## Frontend Build
To rebuild the frontend:
```bash
cd frontend
npm install --legacy-peer-deps
npm run build
```

## Scheduled Jobs
- **Gravity Decay**: Daily at 6:30 PM - reduces gravity scores for inactive relationships
- **Battery Prompts**: Daily at 4:30 AM - sends morning battery check reminders
- **Drift Digest**: Weekly on Sunday at 1:30 PM - sends weekly drift report

## Recent Changes
- 2026-02-04: Added 10 new features (export, battery history, interactions, nudge, filter, archive management, avatar update, enhanced stats)
- 2026-02-04: Fixed frontend build with legacy-peer-deps and craco config
- 2026-02-04: Added ownership validation to secure endpoints
- 2026-02-04: Created interaction_logs table for tracking
- 2026-02-04: Migrated from MongoDB to PostgreSQL
- 2026-02-04: Set up Telegram webhook
