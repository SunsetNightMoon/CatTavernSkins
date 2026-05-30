export class TurnstileService {
  static isTurnstileConfigured(): boolean {
    return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)
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

      const data = await response.json() as { success: boolean }
      return data.success === true
    } catch (error) {
      console.error('Turnstile verification error:', error)
      return false
    }
  }
}
