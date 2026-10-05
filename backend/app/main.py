import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.api.v1 import router as api_router
from app.core.config import settings
from app.core.database import init_db

logger = logging.getLogger("cashflowiq.main")


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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # FastAPI routes a catch-all Exception handler to ServerErrorMiddleware,
    # which Starlette always places OUTSIDE user middleware (including
    # CORSMiddleware) so it can catch errors raised inside middleware too.
    # That means CORSMiddleware never touches this response, so the browser
    # can't read it and reports a generic network failure instead of the
    # real error. Add the header here directly instead of relying on CORS.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "message": "CashFlowIQ Backend is running 🚀"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Cash Flow IQ"}