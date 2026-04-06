from sqlalchemy import Column, Integer, String, Boolean, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    atividades_responsaveis = relationship("Atividade", back_populates="usuario_responsavel")
    historicos = relationship("StatusHistorico", back_populates="usuario")
    sessoes = relationship("SessaoTrabalho", back_populates="usuario")
    
    __table_args__ = (
        CheckConstraint(role.in_(['funcionario', 'admin']), name='check_role'),
    )
