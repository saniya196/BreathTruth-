# BreathTruth Deployment Guide

This guide walks you through deploying BreathTruth to production with free-tier services.

## 📋 Prerequisites

- GitHub account (done ✓)
- MongoDB Atlas account (free): https://www.mongodb.com/cloud/atlas
- Vercel account (free): https://vercel.com (for frontend)
- Railway account (free): https://railway.app (for backend)
  - OR Render account: https://render.com (alternative backend)

---

## Step 1: Set Up MongoDB Atlas (Cloud Database)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account and cluster
3. Create a database user (note username & password)
4. Get connection string:
   - Click "Connect" → "Drivers" → Copy connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/breathtruth?retryWrites=true&w=majority`
5. Replace `username` and `password` with your credentials
6. Keep this string safe - you'll need it for backend deployment

---

## Step 2: Deploy Backend (Node.js Server)

### Option A: Using Railway.app (Recommended)

1. Sign up at https://railway.app
2. Create new project → Deploy from GitHub
3. Select your `BreathTruth-` repository
4. Select the `backend` directory
5. Add environment variables:
   - Go to Variables tab
   - Add all from `backend/.env.example`:
     ```
     MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/breathtruth?retryWrites=true&w=majority
     JWT_SECRET=<generate random: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
     NODE_ENV=production
     CLIENT_URL=https://your-frontend-url.vercel.app
     EMAIL_HOST=smtp.gmail.com
     EMAIL_PORT=587
     EMAIL_USER=your_email@gmail.com
     EMAIL_PASS=your_app_password
     CPCB_API_KEY=your_key
     CPCB_API_URL=https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69
     PORT=5000
     ```
6. Deploy → Railway auto-deploys from main branch
7. Get your backend URL from Railway dashboard (e.g., `https://breathtruth-backend-prod.railway.app`)

### Option B: Using Render.com (Alternative)

1. Sign up at https://render.com
2. New → Web Service → Connect GitHub repo
3. Select repository, search path: `backend`
4. Configure:
   - Name: `breathtruth-backend`
   - Environment: `Node`
   - Build: `npm install`
   - Start: `node server.js`
5. Add environment variables (same as Railway)
6. Deploy

---

## Step 3: Deploy Frontend (React App)

### Using Vercel (Easiest for React)

1. Sign up at https://vercel.com
2. New Project → Import Git Repository → Select `BreathTruth-`
3. Framework Preset: `Create React App`
4. Root Directory: `frontend`
5. Environment Variables:
   - `REACT_APP_API_URL=https://your-backend-url-from-step-2.railway.app`
6. Deploy
7. Get your frontend URL (e.g., `https://breathtruth.vercel.app`)

---

## Step 4: Update Backend with Frontend URL

1. Go back to Railway (or Render)
2. Update environment variable:
   - `CLIENT_URL=https://breathtruth.vercel.app` (your actual Vercel URL)
3. Redeploy
4. Wait for deployment to complete

---

## Step 5: Add GitHub Link to README

Update your [README.md](README.md) with the deployed link:

```markdown
## 🚀 Live Demo

**Visit the live app:** [BreathTruth App](https://breathtruth.vercel.app)

- **Frontend:** https://breathtruth.vercel.app
- **Backend API:** https://your-backend.railway.app
```

---

## Testing Production Deployment

1. Open your Vercel URL
2. Test login/registration
3. Test submitting a report
4. Check if official AQI loads
5. Test trends and comparisons

---

## Troubleshooting

### Frontend blank page
- Check browser console for API errors
- Verify `REACT_APP_API_URL` is correct in Vercel

### Backend API 502 error
- Check Railway/Render logs
- Ensure environment variables are set
- Verify MongoDB Atlas connection string

### Database connection fails
- Verify MongoDB Atlas IP whitelist includes Railway/Render IPs
- Add `0.0.0.0/0` to allow all IPs (less secure)

### CORS errors
- Update `CLIENT_URL` in backend to match your frontend Vercel URL

---

## Continuous Deployment

Both Railway and Vercel auto-deploy when you:
- Push to `main` branch
- Create pull requests (previews)

No additional setup needed! 🎉

---

## Environment Variables Reference

See `backend/.env.example` and `frontend/.env.example` for all required variables.

### Important: Generating JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Security Notes

✅ Never commit `.env` files (they're in `.gitignore`)
✅ Use strong JWT_SECRET in production
✅ Store secrets in deployment platform (Railway/Vercel), not GitHub
✅ Rotate passwords periodically
✅ Update email app passwords if using Gmail

---

## Getting Help

- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Render docs: https://render.com/docs
- MongoDB Atlas: https://docs.atlas.mongodb.com
