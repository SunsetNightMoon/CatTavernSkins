import { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, message, Modal, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAuthStore } from '../../store/authStore'

interface Skin {
  id: string;
  user_uid: number;
  uploader_name?: string;
  file_path: string;
  model_type: string;
  license_type: string;
  permission_level: string;
  approval_status: string;
  download_count: number;
  view_count: number;
  created_at: string;
}

function SkinApproval() {
  const [skins, setSkins] = useState<Skin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSkin, setSelectedSkin] = useState<Skin | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const { token } = useAuthStore()

  useEffect(() => {
    loadPendingSkins()
  }, [])

  const loadPendingSkins = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/skins/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errorMessage || `请求失败: ${response.status}`);
      }
      const data = await response.json()
      setSkins(data)
    } catch (error: any) {
      message.error(`加载皮肤列表失败: ${error.message}`)
      console.error('加载皮肤列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (skinId: string) => {
    try {
      const response = await fetch(`/api/admin/skins/${skinId}/approve`, {
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
      loadPendingSkins()
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`)
      console.error('审核皮肤失败:', error)
    }
  }

  const handleReject = (skinId: string) => {
    Modal.confirm({
      title: '拒绝皮肤',
      content: '确定要拒绝这个皮肤吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/skins/${skinId}/reject`, {
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
          loadPendingSkins()
        } catch (error: any) {
          message.error(`操作失败: ${error.message}`)
          console.error('拒绝皮肤失败:', error)
        }
      },
    })
  }

  const handleViewDetail = (skin: Skin) => {
    setSelectedSkin(skin)
    setDetailVisible(true)
  }

  const columns: ColumnsType<Skin> = [
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
      render: (name: string | undefined, record: Skin) => name || `UID.${record.user_uid}`,
    },
    {
      title: '预览',
      key: 'preview',
      width: 70,
      render: (_, record: Skin) => (
        <img
          src={record.file_path.startsWith('./') ? record.file_path.replace(/^\./, '') : record.file_path}
          alt="Skin"
          style={{ width: 40, height: 40, border: '1px solid #d9d9d9', imageRendering: 'pixelated' }}
        />
      ),
    },
    {
      title: '模型',
      dataIndex: 'model_type',
      key: 'model_type',
      width: 80,
      render: (type: string) => type === 'default' ? '经典' : '纤细',
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
      render: (_, record: Skin) => (
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
      <h2>皮肤审核</h2>
      <Table 
        columns={columns} 
        dataSource={skins} 
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个` }}
        size="small"
      />

      <Modal
        title="皮肤详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedSkin && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img 
                src={selectedSkin.file_path} 
                alt="Skin" 
                style={{ maxWidth: '100%', border: '1px solid #d9d9d9' }}
              />
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{selectedSkin.id}</Descriptions.Item>
              <Descriptions.Item label="上传者">{selectedSkin.uploader_name || `UID.${selectedSkin.user_uid}`}</Descriptions.Item>
              <Descriptions.Item label="模型类型">
                {selectedSkin.model_type === 'default' ? '经典' : '纤细'}
              </Descriptions.Item>
              <Descriptions.Item label="协议">
                <Tag>{selectedSkin.license_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="权限级别">
                {selectedSkin.permission_level === 'private' && '私有'}
                {selectedSkin.permission_level === 'public_no_download' && '公开不可下载'}
                {selectedSkin.permission_level === 'public_downloadable' && '公开可下载'}
              </Descriptions.Item>
              <Descriptions.Item label="审核状态">
                {selectedSkin.approval_status === 'pending' && <Tag color="orange">待审核</Tag>}
                {selectedSkin.approval_status === 'approved' && <Tag color="green">已通过</Tag>}
                {selectedSkin.approval_status === 'rejected' && <Tag color="red">已拒绝</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="下载次数">{selectedSkin.download_count}</Descriptions.Item>
              <Descriptions.Item label="浏览次数">{selectedSkin.view_count}</Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {new Date(selectedSkin.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SkinApproval
