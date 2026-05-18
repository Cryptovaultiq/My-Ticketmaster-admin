# 🔒 Security Configuration Guide - Admin Panel

## ⚠️ CRITICAL: Required Environment Variables

Your admin panel (`My-Ticketmaster-admin`) is now protected with **API key authentication** to prevent the Rahman admin panel from accessing submissions.

### Required Environment Variables on Vercel:

```
GITHUB_TOKEN = "your_github_personal_access_token"
GITHUB_BRANCH = "main"
SUBMISSIONS_API_KEY = "your_secure_api_key_here"  ⭐ CRITICAL
```

---

## 🚀 Setup Instructions

### Step 1: Generate a Secure API Key

**On Mac/Linux:**
```bash
openssl rand -base64 32
```

**On Windows PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))
```

**Example output:**
```
xK9mP2jL5qR8vN3wB7cF6dH4tJ1sY9uG2oE5iA8kM3nP7rL2qW9sT4vX6yZ1bC
```

### Step 2: Set Environment Variables on Vercel

1. Go to https://vercel.com/account/projects
2. Click on **My-Ticketmaster-admin** project
3. Click **Settings**
4. Scroll to **Environment Variables**
5. Add the following:
   - **Name:** `GITHUB_TOKEN`, **Value:** `[your-github-token]`
   - **Name:** `GITHUB_BRANCH`, **Value:** `main`
   - **Name:** `SUBMISSIONS_API_KEY`, **Value:** `[your-secure-key]`
6. Click **Save**
7. Click **Deployments** → Select latest → **Redeploy**

---

## 🔐 What This Protects

- **Blocks Rahman admin panel** from accessing submissions via API
- **Requires valid API key** for all submissions
- **Validates request origin** to ensure only your customer portal can submit
- **Restricts HTTP methods** to POST only (no GET, DELETE, etc.)

---

## 📋 API Endpoints

### GET /api/config
**Purpose:** Returns configuration (including API key) to customer portal
**Auth:** Not required (API key is public to authenticated customers)
**Response:**
```json
{
  "githubToken": "hidden",
  "githubRepo": "Cryptovaultiq/My-Ticketmaster-admin",
  "githubBranch": "main",
  "submissionsApiKey": "xK9mP2jL5qR8vN3wB7cF6dH4tJ1sY9uG2oE5iA8kM3nP7rL2qW9sT4vX6yZ1bC"
}
```

### POST /api/submissions
**Purpose:** Accept ticket purchase submissions
**Auth Required:** `X-API-Key` header with valid key
**Allowed Origin:** `https://admin-tmaster.vercel.app`
**Request:**
```bash
curl -X POST https://admin-tmaster.vercel.app/api/submissions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: [SUBMISSIONS_API_KEY]" \
  -d '{
    "email": "buyer@example.com",
    "eventTitle": "Concert Event",
    "quantity": 2,
    "totalPayment": "100.00"
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Submission saved",
  "submission": {
    "id": 1234567890,
    "email": "buyer@example.com",
    "eventTitle": "Concert Event",
    "timestamp": "2026-05-18T10:30:00.000Z",
    "date": "5/18/2026, 10:30:00 AM"
  }
}
```

**Response (Unauthorized):**
```json
{
  "error": "Unauthorized: Invalid API key"
}
```

---

## 🛡️ Security Features

| Feature | Purpose | Implementation |
|---------|---------|-----------------|
| API Key Authentication | Ensure only authorized client can submit | `X-API-Key` header validation |
| CORS Restrictions | Block cross-origin requests from Rahman | Origin/Referer header check |
| Method Validation | Prevent data exfiltration via GET/DELETE | Only POST allowed |
| Origin Validation | Verify request comes from customer portal | Whitelist check |
| Environment Variable | Keep secret key out of code | `process.env.SUBMISSIONS_API_KEY` |

---

## ✅ Verify It's Working

After deployment, test the security:

### Test 1: Valid Request ✅
```bash
curl -X POST https://admin-tmaster.vercel.app/api/submissions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"email":"test@test.com","eventTitle":"Test"}'
# Expected: 200 OK with submission details
```

### Test 2: Missing API Key ❌
```bash
curl -X POST https://admin-tmaster.vercel.app/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","eventTitle":"Test"}'
# Expected: 401 Unauthorized
```

### Test 3: Wrong Origin ❌
```bash
# From browser at different domain
fetch('https://admin-tmaster.vercel.app/api/submissions', {
  method: 'POST',
  headers: {'X-API-Key': 'valid_key'},
  body: JSON.stringify({...})
})
// If origin is not whitelisted: 403 Forbidden
```

---

## 📊 Security Logging

The admin API logs all security events:

- ✅ Successful submissions
- 🚫 Blocked requests (wrong origin, missing key, wrong method)
- ⚠️ Configuration issues (missing env vars)

Check Vercel logs: https://vercel.com/account/projects → My-Ticketmaster-admin → Monitoring → Logs

---

## 🔄 Important Notes

1. **Do NOT commit API key to GitHub** - Use Vercel environment variables only
2. **Rotate API key periodically** - Update on Vercel and redeploy
3. **Share API key only with customer portal** - It's sent to `/api/config`
4. **Monitor Vercel logs** for unauthorized access attempts
5. **If Rahman panel tries to access:** You'll see `🚫 BLOCKED` logs

---

## 📞 Support

If submissions aren't saving:
1. Check Vercel environment variables are set
2. Check admin logs for security errors
3. Verify `SUBMISSIONS_API_KEY` matches what customer portal received
4. Redeploy admin panel to pick up new environment variables

---

**Last Updated:** May 18, 2026
