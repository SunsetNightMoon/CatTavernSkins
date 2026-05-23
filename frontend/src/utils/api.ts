import axios from 'axios'

let clearAuthFn: (() => void) | null = null

export function setAuthClearHandler(fn: () => void) {
  clearAuthFn = fn
}

function handle401() {
  if (clearAuthFn) {
    clearAuthFn()
    window.location.href = '/login'
  }
}

// ── axios 全局 401/403 拦截器 ──
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      handle401()
    }
    return Promise.reject(error)
  },
)

// ── 带认证的 fetch 封装 ──
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...options, headers })

  if (response.status === 401 || response.status === 403) {
    handle401()
  }

  return response
}

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.state?.token || null
    }
  } catch {
    // ignore
  }
  return null
}
