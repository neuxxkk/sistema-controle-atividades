from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Laje(Base):
    __tablename__ = "lajes"
    
    id = Column(Integer, primary_key=True, index=True)
    edificio_id = Column(Integer, ForeignKey("edificios.id", ondelete="CASCADE"))
    tipo = Column(String(30), nullable=False)
    ordem = Column(Integer, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    edificio = relationship("Edificio", back_populates="lajes")
    atividades = relationship("Atividade", back_populates="laje", cascade="all, delete-orphan")
