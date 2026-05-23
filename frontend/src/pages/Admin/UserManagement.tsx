import { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, message, Modal, Form, Select, DatePicker, Popconfirm, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography
import { useAuthStore } from '../../store/authStore'
import dayjs from 'dayjs'

interface UserRecord {
  id: string
  user_uid: number
  email: string
  role: string
  level: number
  is_active: number
  email_verified: number
  banned_until: string | null
  created_at: string
}

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

function getBanStatus(bannedUntil: string | null): { text: string; color: string } {
  if (!bannedUntil || bannedUntil === '') {
    return { text: '正常', color: 'green' }
  }
  if (bannedUntil === 'permanent') {
    return { text: '永久封禁', color: 'red' }
  }
  if (new Date(bannedUntil) > new Date()) {
    return { text: `封禁至 ${new Date(bannedUntil).toLocaleDateString('zh-CN')}`, color: 'orange' }
  }
  return { text: '正常', color: 'green' }
}

export default function UserManagement() {
  const { user: currentUser, token } = useAuthStore()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 角色编辑弹窗
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleModalLoading, setRoleModalLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [roleForm] = Form.useForm()

  // 封禁弹窗
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banModalLoading, setBanModalLoading] = useState(false)
  const [banType, setBanType] = useState<'temporary' | 'permanent' | 'unban'>('unban')
  const [banForm] = Form.useForm()

  // 邮箱验证操作
  const [sendingVerification, setSendingVerification] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `请求失败: ${response.status}`);
      }
      const data = await response.json()
      setUsers(data)
    } catch (error: any) {
      message.error(`加载用户列表失败: ${error.message}`)
      console.error('加载用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (userId: string, _isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `操作失败: ${response.status}`);
      }
      message.success('操作成功')
      loadUsers()
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`)
      console.error('切换激活状态失败:', error)
    }
  }

  // 打开角色编辑弹窗
  const openRoleModal = (user: UserRecord) => {
    setEditingUser(user)
    roleForm.setFieldsValue({ level: user.level })
    setRoleModalOpen(true)
  }

  // 提交角色修改
  const handleRoleSubmit = async () => {
    if (!editingUser) return
    try {
      const values = await roleForm.validateFields()
      setRoleModalLoading(true)
      const response = await fetch(`/api/admin/users/${editingUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `操作失败: ${response.status}`);
      }
      message.success('角色已更新')
      setRoleModalOpen(false)
      loadUsers()
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`)
      console.error('更新角色失败:', error)
    } finally {
      setRoleModalLoading(false)
    }
  }

  // 打开封禁弹窗
  const openBanModal = (user: UserRecord, type: 'temporary' | 'permanent' | 'unban') => {
    setEditingUser(user)
    setBanType(type)
    banForm.resetFields()
    setBanModalOpen(true)
  }

  // 提交封禁
  const handleBanSubmit = async () => {
    if (!editingUser) return
    try {
      const values = await banForm.validateFields()
      setBanModalLoading(true)

      let bannedUntil: string | null = null
      if (banType === 'permanent') {
        bannedUntil = 'permanent'
      } else if (banType === 'temporary') {
        bannedUntil = values.expiryDate.format('YYYY-MM-DDTHH:mm:ss.sssZ')
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bannedUntil }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `操作失败: ${response.status}`);
      }
      message.success(banType === 'unban' ? '已解除封禁' : '封禁操作成功')
      setBanModalOpen(false)
      loadUsers()
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`)
      console.error('封禁操作失败:', error)
    } finally {
      setBanModalLoading(false)
    }
  }

  const isSuperAdmin = currentUser && currentUser.level >= 2

  // 发送验证邮件
  const handleSendVerification = async (userId: string) => {
    setSendingVerification(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '发送失败')
      message.success('验证邮件已发送')
    } catch (err: any) {
      message.error(err.message || '发送失败')
    } finally {
      setSendingVerification(null)
    }
  }

  // 手动验证邮箱
  const handleVerifyEmail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || '操作失败')
      message.success('邮箱已验证')
      loadUsers()
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  // 切换账号激活状态（权限：只能操作 level < 当前用户的用户，不能操作自己）
  const canToggleActive = (record: UserRecord): boolean => {
    if (!currentUser) return false
    if (record.id === currentUser.id) return false
    if (record.level >= currentUser.level) return false
    return true
  }

  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户 ID',
      dataIndex: 'user_uid',
      key: 'user_uid',
      width: 90,
      render: (uid: number) => <Text strong>{uid}</Text>,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
      render: (email: string) => <span style={{ whiteSpace: 'nowrap' }}>{email}</span>,
    },
    {
      title: '身份',
      dataIndex: 'level',
      key: 'level',
      width: 180,
      render: (level: number, record: UserRecord) => (
        <Space>
          <Tag color={getRoleTagColor(level)}>{getRoleName(level)}</Tag>
          {isSuperAdmin && record.id !== currentUser?.id && record.level < 2 && (
            <Button type="link" size="small" onClick={() => openRoleModal(record)}>
              修改
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: '账号状态',
      dataIndex: 'banned_until',
      key: 'banned_until',
      width: 180,
      render: (bannedUntil: string | null) => {
        const status = getBanStatus(bannedUntil)
        return <Tag color={status.color}>{status.text}</Tag>
      },
    },
    {
      title: '活跃状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (isActive: number, record: UserRecord) => {
        if (!canToggleActive(record)) {
          return isActive ? (
            <Tag color="green">正常</Tag>
          ) : (
            <Tag color="red">已禁用</Tag>
          )
        }
        return (
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleActive(record.id, !isActive)}
          >
            {isActive ? (
              <Tag color="green">正常</Tag>
            ) : (
              <Tag color="red">已禁用</Tag>
            )}
          </Button>
        )
      },
    },
    {
      title: '封禁操作',
      key: 'ban',
      width: 180,
      render: (_: any, record: UserRecord) => {
        // 不能操作自己
        if (record.id === currentUser?.id) return <Text type="secondary">-</Text>
        // 不能操作同级或更高级的用户
        if (record.level >= (currentUser?.level ?? 0)) return <Text type="secondary">-</Text>

        const banStatus = getBanStatus(record.banned_until)
        const isBanned = banStatus.color !== 'green'

        if (isBanned) {
          return (
            <Popconfirm
              title="确认解除封禁？"
              onConfirm={() => openBanModal(record, 'unban')}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                解除封禁
              </Button>
            </Popconfirm>
          )
        }

        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => openBanModal(record, 'temporary')}
            >
              临时封禁
            </Button>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => openBanModal(record, 'permanent')}
            >
              永久封禁
            </Button>
          </Space>
        )
      },
    },
    {
      title: '邮箱验证',
      dataIndex: 'email_verified',
      key: 'email_verified',
      width: 200,
      render: (verified: number, record: UserRecord) => {
        const isVerified = verified === 1
        return (
          <Space>
            <Tag color={isVerified ? 'green' : 'orange'}>
              {isVerified ? '已验证' : '未验证'}
            </Tag>
            {!isVerified && (
              <Space size={4}>
                <Tooltip title="手动验证此用户邮箱">
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleVerifyEmail(record.id)}
                  >
                    验证
                  </Button>
                </Tooltip>
                <Tooltip title="发送验证邮件">
                  <Button
                    type="link"
                    size="small"
                    loading={sendingVerification === record.id}
                    onClick={() => handleSendVerification(record.id)}
                  >
                    发送邮件
                  </Button>
                </Tooltip>
              </Space>
            )}
          </Space>
        )
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ]

  return (
    <div>
      <h2>用户管理</h2>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      {/* 角色编辑弹窗 */}
      <Modal
        title={`修改用户身份 - ${editingUser?.email}`}
        open={roleModalOpen}
        onOk={handleRoleSubmit}
        onCancel={() => setRoleModalOpen(false)}
        confirmLoading={roleModalLoading}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={roleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="level"
            label="身份等级"
            rules={[{ required: true, message: '请选择身份' }]}
          >
            <Select>
              <Select.Option value={0}>普通用户</Select.Option>
              <Select.Option value={1}>管理员</Select.Option>
              {isSuperAdmin && editingUser?.id === currentUser?.id && (
                <Select.Option value={2}>超级管理员</Select.Option>
              )}
            </Select>
          </Form.Item>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            <div>Level 2 - 超级管理员（完全控制）</div>
            <div>Level 1 - 管理员（审核皮肤）</div>
            <div>Level 0 - 普通用户</div>
          </div>
        </Form>
      </Modal>

      {/* 封禁弹窗 */}
      <Modal
        title={
          banType === 'unban'
            ? `解除封禁 - ${editingUser?.email}`
            : banType === 'permanent'
              ? `永久封禁 - ${editingUser?.email}`
              : `临时封禁 - ${editingUser?.email}`
        }
        open={banModalOpen}
        onOk={handleBanSubmit}
        onCancel={() => setBanModalOpen(false)}
        confirmLoading={banModalLoading}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: banType !== 'unban' }}
      >
        {banType === 'unban' ? (
          <div style={{ marginTop: 16 }}>
            <p>确认解除该用户的封禁状态？</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>解除封禁后，用户可以正常登录。</p>
          </div>
        ) : banType === 'permanent' ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>警告：此操作将永久封禁该用户！</p>
            <p>永久封禁后：</p>
            <ul>
              <li>用户将无法登录</li>
              <li>所有登录令牌将被清除</li>
              <li>封禁不可自动解除，只能由管理员手动解除</li>
            </ul>
          </div>
        ) : (
          <Form form={banForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              name="expiryDate"
              label="封禁截止日期"
              rules={[{ required: true, message: '请选择封禁截止日期' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                placeholder="选择封禁截止日期"
              />
            </Form.Item>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              封禁截止日期到后，用户将自动解除封禁。
            </p>
          </Form>
        )}
      </Modal>
    </div>
  )
}
