from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class VinculoMaquina(Base):
    __tablename__ = "vinculos_maquina"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nome_dispositivo = Column(String(120), nullable=False)
    ip = Column(String(45), nullable=False)
    windows_username = Column(String(120), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    usuario = relationship("Usuario", back_populates="vinculo_maquina")

    __table_args__ = (
        UniqueConstraint("usuario_id", name="uq_vinculos_maquina_usuario_id"),
    )
