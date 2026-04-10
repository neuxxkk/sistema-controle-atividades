"""
Seed de dados reais: Construtoras Arte e Simetria + Capanema,
5 edifícios, e histórico completo de sessões desde 2020.
"""
import asyncio
import os
import random
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import models
from services.geracao_lajes import criar_estrutura_edificio

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://formula:formula_password@db:5432/formula_db",
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ── Configuração dos edifícios ─────────────────────────────────────────────

CONSTRUTORAS = [
    "Arte e Simetria",
    "Capanema",
]

EDIFICIOS = [
    # inicio      = primeiro dia útil de trabalho no prédio
    # pct_ok      = fração das atividades que já estão Finalizadas  (0.0–1.0)
    # pct_andando = fração das atividades em andamento/pausadas
    # restante    = Pendente (sem sessões)
    {
        "nome": "Mahan - Administração",
        "construtora": "Arte e Simetria",
        "pavimentos": 8,
        "inicio": date(2020, 1, 2),
        "pct_ok": 1.0,       # concluído — obra encerrada
        "pct_andando": 0.0,
    },
    {
        "nome": "Mahan Beach Club",
        "construtora": "Arte e Simetria",
        "pavimentos": 12,
        "inicio": date(2021, 3, 1),
        "pct_ok": 0.65,      # maioria concluída, ainda com tarefas abertas
        "pct_andando": 0.20,
    },
    {
        "nome": "Joaquim Linhares",
        "construtora": "Capanema",
        "pavimentos": 6,
        "inicio": date(2022, 6, 1),
        "pct_ok": 1.0,       # concluído
        "pct_andando": 0.0,
    },
    {
        "nome": "Costa Rica",
        "construtora": "Capanema",
        "pavimentos": 10,
        "inicio": date(2023, 9, 4),
        "pct_ok": 0.40,      # obra em andamento avançado
        "pct_andando": 0.30,
    },
    {
        "nome": "Rua Gonçalves Dias",
        "construtora": "Capanema",
        "pavimentos": 5,
        "inicio": date(2025, 2, 3),
        "pct_ok": 0.0,       # obra recém iniciada — tudo pendente ou em andamento
        "pct_andando": 0.35,
    },
]

# Dias úteis = seg–sex
INICIO_HISTORICO = date(2020, 1, 2)


def _is_workday(d: date) -> bool:
    return d.weekday() < 5  # seg=0 … sex=4


def _next_workday(d: date) -> date:
    d = d + timedelta(days=1)
    while not _is_workday(d):
        d = d + timedelta(days=1)
    return d


