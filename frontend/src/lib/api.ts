import { API_BASE } from './constants'

function resolverApiBase(): string {
  if (typeof window === 'undefined') return API_BASE

  try {
    const url = new URL(API_BASE)
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
    const paginaEmRede = !['localhost', '127.0.0.1'].includes(window.location.hostname)

    // Quando a UI roda via IP da rede, "localhost" aponta para o dispositivo errado.
    if (isLocalHost && paginaEmRede) {
      url.hostname = window.location.hostname
      return url.toString().replace(/\/$/, '')
    }

    return API_BASE
  } catch {
    return API_BASE
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${resolverApiBase()}${path}`
  console.log(`[API Request] ${options?.method || 'GET'} ${url}`)
  
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (error) {
    throw new Error(`Falha de conexão com a API em ${url}. Verifique se o backend está ativo e acessível.`)
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
