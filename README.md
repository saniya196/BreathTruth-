# BreathTruth

Community-driven urban air quality monitoring and accountability platform.

BreathTruth helps citizens report local AQI, compare community readings with official data, and generate civic action artifacts.

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
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── utils/
└── frontend/
    ├── .env.example
    ├── package.json
    ├── public/
    └── src/
```

## Core Updates Included

- Login-first opening flow (`/` redirects to `/login`).
- Improved auth screens and navigation behavior.
- Official AQI integration through shared backend helper:
  - CPCB API (data.gov.in) as primary source.
  - Public WAQI demo fallback when CPCB data is unavailable.
- Daily aggregate now stores:
  - `officialAqi`
  - `officialStation`
  - divergence/anomaly metadata
- Trend and comparison pages can render both community and official AQI series.

## Tech Stack

- Frontend: React 18, React Router v6, Recharts, React Leaflet
- Backend: Node.js, Express, Mongoose
- Auth: JWT + bcryptjs
- Alerts: Nodemailer
- Export: PDFKit, csv-writer
- Scheduling: node-cron

## 🚀 Live Demo

**[Visit BreathTruth Live App](https://breathtruth.vercel.app)** ← Click to open the web app

The app is deployed and live! Start monitoring air quality in your community.

### Deployment Details

- **Frontend**: Deployed on Vercel (auto-deploys from GitHub)
- **Backend API**: Deployed on Railway.app
- **Database**: MongoDB Atlas (cloud)

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Quick Start

### Prerequisites

- Node.js 18+ (recommended)
- npm
- MongoDB (local or Atlas)

### 1) Install from repository root

```bash
npm install
```

### 2) Configure environment files

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

If you are on Windows CMD, use `copy` instead of `cp`.

### 3) Run in development

From repository root:

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

You can also run each app independently:

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

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password

CPCB_API_KEY=your_cpcb_api_key
CPCB_API_URL=https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69

NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### frontend/.env

```env
REACT_APP_API_URL=http://localhost:5000
```

## Root Scripts

```bash
npm run dev            # backend + frontend concurrently
npm run dev:backend
npm run dev:frontend
npm run build          # frontend production build
npm run start:backend
npm run start:frontend
npm run install:all
npm run clean
```

## Key API Endpoints

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/settings`

AQI:

- `GET /api/aqi/official?city=Hyderabad`
- `GET /api/aqi/current/:pincode`
- `GET /api/aqi/comparison/:pincode`

Reports:

- `POST /api/reports`
- `GET /api/reports?pincode=...`
- `GET /api/reports/summary/:pincode`
- `GET /api/reports/trend/:pincode`

Civic and export:

- `GET /api/civic/complaint/:pincode`
- `POST /api/civic/escalate`
- `GET /api/export/csv?pincode=...`

## Deployment Notes

- Set `NODE_ENV=production` in backend.
- Use production MongoDB URI.
- Set correct `CLIENT_URL` and `REACT_APP_API_URL`.
- Build frontend with `npm run build`.
- Do not commit real credentials or `.env` files.

## Security Notes

- `.env.example` must contain placeholders only.
- Keep `JWT_SECRET`, email password, and API keys out of git.
- Use app passwords for SMTP providers.

## Additional Docs

See `docs/` for setup checklist, optimization notes, and folder reference.

## License

Community project. Add your preferred open-source license before public distribution.
