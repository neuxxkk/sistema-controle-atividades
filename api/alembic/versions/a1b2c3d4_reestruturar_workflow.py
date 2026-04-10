"""reestruturar workflow: adicionar status_ciclo, etapa_atual, etapa_total

Revision ID: a1b2c3d4
Revises:
Create Date: 2026-04-08

Mapeia dados legados para o novo modelo ação-orientado:
  - status_atual (Fazendo/Pausado/etc.) → status_ciclo (Em andamento/Pausada/etc.)
  - Adiciona etapa_atual e etapa_total por tipo_elemento
  - Expande status_historico com acao, etapa_anterior, etapa_nova
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── atividades: novas colunas ──────────────────────────────────────────
    op.add_column('atividades', sa.Column('status_ciclo', sa.String(30), nullable=True))
    op.add_column('atividades', sa.Column('etapa_atual',  sa.Integer(), nullable=True, server_default='1'))
    op.add_column('atividades', sa.Column('etapa_total',  sa.Integer(), nullable=True, server_default='1'))

    # Mapear status_atual legado → status_ciclo canônico
    op.execute("""
        UPDATE atividades
        SET status_ciclo = CASE
            WHEN status_atual = 'Pendente' THEN 'Pendente'
            WHEN status_atual = 'Fazendo'  THEN 'Em andamento'
            WHEN status_atual = 'Pausado'  THEN 'Pausada'
            ELSE 'Finalizada'
        END
    """)

    # Atividades multi-etapa sem subtipo (novo modelo): etapa_total = 3
    op.execute("""
        UPDATE atividades
        SET etapa_total = 3
        WHERE tipo_elemento IN ('Vigas', 'Lajes') AND subtipo IS NULL
    """)

    # Atividades finalizadas: etapa_atual = etapa_total
    op.execute("""
        UPDATE atividades
        SET etapa_atual = etapa_total
        WHERE status_ciclo = 'Finalizada'
    """)

    # Tornar obrigatórias após popular
    op.alter_column('atividades', 'status_ciclo', nullable=False)
    op.alter_column('atividades', 'etapa_atual',  nullable=False)
    op.alter_column('atividades', 'etapa_total',  nullable=False)

    # ── status_historico: novas colunas ───────────────────────────────────
    op.add_column('status_historico', sa.Column('acao',           sa.String(30), nullable=True))
    op.add_column('status_historico', sa.Column('etapa_anterior', sa.Integer(),  nullable=True))
    op.add_column('status_historico', sa.Column('etapa_nova',     sa.Integer(),  nullable=True))


def downgrade() -> None:
    op.drop_column('atividades', 'status_ciclo')
    op.drop_column('atividades', 'etapa_atual')
    op.drop_column('atividades', 'etapa_total')
    op.drop_column('status_historico', 'acao')
    op.drop_column('status_historico', 'etapa_anterior')
    op.drop_column('status_historico', 'etapa_nova')
