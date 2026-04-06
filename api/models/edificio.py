from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Edificio(Base):
    __tablename__ = "edificios"
    
    id = Column(Integer, primary_key=True, index=True)
    construtora_id = Column(Integer, ForeignKey("construtoras.id", ondelete="RESTRICT"))
    nome = Column(String(150), nullable=False)
    descricao = Column(Text)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    encerrado_em = Column(DateTime(timezone=True))
    
    # Relationships
    construtora = relationship("Construtora", back_populates="edificios")
    lajes = relationship("Laje", back_populates="edificio", cascade="all, delete-orphan")
