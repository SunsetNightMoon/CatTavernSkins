import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Descriptions, message, Tag, Divider, Typography,
  Modal, Form, Input, Spin, Alert, Space,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, MailOutlined, LinkOutlined, CopyOutlined, ExclamationCircleOutlined, LockOutlined, SafetyOutlined, KeyOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { SkinAvatar } from '../../components/SkinAvatar'
import { profileService } from '../../services/profileService'
import { usePageTitle } from '../../hooks/usePageTitle'

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
  skin_id?: string
  cape_id?: string
  name_changed_at?: string | null
}

export function UserProfile() {
  usePageTitle('个人中心')
  const { user, token, skinUrl, profileName, setProfileName, clearAuth, updateUser, setSkinUrl } = useAuthStore()
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
  // 发送验证邮件
  const [sendingVerify, setSendingVerify] = useState(false)

  // 注销账号
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // 功能区 - 修改密码
  const [changePwdModalOpen, setChangePwdModalOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // 功能区 - 找回密码
  const [forgotPwdStep, setForgotPwdStep] = useState<0 | 1>(0)
  const [forgotPwdModalOpen, setForgotPwdModalOpen] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [sendingResetEmail, setSendingResetEmail] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

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
  const nameChangedAt = primaryProfile?.name_changed_at ?? undefined

  // Yggdrasil API 根地址：优先使用环境变量中的后端地址
  const apiBaseUrl = (import.meta as any).env.VITE_API_URL || window.location.origin
  const yggUrl = apiBaseUrl
  const authlibUrl = `authlib-injector:yggdrasil-server:${encodeURIComponent(yggUrl)}`

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

  // 发送验证邮件
  const handleSendVerification = async () => {
    setSendingVerify(true)
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '发送失败')
      message.success('验证邮件已发送，请查收邮箱')
    } catch (err: any) {
      message.error(err.message || '发送失败')
    } finally {
      setSendingVerify(false)
    }
  }

  // 注销账号
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      message.error('请输入密码')
      return
    }

    setDeletingAccount(true)
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.errorMessage || '注销失败')
      }

      message.success('账号已注销')
      clearAuth()
      navigate('/login')
    } catch (err: any) {
      message.error(err.message || '注销失败')
    } finally {
      setDeletingAccount(false)
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      message.error('请填写所有字段')
      return
    }
    if (newPassword.length < 6) {
      message.error('新密码长度至少6位')
      return
    }
    if (newPassword !== confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '修改失败')

      message.success('密码已修改，请重新登录')
      setChangePwdModalOpen(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // 修改密码后要求重新登录
      clearAuth()
      navigate('/login')
    } catch (err: any) {
      message.error(err.message || '修改失败')
    } finally {
      setChangingPassword(false)
    }
  }

  // 发送密码重置邮件
  const handleSendResetEmail = async () => {
    setSendingResetEmail(true)
    try {
      const res = await fetch('/api/auth/send-reset-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '发送失败')

      message.success('重置邮件已发送，请查收邮箱')
      setForgotPwdStep(1)
    } catch (err: any) {
      message.error(err.message || '发送失败')
    } finally {
      setSendingResetEmail(false)
    }
  }

  // 使用验证码重置密码
  const handleResetPassword = async () => {
    if (!resetCode || !forgotNewPassword || !forgotConfirmPassword) {
      message.error('请填写所有字段')
      return
    }
    if (forgotNewPassword.length < 6) {
      message.error('新密码长度至少6位')
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }

    setResettingPassword(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: resetCode, newPassword: forgotNewPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '重置失败')

      message.success('密码已重置，请使用新密码登录')
      setForgotPwdModalOpen(false)
      setForgotPwdStep(0)
      setResetCode('')
      setForgotNewPassword('')
      setForgotConfirmPassword('')
      clearAuth()
      navigate('/login')
    } catch (err: any) {
      message.error(err.message || '重置失败')
    } finally {
      setResettingPassword(false)
    }
  }

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
        onClick={() => navigate('/library')}
        style={{ marginBottom: 16 }}
      >
        返回材质库
      </Button>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24 }}>
        {/* 头部：头像 + 邮箱 + UID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <SkinAvatar skinUrl={skinUrl || undefined} size={80} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4, color: 'var(--text-primary)' }}>
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
            background: 'rgba(207, 19, 34, 0.12)',
            border: '1px solid rgba(207, 19, 34, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ color: '#ff7875' }}>账号状态：已被封禁</Text>
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
            background: 'rgba(56, 158, 13, 0.12)',
            border: '1px solid rgba(56, 158, 13, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
          }}>
            <Text strong style={{ color: '#95de64' }}>账号状态：正常</Text>
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
            <Space>
              <Text>{user.email}</Text>
              {isVerified ? (
                <Tag color="green">已验证</Tag>
              ) : (
                <>
                  <Tag color="orange">未验证</Tag>
                  <Button size="small" icon={<MailOutlined />} loading={sendingVerify} onClick={handleSendVerification}>
                    立即验证
                  </Button>
                </>
              )}
            </Space>
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

      {/* Yggdrasil 认证服务器卡片 */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 24,
        marginTop: 20,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
          <LinkOutlined style={{ marginRight: 8 }} />
          添加 Yggdrasil 认证服务器
        </div>

        <div style={{
          background: 'var(--bg-inner)',
          border: '1px dashed var(--border-color)',
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
          marginBottom: 20,
        }}>
          <div
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', authlibUrl)
              e.dataTransfer.setData('text/uri-list', authlibUrl)
              e.dataTransfer.effectAllowed = 'all'
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 32px',
              background: '#238636',
              color: '#fff',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'grab',
              userSelect: 'none',
              boxShadow: '0 4px 16px rgba(35, 134, 54, 0.35)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(35, 134, 54, 0.45)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(35, 134, 54, 0.35)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            将此按钮拖至启动器
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-weak)' }}>
            支持 HMCL、PCL2 等支持 Yggdrasil 的启动器
          </div>
        </div>

        <Divider style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            手动填写
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={yggUrl}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(yggUrl)
                message.success('已复制到剪贴板')
              }}
            >
              复制
            </Button>
          </Space.Compact>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-muted)' }}>使用说明</div>
          <div>1. 拖拽方式：按住上方绿色按钮，直接拖入 HMCL / PCL2 启动器的认证服务器添加区域</div>
          <div>2. 手动方式：复制上方 API 地址，在启动器中粘贴添加</div>
          <div>3. 添加成功后，使用你的邮箱和密码登录即可</div>
        </div>
      </div>

      {/* 功能区 + 危险区 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginTop: 20,
      }}>
        {/* 功能区卡片 - 所有用户可见 */}
        <div style={{
          background: 'rgba(82,196,26,0.06)',
          border: '1px solid rgba(82,196,26,0.3)',
          borderRadius: 12,
          padding: 24,
          gridColumn: user.level >= 2 ? '1 / -1' : undefined,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyOutlined />
            功能区
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.8 }}>
            <div>管理你的账号安全设置，包括修改密码或通过邮件验证找回密码。</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button
              icon={<LockOutlined />}
              size="large"
              onClick={() => {
                setOldPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setChangePwdModalOpen(true)
              }}
              style={{ fontWeight: 500, justifyContent: 'flex-start' }}
            >
              修改密码
            </Button>
            <Button
              icon={<KeyOutlined />}
              size="large"
              onClick={() => {
                setForgotPwdStep(0)
                setResetCode('')
                setForgotNewPassword('')
                setForgotConfirmPassword('')
                setForgotPwdModalOpen(true)
              }}
              style={{ fontWeight: 500, justifyContent: 'flex-start' }}
            >
              找回密码
            </Button>
          </div>
        </div>

        {/* 危险区卡片 - 仅非超级管理员可见 */}
        {user.level < 2 && (
          <div style={{
            background: 'rgba(255,77,79,0.06)',
            border: '1px solid rgba(255,77,79,0.3)',
            borderRadius: 12,
            padding: 24,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#ff4d4f', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationCircleOutlined />
              危险区
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.8 }}>
              <div>注销账号将<Text strong style={{ color: '#ff4d4f' }}>永久删除</Text>你的所有数据，包括：</div>
              <div>• 账号信息（邮箱、密码等）</div>
              <div>• 所有上传的皮肤和披风</div>
              <div>• 角色信息</div>
              <div>• 收藏记录</div>
              <div style={{ marginTop: 8, color: 'var(--text-subtle)' }}>此操作不可恢复，请谨慎操作。</div>
            </div>
            <Button
              danger
              size="large"
              onClick={() => {
                setDeletePassword('')
                setDeleteModalOpen(true)
              }}
              style={{ fontWeight: 500 }}
            >
              注销我的账号
            </Button>
          </div>
        )}
      </div>

      {/* 注销账号确认弹窗 */}
      <Modal
        title={
          <span style={{ color: '#ff4d4f' }}>
            <ExclamationCircleOutlined style={{ marginRight: 8 }} />
            确认注销账号
          </span>
        }
        open={deleteModalOpen}
        onCancel={() => {
          setDeleteModalOpen(false)
          setDeletePassword('')
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setDeleteModalOpen(false)
            setDeletePassword('')
          }}>
            取消
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deletingAccount}
            disabled={!deletePassword}
            onClick={handleDeleteAccount}
          >
            确认注销
          </Button>,
        ]}
      >
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            此操作将<Text strong style={{ color: '#ff4d4f' }}>永久删除</Text>你的账号和所有数据，且不可恢复。
          </div>
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,77,79,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--text-secondary)' }}>将被删除的数据：</div>
            <div>• 账号信息（邮箱、密码）</div>
            <div>• 所有上传的皮肤和披风文件</div>
            <div>• 角色信息（游戏 ID）</div>
            <div>• 所有收藏记录</div>
          </div>
          <div style={{ marginBottom: 8, color: 'var(--text-muted)' }}>请输入密码以确认：</div>
          <Input.Password
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="输入你的登录密码"
            onPressEnter={handleDeleteAccount}
            style={{ fontSize: 14 }}
          />
        </div>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title={<span><LockOutlined style={{ marginRight: 8 }} />修改密码</span>}
        open={changePwdModalOpen}
        onCancel={() => {
          setChangePwdModalOpen(false)
          setOldPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setChangePwdModalOpen(false)
            setOldPassword('')
            setNewPassword('')
            setConfirmPassword('')
          }}>
            取消
          </Button>,
          <Button
            key="change"
            type="primary"
            loading={changingPassword}
            disabled={!oldPassword || !newPassword || !confirmPassword}
            onClick={handleChangePassword}
          >
            确认修改
          </Button>,
        ]}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="原密码" required>
            <Input.Password
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="输入当前密码"
            />
          </Form.Item>
          <Form.Item label="新密码" required>
            <Input.Password
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少6位）"
            />
          </Form.Item>
          <Form.Item label="确认新密码" required>
            <Input.Password
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              onPressEnter={handleChangePassword}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 找回密码弹窗 */}
      <Modal
        title={<span><KeyOutlined style={{ marginRight: 8 }} />{forgotPwdStep === 0 ? '找回密码' : '输入验证码'}</span>}
        open={forgotPwdModalOpen}
        onCancel={() => {
          setForgotPwdModalOpen(false)
          setForgotPwdStep(0)
          setResetCode('')
          setForgotNewPassword('')
          setForgotConfirmPassword('')
        }}
        footer={forgotPwdStep === 0 ? [
          <Button key="cancel" onClick={() => {
            setForgotPwdModalOpen(false)
            setForgotPwdStep(0)
          }}>
            取消
          </Button>,
          <Button
            key="send"
            type="primary"
            loading={sendingResetEmail}
            onClick={handleSendResetEmail}
          >
            发送重置邮件
          </Button>,
        ] : [
          <Button key="back" onClick={() => setForgotPwdStep(0)}>
            上一步
          </Button>,
          <Button
            key="reset"
            type="primary"
            loading={resettingPassword}
            disabled={!resetCode || !forgotNewPassword || !forgotConfirmPassword}
            onClick={handleResetPassword}
          >
            确认重置
          </Button>,
        ]}
      >
        {forgotPwdStep === 0 ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              我们将向你的邮箱 <Text strong>{user.email}</Text> 发送一封包含验证码的密码重置邮件。
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              验证码有效期为 30 分钟，请在收到邮件后尽快完成重置。
            </p>
          </div>
        ) : (
          <Form layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="验证码" required>
              <Input
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="输入邮件中的8位验证码"
                maxLength={8}
              />
            </Form.Item>
            <Form.Item label="新密码" required>
              <Input.Password
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                placeholder="输入新密码（至少6位）"
              />
            </Form.Item>
            <Form.Item label="确认新密码" required>
              <Input.Password
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                onPressEnter={handleResetPassword}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

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
