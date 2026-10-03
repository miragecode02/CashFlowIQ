import asyncio
import logging
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("cashflowiq.database")


def to_asyncpg(raw: str) -> tuple[str, dict]:
    """Accept any standard Postgres URL (Neon, Supabase, Render, Aiven...).

    Hosted providers hand out `postgres://` / `postgresql://` URLs with libpq
    options like `sslmode=require&channel_binding=require`. asyncpg needs the
    `postgresql+asyncpg://` scheme and rejects those options, so translate them
    into connect_args instead.
    """
    url = raw.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    url = urlunsplit(parts._replace(query=urlencode(query)))

    connect_args: dict = {"timeout": 10}
    host = parts.hostname or ""
    if sslmode in ("require", "verify-ca", "verify-full") or host.endswith(
        (".neon.tech", ".supabase.co", ".supabase.com", ".aivencloud.com")
    ):
        connect_args["ssl"] = "require"
    # PgBouncer-style poolers (Neon "-pooler", Supabase :6543) can't hold prepared statements
    if "-pooler" in host or parts.port == 6543:
        connect_args["statement_cache_size"] = 0
    return url, connect_args


DATABASE_URL, CONNECT_ARGS = to_asyncpg(settings.DATABASE_URL)
_safe = urlsplit(DATABASE_URL)
logger.info("Database host: %s (ssl=%s)", _safe.hostname, "ssl" in CONNECT_ARGS)  # never log the password

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args=CONNECT_ARGS,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Connect to the database on startup, retrying with backoff.

    Free-tier databases (Render/Neon/Supabase) can be paused/sleeping and
    take tens of seconds to wake up. Retry instead of hanging forever, and
    let the app boot even if the DB never comes up so /health still responds.
    """
    delays = [1, 2, 4, 8, 15, 15, 15, 15]  # ~75s total budget
    for attempt, delay in enumerate([0] + delays, start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database connected on attempt %d", attempt)
            return
        except Exception as exc:
            logger.warning("Database connection attempt %d failed: %s", attempt, exc)

    logger.error(
        "Could not connect to the database after %d attempts; "
        "starting app anyway, requests needing the DB will fail until it recovers",
        len(delays) + 1,
    )
