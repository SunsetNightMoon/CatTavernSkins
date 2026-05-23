import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, message, Modal, Form, Input, Select } from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Skin {
  id: number
  file_path: string
  name: string
  description: string
  model_type: string
  license_type: string
  permission_level: string
  approval_status: string
  download_count: number
  view_count: number
  created_at: string
}

function getPermissionText(level: string): string {
  switch (level) {
    case 'private': return '私有'
    case 'public_no_download': return '公开不可下载'
    case 'public_downloadable': return '公开可下载'
    default: return level
  }
}

function getStatusTag(status: string) {
  const map: Record<string, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待审核' },
    approved: { color: 'green', text: '已通过' },
    rejected: { color: 'red', text: '已拒绝' },
  }
  const s = map[status] || { color: 'default', text: status }
  return <Tag color={s.color}>{s.text}</Tag>
}

export default function MySkins() {
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const [skins, setSkins] = useState<Skin[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSkin, setEditingSkin] = useState<Skin | null>(null)
  const [editForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Skin | null>(null)

  const loadSkins = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/skins', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      setSkins(data)
    } catch (e) {
      message.error('加载皮肤列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSkins() }, [loadSkins])

  const handleEdit = (skin: Skin) => {
    setEditingSkin(skin)
    editForm.setFieldsValue({
      name: skin.name,
      description: skin.description || '',
      permission_level: skin.permission_level,
      license_type: skin.license_type,
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingSkin) return
    try {
      const values = await editForm.validateFields()
      setSubmitting(true)
      const res = await fetch(`/api/skins/${editingSkin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.errorMessage || '更新失败')
      }
      message.success('皮肤信息已更新')
      setEditModalOpen(false)
      loadSkins()
    } catch (e: any) {
      message.error(e.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/skins/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('删除失败')
      message.success('皮肤已删除')
      setDeleteTarget(null)
      loadSkins()
    } catch (e) {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Skin> = [
    {
      title: '预览',
      key: 'preview',
      width: 80,
      render: (_, r) => (
        <img src={r.file_path.startsWith('./') ? r.file_path.replace(/^\./, '') : r.file_path}
          alt="" style={{ width: 40, height: 20, border: '1px solid #d9d9d9', imageRendering: 'pixelated' }} />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '模型',
      dataIndex: 'model_type',
      key: 'model_type',
      width: 80,
      render: (t: string) => t === 'slim' ? '纤细' : '经典',
    },
    {
      title: '权限',
      dataIndex: 'permission_level',
      key: 'permission_level',
      width: 120,
      render: (t: string) => <Tag>{getPermissionText(t)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'approval_status',
      key: 'approval_status',
      width: 90,
      render: (t: string) => getStatusTag(t),
    },
    {
      title: '浏览/下载',
      key: 'stats',
      width: 100,
      render: (_, r) => `${r.view_count || 0} / ${r.download_count || 0}`,
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteTarget(r)}>删除</Button>
        </Space>
      ),
    },
  ]

  if (!user) return <div style={{ padding: 20 }}>请先登录</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>我的皮肤</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/upload')}>上传新皮肤</Button>
      </div>

      <Table
        columns={columns}
        dataSource={skins}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑皮肤信息"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="皮肤名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="皮肤名称" maxLength={50} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="皮肤描述（可选）" maxLength={200} />
          </Form.Item>
          <Form.Item name="license_type" label="协议类型" rules={[{ required: true, message: '请选择协议' }]}>
            <Select>
              <Select.Option value="ARR">ARR（保留所有权利）</Select.Option>
              <Select.Option value="CC0">CC0（公有领域）</Select.Option>
              <Select.Option value="CC-BY">CC-BY（署名）</Select.Option>
              <Select.Option value="CC-BY-SA">CC-BY-SA（署名-相同方式共享）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="permission_level" label="权限级别" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="private">私有（仅自己可见）</Select.Option>
              <Select.Option value="public_no_download">公开不可下载</Select.Option>
              <Select.Option value="public_downloadable">公开可下载</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onOk={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {deleteTarget && (
          <div>
            <p>确定要删除皮肤 <strong>{deleteTarget.name}</strong> 吗？</p>
            <p style={{ color: '#999', fontSize: 12 }}>此操作不可撤销，皮肤文件将被永久删除。</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
