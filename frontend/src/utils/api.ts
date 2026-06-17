import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// 修复 H1：同源 XHR 自动携带 httpOnly auth_token Cookie，认证不再依赖 localStorage 中的 token。
axios.defaults.withCredentials = true

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

// 认证类接口：其 401/403 表示「本次登录/注册凭据无效」，应由页面内联处理，
// 不能触发全局登出跳转（否则会整页刷新、清空表单、看不到错误提示）。
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/oauth']

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false
  return AUTH_ENDPOINTS.some((p) => url.includes(p))
}

// ── axios 全局 401/403 拦截器 ──
// 仅对「已认证会话失效」的请求触发自动登出跳转；
// 登录/注册接口自身的 401/403 交给调用方（登录/注册页）内联高亮处理。
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url as string | undefined
    if ((status === 401 || status === 403) && !isAuthEndpoint(url)) {
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

  // 修复 H1：携带 httpOnly auth_token Cookie（认证主载体）；
  // Bearer 头作为内存 token 的兜底，首次刷新前仍可用，无害。
  const response = await fetch(url, { ...options, headers, credentials: 'include' })

  if (response.status === 401 || response.status === 403) {
    handle401()
  }

  return response
}

// 读取内存中的 token（不再从 localStorage 读取，token 已不持久化，修复 H1）。
function getStoredToken(): string | null {
  return useAuthStore.getState().token
}
