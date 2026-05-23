import { useState, useEffect } from 'react'
import { Table, Tag, Button, message, Modal, Form, Input, Select, DatePicker, Popconfirm, Typography, Card, Statistic, Row, Col } from 'antd'
import { DeleteOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Text, Paragraph } = Typography
import { useAuthStore } from '../../store/authStore'
import dayjs from 'dayjs'

interface BlacklistRecord {
  id: number
  email: string | null
  ip_address: string | null
  ban_type: 'permanent' | 'temporary'
  ban_until: string | null
  reason: string | null
  banned_by: string
  created_at: string
}

export default function BlacklistManagement() {
  const { token } = useAuthStore()
  const [blacklist, setBlacklist] = useState<BlacklistRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ permanent: 0, temporary: 0, expired: 0 })

  // 添加黑名单弹窗
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalLoading, setAddModalLoading] = useState(false)
  const [addForm] = Form.useForm()

  // 清理过期黑名单
  const [cleaningExpired, setCleaningExpired] = useState(false)

  useEffect(() => {
    loadBlacklist()
  }, [])

  const loadBlacklist = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/blacklist', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('请求失败')
      const data = await response.json()
      setBlacklist(data)

      // 计算统计
      const permanent = data.filter((item: BlacklistRecord) => item.ban_type === 'permanent').length
      const temporary = data.filter((item: BlacklistRecord) => item.ban_type === 'temporary').length
      const expired = data.filter((item: BlacklistRecord) => {
        if (item.ban_type === 'temporary' && item.ban_until) {
          return new Date(item.ban_until) <= new Date()
        }
        return false
      }).length

      setStats({ permanent, temporary, expired })
    } catch (error) {
      message.error('加载黑名单失败')
      console.error('加载黑名单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToBlacklist = async () => {
    try {
      const values = await addForm.validateFields()
      setAddModalLoading(true)

      const payload: any = {
        ban_type: values.ban_type,
        reason: values.reason || null,
      }

      if (values.email) {
        payload.email = values.email
      }
      if (values.ip_address) {
        payload.ip_address = values.ip_address
      }
      if (values.ban_type === 'temporary' && values.ban_until) {
        payload.ban_until = values.ban_until.toISOString()
      }

      const response = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.errorMessage || '添加失败')
      }

      message.success('已添加到黑名单')
      setAddModalOpen(false)
      addForm.resetFields()
      loadBlacklist()
    } catch (error: any) {
      message.error(error.message || '添加失败')
    } finally {
      setAddModalLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/blacklist/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.errorMessage || '删除失败')
      }

      message.success('已从黑名单移除')
      loadBlacklist()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const handleCleanupExpired = async () => {
    setCleaningExpired(true)
    try {
      const response = await fetch('/api/admin/blacklist/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.errorMessage || '清理失败')
      }

      const data = await response.json()
      message.success(`已清理 ${data.deletedCount} 条过期记录`)
      loadBlacklist()
    } catch (error: any) {
      message.error(error.message || '清理失败')
    } finally {
      setCleaningExpired(false)
    }
  }

  const getBanTypeTag = (banType: string, banUntil: string | null) => {
    if (banType === 'permanent') {
      return <Tag color="red">永久封禁</Tag>
    } else {
      const isExpired = banUntil && new Date(banUntil) <= new Date()
      return (
        <Tag color={isExpired ? 'default' : 'orange'}>
          临时封禁 {isExpired ? '(已过期)' : ''}
        </Tag>
      )
    }
  }

  const columns: ColumnsType<BlacklistRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) => email ? <Text copyable={{ text: email }}>{email}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip: string | null) => ip ? <Text copyable={{ text: ip }}>{ip}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '封禁类型',
      dataIndex: 'ban_type',
      key: 'ban_type',
      width: 120,
      render: (banType: string, record: BlacklistRecord) => getBanTypeTag(banType, record.ban_until),
    },
    {
      title: '封禁截止',
      dataIndex: 'ban_until',
      key: 'ban_until',
      width: 160,
      render: (banUntil: string | null) => {
        if (!banUntil) return <Text type="secondary">永久</Text>
        const isExpired = new Date(banUntil) <= new Date()
        return (
          <Text type={isExpired ? 'secondary' : 'warning'}>
            {new Date(banUntil).toLocaleString('zh-CN')}
          </Text>
        )
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      render: (reason: string | null) => reason ? <Text ellipsis>{reason}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '封禁时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: BlacklistRecord) => (
        <Popconfirm
          title="确认从黑名单移除？"
          onConfirm={() => handleDelete(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <h2>黑名单管理</h2>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        管理被封禁的邮箱和 IP 地址。加入黑名单的用户将无法注册和登录，即使注销后重新注册也会被阻止。
      </Paragraph>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="永久封禁"
              value={stats.permanent}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="临时封禁"
              value={stats.temporary}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="已过期"
              value={stats.expired}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            addForm.resetFields()
            setAddModalOpen(true)
          }}
        >
          添加到黑名单
        </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={handleCleanupExpired}
            loading={cleaningExpired}
            disabled={stats.expired === 0}
          >
            清理过期记录 ({stats.expired})
          </Button>
      </div>

      {/* 黑名单列表 */}
      <Table
        columns={columns}
        dataSource={blacklist}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ x: 1000 }}
      />

      {/* 添加黑名单弹窗 */}
      <Modal
        title="添加到黑名单"
        open={addModalOpen}
        onOk={handleAddToBlacklist}
        onCancel={() => {
          setAddModalOpen(false)
          addForm.resetFields()
        }}
        confirmLoading={addModalLoading}
        okText="添加"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="email"
            label="邮箱"
            extra="填写邮箱或 IP 地址，至少填写一项"
          >
            <Input placeholder="输入要封禁的邮箱" />
          </Form.Item>
          <Form.Item
            name="ip_address"
            label="IP 地址"
          >
            <Input placeholder="输入要封禁的 IP 地址" />
          </Form.Item>
          <Form.Item
            name="ban_type"
            label="封禁类型"
            rules={[{ required: true, message: '请选择封禁类型' }]}
            initialValue="permanent"
          >
            <Select>
              <Select.Option value="permanent">永久封禁</Select.Option>
              <Select.Option value="temporary">临时封禁</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.ban_type !== currentValues.ban_type}
          >
            {() => {
              const banType = addForm.getFieldValue('ban_type')
              return banType === 'temporary' ? (
                <Form.Item
                  name="ban_until"
                  label="封禁截止时间"
                  rules={[{ required: true, message: '请选择封禁截止时间' }]}
                >
                  <DatePicker
                    showTime
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD HH:mm"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Form.Item>
              ) : null
            }}
          </Form.Item>
          <Form.Item
            name="reason"
            label="封禁原因"
          >
            <Input.TextArea placeholder="输入封禁原因（可选）" rows={3} />
          </Form.Item>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
            <div style={{ color: '#ff4d4f', fontWeight: 500, marginBottom: 4 }}>注意：</div>
            <div>• 添加到黑名单后，该邮箱/IP 将无法注册和登录</div>
            <div>• 即使注销账号后重新注册，也会被阻止</div>
            <div>• 临时封禁到期后，记录会自动清理</div>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
