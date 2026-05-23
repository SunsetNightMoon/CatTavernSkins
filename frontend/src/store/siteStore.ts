import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SiteState {
  title: string
  description: string

  // 主题
  theme: 'light' | 'dark'

  // 背景图（区分亮暗色）
  lightBgImage: string
  darkBgImage: string

  // 登录/注册页面背景图
  loginBgImage: string

  // 登录/注册页面内嵌图片（左侧展示图）
  loginEmbedImage: string

  // WebM 视频静音
  videoMuted: boolean

  // 蒙版透明度（区分亮暗色，0-100）
  lightBgOverlayOpacity: number
  darkBgOverlayOpacity: number

  // Actions
  setTitle: (title: string) => void
  setDescription: (description: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  setLightBgImage: (url: string) => void
  setDarkBgImage: (url: string) => void
  setLoginBgImage: (url: string) => void
  setLoginEmbedImage: (url: string) => void
  setVideoMuted: (muted: boolean) => void
  setLightBgOverlayOpacity: (opacity: number) => void
  setDarkBgOverlayOpacity: (opacity: number) => void
  loadSettings: () => Promise<void>
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      title: 'Skin2',
      description: 'Minecraft Skin Server',

      theme: 'dark', // 默认暗色

      lightBgImage: '',
      darkBgImage: '',
      loginBgImage: '',
      loginEmbedImage: '',
      videoMuted: true,

      lightBgOverlayOpacity: 30,
      darkBgOverlayOpacity: 30,

      setTitle: (title) => set({ title }),
      setDescription: (description) => set({ description }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),
      setLightBgImage: (url) => set({ lightBgImage: url }),
      setDarkBgImage: (url) => set({ darkBgImage: url }),
      setLoginBgImage: (url) => set({ loginBgImage: url }),
      setLoginEmbedImage: (url) => set({ loginEmbedImage: url }),
      setVideoMuted: (muted) => set({ videoMuted: muted }),
      setLightBgOverlayOpacity: (opacity) => set({ lightBgOverlayOpacity: opacity }),
      setDarkBgOverlayOpacity: (opacity) => set({ darkBgOverlayOpacity: opacity }),
      loadSettings: async () => {
        try {
          const res = await fetch('/api/settings/public')
          if (!res.ok) return
          const data = await res.json()
          set({
            title: data.SITE_TITLE || 'Skin2',
            description: data.SITE_DESCRIPTION || 'Minecraft Skin Server',
            theme: data.THEME === 'light' ? 'light' : 'dark',
            lightBgImage: data.LIGHT_BG_IMAGE || '',
            darkBgImage: data.DARK_BG_IMAGE || '',
            loginBgImage: data.LOGIN_BG_IMAGE || '',
            loginEmbedImage: data.LOGIN_EMBED_IMAGE || '',
            videoMuted: String(data.VIDEO_MUTED || 'true').toLowerCase() === 'true',
            lightBgOverlayOpacity: parseInt(data.LIGHT_BG_OVERLAY_OPACITY) || 30,
            darkBgOverlayOpacity: parseInt(data.DARK_BG_OVERLAY_OPACITY) || 30,
          })
        } catch {
          // 静默失败，不打扰用户
        }
      },
    }),
    {
      name: 'site-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
