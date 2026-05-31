import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message, Alert, AutoComplete, Divider } from 'antd'
import type { SelectProps } from 'antd'
import { authService } from '../../services/authService'
import type { RegisterDTO } from '../../types'
import { useSiteStore } from '../../store/siteStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import { TurnstileWidget } from '../../components/TurnstileWidget/TurnstileWidget'
import './AuthShared.css'
import { isVideoFile } from '../../utils/media'

const EMAIL_SUFFIXES = [
  '163.com',
  'gmail.com',
  'qq.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'icloud.com',
  'foxmail.com',
]

function getEmailOptions(input: string): SelectProps<string>['options'] {
  if (!input || input.includes('@')) return []
  return EMAIL_SUFFIXES.map(suffix => ({
    label: `${input}@${suffix}`,
    value: `${input}@${suffix}`,
  }))
}

export function Register() {
  usePageTitle('注册')
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [captchaSessionId, setCaptchaSessionId] = useState<string>('')
  const [captchaQuestion, setCaptchaQuestion] = useState<string>('')
  const [emailOptions, setEmailOptions] = useState<SelectProps<string>['options']>([])
  const [captchaType, setCaptchaType] = useState<'turnstile' | 'math'>('math')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>('')
  const [oauthProviders, setOauthProviders] = useState<{ github: boolean; microsoft: boolean }>({ github: false, microsoft: false })

  const handleEmailSearch = (value: string) => {
    if (!value || value.includes('@')) {
      setEmailOptions([])
      return
    }
    setEmailOptions(getEmailOptions(value))
  }

  const handleEmailSelect = (value: string) => {
    form.setFieldValue('email', value)
    setEmailOptions([])
  }
  const { title, loginBgImage, loginEmbedImage, videoMuted, theme } = useSiteStore()

  const hasCustomBg = loginBgImage && loginBgImage.trim() !== ''
  const hasEmbedImage = loginEmbedImage && loginEmbedImage.trim() !== ''
  const isBgVideo = hasCustomBg && isVideoFile(loginBgImage)
  const isEmbedVideo = hasEmbedImage && isVideoFile(loginEmbedImage)

  const loadCaptcha = async () => {
    try {
      const sessionId = Math.random().toString(36).substring(2, 15)
      const response = await fetch(`/api/captcha/generate?sessionId=${sessionId}`)
      const data = await response.json()
      setCaptchaSessionId(sessionId)
      setCaptchaQuestion(data.question)
    } catch (error) {
      console.error('加载验证码失败:', error)
    }
  }

  useEffect(() => {
    const fetchCaptchaType = async () => {
      try {
        const response = await fetch('/api/captcha/captcha-type')
        const data = await response.json()
        setCaptchaType(data.type)
        if (data.type === 'turnstile' && data.siteKey) {
          setTurnstileSiteKey(data.siteKey)
        }
        if (data.type === 'math') {
          loadCaptcha()
        }
      } catch {
        loadCaptcha()
      }
    }
    fetchCaptchaType()
  }, [])

  useEffect(() => {
    const fetchOAuthProviders = async () => {
      try {
        const response = await fetch('/api/auth/oauth/providers')
        const data = await response.json()
        setOauthProviders(data)
      } catch {
        // ignore
      }
    }
    fetchOAuthProviders()
  }, [])

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const handleTurnstileError = useCallback((error: string) => {
    message.error(error)
    setTurnstileToken('')
  }, [])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const registerData: RegisterDTO = {
        email: values.email,
        password: values.password,
        profile_name: values.profile_name,
      }

      if (captchaType === 'turnstile') {
        registerData.turnstile_token = turnstileToken
      } else {
        registerData.captcha_session_id = captchaSessionId
        registerData.captcha_answer = values.captcha_answer
      }

      const result = await authService.register(registerData)

      if (result.isFirstUser) {
        message.success('注册成功！您是第一位用户，已自动设为超级管理员')
      } else {
        message.success('注册成功！请查收验证邮件')
      }
      navigate('/login')
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '注册失败')
      if (captchaType === 'math') {
        loadCaptcha()
      } else {
        setTurnstileToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" data-theme={theme}>
      {hasCustomBg ? (
        isBgVideo ? (
          <video
            className="auth-page__bg-video"
            src={loginBgImage}
            autoPlay
            loop
            muted={videoMuted}
            playsInline
          />
        ) : (
          <div
            className="auth-page__bg"
            style={{ backgroundImage: `url(${loginBgImage})` }}
          />
        )
      ) : (
        <div className="auth-page__starfield">
          <div className="starfield-bg">
            <div className="starfield-bg__stars" />
            <div className="starfield-bg__shooting-star" />
            <div className="starfield-bg__fog" />
          </div>
        </div>
      )}

      <div className="auth-page__overlay" />

      <div className={`auth-container ${!hasEmbedImage ? 'auth-container--no-embed' : ''}`}>
        {hasEmbedImage && (
          <div className="auth-embed">
            {isEmbedVideo ? (
              <video
                src={loginEmbedImage}
                className="auth-embed__video"
                autoPlay
                loop
                muted={videoMuted}
                playsInline
              />
            ) : (
              <img src={loginEmbedImage} alt="" className="auth-embed__image" />
            )}
          </div>
        )}

        <div className="auth-content">
          <div className="auth-page__logo">
            <div className="auth-page__logo-icon">S</div>
            <div className="auth-page__logo-text">{title}</div>
          </div>

          <div className="auth-card">
          <h2 className="auth-card__title">注册</h2>

          <Alert
            message="注册说明"
            description="注册时必须填写 Minecraft 游戏名（角色ID），3-16个字符，仅限字母、数字和下划线。第一个注册用户自动成为超级管理员。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Minecraft 游戏名（角色ID）"
              name="profile_name"
              rules={[
                { required: true, message: '请输入角色ID' },
                { min: 3, max: 16, message: '角色ID需3-16个字符' },
                { pattern: /^[a-zA-Z0-9_]+$/, message: '仅限字母、数字和下划线' },
              ]}
            >
              <Input placeholder="例如: Steve_2024" size="large" />
            </Form.Item>

            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}
            >
              <AutoComplete
                options={emailOptions}
                onSearch={handleEmailSearch}
                onSelect={handleEmailSelect}
                onBlur={() => setTimeout(() => setEmailOptions([]), 200)}
                placeholder="请输入邮箱"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' },
              ]}
            >
              <Input.Password placeholder="请输入密码（至少6位）" size="large" />
            </Form.Item>

            {captchaType === 'turnstile' ? (
              <Form.Item label="人机验证">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  mode="managed"
                  onVerify={handleTurnstileVerify}
                  onError={handleTurnstileError}
                />
              </Form.Item>
            ) : (
              <>
                <Form.Item label="人机验证（计算下面的结果）">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Input
                      value={captchaQuestion}
                      disabled
                      style={{ width: '180px', fontWeight: 'bold' }}
                      size="large"
                    />
                    <Button onClick={loadCaptcha} size="large">换一道</Button>
                  </div>
                </Form.Item>

                <Form.Item
                  name="captcha_answer"
                  label="你的答案"
                  rules={[{ required: true, message: '请输入答案' }]}
                >
                  <Input placeholder="输入数字答案" style={{ width: '180px' }} size="large" />
                </Form.Item>
              </>
            )}

            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                注 册
              </Button>
            </Form.Item>

            <div className="auth-card__footer">
              <span>已有账户？ </span>
              <Link to="/login">立即登录</Link>
            </div>
          </Form>

          {(oauthProviders.github || oauthProviders.microsoft) && (
            <>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', margin: '20px 0' }}>第三方登录</Divider>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {oauthProviders.github && (
                  <Button
                    size="large"
                    icon={
                      <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{ verticalAlign: '-2px' }}>
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                    }
                    href="/api/auth/oauth/github"
                    className="oauth-btn oauth-btn--github"
                  >
                    GitHub 登录
                  </Button>
                )}
                {oauthProviders.microsoft && (
                  <Button
                    size="large"
                    icon={
                      <svg viewBox="0 0 21 21" width="16" height="16" style={{ verticalAlign: '-2px' }}>
                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                      </svg>
                    }
                    href="/api/auth/oauth/microsoft"
                    className="oauth-btn oauth-btn--microsoft"
                  >
                    Microsoft 登录
                  </Button>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

    </div>
  )
}
