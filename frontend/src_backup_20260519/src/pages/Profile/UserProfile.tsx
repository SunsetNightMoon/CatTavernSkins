import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Descriptions, message, Tag, Divider, Typography,
  Modal, Form, Input, Spin, Alert, Space,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { SkinAvatar } from '../../components/SkinAvatar'
import { profileService } from '../../services/profileService'

const { Text } = Typography

function getRoleName(level: number): string {
  switch (level) {
    case 2: return '超级管理员'
    case 1: return '管理员'
    default: return '普通用户'
  }
}

function getRoleTagColor(level: number): string {
  switch (level) {
    case 2: return 'red'
    case 1: return 'blue'
    default: return 'default'
  }
}

interface ProfileInfo {
  id: string
  name: string
  skin_id?: number
  cape_id?: number
  name_changed_at?: string | null
}

export function UserProfile() {
  const { user, skinUrl, profileName, setProfileName, clearAuth, updateUser, setSkinUrl } = useAuthStore()
  const navigate = useNavigate()

  // 角色信息
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  // 编辑名称
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [checkResult, setCheckResult] = useState<{ available: boolean; message: string } | null>(null)
  const [checkingName, setCheckingName] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // 获取角色信息和最新用户数据
  useEffect(() => {
    if (!user) return
    const fetchProfiles = async () => {
      setLoadingProfiles(true)
      try {
        const data = await profileService.getMe()
        // 同步更新用户信息（角色、验证状态等可能已被管理员修改）
        if (data.user) {
          updateUser(data.user)
        }
        if (data.skinUrl !== undefined) {
          setSkinUrl(data.skinUrl || null)
        }
        if (data.profiles) {
          setProfiles(data.profiles)
        }
      } catch (err: any) {
        console.error('获取角色信息失败:', err)
      } finally {
        setLoadingProfiles(false)
      }
    }
    fetchProfiles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const primaryProfile = profiles[0]
  const currentGameName = primaryProfile?.name || profileName || ''
  const nameChangedAt = primaryProfile?.name_changed_at

  // 计算冷却
  function getCooldownInfo(): { inCooldown: boolean; daysRemaining: number; canChangeAt?: Date } {
    if (!nameChangedAt) return { inCooldown: false, daysRemaining: 0 }
    const lastChanged = new Date(nameChangedAt)
    const cooldownEnd = new Date(lastChanged)
    cooldownEnd.setDate(cooldownEnd.getDate() + 30)
    const now = new Date()
    if (now < cooldownEnd) {
      const daysRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { inCooldown: true, daysRemaining, canChangeAt: cooldownEnd }
    }
    return { inCooldown: false, daysRemaining: 0 }
  }

  const cooldown = getCooldownInfo()

  const handleLogout = () => {
    clearAuth()
    message.success('已退出登录')
    navigate('/login')
  }

  // 打开编辑弹窗
  const openEditModal = () => {
    setEditName(currentGameName)
    setCheckResult(null)
    setIsEditModalOpen(true)
  }

  // 检测名称可用性
  const handleCheckName = async () => {
    if (!editName || editName.length < 3 || editName.length > 16) {
      setCheckResult({ available: false, message: '名称长度必须在3-16个字符之间' })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(editName)) {
      setCheckResult({ available: false, message: '名称只能包含字母、数字和下划线' })
      return
    }
    if (editName === currentGameName) {
      setCheckResult({ available: false, message: '新名称与当前名称相同' })
      return
    }
    setCheckingName(true)
    try {
      const result = await profileService.checkNameAvailability(editName)
      setCheckResult(result)
    } catch (err: any) {
      setCheckResult({ available: false, message: err.response?.data?.errorMessage || '检测失败' })
    } finally {
      setCheckingName(false)
    }
  }

  // 保存名称
  const handleSaveName = async () => {
    if (!primaryProfile?.id) {
      message.error('未找到角色信息')
      return
    }
    setSavingName(true)
    try {
      const result = await profileService.updateName(primaryProfile.id, editName)
      message.success(result.message || '角色名已更新')
      setProfileName(editName)
      // 刷新角色信息
      const meData = await profileService.getMe()
      if (meData.profiles) {
        setProfiles(meData.profiles)
      }
      setIsEditModalOpen(false)
    } catch (err: any) {
      const errMsg = err.response?.data?.errorMessage || '更新失败'
      if (err.response?.status === 429) {
        const days = err.response?.data?.days_remaining
        message.error(`改名冷却中，${days}天后可再次改名`)
      } else {
        message.error(errMsg)
      }
    } finally {
      setSavingName(false)
    }
  }

  if (!user) {
    return <div style={{ padding: 20 }}>请先登录</div>
  }

  // 兼容后端返回的 number 类型（SQLite 返回 0/1）
  const isVerified = user.email_verified === true || user.email_verified === 1

  // 封禁状态判断
  const bannedUntil = user.banned_until as string | null
  const isBanned = bannedUntil !== null && bannedUntil !== '' && (
    bannedUntil === 'permanent' || new Date(bannedUntil) > new Date()
  )
  const isPermanentBan = bannedUntil === 'permanent'
  const banExpiryText = !isPermanentBan && bannedUntil
    ? `解除日期: ${new Date(bannedUntil).toLocaleDateString('zh-CN')}`
    : null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 16 }}
      >
        返回皮肤库
      </Button>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        {/* 头部：头像 + 邮箱 + UID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <SkinAvatar skinUrl={skinUrl || undefined} size={80} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
              {currentGameName || user.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text type="secondary">UID: {user.user_uid}</Text>
              <Divider type="vertical" />
              <Tag color={getRoleTagColor(user.level)}>{getRoleName(user.level)}</Tag>
              {isVerified ? (
                <Tag color="green">已验证</Tag>
              ) : (
                <Tag color="orange">未验证</Tag>
              )}
            </div>
          </div>
        </div>

        {/* 账号状态 */}
        {isBanned ? (
          <div style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ color: '#cf1322' }}>账号状态：已被封禁</Text>
              {isPermanentBan ? (
                <Tag color="red">永久封禁</Tag>
              ) : banExpiryText ? (
                <Tag color="orange">{banExpiryText}</Tag>
              ) : null}
            </div>
            {banExpiryText && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                封禁截止日期：{new Date(bannedUntil!).toLocaleDateString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </Text>
            )}
          </div>
        ) : (
          <div style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
          }}>
            <Text strong style={{ color: '#389e0d' }}>账号状态：正常</Text>
          </div>
        )}

        {/* 详细信息 */}
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户 ID">{user.user_uid}</Descriptions.Item>
          <Descriptions.Item label="玩家名称">
            <Space>
              <Text strong style={{ fontSize: 16 }}>
                {loadingProfiles ? <Spin size="small" /> : (currentGameName || '—')}
              </Text>
              <Button size="small" icon={<EditOutlined />} onClick={openEditModal}>
                编辑
              </Button>
            </Space>
            {cooldown.inCooldown && (
              <div style={{ marginTop: 4 }}>
                <Tag color="orange">
                  改名冷却中：{cooldown.daysRemaining} 天后可再次改名
                </Tag>
              </div>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            {user.email}
            {isVerified ? (
              <Tag color="green" style={{ marginLeft: 8 }}>已验证</Tag>
            ) : (
              <Tag color="orange" style={{ marginLeft: 8 }}>未验证</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="身份">
            <Tag color={getRoleTagColor(user.level)}>{getRoleName(user.level)}</Tag>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              (Level {user.level})
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="账号状态">
            {isBanned ? (
              isPermanentBan ? (
                <Tag color="red">被封禁 &lt;永久封禁&gt;</Tag>
              ) : (
                <Tag color="orange">
                  被封禁 &lt;{new Date(bannedUntil!).toLocaleDateString('zh-CN')} 解除&gt;
                </Tag>
              )
            ) : (
              <Tag color="green">正常</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* 操作按钮 */}
        <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="primary" onClick={() => navigate('/upload')}>
            上传皮肤
          </Button>
          <Button onClick={() => navigate('/my-skins')}>
            我的皮肤
          </Button>
          {user.level >= 1 && (
            <Button type="dashed" onClick={() => navigate('/admin')}>
              管理面板
            </Button>
          )}
          <Button danger onClick={handleLogout} style={{ marginLeft: 'auto' }}>
            退出登录
          </Button>
        </div>
      </div>

      {/* 编辑名称弹窗 */}
      <Modal
        title="编辑玩家名称"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsEditModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={savingName}
            disabled={!checkResult?.available || cooldown.inCooldown}
            onClick={handleSaveName}
          >
            保存
          </Button>,
        ]}
      >
        {cooldown.inCooldown && (
          <Alert
            type="warning"
            message={`改名冷却中：${cooldown.daysRemaining} 天后可再次改名`}
            description={`下次可改名时间：${cooldown.canChangeAt?.toLocaleDateString('zh-CN')}`}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Form layout="vertical">
          <Form.Item label="当前名称">
            <Input value={currentGameName} disabled />
          </Form.Item>
          <Form.Item label="新名称">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  setCheckResult(null)
                }}
                placeholder="输入新名称（3-16个字符，字母/数字/下划线）"
                maxLength={16}
                disabled={cooldown.inCooldown}
              />
              <Button
                onClick={handleCheckName}
                loading={checkingName}
                disabled={!editName || cooldown.inCooldown}
              >
                检测可用性
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>

        {checkResult && (
          <div style={{ marginTop: 8 }}>
            {checkResult.available ? (
              <Alert
                type="success"
                icon={<CheckCircleOutlined />}
                message={checkResult.message}
                showIcon
              />
            ) : (
              <Alert
                type="error"
                icon={<CloseCircleOutlined />}
                message={checkResult.message}
                showIcon
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
