import { API_BASE } from './constants'

function normalizarBase(url: string): string {
  return url.replace(/\/$/, '')
}

function resolverApiBases(): string[] {
  if (typeof window === 'undefined') return [normalizarBase(API_BASE)]

  try {
    const url = new URL(API_BASE)
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
    const paginaEmRede = !['localhost', '127.0.0.1'].includes(window.location.hostname)
    const candidatos = new Set<string>()

    const adicionar = (hostname: string) => {
      const alt = new URL(url.toString())
      alt.hostname = hostname
      candidatos.add(normalizarBase(alt.toString()))
    }

    // Mantém API_BASE configurada como primeira opção.
    candidatos.add(normalizarBase(API_BASE))

    // Quando a UI roda via IP da rede, "localhost" aponta para o dispositivo errado.
    if (isLocalHost && paginaEmRede) {
      adicionar(window.location.hostname)
    }

    // Fallbacks comuns para ambiente local.
    if (isLocalHost) {
      adicionar('localhost')
      adicionar('127.0.0.1')
    }

    return Array.from(candidatos)
  } catch {
    return [normalizarBase(API_BASE)]
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const bases = resolverApiBases()
  const metodo = options?.method || 'GET'
  const urlsTentadas: string[] = []

  let res: Response | null = null

  for (const base of bases) {
    const url = `${base}${path}`
    urlsTentadas.push(url)
    console.log(`[API Request] ${metodo} ${url}`)

    try {
      res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      })
      break
    } catch (error) {
      void error
    }
  }

  if (!res) {
    const destino = urlsTentadas.join(' | ')
    throw new Error(`Falha de conexão com a API. Endereços tentados: ${destino}. Verifique se o backend está ativo e acessível.`)
  }

  if (!res.ok) {
    const erro = await res.json().catch(() => ({ detail: 'Erro desconhecido' }))
    throw new Error(erro.detail ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}
