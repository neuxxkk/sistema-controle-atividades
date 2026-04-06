from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Construtora(Base):
    __tablename__ = "construtoras"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    edificios = relationship("Edificio", back_populates="construtora")
