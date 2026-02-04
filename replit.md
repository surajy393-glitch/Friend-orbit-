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
│   ├── build/             # Pre-built React app
│   ├── src/               # React source code
│   └── package.json       # Frontend dependencies
└── replit.md              # This file
```

## Tech Stack
- **Backend**: FastAPI (Python 3.11)
- **Frontend**: React with Tailwind CSS
- **Database**: PostgreSQL (Replit built-in)
- **Bot Platform**: Telegram Bot API

## Running the App
The workflow "Friend Orbit Bot" runs the FastAPI server which:
1. Serves the React frontend
2. Provides REST API endpoints
3. Handles Telegram webhook callbacks

## Key Features
- Add people (planets) to your universe
- Track relationship health via "gravity score"
- Daily social battery check
- Invite friends to connect
- Scheduled reminders and drift reports

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection (auto-set by Replit)
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `TELEGRAM_BOT_USERNAME` - Bot username for links
- `WEBAPP_URL` - Public URL for the webapp
- `WEBHOOK_SECRET` - Secret for Telegram webhook validation

## API Endpoints
- `POST /api/auth/telegram` - Authenticate user
- `GET/POST /api/users` - User management
- `GET/POST /api/people` - Manage contacts (planets)
- `POST /api/people/{id}/interaction` - Log interaction
- `GET/POST /api/battery` - Social battery tracking
- `POST /api/telegram/webhook/{secret}` - Telegram updates

## Recent Changes
- 2026-02-04: Migrated from MongoDB to PostgreSQL
- 2026-02-04: Updated API URLs for Replit deployment
- 2026-02-04: Set up Telegram webhook
