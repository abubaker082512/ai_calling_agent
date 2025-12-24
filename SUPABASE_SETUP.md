# Supabase Setup Guide

## 📋 **Quick Setup**

### 1. Update Environment Variables

Copy `.env.example` to `.env` and update with your actual values:

```bash
cp .env.example .env
```

Your Supabase credentials are already configured:
- ✅ SUPABASE_URL
- ✅ SUPABASE_KEY  
- ✅ SUPABASE_SERVICE_ROLE_KEY

### 2. Test Connection

```bash
npm run test:supabase
```

This will:
- Test database connection
- Verify credentials
- Show current status

### 3. Apply Database Schema

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project: `tfqixysbcrxgmavzvobj`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `database/telnyx_calls_schema.sql`
6. Paste into the SQL editor
7. Click **Run** or press `Ctrl+Enter`

**Option B: Using Script**

```bash
npm run setup:supabase
```

### 4. Verify Tables

After applying the schema, verify tables were created:

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('calls', 'call_events');
```

You should see:
- ✅ calls
- ✅ call_events

---

## 📊 **Database Schema**

### Tables Created

#### `calls`
Main call records table
- Stores call metadata
- Tracks call lifecycle
- Auto-calculates duration

#### `call_events`
All webhook events from Telnyx
- Complete event history
- JSONB payload storage
- Fast event lookups

### Features
- ✅ Auto-update triggers
- ✅ Duration calculation
- ✅ Indexes for performance
- ✅ RLS enabled

---

## 🔍 **Verification Queries**

### Check Tables
```sql
SELECT * FROM calls LIMIT 10;
SELECT * FROM call_events LIMIT 10;
```

### Check Indexes
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('calls', 'call_events');
```

### Check Triggers
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('calls', 'call_events');
```

---

## ⚠️ **Troubleshooting**

### Connection Failed
- Verify SUPABASE_URL is correct
- Check SUPABASE_SERVICE_ROLE_KEY
- Ensure project is not paused

### Tables Not Created
- Use Supabase Dashboard SQL Editor (Option A)
- Check for error messages
- Verify you have admin permissions

### RLS Issues
- Tables have permissive policies for development
- Update policies for production

---

## 🚀 **Next Steps**

After database setup:

1. ✅ Test webhook endpoint
2. ✅ Make a test call
3. ✅ Verify data is stored
4. ✅ Check call events

---

**Your Supabase Project:**
- URL: https://tfqixysbcrxgmavzvobj.supabase.co
- Dashboard: https://supabase.com/dashboard/project/tfqixysbcrxgmavzvobj
