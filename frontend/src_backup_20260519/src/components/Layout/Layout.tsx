import { Link, useNavigate, Outlet } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Space } from 'antd'
import { HomeOutlined, UserOutlined, UploadOutlined, SkinOutlined, ClusterOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { SkinAvatar } from '../SkinAvatar'

const { Header, Content, Footer } = AntLayout

export function Layout() {
  const { isAuthenticated, user, skinUrl, profileName, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const menuItems = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: <Link to="/">首页</Link>,
    },
    {
      key: 'library',
      icon: <SkinOutlined />,
      label: <Link to="/library">皮肤库</Link>,
    },
    isAuthenticated && {
      key: 'upload',
      icon: <UploadOutlined />,
      label: <Link to="/upload">上传材质</Link>,
    },
    isAuthenticated && {
      key: 'wardrobe',
      icon: <ClusterOutlined />,
      label: <Link to="/wardrobe">衣柜</Link>,
    },
    isAuthenticated && {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">个人中心</Link>,
    },
    isAuthenticated && user && user.level >= 1 && {
      key: 'admin',
      label: <Link to="/admin">管理面板</Link>,
    },
  ].filter(Boolean) as { key: string; icon?: React.ReactNode; label: React.ReactNode }[]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            Minecraft Skin Server
          </Link>
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          items={menuItems}
          style={{ flex: 1, marginLeft: 50 }}
        />
        <Space>
          {isAuthenticated ? (
            <>
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white', textDecoration: 'none' }}>
                <SkinAvatar skinUrl={skinUrl || undefined} size={28} border={false} />
                <span>{profileName || user?.email?.split('@')[0] || '#' + user?.user_uid}</span>
              </Link>
              <Button type="text" style={{ color: 'white' }} onClick={handleLogout}>
                退出
              </Button>
            </>
          ) : (
            <>
              <Button type="text" style={{ color: 'white' }} onClick={() => navigate('/login')}>
                登录
              </Button>
              <Button type="primary" onClick={() => navigate('/register')}>
                注册
              </Button>
            </>
          )}
        </Space>
      </Header>
      <Content style={{ padding: '20px 50px' }}>
        <div style={{ background: '#fff', padding: 24, minHeight: 280 }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        Minecraft Skin Server ©2026 Created by You
      </Footer>
    </AntLayout>
  )
}
