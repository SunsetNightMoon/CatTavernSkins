import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spin, Result, Button, Card, Typography, Space } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import axios from 'axios'

const { Paragraph, Text } = Typography

interface ConflictInfo {
  email: string
  provider: string
}

const providerLabel: Record<string, string> = {
  github: 'GitHub',
  microsoft: 'Microsoft',
}

export function OAuthConflict() {
  usePageTitle('账户已存在')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const pending = searchParams.get('pending')

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<ConflictInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 拉取冲突详情（不消费挂起记录）
  useEffect(() => {
    if (!pending) {
      setLoadError('缺少冲突标识，请重新登录')
      setLoading(false)
      return
    }

    let cancelled = false
    const fetchInfo = async () => {
      try {
        const response = await axios.get(`/api/auth/oauth/conflict/${pending}`)
        if (cancelled) return
        setInfo({ email: response.data.email, provider: response.data.provider })
      } catch (err: any) {
        if (cancelled) return
        setLoadError(err.response?.data?.errorMessage || '请求已过期或不存在，请重新登录')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInfo()
    return () => {
      cancelled = true
    }
  }, [pending])

  // 继续：创建第二个独立账户
  const handleContinue = async () => {
    if (!pending) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await axios.post(`/api/auth/oauth/conflict/${pending}/continue`)
      const token = response.data.token

      if (!token) {
        setSubmitError('创建账户失败，请重新登录')
        setSubmitting(false)
        return
      }

      // 复用 OAuthCallback 的成功逻辑：获取用户信息并写入 store
      const me = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = me.data
      const profileName = data.profileName || null
      const profileId = data.profiles?.[0]?.id || null
      setAuth(token, data.user, data.skinUrl, profileName, profileId)

      navigate('/profile', { state: { oauthNewUser: true }, replace: true })
    } catch (err: any) {
      setSubmitError(err.response?.data?.errorMessage || '创建账户失败，请重新登录')
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="正在加载..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Result
          status="error"
          title="无法处理该请求"
          subTitle={loadError}
          extra={
            <Button type="primary" onClick={handleCancel}>
              返回登录
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 16 }}>
      <Card style={{ maxWidth: 520, width: '100%' }}>
        <Typography>
          <Result
            status="warning"
            title="账户已存在"
            subTitle={`检测到该 ${info ? providerLabel[info.provider] || info.provider : ''} 账户的邮箱已被注册`}
          />
          <Paragraph>
            邮箱 <Text strong>{info?.email}</Text> 已经在本站注册过一个账户。
          </Paragraph>
          <Paragraph>
            出于安全考虑，我们不会自动把该 OAuth 登录关联到现有账户。你可以选择：
          </Paragraph>
          <Paragraph>
            <ul>
              <li>
                <Text strong>继续</Text>：创建一个全新的、独立的账户（与现有账户互不影响）。
              </li>
              <li>
                <Text strong>取消</Text>：返回登录页，使用原有方式登录现有账户。
              </li>
            </ul>
          </Paragraph>
          {submitError && (
            <Paragraph>
              <Text type="danger">{submitError}</Text>
            </Paragraph>
          )}
          <Space>
            <Button type="primary" loading={submitting} onClick={handleContinue}>
              继续
            </Button>
            <Button onClick={handleCancel} disabled={submitting}>
              取消
            </Button>
          </Space>
        </Typography>
      </Card>
    </div>
  )
}
