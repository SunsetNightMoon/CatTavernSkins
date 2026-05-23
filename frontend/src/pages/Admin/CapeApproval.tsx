import { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, message, Modal, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAuthStore } from '../../store/authStore'

interface Cape {
  id: string
  user_uid: number
  uploader_name?: string
  file_path: string
  name?: string
  description?: string
  license_type: string
  permission_level: string
  approval_status: string
  created_at: string
}

function CapeApproval() {
  const [capes, setCapes] = useState<Cape[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCape, setSelectedCape] = useState<Cape | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const { token } = useAuthStore()

  useEffect(() => {
    loadPendingCapes()
  }, [])

  const loadPendingCapes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/capes/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `请求失败: ${response.status}`);
      }
      const data = await response.json()
      setCapes(data)
    } catch (error: any) {
      message.error(`加载披风列表失败: ${error.message}`)
      console.error('加载披风列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (capeId: string) => {
    try {
      const response = await fetch(`/api/admin/capes/${capeId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `操作失败: ${response.status}`);
      }
      message.success('审核通过')
      loadPendingCapes()
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`)
      console.error('审核披风失败:', error)
    }
  }

  const handleReject = (capeId: string) => {
    Modal.confirm({
      title: '拒绝披风',
      content: '确定要拒绝这个披风吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/capes/${capeId}/reject`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.errorMessage || `操作失败: ${response.status}`);
          }
          message.success('已拒绝')
          loadPendingCapes()
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`)
          console.error('拒绝披风失败:', error)
        }
      },
    })
  }

  const handleViewDetail = (cape: Cape) => {
    setSelectedCape(cape)
    setDetailVisible(true)
  }

  const columns: ColumnsType<Cape> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '上传者',
      dataIndex: 'uploader_name',
      key: 'uploader_name',
      width: 100,
      render: (name: string | undefined, record: Cape) => name || `UID${record.user_uid}`,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '预览',
      key: 'preview',
      width: 70,
      render: (_, record: Cape) => (
        <img
          src={record.file_path.startsWith('./') ? record.file_path.replace(/^\./, '') : record.file_path}
          alt="Cape"
          style={{ width: 60, height: 'auto', objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.05)', imageRendering: 'pixelated' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ),
    },
    {
      title: '协议',
      dataIndex: 'license_type',
      key: 'license_type',
      width: 120,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '权限',
      dataIndex: 'permission_level',
      key: 'permission_level',
      width: 120,
      render: (level: string) => {
        const map: Record<string, string> = {
          private: '私有',
          public_no_download: '公开不可下载',
          public_downloadable: '公开可下载',
        }
        return map[level] || level
      },
    },
    {
      title: '状态',
      dataIndex: 'approval_status',
      key: 'approval_status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          approved: 'green',
          rejected: 'red',
        }
        const textMap: Record<string, string> = {
          pending: '待审核',
          approved: '已通过',
          rejected: '已拒绝',
        }
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record: Cape) => (
        <Space>
          <Button type="link" onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          {record.approval_status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                type="primary"
                danger
                size="small"
                onClick={() => handleReject(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>披风审核</h2>
      <Table
        columns={columns}
        dataSource={capes}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个` }}
        size="small"
      />

      <Modal
        title="披风详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedCape && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img
                src={selectedCape.file_path}
                alt="Cape"
                style={{ maxWidth: '100%', border: '1px solid #d9d9d9' }}
              />
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{selectedCape.id}</Descriptions.Item>
              <Descriptions.Item label="上传者">{selectedCape.uploader_name || `UID${selectedCape.user_uid}`}</Descriptions.Item>
              <Descriptions.Item label="名称">{selectedCape.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedCape.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="协议">
                <Tag>{selectedCape.license_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="权限级别">
                {selectedCape.permission_level === 'private' && '私有'}
                {selectedCape.permission_level === 'public_no_download' && '公开不可下载'}
                {selectedCape.permission_level === 'public_downloadable' && '公开可下载'}
              </Descriptions.Item>
              <Descriptions.Item label="审核状态">
                {selectedCape.approval_status === 'pending' && <Tag color="orange">待审核</Tag>}
                {selectedCape.approval_status === 'approved' && <Tag color="green">已通过</Tag>}
                {selectedCape.approval_status === 'rejected' && <Tag color="red">已拒绝</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {new Date(selectedCape.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CapeApproval
