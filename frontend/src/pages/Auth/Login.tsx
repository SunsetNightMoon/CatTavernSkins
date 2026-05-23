import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'
import { useSiteStore } from '../../store/siteStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import { isVideoFile } from '../../utils/media'
import './AuthShared.css'

export function Login() {
  usePageTitle('登录')
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)
  const { title, loginBgImage, loginEmbedImage, videoMuted, theme } = useSiteStore()

  const hasCustomBg = loginBgImage && loginBgImage.trim() !== ''
  const hasEmbedImage = loginEmbedImage && loginEmbedImage.trim() !== ''
  const isBgVideo = hasCustomBg && isVideoFile(loginBgImage)
  const isEmbedVideo = hasEmbedImage && isVideoFile(loginEmbedImage)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const data = await authService.login({
        email: values.email,
        password: values.password,
      })

      const profileName = data.profileName || null
      const profileId = data.profiles?.[0]?.id || null
      setAuth(data.accessToken, data.user, data.skinUrl, profileName, profileId)

      message.success('登录成功！')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" data-theme={theme}>
      {/* 自定义背景图 or 星空背景 or WebM 视频背景 */}
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

      {/* 背景暗化层 */}
      <div className="auth-page__overlay" />

      {/* 内容 */}
      <div className={`auth-container ${!hasEmbedImage ? 'auth-container--no-embed' : ''}`}>
        {/* 左侧内嵌图片 */}
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

        {/* 右侧内容 */}
        <div className="auth-content">
          {/* Logo */}
          <div className="auth-page__logo">
            <div className="auth-page__logo-icon">S</div>
            <div className="auth-page__logo-text">{title}</div>
          </div>

          {/* 登录卡片 */}
          <div className="auth-card">
          <h2 className="auth-card__title">登录</h2>

          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}
            >
              <Input placeholder="请输入邮箱" size="large" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                登 录
              </Button>
            </Form.Item>

            <div className="auth-card__footer">
              <span>还没有账户？ </span>
              <Link to="/register">立即注册</Link>
            </div>
          </Form>
          </div>
        </div>
      </div>
    </div>
  )
}
