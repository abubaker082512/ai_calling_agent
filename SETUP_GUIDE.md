# 🚀 Callify AI Calling Agent - Setup Guide

## ✅ **API Key Configured**

Your Dexatel API key has been added to the configuration.

---

## 📋 **Quick Start**

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Verify Configuration
Your `.env` should have:
```bash
# Dexatel (Voice Provider)
DEXATEL_API_KEY=51050c33778001c2d22df1d722750026

# Supabase (Database)
SUPABASE_URL=https://tfqixysbcrxgmavzvobj.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server
PORT=3000
DOMAIN=http://localhost:3000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Server
```bash
npm run dev
```

### 5. Access Dashboard
```
http://localhost:3000/dashboard/
```

---

## 🎯 **What's Ready**

### ✅ Configured:
- Dexatel Voice API
- Supabase Database
- Frontend Dashboard
- All Backend Services

### 📱 Available Features:
- AI Agent Management
- Knowledge Bases
- Call History
- Analytics
- Batch Calls
- Live Testing
- Templates

---

## 🧪 **Testing**

### Test API Endpoints:
```bash
# Health check
curl http://localhost:3000/api/stats

# Dexatel webhook test
curl http://localhost:3000/dexatel/events/test
```

### Make Test Call:
```javascript
// Using Dexatel API
const call = await dexatelService.makeCall({
    to: '+1234567890',
    stream_url: 'wss://yourdomain.com/media/stream'
});
```

---

## 📊 **Dashboard Pages**

Once server is running, access:

- **Home:** http://localhost:3000/dashboard/
- **Agents:** http://localhost:3000/dashboard/agents.html
- **Knowledge Bases:** http://localhost:3000/dashboard/knowledge-bases.html
- **Call History:** http://localhost:3000/dashboard/call-history.html
- **Analytics:** http://localhost:3000/dashboard/analytics.html
- **Live Test:** http://localhost:3000/dashboard/live-test.html

---

## ⚠️ **Important Notes**

### Dexatel Voice API:
- **Requires:** Contact Dexatel support to activate Voice API
- **WebSocket:** Audio streaming via WebSocket (G.711 A-Law)
- **Outbound:** Primarily for outbound calls
- **Custom Number:** Contact support for custom caller ID

### Next Steps:
1. Contact Dexatel support to activate Voice API for your account
2. Request custom caller number (optional)
3. Test with real calls

---

## 🔧 **Troubleshooting**

### Server won't start:
```bash
# Check if port 3000 is available
netstat -ano | findstr :3000

# Try different port
PORT=3001 npm run dev
```

### Database connection issues:
- Verify Supabase credentials in `.env`
- Check internet connection
- Verify Supabase project is active

### Redis (Optional):
If you don't have Redis:
- Platform will use in-memory sessions
- Works fine for development/testing

---

## 📞 **Support**

**Dexatel Support:** [email protected]
**Documentation:** https://developers.dexatel.com/

---

**Status:** ✅ Ready to Start
**Next:** Run `npm run dev` and access dashboard
