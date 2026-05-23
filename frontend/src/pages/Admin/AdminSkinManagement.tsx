import { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, message, Modal, Form, Input, Select, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuthStore } from '../../store/authStore'

interface Skin {
  id: string
  user_uid: number
  uploader_name: string
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

function getPermissionTag(level: string) {
  const map: Record<string, { color: string; text: string }> = {
    private: { color: 'default', text: '私有' },
    public_no_download: { color: 'blue', text: '公开不可下载' },
    public_downloadable: { color: 'green', text: '公开可下载' },
  }
  const s = map[level] || { color: 'default', text: level }
  return <Tag color={s.color}>{s.text}</Tag>
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

export default function AdminSkinManagement() {
  const [skins, setSkins] = useState<Skin[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const { token } = useAuthStore()
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSkin, setEditingSkin] = useState<Skin | null>(null)
  const [editForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const loadSkins = async (p: number = page) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/skins?page=${p}&limit=${pageSize}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `请求失败: ${res.status}`);
      }
      const data = await res.json()
      setSkins(data.skins || data)
      if (data.total !== undefined) setTotal(data.total)
    } catch (e: any) {
      message.error(`加载皮肤列表失败: ${e.message}`)
      console.error('加载皮肤列表失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSkins(1) }, [])

  const handlePageChange = (p: number) => {
    setPage(p)
    loadSkins(p)
  }

  const handleEdit = (skin: Skin) => {
    setEditingSkin(skin)
    editForm.setFieldsValue({
      name: skin.name,
      description: skin.description || '',
      license_type: skin.license_type,
      permission_level: skin.permission_level,
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editingSkin) return
    try {
      const values = await editForm.validateFields()
      setSubmitting(true)
      const res = await fetch(`/api/admin/skins/${editingSkin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('更新失败')
      message.success('皮肤信息已更新')
      setEditModalOpen(false)
      loadSkins(page)
    } catch (e) {
      message.error('更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (skin: Skin) => {
    try {
      const res = await fetch(`/api/admin/skins/${skin.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('删除失败')
      message.success('皮肤已删除')
      loadSkins(page)
    } catch (e) {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Skin> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 230,
      ellipsis: true,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '预览',
      key: 'preview',
      width: 70,
      render: (_: any, r: Skin) => (
        <img
          src={r.file_path.startsWith('./') ? r.file_path.replace(/^\./, '') : r.file_path}
          alt=""
          style={{ width: 40, height: 40, border: '1px solid #d9d9d9', imageRendering: 'pixelated' }}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 120,
    },
    {
      title: '上传者',
      key: 'uploader',
      width: 110,
      render: (_: any, r: Skin) => r.uploader_name || `UID.${r.user_uid}`,
    },
    {
      title: '权限',
      dataIndex: 'permission_level',
      key: 'permission_level',
      width: 120,
      render: (t: string) => getPermissionTag(t),
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
      width: 90,
      render: (_: any, r: Skin) => `${r.view_count || 0} / ${r.download_count || 0}`,
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_: any, r: Skin) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除此皮肤？" onConfirm={() => handleDelete(r)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>皮肤管理</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 13 }}>
        共 {total || skins.length} 个皮肤，以下是所有用户上传的皮肤。
      </p>
      <Table
        columns={columns}
        dataSource={skins}
        rowKey="id"
        loading={loading}
        pagination={total > pageSize ? { current: page, total, pageSize, onChange: handlePageChange } : false}
        size="small"
        scroll={{ x: 900 }}
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
    </div>
  )
}
