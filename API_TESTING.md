# API Testing Guide

## Quick Test

Run this command to test all API endpoints:

```bash
# Test local server
node test-api.js

# Test production server
API_URL=https://your-domain.com node test-api.js
```

## Manual Testing

### 1. Test Agents API

**List Agents:**
```bash
curl https://your-domain.com/api/agents
```

**Create Agent:**
```bash
curl -X POST https://your-domain.com/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Agent",
    "system_prompt": "You are a friendly sales assistant.",
    "voice": "AWS.Polly.Joanna-Neural",
    "greeting": "Hello! How can I help you today?",
    "is_active": true
  }'
```

### 2. Test Knowledge Bases API

**List Knowledge Bases:**
```bash
curl https://your-domain.com/api/knowledge-bases
```

**Create Knowledge Base:**
```bash
curl -X POST https://your-domain.com/api/knowledge-bases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Documentation",
    "description": "All product information"
  }'
```

**Add Document:**
```bash
curl -X POST https://your-domain.com/api/knowledge-bases/KB_ID/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Features",
    "content": "Our product has amazing features..."
  }'
```

### 3. Test Analytics API

```bash
curl https://your-domain.com/api/analytics/overview?days=30
curl https://your-domain.com/api/analytics/trends?days=30
curl https://your-domain.com/api/analytics/agents?limit=10
```

### 4. Test Templates API

```bash
curl https://your-domain.com/api/templates
curl https://your-domain.com/api/templates/search?q=sales
```

## Expected Results

### ✅ Success:
- Status 200 for GET requests
- Status 201 for POST requests (create)
- JSON response with data

### ❌ Common Errors:

**404 Not Found:**
- Route not registered
- Check index.ts has route registration

**500 Internal Server Error:**
- Database connection issue
- Check Supabase credentials
- Verify tables exist

**CORS Error (Browser):**
- Add CORS headers to Fastify
- Check API_URL in frontend

## Troubleshooting

### If APIs return 500:
1. Check Render logs
2. Verify Supabase connection
3. Ensure tables exist (run SQL schema)
4. Check environment variables

### If Frontend shows errors:
1. Hard refresh browser (Ctrl+Shift+R)
2. Check browser console for errors
3. Verify API_URL is correct
4. Check network tab for failed requests

### If Database errors:
1. Run knowledge_base_schema.sql in Supabase
2. Verify tables created
3. Check RLS policies
4. Test Supabase connection
