import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/Layout/Layout'
import { profileService } from './services/profileService'
import axios from 'axios'
import SetupWizard from './pages/Setup/SetupWizard'
import { Login } from './pages/Auth/Login'
import { Register } from './pages/Auth/Register'
import { Landing } from './pages/Landing/Landing'
import { SkinLibrary } from './pages/Library/SkinLibrary'
import { SkinDetail } from './pages/SkinDetail/SkinDetail'
import { CapeDetail } from './pages/CapeDetail/CapeDetail'
import { SkinUpload } from './pages/Upload/SkinUpload'
import { Wardrobe } from './pages/Wardrobe/Wardrobe'
import { UserProfile } from './pages/Profile/UserProfile'
import { AdminDashboard } from './pages/Admin/AdminDashboard'
import MySkins from './pages/MySkins/MySkins'

function App() {
  const { isAuthenticated, user, updateUser, setSkinUrl } = useAuthStore()
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const navigate = useNavigate()

  // 检查是否需要安装
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await axios.get('/api/setup/status')
        if (res.data && res.data.setup_completed === false) {
          setSetupRequired(true)
        } else {
          setSetupRequired(false)
        }
      } catch {
        setSetupRequired(false)
      }
    }
    checkSetup()
  }, [])

  // 处理安装状态的页面跳转
  useEffect(() => {
    if (setupRequired === null) return
    if (setupRequired && window.location.pathname !== '/setup') {
      setRedirectTo('/setup')
    } else if (!setupRequired && window.location.pathname === '/setup') {
      setRedirectTo('/')
    }
  }, [setupRequired])

  // 执行跳转
  useEffect(() => {
    if (redirectTo) {
      navigate(redirectTo)
    }
  }, [redirectTo, navigate])

  // 应用初始化时刷新用户信息
  useEffect(() => {
    if (!isAuthenticated || setupRequired) return
    const refreshUser = async () => {
      try {
        const data = await profileService.getMe()
        if (data.user) {
          updateUser(data.user)
        }
        if (data.skinUrl !== undefined) {
          setSkinUrl(data.skinUrl || null)
        }
      } catch (err) {
        console.error('刷新用户信息失败:', err)
      }
    }
    refreshUser()
  }, [isAuthenticated, updateUser, setSkinUrl, setupRequired])

  // 等待检查结果
  if (setupRequired === null) {
    return <div style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  }

  // 正在跳转
  if (redirectTo) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        正在跳转...
      </div>
    )
  }

  return (
    <Routes>
      {/* 安装向导 */}
      <Route path="/setup" element={<SetupWizard />} />

      {/* 认证路由 */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />

      {/* 带布局的路由 */}
      <Route element={<Layout />}>
        <Route path="/library" element={<SkinLibrary />} />
        <Route path="/skin/:id" element={<SkinDetail />} />
        <Route path="/cape/:id" element={<CapeDetail />} />
        <Route
          path="/upload"
          element={isAuthenticated ? <SkinUpload /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <UserProfile /> : <Navigate to="/login" />}
        />
        <Route
          path="/wardrobe"
          element={isAuthenticated ? <Wardrobe /> : <Navigate to="/login" />}
        />

        <Route
          path="/my-skins"
          element={isAuthenticated ? <MySkins /> : <Navigate to="/login" />}
        />
        {/* 管理员路由 */}
        {isAuthenticated && user && user.level >= 1 && (
          <Route path="/admin" element={<AdminDashboard />} />
        )}
      </Route>

      {/* 起始页（独立，不使用 Layout） */}
      <Route path="/" element={<Landing />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App
