import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

export function OAuthCallback() {
  const { t } = useTranslation()
  usePageTitle(t('auth.oauthLogin', 'OAuth Login'))
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const isNewUser = searchParams.get('new_user') === 'true'

    // 安全加固：剥离地址栏 query，避免 new_user 等标志残留在历史记录中。
    const stripQueryFromUrl = () => {
      window.history.replaceState(null, '', '/oauth-success')
    }

    const fetchUser = async () => {
      try {
        // 修复 H1：令牌已由后端写入 httpOnly auth_token Cookie，不再出现在 URL。
        // withCredentials 已全局开启，Cookie 随同源请求自动携带，无需手动设置 Authorization 头。
        const response = await axios.get('/api/auth/me')

        const data = response.data
        const profileName = data.profileName || null
        const profileId = data.profiles?.[0]?.id || null
        // 认证主载体为 Cookie；内存 store 的 token 字段此处无值，传空串即可。
        setAuth('', data.user, data.skinUrl, profileName, profileId)

        if (isNewUser) {
          navigate('/profile', { state: { oauthNewUser: true }, replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (err: any) {
        stripQueryFromUrl()
        setError(err.response?.data?.errorMessage || t('auth.fetchUserFailed', 'Failed to fetch user info, please login again'))
      }
    }

    fetchUser()
  }, [searchParams, setAuth, navigate, t])

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Result
          status="error"
          title={t('auth.oauthLoginFailed', 'OAuth Login Failed')}
          subTitle={error}
          extra={
            <Button type="primary" href="/login">
              {t('auth.backToLogin', 'Back to Login')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" tip={t('auth.completingOAuth', 'Completing OAuth login...')} />
    </div>
  )
}
