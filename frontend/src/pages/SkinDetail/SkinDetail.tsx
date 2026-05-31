import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button, Tag, Card, Descriptions, Spin, message, Space, Divider, Typography, Alert, Switch, Modal, Input } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, HeartOutlined, HeartFilled, StarOutlined } from '@ant-design/icons'
import type { Skin } from '../../types'
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
  'Custom': 'default',
  'AI_CC0': 'geekblue',
}

export function SkinDetail() {
  usePageTitle('皮肤详情')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [skin, setSkin] = useState<Skin | null>(null)
  const [loading, setLoading] = useState(true)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const { isAuthenticated, user, token } = useAuthStore()

  const skinId = id || ''

  // 从后端获取收藏状态
  const [isFavoritedByUser, setIsFavoritedByUser] = useState(false)

  // 管理员警告弹窗
  const [warningModalVisible, setWarningModalVisible] = useState(false)
  const [warningText, setWarningText] = useState('')

  // 当前用户是否为发布者
  const isUploader = user ? Number(user.user_uid) === Number(skin?.user_uid) : false

  // 返回材质库（保持 tab + 页码）
  const handleBack = useCallback(() => {
    const s = location.state as { returnTab?: string; returnPage?: number } | null
    if (s?.returnTab) {
      const params = new URLSearchParams()
      params.set('tab', s.returnTab)
      if (s.returnPage && s.returnPage > 1) params.set(`${s.returnTab}Page`, String(s.returnPage))
      navigate(`/library?${params.toString()}`)
    } else {
      navigate('/library')
    }
  }, [location.state, navigate])

  // 加载皮肤详情 + 收藏状态
  useEffect(() => {
    loadSkinDetail()
  }, [id])

  // 用户登录状态或 skin 变化时，刷新收藏状态
  useEffect(() => {
    if (!skin) return
    loadFavoriteStatus()
  }, [skinId, token])

  const loadSkinDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/library/skins/${id}`)
      const data = await response.json()
      setSkin(data)
    } catch (error) {
      console.error('加载皮肤详情失败:', error)
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadFavoriteStatus = async () => {
    try {
      // 获取收藏数
      const countRes = await fetch(`/api/skins/${skinId}/favorite-count`)
      if (countRes.ok) {
        const countData = await countRes.json()
        setFavoriteCount(countData.favoriteCount || 0)
      }

      // 获取当前用户是否收藏（需要登录）
      if (token) {
        const statusRes = await fetch(`/api/skins/${skinId}/is-favorited`, {
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
    if (!skin) return

    try {
      const response = await fetch(skin.file_path)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `skin_${skin.id}.png`
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
      message.info('您是此皮肤的发布者，无需操作')
      return
    }

    try {
      if (isFavoritedByUser) {
        // 取消收藏
        const res = await fetch(`/api/skins/${skinId}/favorite`, {
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
        const res = await fetch(`/api/skins/${skinId}/favorite`, {
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

  const handleAddWarning = async () => {
    if (!warningText.trim()) return
    try {
      const res = await fetch(`/api/admin/skins/${skinId}/warning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ warning: warningText.trim() })
      })
      if (!res.ok) throw new Error('添加失败')
      setSkin(prev => prev ? { ...prev, admin_warning: warningText.trim(), warning_set_by_level: user?.level } : null)
      message.success('已添加警告')
    } catch (e: any) {
      message.error(e.message || '操作失败')
    } finally {
      setWarningModalVisible(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!skin) {
    return <div>皮肤不存在</div>
  }

  const canDownload = skin.permission_level === 'public_downloadable'
  // 显示"已收藏"：发布者 或 已收藏
  const isShownAsFavorited = isUploader || isFavoritedByUser

  return (
    <div style={{ padding: '20px' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={handleBack}
        style={{ marginBottom: 20 }}
      >
        返回材质库
      </Button>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        {/* 左侧：3D预览 */}
        <div style={{ flex: '0 0 auto' }}>
          <Skin3DViewer
            skinUrl={skin.file_path}
            modelType={skin.model_type}
            width={350}
            height={400}
          />
        </div>

        {/* 右侧：皮肤详情 */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <h2 style={{ marginBottom: 12 }}>
            {skin.name || '未命名皮肤'}
          </h2>

          {/* 标签 */}
          {skin.tags && skin.tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Space size={[4, 4]} wrap>
                {skin.tags.map((tag: string) => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </Space>
            </div>
          )}

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
              下载 {skin.download_count}
            </Text>
            <Text type="secondary">
              <StarOutlined style={{ marginRight: 4 }} />
              浏览 {skin.view_count}
            </Text>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* 详细信息表格 */}
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="上传者">
              {skin.uploader_name || `UID.${skin.user_uid}`}
              {isUploader && <Tag color="purple" style={{ marginLeft: 8 }}>我发布的</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="模型类型">
              {skin.model_type === 'default' ? '经典' : '纤细'}
            </Descriptions.Item>
            <Descriptions.Item label="协议类型">
              <Tag color={LICENSE_TAG_COLORS[skin.license_type]}>
                {skin.license_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="权限级别">
              {skin.permission_level === 'private' && '私有'}
              {skin.permission_level === 'public_no_download' && '公开不可下载'}
              {skin.permission_level === 'public_downloadable' && '公开可下载'}
            </Descriptions.Item>
            <Descriptions.Item label="审核状态">
              {skin.approval_status === 'pending' && <Tag color="orange">待审核</Tag>}
              {skin.approval_status === 'approved' && <Tag color="green">已通过</Tag>}
              {skin.approval_status === 'rejected' && <Tag color="red">已拒绝</Tag>}
            </Descriptions.Item>
          </Descriptions>

          {/* 管理员操作区 + 红色警告 */}
      {user && user.level >= 1 && (
        <Card size="small" style={{ marginTop: 16, border: '1px solid #d9d9d9' }}>
          <div style={{ marginBottom: 8 }}><b>管理员操作</b></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>AI 生成标记：</span>
            <Switch
              checked={!!skin.is_ai_generated}
              onChange={async (checked) => {
                try {
                  const res = await fetch(`/api/admin/skins/${skin.id}/ai-generated`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ is_ai_generated: checked })
                  });
                  if (!res.ok) throw new Error('操作失败');
                  setSkin({ ...skin, is_ai_generated: checked ? 1 : 0 });
                  message.success(checked ? '已标记为 AI 生成' : '已取消 AI 标记');
                } catch (e: any) {
                  message.error(e.message || '操作失败');
                }
              }}
            />
            {user.level >= 2 && (
              <>
                {skin.admin_warning ? (
                  <Button size="small" danger onClick={async () => {
                    try {
                      const res = await fetch(`/api/admin/skins/${skin.id}/warning`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!res.ok) throw new Error('移除失败');
                      setSkin({ ...skin, admin_warning: null, warning_set_by_level: null });
                      message.success('已移除警告');
                    } catch (e: any) {
                      message.error(e.message || '操作失败');
                    }
                  }}>移除警告</Button>
                ) : (
                  <Button size="small" danger onClick={() => {
                    setWarningText('');
                    setWarningModalVisible(true);
                  }}>添加警告</Button>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* 红色警告 */}
      {skin.admin_warning && (
        <Alert
          type="error"
          showIcon
          message="管理员警告"
          description={skin.admin_warning}
          style={{ marginTop: 16 }}
        />
      )}

          {/* 简介卡片 */}
          {skin.description && (
            <Card size="small" style={{ marginTop: 16 }} title="描述">
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{skin.description}</Paragraph>
            </Card>
          )}
        </div>
      </div>

      <Modal
        title="添加管理员警告"
        open={warningModalVisible}
        onOk={handleAddWarning}
        onCancel={() => setWarningModalVisible(false)}
        okText="确认添加"
        cancelText="取消"
        destroyOnClose
      >
        <Input.TextArea
          rows={4}
          placeholder="输入警告内容..."
          value={warningText}
          onChange={e => setWarningText(e.target.value)}
        />
      </Modal>
    </div>
  )
}
