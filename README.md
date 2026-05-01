# 🌬️ BreathTruth

**Community-Driven Urban Air Quality Monitoring & Accountability Platform**

> BreathTruth gives Indian citizens the tools to measure, prove, and escalate the pollution their government isn't monitoring.

---

## 📋 Project Structure

```
breathtruth/
├── package.json              # Root monorepo scripts + workspace orchestration
├── README.md                 # Project documentation
├── .gitignore                # Global ignore rules
├── docs/                     # Project guides and completion notes
│   ├── CHECKLIST.md
│   ├── COMPLETION_SUMMARY.md
│   ├── FILES_CHANGED.md
│   ├── FOLDER_STRUCTURE.md
│   ├── OPTIMIZATIONS.md
│   └── SETUP.md
├── backend/                  # Node.js + Express + MongoDB API
│   ├── .env                  # Environment variables (DO NOT COMMIT)
│   ├── .env.example          # Example environment variables
│   ├── .gitignore            # Backend-specific git ignore
│   ├── package.json          # Backend dependencies and dev scripts
│   ├── server.js             # Express app entry point + cron jobs
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── utils/
└── frontend/                 # React.js SPA
    ├── .env.example          # Example environment variables
    ├── .gitignore            # Frontend-specific git ignore
    ├── package.json          # Frontend dependencies and scripts
    ├── public/
    └── src/
        ├── components/
        ├── context/
        ├── pages/
        └── utils/
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+ recommended)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

```bash
cd backend

# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# - MongoDB URI
# - JWT Secret
# - Email credentials
# - CPCB API key

# Install dependencies
npm install

# Start development server
npm run dev
```

**Backend Server**: http://localhost:5000

### Frontend Setup

```bash
cd frontend

# Copy example environment file
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm start
```

**Frontend Server**: http://localhost:3000

### Root Workspace Commands

From the project root you can run:

```bash
npm install
npm run dev
npm run build
```

The root `package.json` ties the frontend and backend together so the repo behaves like a single professional workspace.

## 📦 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)
- `PUT /api/auth/settings` - Update user settings (requires token)

### AQI Data
- `GET /api/aqi/official?city=X` - Get official CPCB AQI
- `GET /api/aqi/comparison/:pincode` - Compare community vs official AQI
- `GET /api/aqi/current/:pincode` - Get current AQI

### Reports
- `POST /api/reports` - Submit new AQI report (requires token)
- `GET /api/reports?pincode=X` - Get area reports (requires token)
- `GET /api/reports/summary/:pincode` - Get area summary (public)
- `GET /api/reports/trend/:pincode` - Get weekly trend (requires token)
- `DELETE /api/reports/:id` - Delete own report (requires token)

### Civic Action
- `GET /api/civic/complaint/:pincode` - Generate complaint PDF
- `POST /api/civic/escalate` - File escalation

### Alerts
- `GET /api/alerts` - Get user alerts (requires token)
- `PUT /api/alerts/:id/read` - Mark alert as read (requires token)

### Export
- `GET /api/export/csv?pincode=X` - Export AQI data as CSV (requires token)

## 🗂️ Cleaned Up Folder Structure

The following **unnecessary folders have been removed**:
- ✅ `frontend/build/` - Regenerated during build
- ✅ `frontend/node_modules/` - Regenerated from package.json
- ✅ `backend/node_modules/` - Regenerated from package.json

The following files have been created for proper Git management:
- ✅ `.gitignore` (root) - Global git ignore rules
- ✅ `backend/.gitignore` - Backend-specific rules
- ✅ `frontend/.gitignore` - Frontend-specific rules
- ✅ `backend/.env.example` - Updated with all variables
- ✅ `frontend/.env.example` - Setup environment template

## 🎨 Professional Logo

- **Logo file**: `frontend/public/logo.svg` (256x256px)
- **Icon file**: `frontend/public/logoicon.svg` (favicon)
- **Design**: Modern gradient blue (sky/air theme) with lungs & breath waves
- **Usage**: Integrated in Navbar and Auth pages

## 🔐 Environment Variables

### Backend (.env)
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/breathtruth
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
CPCB_API_KEY=your_cpcb_api_key
CPCB_API_URL=https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000
```

