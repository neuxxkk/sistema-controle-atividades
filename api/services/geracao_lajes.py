from sqlalchemy.ext.asyncio import AsyncSession
import models
from services.workflow import status_inicial

def gerar_lajes_data(num_pavimentos: int) -> list[dict]:
    lajes = []
    ordem = 1

    lajes.append({"tipo": "Fundacao", "ordem": ordem}); ordem += 1

    for n in range(1, num_pavimentos + 1):
        lajes.append({"tipo": f"Laje_{n}", "ordem": ordem}); ordem += 1

    lajes.append({"tipo": "FundCX", "ordem": ordem}); ordem += 1
    lajes.append({"tipo": "TampaCX", "ordem": ordem})

    return lajes

ATIVIDADES_POR_LAJE = [
    {"tipo_elemento": "Vigas", "subtipo": "Rascunho"},
    {"tipo_elemento": "Vigas", "subtipo": "Formato"},
    {"tipo_elemento": "Lajes", "subtipo": "Rascunho"},
    {"tipo_elemento": "Lajes", "subtipo": "Formato"},
]

ATIVIDADES_GERAIS_EDIFICIO = [
    {"tipo_elemento": "GrelhaRefinada", "subtipo": None},
    {"tipo_elemento": "Cortinas",       "subtipo": None},
    {"tipo_elemento": "Rampa",          "subtipo": None},
    {"tipo_elemento": "Escada",         "subtipo": None},
    {"tipo_elemento": "BlocosFundacao", "subtipo": None},
]

async def criar_estrutura_edificio(edificio_id: int, num_pavimentos: int, db: AsyncSession):
    lajes_data = gerar_lajes_data(num_pavimentos)
    lajes_criadas: list[models.Laje] = []
    
    for l_data in lajes_data:
        nova_laje = models.Laje(
            edificio_id=edificio_id,
            tipo=l_data["tipo"],
            ordem=l_data["ordem"]
        )
        db.add(nova_laje)
        await db.flush() # Para obter o ID da laje
        lajes_criadas.append(nova_laje)
        
        # Vigas e Lajes existem em cada laje, com subtipos Rascunho/Formato.
        for ativ in ATIVIDADES_POR_LAJE:
            nova_ativ = models.Atividade(
                laje_id=nova_laje.id,
                tipo_elemento=ativ["tipo_elemento"],
                subtipo=ativ["subtipo"],
                status_atual=status_inicial(ativ["tipo_elemento"], ativ["subtipo"])
            )
            db.add(nova_ativ)

    # Atividades gerais existem uma vez por edifício (referenciadas na laje Fundação).
    laje_referencia = next((l for l in lajes_criadas if l.tipo == "Fundacao"), lajes_criadas[0] if lajes_criadas else None)
    if laje_referencia:
        for ativ in ATIVIDADES_GERAIS_EDIFICIO:
            nova_ativ = models.Atividade(
                laje_id=laje_referencia.id,
                tipo_elemento=ativ["tipo_elemento"],
                subtipo=ativ["subtipo"],
                status_atual=status_inicial(ativ["tipo_elemento"], ativ["subtipo"])
            )
            db.add(nova_ativ)
    
    # O commit será feito pelo router que chama este serviço
