import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# Database URL using asyncpg
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://formula:formula_password@db:5432/formula_db"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
