# 🔌 Cash Flow IQ — Lovable Frontend Integration Patch

Drop these files into your Lovable project to connect it to the FastAPI backend.

---

## Files in this patch

```
src/
  App.tsx                  ← REPLACE existing (adds auth routing)
  lib/
    api.ts                 ← NEW: Axios client + all API calls
  contexts/
    AuthContext.tsx         ← NEW: Global auth state (login/logout/user)
  pages/
    Auth.tsx               ← NEW: Login + Register page
    Advisor.tsx            ← REPLACE existing (connects to real Gemini API)
package.json               ← REPLACE existing (adds axios dependency)
.env.example               ← NEW: copy to .env and fill in backend URL
```

---

## Steps

### 1. Copy files into your Lovable project
Drag and drop (or copy-paste) each file into the matching path in your project.

### 2. Install new dependency
```bash
npm install
# or
bun install
```
This adds `axios` which `api.ts` uses.

### 3. Set environment variable
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_API_URL=http://localhost:8000/api/v1
```
→ When deployed, change to your Render/Railway backend URL.

### 4. Start the backend
```bash
cd cashflow-backend
cp .env.example .env      # add GEMINI_API_KEY
docker-compose up --build
```

### 5. Run frontend
```bash
npm run dev
```

---

## What changes after this patch

| Before | After |
|--------|-------|
| Static hardcoded data | Real data from PostgreSQL |
| No login/auth | JWT login + register page |
| Simulated AI responses | Real Gemini 1.5 Flash responses |
| No data persistence | All data saved in DB |
| `/advisor` uses setTimeout mock | Live streaming from your backend |

---

## How the connection works

```
Lovable Frontend (React)
  └── src/lib/api.ts          ← Axios, auto-attaches JWT token
        ├── authApi            → POST /auth/login, /auth/register
        ├── transactionsApi    → GET/POST/PATCH/DELETE /transactions
        ├── analyticsApi       → GET /analytics/summary, /forecast
        ├── budgetsApi         → GET/POST /budgets
        └── chatApi            → POST /chat (Gemini)
  └── src/contexts/AuthContext.tsx
        └── useAuth()          ← call anywhere: { user, login, logout }
```
