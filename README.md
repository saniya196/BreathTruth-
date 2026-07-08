# BreathTruth

A community-driven urban air quality monitoring and civic accountability platform. BreathTruth lets citizens report local air quality conditions, cross-checks community-reported data against official government-linked readings, flags anomalies, and generates ready-to-file civic complaint documents.

**Live app:** [https://breathtruth.vercel.app](https://breathtruth.vercel.app)

---

## Overview

Government AQI monitoring stations are sparse and often don't reflect hyperlocal conditions — a locality 2km from the nearest official sensor can have meaningfully different air quality. BreathTruth addresses this by letting residents submit direct AQI readings or symptom-based reports, aggregating them into a per-locality community score, and comparing that score against the nearest official station's data pulled from WAQI (World Air Quality Index).

When community-reported pollution diverges significantly from official readings, the system flags it as an anomaly — surfacing a signal that a locality may be under-monitored or misrepresented by existing infrastructure. If enough residents in an area report consistently poor air quality, the platform can generate a formatted complaint letter for submission to local pollution control authorities.

## Core Features

- **Community AQI reporting** — direct AQI submission, or a symptom-based estimate (coughing, eye irritation, reduced visibility, etc.) mapped to an approximate AQI value when no sensor reading is available.
- **Community Confidence Score** — a statistical scoring algorithm that weighs both report volume and variance across reports, so confidence in a locality's reported AQI reflects both how many people reported and how much they agreed, not volume alone.
- **Official AQI comparison** — nearest-station official readings fetched via the WAQI API, geocoded from a user's pincode/locality/city using OpenStreetMap Nominatim.
- **Anomaly / divergence detection** — flags a locality when community-reported AQI is 2x or more above the official reading for that area.
- **Nearby institution mapping** — surfaces schools, colleges, hospitals, and care homes within a radius of a locality using the Overpass API (OpenStreetMap), useful for identifying vulnerable populations near high-pollution zones.
- **Civic complaint generation** — auto-generates a formatted PDF complaint letter addressed to local municipal/pollution control authorities, gated behind a minimum threshold of unique reporting accounts (to prevent single-user spam from triggering a "complaint").
- **Threshold-based alerts** — scheduled job checks community AQI against each user's configured alert threshold and sends email + in-app notifications when exceeded.
- **CSV export** — daily aggregate data (community AQI, official AQI, confidence score, divergence ratio, top pollution source) exportable per locality and date range.
- **Role-based access** — user, admin, and government account roles.

## Tech Stack

**Frontend:** React 18, React Router v6, Recharts, React Leaflet
**Backend:** Node.js, Express, Mongoose (MongoDB)
**Auth:** JSON Web Tokens (JWT), bcrypt password hashing
**External APIs:** WAQI (official AQI data), OpenStreetMap Nominatim (geocoding), OpenStreetMap Overpass API (nearby institution data)
**Alerts:** Nodemailer
**Document generation:** PDFKit (complaint letters), csv-writer (data export)
**Scheduling:** node-cron
**Validation:** express-validator
**Rate limiting:** express-rate-limit

## Engineering Notes

A few implementation details worth calling out, since they reflect real production concerns rather than tutorial-level code:

- **Tiered rate limiting** — a general limiter applies across all API routes, with a stricter limiter specifically on login/register to reduce brute-force risk, and a separate limiter on report submission to prevent data flooding.
- **Resilient geocoding** — Nominatim's usage policy allows roughly one request per second per IP, and shared hosting IPs (e.g. on free-tier Render deployments) can trigger rate limits even under light load. The backend throttles outbound geocoding calls to maintain a minimum gap between requests and retries 429 responses with exponential backoff.
- **Multi-endpoint Overpass fallback** — public Overpass API mirrors are frequently overloaded, so institution lookups fall back across three separate Overpass instances, each attempted with two different request encodings, before failing.
- **Environment-gated debug routes** — diagnostic endpoints (e.g. CORS configuration inspection) are only exposed when `NODE_ENV !== production`.
- **Dynamic CORS validation** — origin checking allows configured domains, localhost during development, and any `*.vercel.app` preview deployment, rather than a single hardcoded origin.

## Project Structure

```text
breathtruth-fullstack/
├── package.json
├── package-lock.json
├── README.md
├── docs/
│   ├── CHECKLIST.md
│   ├── COMPLETION_SUMMARY.md
│   ├── FILES_CHANGED.md
│   ├── FOLDER_STRUCTURE.md
│   ├── OPTIMIZATIONS.md
│   └── SETUP.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── aqiController.js
│   │   ├── civicController.js
│   │   ├── exportController.js
│   │   └── reportsController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validators.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Report.js
│   │   ├── AqiAggregate.js
│   │   └── Alert.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── aqi.js
│   │   ├── reports.js
│   │   ├── alerts.js
│   │   ├── map.js
│   │   ├── export.js
│   │   └── civic.js
│   └── utils/
│       ├── aggregator.js
│       ├── officialAqi.js
│       └── alertService.js
└── frontend/
    ├── .env.example
    ├── package.json
    ├── public/
    └── src/
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB (local instance or MongoDB Atlas)

### 1. Install dependencies (from repository root)

```bash
npm install
```

### 2. Configure environment files

Backend:

```bash
cd backend
cp .env.example .env
```

Frontend:

```bash
cd ../frontend
cp .env.example .env
```

> On Windows Command Prompt, use `copy` instead of `cp`.

### 3. Run in development

From the repository root:

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

Or run each independently:

```bash
npm run dev:backend
npm run dev:frontend
```

## Environment Variables

### backend/.env

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/breathtruth

JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

CLIENT_URL=http://localhost:3000
NODE_ENV=development

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password

WAQI_TOKEN=demo
```

> `WAQI_TOKEN=demo` provides limited-rate access for local testing. Request a free token at [aqicn.org/data-platform/token](https://aqicn.org/data-platform/token) for full access.

### frontend/.env

```env
REACT_APP_API_URL=http://localhost:5000
```

## Root Scripts

```bash
npm run dev            # backend + frontend concurrently
npm run dev:backend
npm run dev:frontend
npm run build           # frontend production build
npm run start:backend
npm run start:frontend
npm run install:all
npm run clean
```

## API Reference

### Authentication

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Log in and receive a JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |
| PUT | `/api/auth/settings` | Yes | Update alert preferences |

### AQI

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/aqi/official?city=` | No | Fetch official AQI for a city |
| GET | `/api/aqi/current/:pincode` | No | Current AQI (community + official) for a pincode |
| GET | `/api/aqi/nearest/:pincode` | No | Nearest official station for a pincode via WAQI |
| GET | `/api/aqi/comparison/:pincode` | Yes | Historical community vs. official AQI comparison |

### Reports

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/api/reports` | Yes | Submit an AQI or symptom-based report |
| GET | `/api/reports?pincode=` | Yes | Get recent reports for a pincode |
| GET | `/api/reports/trend/:pincode` | Yes | 7-day AQI trend for a pincode |
| GET | `/api/reports/summary/:pincode` | No | Latest aggregate summary + civic eligibility status |
| DELETE | `/api/reports/:id` | Yes | Delete a report (owner or admin only) |

### Alerts

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/alerts` | Yes | Get in-app alerts for current user |
| PUT | `/api/alerts/:id/read` | Yes | Mark an alert as read |

### Map

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/map/zones?pincode=` | No | Today's AQI overlay data by zone |
| GET | `/api/map/institutions/:pincode` | No | Nearby schools, hospitals, colleges, and care homes |

### Civic Action

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/civic/complaint-pdf/:pincode` | Yes | Generate a formatted complaint PDF (requires 11+ unique reporters in the last 7 days) |
| POST | `/api/civic/escalate` | Yes | Log an escalation event |

### Export

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| GET | `/api/export/csv?pincode=` | Yes | Export daily aggregate data as CSV |

## Deployment

- **Frontend:** Vercel (auto-deploys from GitHub)
- **Backend API:** Render
- **Database:** MongoDB Atlas

Before deploying:

- Set `NODE_ENV=production` on the backend.
- Use a production MongoDB URI.
- Set the correct `CLIENT_URL` (backend) and `REACT_APP_API_URL` (frontend) for your deployed domains.
- Build the frontend with `npm run build`.
- Never commit real credentials or `.env` files.

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions.

## Security Notes

- `.env.example` contains placeholders only — real secrets are never committed.
- Passwords are hashed with bcrypt (cost factor 12) before storage.
- `JWT_SECRET`, SMTP credentials, and API tokens are kept out of version control via `.gitignore`.
- Auth endpoints are rate-limited to reduce brute-force risk.
- Debug/diagnostic routes are disabled outside development environments.

## Additional Documentation

See the [`docs/`](docs/) directory for setup checklists, optimization notes, and folder structure reference.

## License

MIT License. See [LICENSE](LICENSE) for details.