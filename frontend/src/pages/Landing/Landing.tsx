import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RightOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useSiteStore } from '../../store/siteStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import { TopNav } from '../../components/TopNav/TopNav'
import './Landing.css'

interface HomepageButton {
  text: string
  link: string
}

/* ---------- component ---------- */
export function Landing() {
  usePageTitle(null)
  const navigate = useNavigate()
  const {
    title: siteTitle,
    theme,
    lightBgImage,
    darkBgImage,
  } = useSiteStore()
  const currentBgImage = theme === 'dark' ? darkBgImage : lightBgImage
  const [siteSettings, setSiteSettings] = useState({
    HOMEPAGE_TITLE_TEXT: '欢迎来到',
    HOMEPAGE_TEXT: 'WELCOME TO SKIN2!',
    HOMEPAGE_BUTTON_TEXT: '进入个人中心',
    HOMEPAGE_BUTTONS: '[]',
  })

  // 同步主题到 body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  // 加载 Landing 专用站点设置（背景图由 usePageTitle + siteStore 统一管理）
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const url = `/api/settings/public?_t=${Date.now()}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setSiteSettings({
            HOMEPAGE_TITLE_TEXT: String(data.HOMEPAGE_TITLE_TEXT || '欢迎来到'),
            HOMEPAGE_TEXT: String(data.HOMEPAGE_TEXT || 'WELCOME TO SKIN2!'),
            HOMEPAGE_BUTTON_TEXT: String(data.HOMEPAGE_BUTTON_TEXT || '进入个人中心'),
            HOMEPAGE_BUTTONS: String(data.HOMEPAGE_BUTTONS || '[]'),
          })
        }
      } catch (err) {
        console.error('[Landing] 加载站点设置失败:', err)
      }
    }
    loadSettings()
  }, [])

  // 判断是否有自定义背景（从全局 store 读取，根据主题选择）
  const hasCustomBg = currentBgImage && currentBgImage.trim() !== ''

  // 解析自定义按钮
  const extraButtons: HomepageButton[] = (() => {
    try {
      const parsed = JSON.parse(siteSettings.HOMEPAGE_BUTTONS || '[]')
      return Array.isArray(parsed) ? parsed.filter((b: any) => b.text && b.link) : []
    } catch {
      return []
    }
  })()

  // 处理按钮点击：外部URL用新标签页打开，内部路由用 navigate
  const handleButtonClick = (link: string) => {
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank')
    } else {
      navigate(link)
    }
  }

  return (
          <div className={`landing-page ${hasCustomBg ? 'landing-page--custom-bg' : ''}`} data-theme={theme}>
        {/* Custom Background Image */}
        {hasCustomBg && (
          <div
            className="landing-custom-bg"
            style={{ backgroundImage: `url(${currentBgImage})` }}
          />
        )}

        {/* Background — starfield (only show if no custom bg and dark theme) */}
        {!hasCustomBg && theme === 'dark' && (
          <div className="starfield-bg">
            <div className="starfield-bg__stars" />
            <div className="starfield-bg__shooting-star" />
            <div className="starfield-bg__fog" />
          </div>
        )}

        {/* Top Navigation */}
        <TopNav
          brandOnClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          links={[
            { path: '/', label: '首页' },
            { path: '/library', label: '材质库' },
            { path: '/upload', label: '上传材质', auth: true },
            { path: '/wardrobe', label: '衣柜', auth: true },
            { path: '/profile', label: '个人中心', auth: true },
            { path: '/admin', label: '管理面板', auth: true, admin: true },
          ]}
        />

        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-hero__content">
            <h1 className="landing-hero__title">
              {siteSettings.HOMEPAGE_TITLE_TEXT}
              <br />
              <span className="landing-hero__title-accent">{siteTitle}</span>
            </h1>
            <p className="landing-hero__subtitle">
              {siteSettings.HOMEPAGE_TEXT}
            </p>
            <div className="landing-hero__cta">
              <button
                className="landing-hero__btn landing-hero__btn--primary"
                onClick={() => navigate('/profile')}
              >
                {siteSettings.HOMEPAGE_BUTTON_TEXT} <RightOutlined />
              </button>
              {extraButtons.map((btn, idx) => (
                <button
                  key={idx}
                  className="landing-hero__btn landing-hero__btn--secondary"
                  onClick={() => handleButtonClick(btn.link)}
                >
                  {btn.text}
                  <LinkOutlined style={{ fontSize: 12, marginLeft: 4 }} />
                </button>
              ))}
            </div>
          </div>
        </section>

      </div>
  )
}
