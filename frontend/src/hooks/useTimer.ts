import { useState, useEffect, useRef } from 'react'

export function useTimer(iniciado_em: string | null) {
  const [segundos, setSegundos] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!iniciado_em) {
      setSegundos(0)
      return
    }

    const calcular = () => {
      const diff = Math.floor((Date.now() - new Date(iniciado_em).getTime()) / 1000)
      setSegundos(Math.max(0, diff))
    }

    calcular()
    intervalRef.current = setInterval(calcular, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [iniciado_em])

  return segundos
}
