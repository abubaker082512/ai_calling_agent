# 🚀 Render Deployment Guide

## 📋 **Quick Deploy Checklist**

### 1. Create Web Service on Render
- Go to https://render.com/
- New → Web Service
- Connect GitHub repo
- Branch: **dexatel**

### 2. Build Settings
```
Build: npm install && npm run build
Start: npm start
Node: 18.x
```

### 3. Environment Variables
```bash
DEXATEL_API_KEY=51050c33778001c2d22df1d722750026
SUPABASE_URL=https://tfqixysbcrxgmavzvobj.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcWl4eXNiY3J4Z21hdnp2b2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MDYwOTAsImV4cCI6MjA4MTI4MjA5MH0.X-dT-jlcZlnGQFcDChAfBjKad3e_xz7t1j9ppVYa0D8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmcWl4eXNiY3J4Z21hdnp2b2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTcwNjA5MCwiZXhwIjoyMDgxMjgyMDkwfQ.gVmpvfVkIRrVRDRUg2hSbcPkAu7YHsVT8RbvZLLKzhw
PORT=3000
NODE_ENV=production
DOMAIN=https://your-app.onrender.com
```

### 4. After Deploy
1. Update `DOMAIN` with actual Render URL
2. Contact Dexatel: [email protected]
3. Set webhook: `https://your-app.onrender.com/dexatel/events`

### 5. Access
```
Dashboard: https://your-app.onrender.com/dashboard/
```

---

**All code pushed to GitHub (dexatel branch)!**
