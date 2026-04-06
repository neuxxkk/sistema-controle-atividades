from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class SessaoTrabalho(Base):
    __tablename__ = "sessoes_trabalho"
    
    id = Column(Integer, primary_key=True, index=True)
    atividade_id = Column(Integer, ForeignKey("atividades.id", ondelete="CASCADE"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    iniciado_em = Column(DateTime(timezone=True), server_default=func.now())
    finalizado_em = Column(DateTime(timezone=True))
    duracao_segundos = Column(Integer)
    
    # Relationships
    atividade = relationship("Atividade", back_populates="sessoes")
    usuario = relationship("Usuario", back_populates="sessoes")
