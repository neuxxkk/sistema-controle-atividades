from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class VinculoMaquinaHistorico(Base):
    __tablename__ = "vinculos_maquina_historico"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    acao = Column(String(40), nullable=False)

    nome_dispositivo_antes = Column(String(120), nullable=True)
    ip_antes = Column(String(45), nullable=True)
    windows_username_antes = Column(String(120), nullable=True)

    nome_dispositivo_depois = Column(String(120), nullable=False)
    ip_depois = Column(String(45), nullable=False)
    windows_username_depois = Column(String(120), nullable=False)

    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", foreign_keys=[usuario_id], back_populates="historicos_vinculo_maquina")
    admin = relationship("Usuario", foreign_keys=[admin_id])
