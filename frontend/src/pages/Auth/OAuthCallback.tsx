import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import axios from 'axios'

export function OAuthCallback() {
  usePageTitle('OAuth 登录')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const isNewUser = searchParams.get('new_user') === 'true'

    if (!token) {
      setError('缺少认证令牌，请重新登录')
      return
    }

    const fetchUser = async () => {
      try {
        const response = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })

        const data = response.data
        const profileName = data.profileName || null
        const profileId = data.profiles?.[0]?.id || null
        setAuth(token, data.user, data.skinUrl, profileName, profileId)

        if (isNewUser) {
          navigate('/profile', { state: { oauthNewUser: true }, replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (err: any) {
        setError(err.response?.data?.errorMessage || '获取用户信息失败，请重新登录')
      }
    }

    fetchUser()
  }, [searchParams, setAuth, navigate])

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Result
          status="error"
          title="OAuth 登录失败"
          subTitle={error}
          extra={
            <Button type="primary" href="/login">
              返回登录
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spin size="large" tip="正在完成 OAuth 登录..." />
    </div>
  )
}
