import asyncio
import logging

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("cashflowiq.database")

logger.info("DATABASE_URL = %s", settings.DATABASE_URL)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"timeout": 10},
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
