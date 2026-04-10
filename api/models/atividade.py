from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Atividade(Base):
    __tablename__ = "atividades"

    id = Column(Integer, primary_key=True, index=True)
    laje_id = Column(Integer, ForeignKey("lajes.id", ondelete="CASCADE"))
    tipo_elemento = Column(String(30), nullable=False)
    subtipo = Column(String(20))  # mantido para dados legados
    status_atual = Column(String(40), nullable=False)  # campo legado — use status_ciclo
    # Campos do novo modelo ação-orientado
    status_ciclo = Column(String(30), nullable=False, default='Pendente')
    etapa_atual = Column(Integer, nullable=False, default=1)
    etapa_total = Column(Integer, nullable=False, default=1)
    usuario_responsavel_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    laje = relationship("Laje", back_populates="atividades")
    usuario_responsavel = relationship("Usuario", back_populates="atividades_responsaveis")
    historicos = relationship("StatusHistorico", back_populates="atividade", cascade="all, delete-orphan")
    sessoes = relationship("SessaoTrabalho", back_populates="atividade", cascade="all, delete-orphan")