def _workdays_between(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        if _is_workday(cur):
            days.append(cur)
        cur += timedelta(days=1)
    return days


def _ts(d: date, hour: int, minute: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=timezone.utc)


def _sessions_for_activity(
    atividade: models.Atividade,
    funcionario_id: int,
    start_d: date,
    n_days: int,
) -> tuple[list[models.SessaoTrabalho], list[models.StatusHistorico], date]:
    """
    Gera sessões de trabalho para uma atividade.
    Retorna (sessões, históricos, próxima_data_disponível).

    Turnos: manhã 08h–12h + tarde 13h–17h (total 8h/dia).
    """
    sessoes: list[models.SessaoTrabalho] = []
    historicos: list[models.StatusHistorico] = []

    cur = start_d
    days_worked = 0

    while days_worked < n_days:
        if not _is_workday(cur):
            cur += timedelta(days=1)
            continue

        # Turno manhã (08:00–12:00)
        variacao_ini = random.randint(-10, 15)
        variacao_fim = random.randint(-10, 10)
        ini_manha = _ts(cur, 8) + timedelta(minutes=variacao_ini)
        fim_manha = _ts(cur, 12) + timedelta(minutes=variacao_fim)
        dur_manha = int((fim_manha - ini_manha).total_seconds())

        sessoes.append(models.SessaoTrabalho(
            atividade_id=atividade.id,
            usuario_id=funcionario_id,
            iniciado_em=ini_manha,
            finalizado_em=fim_manha,
            duracao_segundos=dur_manha,
        ))

        # Turno tarde (13:00–17:00)
        ini_tarde = _ts(cur, 13) + timedelta(minutes=random.randint(0, 15))
        fim_tarde = _ts(cur, 17) + timedelta(minutes=random.randint(-10, 10))
        dur_tarde = int((fim_tarde - ini_tarde).total_seconds())

        sessoes.append(models.SessaoTrabalho(
            atividade_id=atividade.id,
            usuario_id=funcionario_id,
            iniciado_em=ini_tarde,
            finalizado_em=fim_tarde,
            duracao_segundos=dur_tarde,
        ))

        cur += timedelta(days=1)
        days_worked += 1

    return sessoes, historicos, cur


async def seed_mock_real():
    async with AsyncSessionLocal() as db:
        print("=== Seed: Arte e Simetria + Capanema ===")

        # ── 1. Construtoras ────────────────────────────────────────────────
        print("Criando construtoras...")
        construtoras_map: dict[str, models.Construtora] = {}
        for nome in CONSTRUTORAS:
            res = await db.execute(
                select(models.Construtora).where(models.Construtora.nome == nome)
            )
            c = res.scalar_one_or_none()
            if not c:
                c = models.Construtora(nome=nome)
                db.add(c)
                await db.flush()
                print(f"  + Construtora: {nome}")
            else:
                print(f"  ~ Construtora já existe: {nome}")
            construtoras_map[nome] = c

        # ── 2. Edifícios ───────────────────────────────────────────────────
        print("Criando edifícios e estruturas...")
        edificios_ids: list[int] = []
        for ed_cfg in EDIFICIOS:
            res = await db.execute(
                select(models.Edificio).where(models.Edificio.nome == ed_cfg["nome"])
            )
            ed = res.scalar_one_or_none()
            if not ed:
                c = construtoras_map[ed_cfg["construtora"]]
                ed = models.Edificio(nome=ed_cfg["nome"], construtora_id=c.id)
                db.add(ed)
                await db.flush()
                await criar_estrutura_edificio(ed.id, ed_cfg["pavimentos"], db)
                await db.flush()
                print(f"  + Edifício: {ed_cfg['nome']} ({ed_cfg['pavimentos']} pav.)")
            else:
                print(f"  ~ Edifício já existe: {ed_cfg['nome']}")
            edificios_ids.append(ed.id)

        await db.commit()

        # ── 3. Carregar funcionários ───────────────────────────────────────
        print("Carregando funcionários...")
        res_u = await db.execute(
            select(models.Usuario).where(models.Usuario.role == "funcionario", models.Usuario.ativo == True)
        )
        funcionarios = res_u.scalars().all()
        if not funcionarios:
            print("ERRO: Nenhum funcionário encontrado. Execute o seed básico primeiro.")
            return

        func_ids = [f.id for f in funcionarios]
        print(f"  {len(func_ids)} funcionário(s): {[f.nome for f in funcionarios]}")

        # ── 4. Processar cada edifício conforme sua configuração ───────────
        DIAS_POR_TIPO = {
            "Vigas":          10,
            "Lajes":          10,
            "GrelhaRefinada": 5,
            "Cortinas":       5,
            "Rampa":          5,
            "Escada":         5,
            "BlocosFundacao": 6,
        }

        today = date.today()
        agora = datetime.now(timezone.utc)
        total_sessoes = 0
        total_atividades_processadas = 0
        # Controla qual funcionário terá sessão aberta (apenas 1 por vez no sistema)
        sessao_aberta_usada = False

        for ed_cfg, ed_id in zip(EDIFICIOS, edificios_ids):
            nome_ed = ed_cfg["nome"]
            inicio_ed: date = ed_cfg["inicio"]
            pct_ok: float = ed_cfg["pct_ok"]
            pct_andando: float = ed_cfg["pct_andando"]
            # pct_pendente = 1.0 - pct_ok - pct_andando (restante)

            print(f"\nProcessando: {nome_ed} (início {inicio_ed}, {pct_ok*100:.0f}% concluído)...")

            # Carregar atividades do edifício ordenadas por laje
            res_l = await db.execute(
                select(models.Laje)
                .where(models.Laje.edificio_id == ed_id)
                .order_by(models.Laje.ordem)
            )
            lajes_ed = res_l.scalars().all()
            laje_ids_ed = [l.id for l in lajes_ed]

            res_a = await db.execute(
                select(models.Atividade)
                .where(models.Atividade.laje_id.in_(laje_ids_ed))
                .order_by(models.Atividade.laje_id, models.Atividade.id)
            )
            atividades_ed: list[models.Atividade] = res_a.scalars().all()

            n_total = len(atividades_ed)
            if n_total == 0:
                continue

            # Dividir em blocos segundo as frações configuradas
            n_ok      = round(n_total * pct_ok)
            n_andando = round(n_total * pct_andando)
            # n_pendente = n_total - n_ok - n_andando (restante sem sessões)

            # Espalhar as atividades concluídas ao longo do período
            # do início do edifício até recentemente
            cur_date = inicio_ed if _is_workday(inicio_ed) else _next_workday(inicio_ed)

            for idx, ativ in enumerate(atividades_ed):
                func_id = func_ids[idx % len(func_ids)]
                n_days = DIAS_POR_TIPO.get(ativ.tipo_elemento, 6)

                if idx < n_ok:
                    # ── FINALIZADA ────────────────────────────────────────
                    sessoes, _, _ = _sessions_for_activity(ativ, func_id, cur_date, n_days)

                    # Garantir que todas as sessões têm fim (não podem ser abertas)
                    for s in sessoes:
                        if s.finalizado_em is None or s.finalizado_em > agora:
                            s.finalizado_em = agora - timedelta(days=random.randint(15, 30))
                            s.duracao_segundos = int((s.finalizado_em - s.iniciado_em).total_seconds())
                        db.add(s)
                    total_sessoes += len(sessoes)

                    ts_fim = sessoes[-1].finalizado_em if sessoes else agora - timedelta(days=30)
                    ativ.etapa_atual = ativ.etapa_total
                    ativ.status_ciclo = "Finalizada"
                    ativ.status_atual = "Ok"
                    ativ.usuario_responsavel_id = func_id
                    db.add(models.StatusHistorico(
                        atividade_id=ativ.id,
                        usuario_id=func_id,
                        acao="finalizar",
                        status_anterior="Em andamento",
                        status_novo="Finalizada",
                        etapa_anterior=ativ.etapa_total,
                        etapa_nova=ativ.etapa_total,
                        timestamp=ts_fim,
                    ))
                    # Avançar data de início para a próxima atividade
                    next_d = cur_date + timedelta(days=n_days + 1)
                    cur_date = next_d if _is_workday(next_d) else _next_workday(next_d)

                elif idx < n_ok + n_andando:
                    # ── EM ANDAMENTO ou PAUSADA ───────────────────────────
                    # Usar data recente para as sessões (últimos 30 dias)
                    dias_atras = random.randint(1, 25)
                    start_recente = today - timedelta(days=dias_atras)
                    if not _is_workday(start_recente):
                        start_recente = _next_workday(start_recente - timedelta(days=3))

                    n_days_parcial = random.randint(2, max(2, min(n_days, dias_atras)))
                    sessoes, _, _ = _sessions_for_activity(ativ, func_id, start_recente, n_days_parcial)

                    # Filtrar sessões futuras e opcionalmente deixar uma aberta
                    sessoes_validas = []
                    abriu = False
                    for s in sessoes:
                        if s.iniciado_em > agora:
                            break
                        if s.finalizado_em and s.finalizado_em > agora:
                            if not sessao_aberta_usada and not abriu:
                                s.finalizado_em = None
                                s.duracao_segundos = None
                                abriu = True
                                sessao_aberta_usada = True
                            else:
                                s.finalizado_em = agora - timedelta(minutes=random.randint(5, 60))
                                s.duracao_segundos = int((s.finalizado_em - s.iniciado_em).total_seconds())
                        sessoes_validas.append(s)

                    for s in sessoes_validas:
                        db.add(s)
                    total_sessoes += len(sessoes_validas)

                    etapa_parcial = min(
                        random.randint(1, max(1, ativ.etapa_total - 1)),
                        ativ.etapa_total,
                    )
                    ativ.etapa_atual = etapa_parcial
                    ativ.usuario_responsavel_id = func_id

                    if abriu:
                        ativ.status_ciclo = "Em andamento"
                        ativ.status_atual = "Fazendo"
                    else:
                        ativ.status_ciclo = "Pausada"
                        ativ.status_atual = "Pausado"
                        ts_pausa = sessoes_validas[-1].finalizado_em if sessoes_validas else agora - timedelta(hours=2)
                        db.add(models.StatusHistorico(
                            atividade_id=ativ.id,
                            usuario_id=func_id,
                            acao="pausar",
                            status_anterior="Em andamento",
                            status_novo="Pausada",
                            etapa_anterior=etapa_parcial,
                            etapa_nova=etapa_parcial,
                            timestamp=ts_pausa,
                        ))

                # else: Pendente — sem sessões, status padrão já é Pendente

                total_atividades_processadas += 1

            await db.commit()
            print(f"  → {n_ok} finalizadas | {n_andando} em andamento/pausadas | {n_total - n_ok - n_andando} pendentes")

        print(f"\n=== Seed concluído! ===")
        print(f"  Sessões geradas    : {total_sessoes}")
        print(f"  Atividades tocadas : {total_atividades_processadas}")
        print(f"  Período histórico  : {INICIO_HISTORICO} → {today}")


if __name__ == "__main__":
    asyncio.run(seed_mock_real())
