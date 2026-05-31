import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: (User & { level: number; user_uid: number; banned_until: string | null }) | null
  skinUrl: string | null
  profileName: string | null
  profileId: string | null
  isAuthenticated: boolean
  setAuth: (
    token: string,
    user: User & { level: number; user_uid: number; banned_until: string | null },
    skinUrl?: string | null,
    profileName?: string | null,
    profileId?: string | null,
  ) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
  setProfileName: (name: string | null) => void
  setSkinUrl: (url: string | null) => void
}

// 当前缓存版本，数据结构变更时递增以丢弃旧缓存
// v3：修复 H1 —— 不再持久化 token（仅留存于内存），强制丢弃仍持有 token 的旧缓存
const STORAGE_VERSION = 3

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      skinUrl: null,
      profileName: null,
      profileId: null,
      isAuthenticated: false,
      setAuth: (token, user, skinUrl = null, profileName = null, profileId = null) =>
        set({ token, user, skinUrl, profileName, profileId, isAuthenticated: true }),
      clearAuth: () =>
        set({ token: null, user: null, skinUrl: null, profileName: null, profileId: null, isAuthenticated: false }),
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
      setProfileName: (name) => set({ profileName: name }),
      setSkinUrl: (url) => set({ skinUrl: url }),
    }),
    {
      name: 'auth-storage',
      version: STORAGE_VERSION,
      // 修复 H1：token 不再写入 localStorage（避免 XSS 窃取），仅保留于内存。
      // 刷新后 token 为 null，由 httpOnly auth_token Cookie 重新认证。
      // 其余字段继续持久化以保障 UX（避免刷新闪烁）。
      partialize: (state) => ({
        user: state.user,
        skinUrl: state.skinUrl,
        profileName: state.profileName,
        profileId: state.profileId,
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persistedState: any, version) => {
        // 版本不匹配时丢弃旧缓存
        if (version !== STORAGE_VERSION) {
          return {
            token: null,
            user: null,
            skinUrl: null,
            profileName: null,
            profileId: null,
            isAuthenticated: false,
          } as AuthState
        }
        return persistedState as AuthState
      },
    }
  )
)
