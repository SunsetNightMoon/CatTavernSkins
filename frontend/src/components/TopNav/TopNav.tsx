import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LoginOutlined, SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { useSiteStore } from '../../store/siteStore'
import { SkinAvatar } from '../SkinAvatar'
import './TopNav.css'

export interface NavItem {
  path: string
  label: string
  auth?: boolean
  admin?: boolean
}

interface TopNavProps {
  links: NavItem[]
  brandOnClick?: () => void
}

export function TopNav({ links, brandOnClick }: TopNavProps) {
  const { isAuthenticated, user, skinUrl, profileName } = useAuthStore()
  const { title, description, theme, toggleTheme } = useSiteStore()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const visibleLinks = links.filter((link) => {
    if (link.auth && !isAuthenticated) return false
    if (link.admin && (!user || user.level < 1)) return false
    return true
  })

  const handleBrandClick = () => {
    if (brandOnClick) {
      brandOnClick()
    } else {
      navigate('/')
    }
  }

  return (
    <nav className="top-nav">
      {/* Brand */}
      <div className="top-nav__brand" onClick={handleBrandClick}>
        <div className="top-nav__brand-logo">S</div>
        <div>
          <div className="top-nav__brand-text">{title}</div>
          <div className="top-nav__brand-sub">{description}</div>
        </div>
      </div>

      {/* Center Nav Links */}
      <div className="top-nav__links">
        {visibleLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`top-nav__link${isActive(link.path) ? ' top-nav__link--active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right: Theme Toggle / User / Login */}
      <div className="top-nav__right">
        <button
          className="top-nav__theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        >
          {theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
        </button>
        {isAuthenticated ? (
          <>
            {user && user.level >= 1 && (
              <button className="top-nav__icon-btn" onClick={() => navigate('/admin')} title="管理面板">
                <SettingOutlined />
              </button>
            )}
            <div
              className="top-nav__avatar"
              onClick={() => navigate('/profile')}
              title={profileName || user?.email || '个人中心'}
            >
              <SkinAvatar skinUrl={skinUrl || undefined} size={36} border={false} />
            </div>
          </>
        ) : (
          <button className="top-nav__icon-btn" onClick={() => navigate('/login')} title="登录">
            <LoginOutlined />
          </button>
        )}
      </div>
    </nav>
  )
}
