# Personal Health Dashboard — Project Plan

## Goal

A personal health PWA with a built-in Claude-powered chat interface that acts as an
orchestrator. The app centralises all health data (workouts, sleep, recovery, nutrition,
weight) in one place and lets the user talk to Claude about it in context.

The user is technically proficient in full-stack development, Python, SQL, and Azure.

---

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite (PWA) | Azure Static Web Apps |
| Backend | Flask (Python) | Azure Container Apps |
| Database | Azure Database for PostgreSQL (Flexible Server) | Azure |
| AI | Claude API (claude-sonnet-4-20250514) | Anthropic |
| CI/CD | GitHub Actions | GitHub |

---

## Data Sources & Integrations

| Source | Method | Data |
|---|---|---|
| **Whoop** | OAuth 2.0 — developer.whoop.com | Sleep, recovery, HRV, body weight |
| **Garmin** | OAuth 1.0a — developer.garmin.com | Workouts, heart rate, GPS |
| **Hevy** | REST API — api.hevyapp.com | Strength workouts, sets, reps, weights |
| **Nutrition** | Claude API via chat | Calories, protein, carbs, fat — logged via conversation |
| **Weight history** | One-time CSV import from MyFitnessPal | Historical weight data |

Note: MyFitnessPal has no public API. Historical weight data is imported once via CSV export.
Going forward, weight comes from Whoop or manual entry in the app.

---

## Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weight logs
CREATE TABLE weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    weight_kg FLOAT NOT NULL,
    source VARCHAR(50), -- 'whoop', 'manual', 'import'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nutrition logs
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    meal_type VARCHAR(50), -- 'breakfast', 'lunch', 'dinner', 'snack'
    description TEXT NOT NULL,
    calories INT,
    protein_g FLOAT,
    carbs_g FLOAT,
    fat_g FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whoop data
CREATE TABLE whoop_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    recovery_score INT,
    hrv_ms FLOAT,
    resting_hr INT,
    sleep_score INT,
    sleep_duration_hours FLOAT,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts (Hevy + Garmin)
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    source VARCHAR(50), -- 'hevy', 'garmin'
    title VARCHAR(255),
    duration_minutes INT,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages (conversation history per day)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Project Structure

```
health-dashboard/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask app factory
│   │   ├── config.py            # Config from env vars
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── routes/
│   │   │   ├── chat.py          # POST /api/chat
│   │   │   ├── nutrition.py     # GET/POST /api/nutrition
│   │   │   ├── weight.py        # GET/POST /api/weight
│   │   │   ├── workouts.py      # GET /api/workouts
│   │   │   └── sync.py          # POST /api/sync/* (trigger manual sync)
│   │   └── services/
│   │       ├── claude.py        # Claude API calls + context building
│   │       ├── whoop.py         # Whoop OAuth + data fetching
│   │       ├── garmin.py        # Garmin OAuth + data fetching
│   │       ├── hevy.py          # Hevy API calls
│   │       └── nutrition.py     # Nutrition parsing via Claude
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx    # Main dashboard with charts
│   │   │   ├── Chat.jsx         # Chat interface with Claude
│   │   │   ├── NutritionLog.jsx # Daily food log (MFP-style)
│   │   │   └── WorkoutLog.jsx   # Workout history
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── vite.config.js
│   └── package.json
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml
│       └── deploy-frontend.yml
└── PLAN.md
```

---

## Claude as Orchestrator — How it Works

Every chat message goes through this flow:

1. User sends a message in the chat tab
2. Flask `/api/chat` endpoint receives the message
3. Flask fetches context from PostgreSQL:
   - Last 7 days of nutrition logs
   - Last 7 days of weight
   - Last 7 days of Whoop data (recovery, HRV, sleep)
   - Last 5 workouts (Hevy + Garmin)
4. All context + user message is sent to Claude API
5. Claude responds AND extracts any nutrition logging intent
6. If food was mentioned → Flask parses and writes to `nutrition_logs`
7. Response is returned to the frontend

Example system prompt sent to Claude:
```
You are a personal health coach with access to the user's health data.
Current data:
- Today's recovery score: 78, HRV: 52ms
- Last workout: Push day (Hevy) — bench press 5x5 @ 80kg, shoulder press 4x8 @ 40kg
- Today's nutrition so far: 1,240 kcal (protein: 98g, carbs: 120g, fat: 45g)
- Weight trend (7d): 84.2 → 83.8 kg

When the user mentions food they ate, extract it and respond with a JSON block:
{"log_nutrition": true, "meal_type": "lunch", "description": "...", "calories": ..., "protein_g": ..., "carbs_g": ..., "fat_g": ...}
```

---

## Build Phases

### Phase 1 — Skeleton (start here)
- [ ] Flask app factory with config, CORS, error handling
- [ ] PostgreSQL connection via SQLAlchemy
- [ ] All database tables created via migrations (Flask-Migrate)
- [ ] React + Vite PWA scaffold
- [ ] Basic bottom tab navigation: Dashboard / Nutrition / Chat
- [ ] Environment variable setup (.env.example)
- [ ] Dockerfile for Flask
- [ ] GitHub Actions: deploy Flask to Azure Container Apps, React to Azure Static Web Apps

### Phase 2 — Whoop Integration
- [ ] Whoop OAuth 2.0 flow (authorise, callback, token storage)
- [ ] Whoop sync service: pull sleep, recovery, HRV, body weight
- [ ] Scheduled sync job (every 4 hours via Azure Container Apps)
- [ ] Weight chart on dashboard (recharts)
- [ ] Recovery + HRV cards on dashboard

### Phase 3 — Chat + Nutrition Logging
- [ ] Claude API service with context builder
- [ ] POST /api/chat endpoint
- [ ] Chat tab in frontend with message history
- [ ] Nutrition extraction from chat responses
- [ ] Nutrition log tab: daily overview with meal breakdown (like MFP)
- [ ] Macro progress bars (protein / carbs / fat vs daily goal)

### Phase 4 — Hevy + Garmin
- [ ] Hevy API service (api.hevyapp.com)
- [ ] Garmin OAuth 1.0a flow + workout sync
- [ ] Workout log tab with history
- [ ] Workout context injected into Claude chat

### Phase 5 — Polish
- [ ] PWA manifest + service worker (installable on iPhone homescreen)
- [ ] MFP CSV weight import endpoint
- [ ] Open Food Facts API as fallback for packaged products
- [ ] Weekly summary from Claude (trends, suggestions)
- [ ] Dark mode

---

## Environment Variables

```env
# Flask
FLASK_ENV=development
SECRET_KEY=

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/healthdb

# Claude
ANTHROPIC_API_KEY=

# Whoop
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=

# Garmin
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=

# Hevy
HEVY_API_KEY=
```

---

## Azure Resources Needed

- **Azure Container Apps** — Flask backend
- **Azure Static Web Apps** — React frontend
- **Azure Database for PostgreSQL Flexible Server** — database (free tier available)
- **Azure Container Registry** — Docker images for Flask

---

## Instructions for Claude Code

Start with Phase 1. Build the full project skeleton as described above.
- Use Flask with Flask-SQLAlchemy and Flask-Migrate for the backend
- Use React + Vite for the frontend
- Use recharts for charts
- Use Tailwind CSS for styling
- All secrets via environment variables, never hardcoded
- Write clean, well-commented code
- After Phase 1 is complete, ask before starting Phase 2
