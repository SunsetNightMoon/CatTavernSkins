import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Row, Col, Pagination, Card, Tag, Spin, Tabs, Empty } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { Skin, Cape } from '../../types'
import { SkinThumbnail3D } from '../../components/SkinThumbnail3D/SkinThumbnail3D'

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

function SkinCard({ skin, onClick }: { skin: Skin; onClick: () => void }) {
  // 默认Steve模型预览
  const previewModel = skin.model_type === 'slim' ? 'slim' : 'default'

  return (
    <Card
      hoverable
      cover={
        <div style={{ padding: 16, textAlign: 'center' }}>
          <SkinThumbnail3D
            skinUrl={skin.file_path}
            modelType={previewModel}
            width={140}
            height={180}
          />
        </div>
      }
      onClick={onClick}
    >
      <Card.Meta
        title={skin.name ? `${skin.name} (#${skin.id})` : `#${skin.id} ${skin.model_type === 'slim' ? '纤细' : '经典'}`}
        description={
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>上传者: {skin.uploader_name || `UID.${skin.user_uid}`}</div>
            <div style={{ marginTop: 6 }}>
              <Tag color={LICENSE_TAG_COLORS[skin.license_type]}>{skin.license_type}</Tag>
            </div>
            <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>
              下载: {skin.download_count} | 浏览: {skin.view_count}
            </div>
          </div>
        }
      />
    </Card>
  )
}

function CapeCard({ cape, onClick }: { cape: Cape & { approval_status?: string }; onClick: () => void }) {
  const isPending = cape.approval_status === 'pending'
  const isRejected = cape.approval_status === 'rejected'
  // 披风卡片：默认Steve + 披风叠加预览
  return (
    <Card
      hoverable
      cover={
        <div style={{ padding: 16, textAlign: 'center', position: 'relative' }}>
          <SkinThumbnail3D
            skinUrl="/steve.png"
            capeUrl={cape.file_path}
            modelType="default"
            width={140}
            height={180}
          />
          {isPending && (
            <div style={{
              position: 'absolute', top: 16, left: 16, right: 16, bottom: 16,
              background: 'rgba(255,165,0,0.15)', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>待审核</Tag>
            </div>
          )}
          {isRejected && (
            <div style={{
              position: 'absolute', top: 16, left: 16, right: 16, bottom: 16,
              background: 'rgba(255,0,0,0.1)', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>已拒绝</Tag>
            </div>
          )}
        </div>
      }
      onClick={onClick}
    >
      <Card.Meta
        title={cape.name ? `${cape.name} (#${cape.id})` : `#${cape.id}`}
        description={
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>上传者: {cape.uploader_name || `UID.${cape.user_uid}`}</div>
            <div style={{ marginTop: 6 }}>
              <Tag color={LICENSE_TAG_COLORS[cape.license_type]}>{cape.license_type}</Tag>
              <Tag>{cape.width}×{cape.height}</Tag>
            </div>
            <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>
              下载: {cape.download_count} | 浏览: {cape.view_count}
            </div>
          </div>
        }
      />
    </Card>
  )
}

function SkinGrid() {
  const navigate = useNavigate()
  const [skins, setSkins] = useState<Skin[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const load = (p: number) => {
    setLoading(true)
    fetch(`/api/library/skins?page=${p}&limit=20`)
      .then(r => r.json())
      .then(data => {
        setSkins(data.skins || [])
        setTotal(data.total || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(page) }, [page])

  const filtered = search
    ? skins.filter(s => String(s.id).includes(search) || s.description?.includes(search) || s.name?.includes(search))
    : skins

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <Input
          placeholder="搜索皮肤..."
          prefix={<SearchOutlined />}
          style={{ width: 260 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <Empty description="暂无皮肤" style={{ padding: 60 }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {filtered.map(skin => (
              <Col key={skin.id} xs={24} sm={12} md={8} lg={6}>
                <SkinCard skin={skin} onClick={() => navigate(`/skin/${skin.id}`)} />
              </Col>
            ))}
          </Row>
          <Pagination current={page} pageSize={20} total={total} onChange={setPage}
            style={{ marginTop: 20, textAlign: 'center' }} />
        </>
      )}
    </div>
  )
}

function CapeGrid() {
  const navigate = useNavigate()
  const [capes, setCapes] = useState<Cape[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/library/capes?page=${page}&limit=20`)
      .then(r => r.json())
      .then(data => {
        setCapes(data.capes || [])
        setTotal(data.total || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
      ) : capes.length === 0 ? (
        <Empty description="暂无披风" style={{ padding: 60 }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {capes.map(cape => (
              <Col key={cape.id} xs={24} sm={12} md={8} lg={6}>
                <CapeCard cape={cape} onClick={() => navigate(`/cape/${cape.id}`)} />
              </Col>
            ))}
          </Row>
          <Pagination current={page} pageSize={20} total={total} onChange={setPage}
            style={{ marginTop: 20, textAlign: 'center' }} />
        </>
      )}
    </div>
  )
}

export function SkinLibrary() {
  return (
    <div>
      <h2>材质库</h2>
      <Tabs
        defaultActiveKey="skin"
        items={[
          { key: 'skin', label: '皮肤', children: <SkinGrid /> },
          { key: 'cape', label: '披风', children: <CapeGrid /> },
        ]}
      />
    </div>
  )
}
