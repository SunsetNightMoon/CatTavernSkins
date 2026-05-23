import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button, Tag, Card, Descriptions, Spin, message, Space, Divider, Typography } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, HeartOutlined, HeartFilled, StarOutlined } from '@ant-design/icons'
import type { Cape } from '../../types'
import { Skin3DViewer } from '../../components/Skin3DViewer/Skin3DViewer'
import { useAuthStore } from '../../store/authStore'
import { usePageTitle } from '../../hooks/usePageTitle'

const { Text, Paragraph } = Typography

const LICENSE_TAG_COLORS: Record<string, string> = {
  'CC0_1.0': 'green',
  'CC_BY_3.0': 'blue',
  'CC_BY_4.0': 'blue',
  'CC_BY-SA_3.0': 'cyan',
  'CC_BY-SA_4.0': 'cyan',
  'CC_BY-NC_3.0': 'purple',
  'CC_BY-NC_4.0': 'purple',
  'ARR': 'red',
  'GPLv3': 'orange',
  'Custom': 'default',
}

export function CapeDetail() {
  usePageTitle('披风详情')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [cape, setCape] = useState<Cape | null>(null)
  const [loading, setLoading] = useState(true)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const { isAuthenticated, user, token } = useAuthStore()

  const capeId = id || ''

  // 从后端获取收藏状态
  const [isFavoritedByUser, setIsFavoritedByUser] = useState(false)

  // 当前用户是否为发布者
  const isUploader = user ? Number(user.user_uid) === Number(cape?.user_uid) : false

  // 加载披风详情 + 收藏状态
  useEffect(() => {
    loadCapeDetail()
  }, [id])

  // 用户登录状态或 cape 变化时，刷新收藏状态
  useEffect(() => {
    if (!cape) return
    loadFavoriteStatus()
  }, [capeId, token])

  const loadCapeDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/library/capes/${id}`)
      const data = await response.json()
      setCape(data)
    } catch (error) {
      console.error('加载披风详情失败:', error)
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadFavoriteStatus = async () => {
    try {
      // 获取收藏数
      const countRes = await fetch(`/api/capes/${capeId}/favorite-count`)
      if (countRes.ok) {
        const countData = await countRes.json()
        setFavoriteCount(countData.favoriteCount || 0)
      }

      // 获取当前用户是否收藏（需要登录）
      if (token) {
        const statusRes = await fetch(`/api/capes/${capeId}/is-favorited`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          setIsFavoritedByUser(statusData.isFavorited)
        }
      } else {
        setIsFavoritedByUser(false)
      }
    } catch (error) {
      console.error('加载收藏状态失败:', error)
    }
  }

  const handleDownload = async () => {
    if (!cape) return

    try {
      const response = await fetch(cape.file_path)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cape_${cape.id}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      message.success('下载成功')
    } catch (error) {
      message.error('下载失败')
    }
  }

  const handleFavorite = async () => {
    if (!isAuthenticated || !token) {
      message.info('请先登录后再收藏')
      return
    }

    // 发布者无法移除收藏
    if (isUploader) {
      message.info('您是此披风的发布者，无需操作')
      return
    }

    try {
      if (isFavoritedByUser) {
        // 取消收藏
        const res = await fetch(`/api/capes/${capeId}/favorite`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.errorMessage || '取消收藏失败')
        }
        setIsFavoritedByUser(false)
        setFavoriteCount(c => Math.max(0, c - 1))
        message.success('已取消收藏')
      } else {
        // 添加收藏
        const res = await fetch(`/api/capes/${capeId}/favorite`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.errorMessage || '收藏失败')
        }
        setIsFavoritedByUser(true)
        setFavoriteCount(c => c + 1)
        message.success('已收藏，可在衣柜中查看')
      }

      // 重新获取最新收藏数
      loadFavoriteStatus()
    } catch (error: any) {
      message.error(error.message || '操作失败')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!cape) {
    return <div>披风不存在</div>
  }

  const canDownload = cape.permission_level === 'public_downloadable'
  // 显示"已收藏"：发布者 或 已收藏
  const isShownAsFavorited = isUploader || isFavoritedByUser

  return (
    <div style={{ padding: '20px' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => {
          const s = location.state as { returnTab?: string; returnPage?: number } | null
          if (s?.returnTab) {
            const params = new URLSearchParams()
            params.set('tab', s.returnTab)
            if (s.returnPage && s.returnPage > 1) params.set(`${s.returnTab}Page`, String(s.returnPage))
            navigate(`/library?${params.toString()}`)
          } else {
            navigate('/library')
          }
        }}
        style={{ marginBottom: 20 }}
      >
        返回材质库
      </Button>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        {/* 左侧：3D预览 */}
        <div style={{ flex: '0 0 auto' }}>
          <Skin3DViewer
            skinUrl="/steve.png"
            capeUrl={cape.file_path}
            modelType="default"
            width={350}
            height={400}
            initialBackView={true}
          />
        </div>

        {/* 右侧：披风详情 */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <h2 style={{ marginBottom: 12 }}>
            {cape.name || '未命名披风'}
          </h2>

          {/* 操作按钮 */}
          <Space style={{ marginBottom: 16 }}>
            <Button
              type={isShownAsFavorited ? 'primary' : 'default'}
              icon={isShownAsFavorited ? <HeartFilled /> : <HeartOutlined />}
              onClick={handleFavorite}
              disabled={isUploader}
              title={isUploader ? '发布者默认收藏' : undefined}
            >
              {isUploader ? '已收藏' : isFavoritedByUser ? '已收藏' : '收藏'}
            </Button>
            {canDownload && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                下载
              </Button>
            )}
          </Space>

          {/* 统计信息 */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Text type="secondary">
              <HeartOutlined style={{ marginRight: 4 }} />
              收藏 {favoriteCount}
            </Text>
            <Text type="secondary">
              <DownloadOutlined style={{ marginRight: 4 }} />
              下载 {cape.download_count}
            </Text>
            <Text type="secondary">
              <StarOutlined style={{ marginRight: 4 }} />
              浏览 {cape.view_count}
            </Text>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* 详细信息表格 */}
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="上传者">
              {cape.uploader_name || `UID.${cape.user_uid}`}
              {isUploader && <Tag color="purple" style={{ marginLeft: 8 }}>我发布的</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="尺寸">
              {cape.width} × {cape.height}
            </Descriptions.Item>
            <Descriptions.Item label="协议类型">
              <Tag color={LICENSE_TAG_COLORS[cape.license_type]}>
                {cape.license_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="权限级别">
              {cape.permission_level === 'private' && '私有'}
              {cape.permission_level === 'public_no_download' && '公开不可下载'}
              {cape.permission_level === 'public_downloadable' && '公开可下载'}
            </Descriptions.Item>
            <Descriptions.Item label="审核状态">
              {cape.approval_status === 'pending' && <Tag color="orange">待审核</Tag>}
              {cape.approval_status === 'approved' && <Tag color="green">已通过</Tag>}
              {cape.approval_status === 'rejected' && <Tag color="red">已拒绝</Tag>}
            </Descriptions.Item>
          </Descriptions>

          {/* 简介卡片 */}
          {cape.description && (
            <Card size="small" style={{ marginTop: 16 }} title="描述">
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cape.description}</Paragraph>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
