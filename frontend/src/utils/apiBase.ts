// 跨站部署支持（EdgeOne Pages 等）：当前端与后端分域名部署时，需要把
// 相对路径 `/api`、`/uploads` 改写为后端绝对地址。
//
// 设计原则：**默认零影响**。`VITE_API_BASE` 未设置（默认空串）时，本模块不做任何
// 改写，前端继续走相对路径 `/api` —— 完整保留 Windows 一键启动 / Docker 同源部署行为。
// 仅当构建时注入 `VITE_API_BASE=https://api.example.com` 才启用跨站改写。
//
// 之所以同时给 axios 和原生 fetch 打补丁：代码库里两种调用方式并存（约 70 处
// `fetch('/api/...')` + 若干 axios 调用），逐处改造风险高，集中在入口处理最稳妥。

const RAW_BASE = (import.meta as any).env?.VITE_API_BASE ?? ''
// 去除结尾斜杠，避免出现 `//api`
export const API_BASE: string = String(RAW_BASE).replace(/\/+$/, '')

// 仅改写以这些前缀开头的「站内根相对路径」。其余请求（绝对 URL、第三方）不动。
const REWRITE_PREFIXES = ['/api', '/uploads']

function shouldRewrite(url: string): boolean {
  return REWRITE_PREFIXES.some((p) => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'))
}

function toAbsolute(url: string): string {
  return API_BASE + url
}

export function installApiBase(): void {
  if (!API_BASE) return // 同源部署：不启用任何改写

  // 1) axios：设置 baseURL，使 `/api/...` 自动指向后端绝对地址。
  //    动态 require 避免在未用到时引入额外耦合。
  import('axios').then(({ default: axios }) => {
    axios.defaults.baseURL = API_BASE
  })

  // 2) 原生 fetch：对站内根相对路径补全为后端绝对地址，并强制携带凭据（跨站 Cookie）。
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === 'string' && shouldRewrite(input)) {
      return originalFetch(toAbsolute(input), { credentials: 'include', ...init })
    }
    if (input instanceof Request && shouldRewrite(input.url)) {
      // 用改写后的 URL 重建 Request，保留原方法/头/体
      const req = new Request(toAbsolute(input.url), input)
      return originalFetch(req, { credentials: 'include', ...init })
    }
    return originalFetch(input as any, init)
  }
}

// 供组件按需拼接资源绝对地址（如 <img src>）。同源时返回原值。
export function withApiBase(path: string): string {
  if (!API_BASE || !path) return path
  return shouldRewrite(path) ? toAbsolute(path) : path
}