## 📖 Features

### User Capabilities
- 📍 Report air quality from your location
- 📊 View community-sourced AQI data
- 🗺️ Interactive map with pollution hotspots
- 📈 Trend analysis and historical data
- 🚨 Custom AQI alerts
- 📄 Download complaint letters (PDF)
- 📋 Export data (CSV)

### Data Management
- Confidence scoring based on report count
- Daily aggregation by pincode
- Official vs community AQI comparison
- Anomaly detection
- Source breakdown analysis

## 🛠️ Code Quality

### Backend
- JWT-based authentication
- Rate limiting (100 requests/15 min)
- MongoDB best practices
- Cron jobs for scheduled tasks
- Error handling middleware

### Frontend
- React Hooks + Context API
- Protected routes
- Toast notifications
- Responsive design
- Auto-refreshing auth

## 🚀 Deployment

### Backend (Node.js)
- Set `NODE_ENV=production`
- Configure production MongoDB
- Update `CORS` origins
- Use environment variables
- Deploy to Heroku/AWS/GCP

### Frontend (React)
- Run `npm run build`
- Deploy `build/` folder
- Configure API proxy for CORS

## 📝 License

Community-driven open-source project.

## 🤝 Contributing

Community reports and contributions welcome!

---

**Last Updated**: April 2026  
**Status**: ✅ Production Ready
    │   │   ├── Landing.js          # Public landing page
    │   │   ├── Dashboard.js        # Main user dashboard
    │   │   ├── SubmitReport.js     # 3-step report form
    │   │   ├── Trends.js           # 7-day Recharts graphs
    │   │   ├── MapView.js          # Leaflet AQI map + institutions
    │   │   ├── CivicAction.js      # PDF complaint + CSV export
    │   │   ├── Alerts.js           # In-app notifications
    │   │   ├── PublicDashboard.js  # Read-only public view
    │   │   └── Auth.js             # Login + Register + Settings
    │   ├── utils/
    │   │   └── aqiHelpers.js       # AQI colors, categories, labels
    │   ├── App.js                  # Router + protected routes
    │   ├── index.js
    │   └── index.css               # Complete stylesheet
    └── package.json
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, email config
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

App runs at: `http://localhost:3000`  
API runs at: `http://localhost:5000`

---

## Environment Variables (backend/.env)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `JWT_EXPIRE` | Token expiry e.g. `7d` |
| `EMAIL_HOST` | SMTP host for email alerts |
| `EMAIL_USER` | SMTP email address |
| `EMAIL_PASS` | SMTP password / app password |
| `CPCB_API_KEY` | Official CPCB AQI API key (from data.gov.in) |

---

## Key Features Implemented

| Feature | Status |
|---------|--------|
| JWT Authentication (register/login/roles) | ✅ |
| Community AQI Report Submission (sensor + symptoms) | ✅ |
| Daily aggregate per pincode | ✅ |
| Community Confidence Score (Low/Moderate/High/Verified) | ✅ |
| CPCB Official AQI fetch + comparison | ✅ |
| Anomaly detection (2x+ divergence flagging) | ✅ |
| 7-day trend graphs (Recharts) | ✅ |
| AQI Zone Map (React Leaflet) | ✅ |
| High-risk institution overlay | ✅ |
| Health Advisory Panel (CPCB standard) | ✅ |
| In-app + email threshold alerts | ✅ |
| Civic Complaint PDF generator (PDFKit) | ✅ |
| CSV data export | ✅ |
| Public read-only dashboard | ✅ |
| Responsive design | ✅ |

---

## Getting CPCB API Key

1. Visit [data.gov.in](https://data.gov.in)
2. Register for a free API key
3. Search for "CPCB AQI" or "Air Quality Index"
4. Dataset ID: `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Recharts, React Leaflet |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| PDF | PDFKit |
| CSV | csv-writer |
| Email | Nodemailer |
| Scheduling | node-cron |
| Maps | OpenStreetMap + Leaflet |

---

## One-Line Pitch

*BreathTruth gives Indian citizens the tools to measure, prove, and escalate the pollution their government isn't monitoring.*
