# Health Dashboard - Semi Vibe Code Project
Personal health dashboard PWA that centralizes data from Whoop, Garmin, Hevy and nutrition logging via Claude AI.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (PWA)
- **Backend**: Flask + SQLAlchemy + PostgreSQL
- **AI**: Claude Sonnet (Anthropic) — health coach + nutrition logging
- **Hosting**: Azure Static Web Apps (frontend) + Azure Container Apps (backend)

## Features

- **Dashboard** — Whoop recovery/sleep/HRV/RHR rings, calorie burned vs consumed, weight chart
- **Nutrition** — Log food via chat with Claude, per-item macros, daily overview
- **Workouts** — Calendar view with Hevy (strength), Garmin (cycling/running), Whoop workouts
- **Chat** — Claude health coach with web search, per-day history
- **Weight** — Manual logging, history with KPIs (change, min/max, avg)

## Integrations

| Service | Data |
|---------|------|
| Whoop | Recovery, HRV, RHR, sleep, workouts |
| Garmin | Cycling, running (GPS route, HR zones, pace) |
| Hevy | Strength workouts (exercises, sets, weight) |
| Claude AI | Nutrition logging, health coaching, product lookup |

## Local Development

**Backend** (auto-restarts on code changes):
```bash
cd backend
.\venv\Scripts\flask --app wsgi run --port 8000 --debug
```

**Frontend**:
```bash
cd frontend
npm run dev
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
WHOOP_CLIENT_ID=...
WHOOP_CLIENT_SECRET=...
WHOOP_REDIRECT_URI=http://localhost:8000/api/whoop/callback
GARMIN_EMAIL=...
GARMIN_PASSWORD=...
HEVY_API_KEY=...
MFP_USERNAME=...
MFP_PASSWORD=...
```

## Deployment

Push to `master` — GitHub Actions deploys automatically:
- Frontend → Azure Static Web Apps
- Backend → Azure Container Registry → Azure Container Apps
