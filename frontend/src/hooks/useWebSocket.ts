import { useEffect, useState, useRef, useCallback } from 'react'

function resolverWsUrl(url: string): string {
  if (typeof window === 'undefined') {
    return url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  }

  try {
    const parsed = new URL(url, window.location.origin)
    const hostsLocais = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    const isLocalHost = hostsLocais.includes(parsed.hostname)
    const paginaEmRede = !hostsLocais.includes(window.location.hostname)

    if (isLocalHost && paginaEmRede) {
      parsed.hostname = window.location.hostname
    }

    // 0.0.0.0 nao e um destino valido no browser para conexoes WS.
    if (parsed.hostname === '0.0.0.0') {
      parsed.hostname = 'localhost'
    }

    if (parsed.protocol === 'http:') parsed.protocol = 'ws:'
    if (parsed.protocol === 'https:') parsed.protocol = 'wss:'

    return parsed.toString()
  } catch {
    return url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  }
}

function montarCandidatosWs(url: string): string[] {
  const primary = resolverWsUrl(url)
  const candidatos = new Set<string>([primary])

  if (typeof window === 'undefined') {
    return Array.from(candidatos)
  }

  try {
    const parsed = new URL(url, window.location.origin)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const porta = parsed.port || '8000'
    const sufixo = `${parsed.pathname}${parsed.search}`

    candidatos.add(`${wsProtocol}//${window.location.hostname}:${porta}${sufixo}`)
    candidatos.add(`${wsProtocol}//localhost:${porta}${sufixo}`)
    candidatos.add(`${wsProtocol}//127.0.0.1:${porta}${sufixo}`)
  } catch {
    // Se falhar o parse, usamos apenas a URL primaria ja resolvida.
  }

  return Array.from(candidatos)
}

export function useWebSocket<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnect = useRef(true)
  const activeAttempt = useRef(0)
  const hasOpened = useRef(false)

  const connect = useCallback((attempt = 0) => {
    const candidatos = montarCandidatosWs(url)
    const wsUrl = candidatos[attempt] || candidatos[0]
    activeAttempt.current = attempt
    hasOpened.current = false
    
    console.log('[WebSocket] Tentando conectar em:', wsUrl)
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      console.log('WebSocket conectado')
      setIsConnected(true)
      hasOpened.current = true
      activeAttempt.current = 0
    }

    ws.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        setData(payload)
      } catch (error) {
        console.error('Erro ao processar mensagem WS:', error)
      }
    }

    ws.current.onclose = (event) => {
      console.log(`[WebSocket] Desconectado. Código: ${event.code}. Razão: ${event.reason || 'N/A'}`)
      setIsConnected(false)

      const proximaTentativa = attempt + 1
      if (!hasOpened.current && proximaTentativa < candidatos.length && shouldReconnect.current) {
        reconnectTimeout.current = setTimeout(() => connect(proximaTentativa), 200)
        return
      }

      if (shouldReconnect.current) {
        reconnectTimeout.current = setTimeout(() => connect(0), 3000)
      }
    }

    ws.current.onerror = () => {
      if (!shouldReconnect.current) return

      const ultimaTentativa = attempt + 1 >= candidatos.length
      if (ultimaTentativa) {
        console.error('[WebSocket] Falha ao conectar apos esgotar tentativas.', {
          wsUrl,
          tentativa: attempt + 1,
          totalTentativas: candidatos.length,
          origemPagina: typeof window !== 'undefined' ? window.location.origin : 'server',
          readyState: ws.current?.readyState,
          candidatos
        })
      }

      ws.current?.close()
    }
  }, [url])

  useEffect(() => {
    shouldReconnect.current = true
    connect()

    return () => {
      shouldReconnect.current = false
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }
      ws.current?.close()
    }
  }, [connect])

  return { data, isConnected }
}
