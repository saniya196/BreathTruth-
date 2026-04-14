# BreathTruth - Quick Setup Guide

A quick reference for setting up and running BreathTruth locally.

## Prerequisites

- **Node.js** v14+ (tested with v16+)
- **npm** or **yarn**
- **MongoDB** (local instance or MongoDB Atlas cloud)

## 🚀 Quick Start (5 minutes)

### 1. Clone & Navigate

```bash
cd breathtruth
```

### 2. Backend Setup

```bash
cd backend

# Create environment file
cp .env.example .env

# Edit .env with your values:
# - MONGO_URI (MongoDB connection string)
# - JWT_SECRET (random secret key)
# - EMAIL_USER & EMAIL_PASS (Gmail SMTP)
# - CPCB_API_KEY (Register at data.gov.in)

nano .env  # or use your preferred editor

# Install and run
npm install
npm run dev
```

**Backend will start at**: http://localhost:5000

### 3. Frontend Setup (New Terminal)

```bash
cd frontend

# Create environment file
cp .env.example .env

# Install and run
npm install
npm start
```

**Frontend will start at**: http://localhost:3000

### 4. Verify Setup

- Navigate to http://localhost:3000
- You should see BreathTruth login page with the new logo
- Try registering a test account
- Verify backend is reachable via the app

## 📝 Environment Variables

### Backend (.env)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://127.0.0.1:27017/breathtruth

# Authentication
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRE=7d

# Email (for alerts)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# CPCB API (for official AQI)
CPCB_API_KEY=your-cpcb-api-key
CPCB_API_URL=https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69
```

**Note**: For Gmail, use an [app-specific password](https://support.google.com/accounts/answer/185833)

### Frontend (.env)

```env
# API endpoint
REACT_APP_API_URL=http://localhost:5000
```

## 🗄️ MongoDB Setup

### Option 1: Local MongoDB

```bash
# Install MongoDB Community Edition
# https://docs.mongodb.com/manual/installation/

# Start MongoDB service
mongod

# Default: mongodb://127.0.0.1:27017/breathtruth
```

### Option 2: MongoDB Atlas (Cloud)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update MONGO_URI in .env:
   ```
   MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/breathtruth
   ```

## 📂 Project Structure

```
breathtruth/
├── backend/        # Node.js server
├── frontend/       # React app
├── README.md       # Full documentation
└── OPTIMIZATIONS.md # Changes made
```

## 🔍 Testing the API

### Test with curl:

```bash
# Health check
curl http://localhost:5000/api/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "pincode": "500084",
    "locality": "Kondapur",
    "city": "Hyderabad"
  }'
```

### Test with Postman:

1. Import API endpoints
2. Set up environment variables (BASE_URL, TOKEN)
3. Test authentication flow
4. Submit reports, fetch data

## 🐛 Troubleshooting

### "Cannot find module 'mongoose'"
```bash
cd backend && npm install
```

### "Port 5000 already in use"
```bash
# Change PORT in .env or kill process:
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows
```

### "MongoDB connection failed"
```bash
# Check MongoDB is running:
mongod  # If not running, start it

# Verify MONGO_URI in .env is correct
# For local: mongodb://127.0.0.1:27017/breathtruth
```

### "Email alerts not working"

- Verify EMAIL_USER and EMAIL_PASS are correct
- For Gmail: use an [app-specific password](https://support.google.com/accounts/answer/185833)
- Check if "Less secure app access" is enabled (if using regular password)

### CORS Error in Frontend

- Ensure CLIENT_URL in backend .env matches frontend URL
- Default: http://localhost:3000

## 📚 Documentation

- **README.md** - Complete project documentation
- **OPTIMIZATIONS.md** - Changes and improvements made
- **API Documentation** - Endpoints in README.md

## 🎨 Project Includes

- ✅ Professional logo (modern blue gradient with lung motif)
- ✅ Clean code structure with no errors
- ✅ Comprehensive documentation
- ✅ Git-ready repository (.gitignore configured)
- ✅ Environment-based configuration
- ✅ JWT authentication
- ✅ MongoDB integration
- ✅ Email alerts
- ✅ CPCB API integration

## 🚀 Production Deployment

### Backend:
1. Set `NODE_ENV=production`
2. Configure production MongoDB
3. Update CORS origins
4. Use environment variables
5. Deploy to Heroku/AWS/GCP/Railway

### Frontend:
1. Run `npm run build`
2. Test build locally: `npm install -g serve && serve -s build`
3. Deploy build/ folder to Vercel/Netlify/S3

## 📞 Support

For issues or questions:
1. Check the README.md
2. Review OPTIMIZATIONS.md
3. Check console/terminal for error messages
4. Verify .env files are correctly set up

---

**Quick Verification**:
- [ ] MongoDB running
- [ ] .env files created and configured
- [ ] `npm install` completed in both folders
- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] Can see BreathTruth logo on login page
- [ ] Can register new user

Happy coding! 🌬️
