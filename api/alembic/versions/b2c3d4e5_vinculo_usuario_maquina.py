"""vinculo usuario x maquina

Revision ID: b2c3d4e5
Revises: a1b2c3d4
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5"
down_revision = "a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vinculos_maquina",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome_dispositivo", sa.String(length=120), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=False),
        sa.Column("windows_username", sa.String(length=120), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("usuario_id", name="uq_vinculos_maquina_usuario_id"),
    )
    op.create_index("ix_vinculos_maquina_id", "vinculos_maquina", ["id"])
    op.create_index("ix_vinculos_maquina_usuario_id", "vinculos_maquina", ["usuario_id"])
    op.create_index("ix_vinculos_maquina_ip", "vinculos_maquina", ["ip"])

    op.create_table(
        "vinculos_maquina_historico",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("acao", sa.String(length=40), nullable=False),
        sa.Column("nome_dispositivo_antes", sa.String(length=120), nullable=True),
        sa.Column("ip_antes", sa.String(length=45), nullable=True),
        sa.Column("windows_username_antes", sa.String(length=120), nullable=True),
        sa.Column("nome_dispositivo_depois", sa.String(length=120), nullable=False),
        sa.Column("ip_depois", sa.String(length=45), nullable=False),
        sa.Column("windows_username_depois", sa.String(length=120), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_vinculos_maquina_historico_id", "vinculos_maquina_historico", ["id"])
    op.create_index("ix_vinculos_maquina_historico_usuario_id", "vinculos_maquina_historico", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_vinculos_maquina_historico_usuario_id", table_name="vinculos_maquina_historico")
    op.drop_index("ix_vinculos_maquina_historico_id", table_name="vinculos_maquina_historico")
    op.drop_table("vinculos_maquina_historico")

    op.drop_index("ix_vinculos_maquina_ip", table_name="vinculos_maquina")
    op.drop_index("ix_vinculos_maquina_usuario_id", table_name="vinculos_maquina")
    op.drop_index("ix_vinculos_maquina_id", table_name="vinculos_maquina")
    op.drop_table("vinculos_maquina")
