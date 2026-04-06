'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DadosProgresso {
  id: number
  nome: string
  percentual_conclusao: number
}

interface Props {
  dados: DadosProgresso[]
}

export function GraficoProgresso({ dados }: Props) {
  return (
    <div style={{ width: '100%', height: 340, background: 'var(--superficie-1)', padding: '20px', borderRadius: '8px', border: '1px solid var(--cinza-300)', overflow: 'hidden' }}>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '20px', textTransform: 'uppercase', color: 'var(--cinza-600)' }}>
        Progresso por Edifício (%)
      </h3>
      <div style={{ width: '100%', height: '250px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--cinza-100)" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis 
            dataKey="nome"
            type="category" 
            width={120}
            tickFormatter={(valor: string) => valor.length > 18 ? `${valor.slice(0, 18)}...` : valor}
            style={{ fontSize: '12px', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }} 
          />
          <Tooltip 
            cursor={{ fill: 'var(--cinza-50)' }}
            contentStyle={{ borderRadius: '4px', border: '1px solid var(--cinza-300)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
          <Bar dataKey="percentual_conclusao" radius={[0, 4, 4, 0]} barSize={20}>
            {dados.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.percentual_conclusao === 100 ? 'var(--sucesso)' : 'var(--verde-principal)'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
