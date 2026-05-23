import { useState, useEffect } from 'react'
import { Layout, Menu, Spin, Statistic, Row, Col, Card, message } from 'antd'
import { 
  DashboardOutlined, 
  UserOutlined, 
  SkinOutlined,
  SettingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../../store/authStore'
import UserManagement from './UserManagement'
import SkinApproval from './SkinApproval'
import CapeApproval from './CapeApproval'
import SystemSettings from './SystemSettings'
import AdminSkinManagement from './AdminSkinManagement'

const { Sider, Content } = Layout

interface AdminDashboardProps {}

export function AdminDashboard(_props: AdminDashboardProps) {
  const { user } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')

  if (!user || user.level < 1) {
    return <div>权限不足</div>
  }

  const isSuperAdmin = user.level >= 2

  const menuItems: MenuProps['items'] = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: '用户管理',
      // level >= 1 可用（管理员以上）
    },
    {
      key: 'skins',
      icon: <SkinOutlined />,
      label: '皮肤审核',
      // level >= 1 可用
    },
    {
      key: 'capes',
      icon: <SkinOutlined />,
      label: '披风审核',
      // level >= 1 可用
    },
    {
      key: 'skin-management',
      icon: <AppstoreOutlined />,
      label: '皮肤管理',
      // level >= 1 可用（管理员可管理所有皮肤）
    },
    ...(isSuperAdmin ? [{
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    }] : []),
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardContent />
      case 'users':
        return <UserManagement />
      case 'skins':
        return <SkinApproval />
      case 'capes':
        return <CapeApproval />
      case 'skin-management':
        return <AdminSkinManagement />
      case 'settings':
        return <SystemSettings />
      default:
        return <DashboardContent />
    }
  }

  return (
    <Layout style={{ minHeight: '80vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{ background: '#fff' }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => setActiveTab(key)}
          style={{ height: '100%', borderRight: 0 }}
        />
      </Sider>
      <Content style={{ padding: '20px', background: '#fff' }}>
        <Spin spinning={false}>
          {renderContent()}
        </Spin>
      </Content>
    </Layout>
  )
}

// 仪表盘组件
function DashboardContent() {
  const [stats, setStats] = useState({
    userCount: 0,
    skinCount: 0,
    pendingCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const { token } = useAuthStore()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('请求失败')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      message.error('加载统计数据失败')
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>仪表盘</h2>
      <Row gutter={20} style={{ marginTop: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="用户总数"
              value={stats.userCount}
              loading={loading}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="皮肤总数"
              value={stats.skinCount}
              loading={loading}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pendingCount}
              loading={loading}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
