interface TurnstileVerifyResponse {
  success: boolean
  hostname?: string
  'error-codes'?: string[]
}

export class TurnstileService {
  static isTurnstileConfigured(): boolean {
    return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)
  }

  /**
   * 解析期望的主机名：优先使用 TURNSTILE_EXPECTED_HOSTNAME，
   * 否则尝试从 BASE_URL 推导。未配置时返回 undefined（保持向后兼容，主机名校验为可选）(M3d)
   */
  private static getExpectedHostname(): string | undefined {
    const explicit = process.env.TURNSTILE_EXPECTED_HOSTNAME
    if (explicit) {
      return explicit
    }

    const baseUrl = process.env.BASE_URL
    if (baseUrl) {
      try {
        return new URL(baseUrl).hostname
      } catch {
        return undefined
      }
    }

    return undefined
  }

  static async verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
      return false
    }

    try {
      const params = new URLSearchParams()
      params.append('secret', secretKey)
      params.append('response', token)
      if (remoteIp) {
        params.append('remoteip', remoteIp)
      }

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const data = await response.json() as TurnstileVerifyResponse
      if (data.success !== true) {
        return false
      }

      // 可选的主机名校验：仅在配置了期望主机名时启用 (M3d)
      // 未配置 -> 保持原有行为（不校验，向后兼容）；
      // 已配置但不匹配 -> 失败关闭（拒绝）。
      const expectedHostname = TurnstileService.getExpectedHostname()
      if (expectedHostname && data.hostname && data.hostname !== expectedHostname) {
        console.warn(
          `Turnstile hostname mismatch: expected "${expectedHostname}", got "${data.hostname}"`
        )
        return false
      }

      return true
    } catch (error) {
      console.error('Turnstile verification error:', error)
      return false
    }
  }
}
