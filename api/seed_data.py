import asyncio
import os
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
import models
from services.geracao_lajes import criar_estrutura_edificio

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://formula:formula_password@db:5432/formula_db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed():
    async with AsyncSessionLocal() as db:
        print("--- Iniciando Seeding de Dados de Teste ---")

        # 1. Criar Usuários
        print("Criando usuários...")
        usuarios_data = [
            {"nome": "Alice Admin", "role": "admin"},
            {"nome": "Bob Construtor", "role": "funcionario"},
            {"nome": "Charlie Engenheiro", "role": "funcionario"},
            {"nome": "David Calculista", "role": "funcionario"},
        ]
        usuarios = []
        for u_data in usuarios_data:
            # Verifica se já existe para evitar duplicatas
            res = await db.execute(select(models.Usuario).where(models.Usuario.nome == u_data["nome"]))
            u = res.scalar_one_or_none()
            if not u:
                u = models.Usuario(**u_data)
                db.add(u)
                await db.flush()
            usuarios.append(u)

        # 2. Criar Construtoras
        print("Criando construtoras...")
        construtoras_data = ["Fórmula Alpha", "Beta Incorporações"]
        construtoras = []
        for c_nome in construtoras_data:
            res = await db.execute(select(models.Construtora).where(models.Construtora.nome == c_nome))
            c = res.scalar_one_or_none()
            if not c:
                c = models.Construtora(nome=c_nome)
                db.add(c)
                await db.flush()
            construtoras.append(c)

        # 3. Criar Edifícios
        print("Criando edifícios e gerando estruturas...")
        edificios_data = [
            {"nome": "Ed. Sol Nascente", "num": 5, "const": construtoras[0].id},
            {"nome": "Residencial Horizonte", "num": 3, "const": construtoras[1].id},
        ]
        edificios = []
        for e_data in edificios_data:
            res = await db.execute(select(models.Edificio).where(models.Edificio.nome == e_data["nome"]))
            ed = res.scalar_one_or_none()
            if not ed:
                ed = models.Edificio(nome=e_data["nome"], construtora_id=e_data["const"])
                db.add(ed)
                await db.flush()
                await criar_estrutura_edificio(ed.id, e_data["num"], db)
            edificios.append(ed)

        # 4. Criar Sessões Finalizadas (Horas Trabalhadas)
        print("Gerando histórico de trabalho...")
        # Pegar algumas atividades de 'Vigas - Formato' (que permitem timer)
        res = await db.execute(
            select(models.Atividade)
            .where(models.Atividade.tipo_elemento == 'Vigas', models.Atividade.subtipo == 'Formato')
            .limit(10)
        )
        atividades = res.scalars().all()
        
        agora = datetime.now(timezone.utc)
        
        # Bob trabalhou ontem
        if len(atividades) > 0:
            ativ = atividades[0]
            sessao = models.SessaoTrabalho(
                atividade_id=ativ.id,
                usuario_id=usuarios[1].id, # Bob
                iniciado_em=agora - timedelta(days=1, hours=4),
                finalizado_em=agora - timedelta(days=1, hours=2),
                duracao_segundos=7200
            )
            db.add(sessao)
            # Atualizar status e histórico
            ativ.status_atual = 'Ok'
            ativ.usuario_responsavel_id = usuarios[1].id
            db.add(models.StatusHistorico(
                atividade_id=ativ.id, usuario_id=usuarios[1].id,
                status_anterior='Fazendo', status_novo='Ok', timestamp=sessao.finalizado_em
            ))

        # Charlie trabalhou hoje cedo
        if len(atividades) > 1:
            ativ = atividades[1]
            sessao = models.SessaoTrabalho(
                atividade_id=ativ.id,
                usuario_id=usuarios[2].id, # Charlie
                iniciado_em=agora - timedelta(hours=5),
                finalizado_em=agora - timedelta(hours=2),
                duracao_segundos=10800
            )
            db.add(sessao)
            ativ.status_atual = 'Ok'
            ativ.usuario_responsavel_id = usuarios[2].id
            db.add(models.StatusHistorico(
                atividade_id=ativ.id, usuario_id=usuarios[2].id,
                status_anterior='Fazendo', status_novo='Ok', timestamp=sessao.finalizado_em
            ))

        # 5. Criar Sessões Ativas (Uma por usuário)
        print("Iniciando sessões ativas...")
        # Bob em uma nova atividade
        if len(atividades) > 2:
            ativ = atividades[2]
            sessao = models.SessaoTrabalho(
                atividade_id=ativ.id,
                usuario_id=usuarios[1].id,
                iniciado_em=agora - timedelta(minutes=45)
            )
            db.add(sessao)
            ativ.status_atual = 'Fazendo'
            ativ.usuario_responsavel_id = usuarios[1].id

        # Charlie em outra
        if len(atividades) > 3:
            ativ = atividades[3]
            sessao = models.SessaoTrabalho(
                atividade_id=ativ.id,
                usuario_id=usuarios[2].id,
                iniciado_em=agora - timedelta(minutes=15)
            )
            db.add(sessao)
            ativ.status_atual = 'Fazendo'
            ativ.usuario_responsavel_id = usuarios[2].id

        await db.commit()
        print("--- Seeding concluído com sucesso! ---")

if __name__ == "__main__":
    asyncio.run(seed())
