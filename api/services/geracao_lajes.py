from sqlalchemy.ext.asyncio import AsyncSession
import models

def gerar_lajes_data(num_pavimentos: int) -> list[dict]:
    lajes = []
    ordem = 1
    lajes.append({"tipo": "Fundacao", "ordem": ordem}); ordem += 1
    for n in range(1, num_pavimentos + 1):
        lajes.append({"tipo": f"Laje_{n}", "ordem": ordem}); ordem += 1
    lajes.append({"tipo": "FundCX",  "ordem": ordem}); ordem += 1
    lajes.append({"tipo": "TampaCX", "ordem": ordem})
    return lajes


# Novo modelo: Vigas e Lajes como tarefa única com 3 etapas
ATIVIDADES_POR_LAJE = [
    {"tipo_elemento": "Vigas", "subtipo": None, "etapa_total": 3},
    {"tipo_elemento": "Lajes", "subtipo": None, "etapa_total": 3},
]

# Tarefas únicas por edifício (etapa única)
ATIVIDADES_GERAIS_EDIFICIO = [
    {"tipo_elemento": "GrelhaRefinada", "subtipo": None, "etapa_total": 1},
    {"tipo_elemento": "Cortinas",       "subtipo": None, "etapa_total": 1},
    {"tipo_elemento": "Rampa",          "subtipo": None, "etapa_total": 1},
    {"tipo_elemento": "Escada",         "subtipo": None, "etapa_total": 1},
    {"tipo_elemento": "BlocosFundacao", "subtipo": None, "etapa_total": 1},
]


async def criar_estrutura_edificio(edificio_id: int, num_pavimentos: int, db: AsyncSession):
    lajes_data = gerar_lajes_data(num_pavimentos)
    lajes_criadas: list[models.Laje] = []

    for l_data in lajes_data:
        nova_laje = models.Laje(
            edificio_id=edificio_id,
            tipo=l_data["tipo"],
            ordem=l_data["ordem"],
        )
        db.add(nova_laje)
        await db.flush()
        lajes_criadas.append(nova_laje)

        for ativ in ATIVIDADES_POR_LAJE:
            db.add(models.Atividade(
                laje_id=nova_laje.id,
                tipo_elemento=ativ["tipo_elemento"],
                subtipo=ativ["subtipo"],
                status_atual="Pendente",
                status_ciclo="Pendente",
                etapa_atual=1,
                etapa_total=ativ["etapa_total"],
            ))

    # Tarefas gerais do edifício: ancoradas na laje Fundacao
    laje_ref = next((l for l in lajes_criadas if l.tipo == "Fundacao"), lajes_criadas[0] if lajes_criadas else None)
    if laje_ref:
        for ativ in ATIVIDADES_GERAIS_EDIFICIO:
            db.add(models.Atividade(
                laje_id=laje_ref.id,
                tipo_elemento=ativ["tipo_elemento"],
                subtipo=ativ["subtipo"],
                status_atual="Pendente",
                status_ciclo="Pendente",
                etapa_atual=1,
                etapa_total=ativ["etapa_total"],
            ))
