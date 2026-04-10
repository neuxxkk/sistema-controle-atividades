from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class StatusHistorico(Base):
    __tablename__ = "status_historico"
    
    id = Column(Integer, primary_key=True, index=True)
    atividade_id = Column(Integer, ForeignKey("atividades.id", ondelete="CASCADE"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    acao = Column(String(30))  # iniciar | pausar | retomar | avancar_etapa | finalizar
    status_anterior = Column(String(40))
    status_novo = Column(String(40), nullable=False)
    etapa_anterior = Column(Integer)
    etapa_nova = Column(Integer)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    atividade = relationship("Atividade", back_populates="historicos")
    usuario = relationship("Usuario", back_populates="historicos")
