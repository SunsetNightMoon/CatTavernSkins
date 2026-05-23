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
const STORAGE_VERSION = 2

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
