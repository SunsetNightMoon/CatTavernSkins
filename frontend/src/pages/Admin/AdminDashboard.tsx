import { useState, useEffect } from 'react'
import { Layout, Menu, Spin, Statistic, Row, Col, Card, message } from 'antd'
import { 
  DashboardOutlined, 
  UserOutlined, 
  SkinOutlined,
  SettingOutlined,
  AppstoreOutlined,
  BlockOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../../store/authStore'
import { useSiteStore } from '../../store/siteStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import UserManagement from './UserManagement'
import SkinApproval from './SkinApproval'
import CapeApproval from './CapeApproval'
import { SystemSettings } from './SystemSettings'
import AdminSkinManagement from './AdminSkinManagement'
import AdminCapeManagement from './AdminCapeManagement'
import BlacklistManagement from './BlacklistManagement'
import AdminErrorBoundary from './AdminErrorBoundary'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const { Sider, Content } = Layout

interface AdminDashboardProps {}

export function AdminDashboard(_props: AdminDashboardProps) {
  usePageTitle('管理面板')
  const { user } = useAuthStore()
  
  // 从 localStorage 读取上次的活动标签页，默认 'dashboard'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('admin-active-tab') || 'dashboard'
    } catch {
      return 'dashboard'
    }
  })

  // 持久化 activeTab 到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('admin-active-tab', activeTab)
    } catch (error) {
      console.error('保存管理面板标签页状态失败:', error)
    }
  }, [activeTab])

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
    {
      key: 'cape-management',
      icon: <AppstoreOutlined />,
      label: '披风管理',
      // level >= 1 可用（管理员可管理所有披风）
    },
    ...(isSuperAdmin ? [{
      key: 'blacklist',
      icon: <BlockOutlined />,
      label: '黑名单管理',
    }] : []),
    ...(isSuperAdmin ? [{
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    }] : []),
  ]

  const renderContent = () => {
    const content = (() => {
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
        case 'cape-management':
          return <AdminCapeManagement />
        case 'blacklist':
          return <BlacklistManagement />
        case 'settings':
          return <SystemSettings />
        default:
          return <DashboardContent />
      }
    })()
    
    return <AdminErrorBoundary>{content}</AdminErrorBoundary>
  }

  return (
    <Layout style={{ minHeight: '80vh' }}>
      <Sider 
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => setActiveTab(key)}
          style={{ height: '100%', borderRight: 0 }}
        />
      </Sider>
      <Content style={{ padding: '20px', overflowX: 'auto' }}>
        <Spin spinning={false}>
          {renderContent()}
        </Spin>
      </Content>
    </Layout>
  )
}

// 仪表盘组件
function DashboardContent() {
  const theme = useSiteStore((s) => s.theme)
  const isDark = theme === 'dark'

  // recharts 颜色配置
  const axisColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  const tooltipBg = isDark ? '#1a1a2e' : '#fff'
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)'
  const tooltipColor = isDark ? '#fff' : '#333'
  const legendColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'
  const cardTitleColor = isDark ? '#fff' : '#1a1a2e'

  const [stats, setStats] = useState({
    userCount: 0,
    skinCount: 0,
    pendingCount: 0,
  })
  const [dailyStats, setDailyStats] = useState<{
    days: string[];
    skinUploads: number[];
    capeUploads: number[];
    userRegistrations: number[];
    pendingSubmissions: number[];
    banCounts: number[];
  }>({ days: [], skinUploads: [], capeUploads: [], userRegistrations: [], pendingSubmissions: [], banCounts: [] })
  const [loading, setLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)
  const { token } = useAuthStore()

  useEffect(() => {
    loadStats()
    loadDailyStats()
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

  const loadDailyStats = async () => {
    setChartsLoading(true)
    try {
      const response = await fetch('/api/admin/stats/daily?days=7', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('请求失败')
      const data = await response.json()
      setDailyStats(data)
    } catch (error) {
      message.error('加载趋势数据失败')
      console.error('加载趋势数据失败:', error)
    } finally {
      setChartsLoading(false)
    }
  }

  // 将 dailyStats 转换为 Recharts 数据格式
  const chartData = dailyStats.days.map((date, i) => ({
    date: date.slice(5), // MM-DD 格式
    fullDate: date,
    skinUploads: dailyStats.skinUploads[i] ?? 0,
    capeUploads: dailyStats.capeUploads[i] ?? 0,
    userRegistrations: dailyStats.userRegistrations[i] ?? 0,
    pendingSubmissions: dailyStats.pendingSubmissions[i] ?? 0,
    banCounts: dailyStats.banCounts[i] ?? 0,
  }))

  return (
    <div>
      <h2>仪表盘</h2>

      {/* 统计卡片 */}
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

      {/* 折线图区域 */}
      <Spin spinning={chartsLoading}>
        {/* 投稿趋势：皮肤 + 披风 */}
        <Card title="投稿趋势（近7天）" style={{ marginTop: 20 }} headStyle={{ color: cardTitleColor }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  color: tooltipColor,
                }}
              />
              <Legend wrapperStyle={{ color: legendColor }} />
              <Line
                type="monotone"
                dataKey="skinUploads"
                name="皮肤投稿"
                stroke="#4a9eff"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="capeUploads"
                name="披风投稿"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* 用户注册趋势 */}
        <Card title="用户注册趋势（近7天）" style={{ marginTop: 20 }} headStyle={{ color: cardTitleColor }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  color: tooltipColor,
                }}
              />
              <Legend wrapperStyle={{ color: legendColor }} />
              <Line
                type="monotone"
                dataKey="userRegistrations"
                name="新注册用户"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* 待审核趋势 */}
        <Card title="待审核新增趋势（近7天）" style={{ marginTop: 20 }} headStyle={{ color: cardTitleColor }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  color: tooltipColor,
                }}
              />
              <Legend wrapperStyle={{ color: legendColor }} />
              <Line
                type="monotone"
                dataKey="pendingSubmissions"
                name="待审核新增"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* 封禁趋势 */}
        <Card title="封禁趋势（近7天）" style={{ marginTop: 20 }} headStyle={{ color: cardTitleColor }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  color: tooltipColor,
                }}
              />
              <Legend wrapperStyle={{ color: legendColor }} />
              <Line
                type="monotone"
                dataKey="banCounts"
                name="新增封禁"
                stroke="#ff4d4f"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Spin>
    </div>
  )
}
