import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select
import models
from services.geracao_lajes import criar_estrutura_edificio

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://formula:troque_esta_senha@db:5432/formula_db")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def cleanup():
    async with AsyncSessionLocal() as db:
        print("Limpando tabelas transacionais e de estrutura...")
        
        # Deletar em ordem reversa de dependência
        await db.execute(text("TRUNCATE sessoes_trabalho CASCADE"))
        await db.execute(text("TRUNCATE status_historico CASCADE"))
        await db.execute(text("TRUNCATE atividades CASCADE"))
        await db.execute(text("TRUNCATE lajes CASCADE"))
        await db.execute(text("TRUNCATE edificios CASCADE"))
        await db.execute(text("TRUNCATE construtoras CASCADE"))
        
        # Opcional: Manter usuários, mas se quiser limpar também descomente abaixo:
        # await db.execute(text("TRUNCATE usuarios CASCADE"))
        
        print("Criando Construtora Teste...")
        construtora = models.Construtora(nome="Fórmula Engenharia (Teste)")
        db.add(construtora)
        await db.flush()
        
        print("Criando Edifício Teste...")
        edificio = models.Edificio(
            nome="Edifício Teste",
            descricao="Edifício para homologação do sistema",
            construtora_id=construtora.id
        )
        db.add(edificio)
        await db.flush()
        
        print("Gerando estrutura (lajes e atividades)...")
        await criar_estrutura_edificio(edificio.id, num_pavimentos=3, db=db)
        
        await db.commit()
        print("Limpeza e recriação concluídas com sucesso!")

if __name__ == "__main__":
    asyncio.run(cleanup())
