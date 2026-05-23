import { useNavigate } from 'react-router-dom'
import {
  LoginOutlined,
  LogoutOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { SkinAvatar } from '../../components/SkinAvatar'
import './Landing.css'

/* ---------- component ---------- */
export function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, user, skinUrl, profileName } = useAuthStore()

  return (
    <div className="landing-page">
      {/* Background */}
      <div className="landing-bg">
        <div className="landing-bg__stars" />
        <div className="landing-bg__shooting-star" />
        <div className="landing-bg__fog" />
      </div>

      {/* Top Navigation */}
      <nav className="landing-nav">
        {/* Brand */}
        <div className="landing-nav__brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="landing-nav__brand-logo">S</div>
          <div>
            <div className="landing-nav__brand-text">Skin2</div>
            <div className="landing-nav__brand-sub">Minecraft Skin Server</div>
          </div>
        </div>

        {/* Center Nav Links */}
        <div className="landing-nav__links">
          <button className="landing-nav__link landing-nav__link--active">首页</button>
          <button className="landing-nav__link" onClick={() => navigate('/library')}>皮肤库</button>
          <button className="landing-nav__link" onClick={() => navigate('/wardrobe')}>衣柜</button>
          {isAuthenticated && (
            <button className="landing-nav__link" onClick={() => navigate('/upload')}>上传</button>
          )}
        </div>

        {/* Right: User / Login */}
        <div className="landing-nav__right">
          {isAuthenticated ? (
            <>
              {user && user.level >= 1 && (
                <button className="landing-nav__icon-btn" onClick={() => navigate('/admin')} title="管理面板">
                  <LogoutOutlined />
                </button>
              )}
              <div className="landing-nav__avatar" onClick={() => navigate('/profile')} title={profileName || user?.email || '个人中心'}>
                <SkinAvatar skinUrl={skinUrl || undefined} size={32} border={false} />
              </div>
            </>
          ) : (
            <button className="landing-nav__icon-btn" onClick={() => navigate('/login')} title="登录">
              <LoginOutlined />
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero__content">
          <h1 className="landing-hero__title">
            欢迎来到
            <br />
            <span className="landing-hero__title-accent">Skin2</span>
          </h1>
          <p className="landing-hero__subtitle">
            WELCOME TO SKIN2!
          </p>
          <div className="landing-hero__cta">
            <button
              className="landing-hero__btn landing-hero__btn--primary"
              onClick={() => navigate('/library')}
            >
              进入仪表盘 <RightOutlined />
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
