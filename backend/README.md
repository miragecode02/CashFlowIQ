# 💸 Cash Flow IQ — Full-Stack Personal Finance App

AI-powered personal finance app for Indian users. Built with React + FastAPI + PostgreSQL + Gemini.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│  React + TypeScript + Vite + Tailwind + shadcn/ui   │
│  Framer Motion · Recharts · React Query · Axios     │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (JWT auth)
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND                          │
│         FastAPI + SQLAlchemy (async)                │
│                                                     │
│  /auth       → JWT register/login                   │
│  /transactions → CRUD                               │
│  /budgets    → Monthly budget management            │
│  /analytics  → Pandas + Prophet + scikit-learn      │
│  /chat       → Gemini 1.5 Flash (context-aware)     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│               PostgreSQL 16                         │
│  users · transactions · categories                  │
│  budgets · chat_messages                            │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js 18+ and npm/bun
- Python 3.12+
- Docker + Docker Compose (recommended)
- Gemini API key → https://aistudio.google.com/app/apikey

---

### 1. Backend Setup

```bash
cd cashflow-backend

# Copy and fill in environment variables
cp .env.example .env
# → Set GEMINI_API_KEY and SECRET_KEY in .env

# Option A: Docker (recommended — starts API + PostgreSQL)
docker-compose up --build

# Option B: Manual
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Start PostgreSQL separately, then:
uvicorn app.main:app --reload --port 8000
```

API runs at: **http://localhost:8000**
Swagger docs: **http://localhost:8000/docs**

---

### 2. Frontend Setup

```bash
cd cash-flow-iq-main

# Copy env
cp .env.example .env
# → VITE_API_URL=http://localhost:8000/api/v1

npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account → returns JWT |
| POST | `/api/v1/auth/login` | Login → returns JWT |
| GET | `/api/v1/auth/me` | Get current user |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transactions` | List (filter by type/month/category) |
| POST | `/api/v1/transactions` | Create transaction |
| PATCH | `/api/v1/transactions/:id` | Update |
| DELETE | `/api/v1/transactions/:id` | Delete |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/summary` | Income, spending, savings rate, category breakdown |
| GET | `/api/v1/analytics/forecast` | Prophet cash flow forecast (next N days) |
| GET | `/api/v1/analytics/anomalies` | Unusual spending detection |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/budgets` | Get budgets with actual spending |
| POST | `/api/v1/budgets` | Create/update budget |

### AI Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat` | Send message → Gemini reply |
| GET | `/api/v1/chat/history` | Load conversation history |
| DELETE | `/api/v1/chat/history` | Clear history |

---

## 🧠 AI Features

### Gemini Financial Advisor
- Injected with real-time user financial context (income, spending, savings rate)
- Persistent conversation history stored in PostgreSQL
- Answers questions about affordability, budgeting, spending habits

### Analytics (Python ML)
- **Spending trends**: Pandas groupby aggregations, monthly/weekly breakdowns
- **Forecasting**: Prophet time-series model for 7–90 day cash flow prediction
- **Anomaly detection**: Z-score based flagging (>2 std deviations from category mean)

---

## 🐳 Deployment (Render / Railway)

### Backend
1. Push `cashflow-backend/` to GitHub
2. Create a new Web Service on Render/Railway
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.example`
6. Add a PostgreSQL database and set `DATABASE_URL`

### Frontend
1. Push `cash-flow-iq-main/` to GitHub
2. Deploy on Vercel/Netlify
3. Set `VITE_API_URL` to your backend URL
4. Update `ALLOWED_ORIGINS` in backend `.env`

---

## 📁 Project Structure

```
cashflow-backend/
├── app/
│   ├── main.py              # FastAPI app + CORS
│   ├── core/
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   ├── database.py      # Async SQLAlchemy engine
│   │   └── security.py      # JWT + password hashing
│   ├── models/
│   │   └── models.py        # SQLAlchemy ORM models
│   ├── schemas/
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── services/
│   │   ├── user_service.py
│   │   ├── transaction_service.py
│   │   ├── analytics_service.py  # Pandas + Prophet + sklearn
│   │   ├── budget_service.py
│   │   └── chat_service.py       # Gemini integration
│   └── api/v1/
│       └── endpoints/
│           ├── auth.py
│           ├── transactions.py
│           ├── analytics.py
│           ├── budgets.py
│           └── chat.py
├── Dockerfile
├── docker-compose.yml
└── requirements.txt

cash-flow-iq-main/
├── src/
│   ├── App.tsx              # Protected routes + AuthProvider
│   ├── contexts/
│   │   └── AuthContext.tsx  # Global auth state
│   ├── lib/
│   │   └── api.ts           # Axios client + all API calls
│   └── pages/
│       ├── Auth.tsx         # Login + Register
│       ├── Home.tsx         # Dashboard
│       ├── Analytics.tsx
│       ├── Advisor.tsx      # Live Gemini chat
│       ├── Planner.tsx
│       ├── FinancialHealth.tsx
│       └── Profile.tsx
└── .env.example
```

---

## 🔑 Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/cashflow_iq
SECRET_KEY=your-long-random-secret-key
GEMINI_API_KEY=your-gemini-api-key
ALLOWED_ORIGINS=["http://localhost:5173"]
DEBUG=false
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:8000/api/v1
```
