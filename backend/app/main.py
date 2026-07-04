from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.v1 import router as api_router
from app.core.config import settings
from app.core.database import init_db

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "message": "CashFlowIQ Backend is running 🚀"
    }
    
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Cash Flow IQ API",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://192.168.1.4:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Cash Flow IQ"}