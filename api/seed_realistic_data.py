import asyncio
import os
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import models

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://formula:formula_password@db:5432/formula_db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed_realistic():
    async with AsyncSessionLocal() as db:
        print("--- Iniciando Seeding Realista (3 Meses de Histórico) ---")

        # 1. Obter usuários e atividades que permitem timer
        res_u = await db.execute(select(models.Usuario).where(models.Usuario.role == 'funcionario'))
        funcionarios = res_u.scalars().all()
        
        if not funcionarios:
            print("Erro: Nenhum funcionário encontrado. Execute o seed básico primeiro.")
            return

        # Pegar todas as atividades que não são 'Vigas-Rascunho' (pois estas não usam timer)
        res_a = await db.execute(
            select(models.Atividade)
            .where(models.Atividade.subtipo != 'Rascunho')
        )
        atividades_disponiveis = res_a.scalars().all()
        
        if not atividades_disponiveis:
            print("Erro: Nenhuma atividade elegível encontrada.")
            return

        agora = datetime.now(timezone.utc)
        data_inicio = agora - timedelta(days=90)
        
        print(f"Gerando dados de {data_inicio.date()} até hoje...")

        sessoes_criadas = 0
        
        # Para cada dia nos últimos 90 dias
        for i in range(91):
            data_atual = data_inicio + timedelta(days=i)
            
            # Pular domingos (opcional, mas realista)
            if data_atual.weekday() == 6:
                continue
                
            # Para cada funcionário
            for func in funcionarios:
                # Simular se o funcionário trabalhou no dia (90% de chance)
                if random.random() > 0.9:
                    continue
                
                # Definir quantas sessões no dia (1 ou 2)
                num_sessoes_dia = random.randint(1, 2)
                
                for s in range(num_sessoes_dia):
                    # Escolher uma atividade aleatória para este funcionário
                    ativ = random.choice(atividades_disponiveis)
                    
                    # Definir horário de início (Manhã: 08-09h, Tarde: 13-14h)
                    hora_base = 8 if s == 0 else 13
                    inicio = data_atual.replace(hour=hora_base, minute=random.randint(0, 59), second=0, microsecond=0)
                    
                    # Se for hoje e o horário de início ainda não chegou, pular
                    if inicio > agora:
                        continue
                        
                    # Duração realista (1.5h a 4h)
                    duracao_segundos = random.randint(5400, 14400)
                    fim = inicio + timedelta(seconds=duracao_segundos)
                    
                    # Se o fim for no futuro, tornar uma sessão ativa (se for hoje) ou ajustar
                    is_ativa = False
                    if fim > agora:
                        if data_atual.date() == agora.date():
                            is_ativa = True
                            fim = None
                            duracao_segundos = None
                        else:
                            # Ajustar para não ultrapassar o "agora" em dias passados (teoricamente impossível mas preventivo)
                            fim = agora - timedelta(minutes=5)
                            duracao_segundos = int((fim - inicio).total_seconds())

                    # Criar a sessão
                    nova_sessao = models.SessaoTrabalho(
                        atividade_id=ativ.id,
                        usuario_id=func.id,
                        iniciado_em=inicio,
                        finalizado_em=fim,
                        duracao_segundos=duracao_segundos
                    )
                    db.add(nova_sessao)
                    sessoes_criadas += 1
                    
                    # Atualizar status da atividade de forma simplificada para o seed
                    # (Em um sistema real isso seria mais complexo, aqui apenas marcamos como 'Ok'
                    # se o funcionário trabalhou nela mais de uma vez ou aleatoriamente)
                    if fim and random.random() > 0.7:
                        ativ.status_atual = 'Ok'
                        ativ.usuario_responsavel_id = func.id
                        # Registrar histórico
                        db.add(models.StatusHistorico(
                            atividade_id=ativ.id,
                            usuario_id=func.id,
                            status_anterior='Fazendo',
                            status_novo='Ok',
                            timestamp=fim
                        ))

            # Commit parcial para não sobrecarregar a memória
            if i % 10 == 0:
                await db.commit()
                print(f"Processado até {data_atual.date()}...")

        await db.commit()
        print(f"--- Seeding concluído! {sessoes_criadas} sessões geradas. ---")

if __name__ == "__main__":
    asyncio.run(seed_realistic())
