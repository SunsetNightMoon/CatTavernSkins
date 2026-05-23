import { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, Card, Tag, Spin, Empty, Button, message, Badge, Space, Radio } from 'antd'
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons'
import { Skin3DViewer } from '../../components/Skin3DViewer/Skin3DViewer'
import { SkinThumbnail3D } from '../../components/SkinThumbnail3D/SkinThumbnail3D'
import { profileService } from '../../services/profileService'
import { useAuthStore } from '../../store/authStore'
import type { Skin, Cape } from '../../types'

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

interface ProfileInfo {
  id: string
  name: string
  skin_id?: number
  cape_id?: number
}

type SkinTab = 'mine' | 'favorites'
type CapeTab = 'mine' | 'favorites'

export function Wardrobe() {
  const { token, setSkinUrl } = useAuthStore()

  // 数据列表
  const [skins, setSkins] = useState<Skin[]>([])
  const [capes, setCapes] = useState<Cape[]>([])
  const [favoritedSkins, setFavoritedSkins] = useState<Skin[]>([])
  const [favoritedCapes, setFavoritedCapes] = useState<Cape[]>([])

  // 加载状态
  const [loadingSkins, setLoadingSkins] = useState(true)
  const [loadingCapes, setLoadingCapes] = useState(true)
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [loadingFavoritedSkins, setLoadingFavoritedSkins] = useState(false)
  const [loadingFavoritedCapes, setLoadingFavoritedCapes] = useState(false)

  // 错误状态
  const [skinsError, setSkinsError] = useState<string | null>(null)
  const [capesError, setCapesError] = useState<string | null>(null)

  // 应用状态
  const [applyingSkin, setApplyingSkin] = useState(false)
  const [applyingCape, setApplyingCape] = useState(false)

  // 当前选中的 ID
  const [selectedSkinId, setSelectedSkinId] = useState<number | null>(null)
  const [selectedCapeId, setSelectedCapeId] = useState<number | null>(null)

  // 当前角色信息
  const [currentProfile, setCurrentProfile] = useState<ProfileInfo | null>(null)

  // Tab 状态
  const [skinTab, setSkinTab] = useState<SkinTab>('mine')
  const [capeTab, setCapeTab] = useState<CapeTab>('mine')

  const { width: vw } = useViewportSize()
  const viewerSize = useMemo(() => {
    if (vw < 420) return { width: 260, height: 300 }
    if (vw < 576) return { width: 280, height: 320 }
    if (vw < 768) return { width: 320, height: 360 }
    return { width: 360, height: 400 }
  }, [vw])

  // ======================== 数据加载 ========================

  // 加载当前角色信息
  useEffect(() => {
    if (!token) {
      setLoadingProfiles(false)
      setLoadingSkins(false)
      setLoadingCapes(false)
      return
    }

    const loadProfile = async () => {
      try {
        const data = await profileService.getMe()
        if (data.profiles && data.profiles.length > 0) {
          const profile = data.profiles[0]
          setCurrentProfile(profile)
          setSelectedSkinId(profile.skin_id ?? null)
          setSelectedCapeId(profile.cape_id ?? null)
        }
        setLoadingProfiles(false)
      } catch (error: any) {
        console.error('加载角色信息失败:', error)
      } finally {
        setLoadingProfiles(false)
      }
    }

    loadProfile()
  }, [token])

  // 加载我的皮肤和披风
  useEffect(() => {
    if (!token) return

    // 加载我的皮肤
    setLoadingSkins(true)
    setSkinsError(null)
    fetch('/api/skins', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.errorMessage || `请求失败: ${r.status}`)
        }
        return r.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setSkins(data)
        } else if (data.error) {
          throw new Error(data.errorMessage || '获取皮肤列表失败')
        }
      })
      .catch((err: any) => {
        console.error('加载皮肤失败:', err)
        setSkinsError(err.message || '连接服务器失败，请刷新重试')
      })
      .finally(() => setLoadingSkins(false))

    // 加载我的披风
    setLoadingCapes(true)
    setCapesError(null)
    fetch('/api/capes/mine', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.errorMessage || `请求失败: ${r.status}`)
        }
        return r.json()
      })
      .then(data => {
        if (Array.isArray(data.capes)) {
          setCapes(data.capes)
        } else if (data.error) {
          throw new Error(data.errorMessage || '获取披风列表失败')
        }
      })
      .catch((err: any) => {
        console.error('加载披风失败:', err)
        setCapesError(err.message || '连接服务器失败，请刷新重试')
      })
      .finally(() => setLoadingCapes(false))
  }, [token])

  // 加载收藏的皮肤（懒加载，切换 tab 时加载）
  const loadFavoritedSkins = useCallback(async () => {
    if (!token) return
    setLoadingFavoritedSkins(true)
    try {
      const res = await fetch('/api/skins/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setFavoritedSkins(Array.isArray(data.skins) ? data.skins : [])
    } catch (e) {
      console.error('加载收藏皮肤失败:', e)
    } finally {
      setLoadingFavoritedSkins(false)
    }
  }, [token])

  // 加载收藏的披风（懒加载，切换 tab 时加载）
  const loadFavoritedCapes = useCallback(async () => {
    if (!token) return
    setLoadingFavoritedCapes(true)
    try {
      const res = await fetch('/api/capes/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setFavoritedCapes(Array.isArray(data.capes) ? data.capes : [])
    } catch (e) {
      console.error('加载收藏披风失败:', e)
    } finally {
      setLoadingFavoritedCapes(false)
    }
  }, [token])

  // Tab 切换时加载对应收藏数据
  useEffect(() => {
    if (skinTab === 'favorites') {
      loadFavoritedSkins()
    }
  }, [skinTab, loadFavoritedSkins])

  useEffect(() => {
    if (capeTab === 'favorites') {
      loadFavoritedCapes()
    }
  }, [capeTab, loadFavoritedCapes])

  // ======================== 3D 预览数据 ========================

  // 根据 selectedSkinId 查找皮肤对象（从「我的」和「收藏」两个列表找）
  const selectedSkin = useMemo(() => {
    if (selectedSkinId === null) return null
    return skins.find(s => s.id === selectedSkinId) ||
      favoritedSkins.find(s => s.id === selectedSkinId) ||
      null
  }, [selectedSkinId, skins, favoritedSkins])

  // 根据 selectedCapeId 查找披风对象（从「我的」和「收藏」两个列表找）
  const selectedCape = useMemo(() => {
    if (selectedCapeId === null) return null
    return capes.find(c => c.id === selectedCapeId) ||
      favoritedCapes.find(c => c.id === selectedCapeId) ||
      null
  }, [selectedCapeId, capes, favoritedCapes])

  // 传递给 Skin3DViewer 的 URL（去掉开头的 .）
  const skinUrl = useMemo(() => {
    if (selectedSkin?.file_path) {
      return selectedSkin.file_path.replace(/^\./, '')
    }
    return '/steve.png'
  }, [selectedSkin])

  const capeUrl = useMemo(() => {
    if (selectedCape?.file_path) {
      return selectedCape.file_path.replace(/^\./, '')
    }
    return null
  }, [selectedCape])

  const modelType = selectedSkin?.model_type || 'default'

  // ======================== 同步头像 ========================

  // 当 currentProfile.skin_id 变化时，同步更新全局头像
  useEffect(() => {
    if (currentProfile?.skin_id) {
      const skin = skins.find(s => s.id === currentProfile.skin_id) ||
        favoritedSkins.find(s => s.id === currentProfile.skin_id)
      if (skin?.file_path) {
        setSkinUrl(skin.file_path.replace(/^\./, ''))
      }
    } else {
      setSkinUrl(null)
    }
  }, [currentProfile, skins, favoritedSkins, setSkinUrl])

  // ======================== 应用 / 移除 ========================

  const handleApplySkin = async () => {
    if (!currentProfile || selectedSkinId === null) return
    setApplyingSkin(true)
    try {
      await profileService.applySkin(currentProfile.id, selectedSkinId)
      message.success('皮肤应用成功！')
      setCurrentProfile({ ...currentProfile, skin_id: selectedSkinId })
      // 同步头像
      const appliedSkin = skins.find(s => s.id === selectedSkinId) ||
        favoritedSkins.find(s => s.id === selectedSkinId)
      const newUrl = appliedSkin?.file_path
        ? appliedSkin.file_path.replace(/^\./, '')
        : '/steve.png'
      setSkinUrl(newUrl)
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '应用皮肤失败')
    } finally {
      setApplyingSkin(false)
    }
  }

  const handleApplyCape = async () => {
    if (!currentProfile || selectedCapeId === null) return
    setApplyingCape(true)
    try {
      await profileService.applyCape(currentProfile.id, selectedCapeId)
      message.success('披风应用成功！')
      setCurrentProfile({ ...currentProfile, cape_id: selectedCapeId })
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '应用披风失败')
    } finally {
      setApplyingCape(false)
    }
  }

  const handleRemoveSkin = async () => {
    if (!currentProfile) return
    setApplyingSkin(true)
    try {
      await profileService.removeSkin(currentProfile.id)
      message.success('皮肤已移除')
      setCurrentProfile({ ...currentProfile, skin_id: undefined })
      setSelectedSkinId(null)
      setSkinUrl(null)
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '移除皮肤失败')
    } finally {
      setApplyingSkin(false)
    }
  }

  const handleRemoveCape = async () => {
    if (!currentProfile) return
    setApplyingCape(true)
    try {
      await profileService.removeCape(currentProfile.id)
      message.success('披风已移除')
      setCurrentProfile({ ...currentProfile, cape_id: undefined })
      setSelectedCapeId(null)
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '移除披风失败')
    } finally {
      setApplyingCape(false)
    }
  }

  // ======================== 点击卡片 ========================

  const handleSkinCardClick = useCallback((skinId: number) => {
    setSelectedSkinId(prev => prev === skinId ? null : skinId)
  }, [])

  const handleCapeCardClick = useCallback((capeId: number) => {
    setSelectedCapeId(prev => prev === capeId ? null : capeId)
  }, [])

  // ======================== 渲染辅助 ========================

  const isSkinApplied = currentProfile?.skin_id === selectedSkinId
  const isCapeApplied = currentProfile?.cape_id === selectedCapeId

  const displayedSkins = skinTab === 'mine' ? skins : favoritedSkins
  // 收藏的披风中，过滤掉「我的披风」（已上传的不要重复出现在收藏页）
  const favoritedCapesFiltered = useMemo(() => {
    const myCapeIds = new Set(capes.map(c => c.id))
    return favoritedCapes.filter(c => !myCapeIds.has(c.id))
  }, [capes, favoritedCapes])

  // 当前显示的披风列表（根据 Tab 切换）
  const displayedCapes = capeTab === 'mine' ? capes : favoritedCapesFiltered

  const isLoadingSkins = skinTab === 'mine' ? loadingSkins : loadingFavoritedSkins
  const isLoadingCapes = capeTab === 'mine' ? loadingCapes : loadingFavoritedCapes

  // ======================== 渲染 ========================

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 20px 0' }}>
      {/* 标题和当前角色 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>我的衣柜</h2>
        {currentProfile && (
          <Tag color="blue" icon={<CheckOutlined />}>
            当前角色: {currentProfile.name}
          </Tag>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
        {/* 左侧 3D 预览 */}
        <div style={{ flex: '0 0 auto' }}>
          <Skin3DViewer
            key={`${skinUrl}-${capeUrl}`}
            skinUrl={skinUrl}
            capeUrl={capeUrl}
            modelType={modelType}
            width={viewerSize.width}
            height={viewerSize.height}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center' }}>
            {selectedSkin || selectedCape
              ? '已在 3D 模型上预览组合效果'
              : '从下方选择皮肤和披风进行搭配预览'}
          </div>
        </div>

        {/* 右侧选择区 */}
        <div style={{ flex: '1 1 400px', minWidth: 300 }}>
          {/* ===== 皮肤选择 ===== */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>选择皮肤</h3>
              <Space>
                {selectedSkinId !== null && !isSkinApplied && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={applyingSkin}
                    onClick={handleApplySkin}
                  >
                    应用
                  </Button>
                )}
                {isSkinApplied && (
                  <Tag color="success">已应用</Tag>
                )}
                {currentProfile?.skin_id && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={applyingSkin}
                    onClick={handleRemoveSkin}
                  >
                    移除
                  </Button>
                )}
              </Space>
            </div>

            <Radio.Group
              value={skinTab}
              onChange={e => setSkinTab(e.target.value)}
              size="small"
              style={{ marginBottom: 12 }}
            >
              <Radio.Button value="mine">我的皮肤</Radio.Button>
              <Radio.Button value="favorites">收藏的皮肤</Radio.Button>
            </Radio.Group>

            {isLoadingSkins || loadingProfiles ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : skinTab === 'mine' && skinsError ? (
              <Empty
                description={
                  <div>
                    <div style={{ color: '#ff4d4f', marginBottom: 8 }}>加载失败: {skinsError}</div>
                    <Button size="small" onClick={() => window.location.reload()}>刷新重试</Button>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : displayedSkins.length === 0 ? (
              <Empty
                description={skinTab === 'mine' ? '暂无皮肤，请先上传' : '暂无收藏，去皮肤库收藏吧'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[8, 8]}>
                {displayedSkins.map(skin => {
                  const isSelected = selectedSkinId === skin.id
                  const isApplied = currentProfile?.skin_id === skin.id
                  return (
                    <Col key={skin.id} xs={12} sm={8} md={6}>
                      <Card
                        hoverable
                        size="small"
                        onClick={() => handleSkinCardClick(skin.id)}
                        style={{
                          border: isSelected
                            ? '2px solid #4f46e5'
                            : isApplied
                              ? '2px solid #52c41a'
                              : '1px solid #e5e7eb',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        styles={{ body: { padding: 8 } }}
                      >
                        {isApplied && (
                          <Badge
                            count="使用中"
                            style={{ position: 'absolute', top: 4, right: 4 }}
                            status="success"
                          />
                        )}
                        <div style={{ marginBottom: 6 }}>
                          <SkinThumbnail3D
                            skinUrl={skin.file_path}
                            modelType={skin.model_type === 'slim' ? 'slim' : 'default'}
                            width={100}
                            height={120}
                          />
                        </div>
                        <div style={{ fontSize: 11, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {skin.name || `#${skin.id}`}
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 4 }}>
                          <Tag color={skin.model_type === 'slim' ? 'blue' : 'default'} style={{ margin: 0 }}>
                            {skin.model_type === 'slim' ? '纤细' : '经典'}
                          </Tag>
                        </div>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            )}
          </div>

          {/* ===== 披风选择 ===== */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>选择披风</h3>
              <Space>
                {selectedCapeId !== null && !isCapeApplied && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={applyingCape}
                    onClick={handleApplyCape}
                  >
                    应用
                  </Button>
                )}
                {isCapeApplied && (
                  <Tag color="success">已应用</Tag>
                )}
                {currentProfile?.cape_id && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={applyingCape}
                    onClick={handleRemoveCape}
                  >
                    移除
                  </Button>
                )}
              </Space>
            </div>

            <Radio.Group
              value={capeTab}
              onChange={e => setCapeTab(e.target.value)}
              size="small"
              style={{ marginBottom: 12 }}
            >
              <Radio.Button value="mine">我的披风</Radio.Button>
              <Radio.Button value="favorites">收藏的披风</Radio.Button>
            </Radio.Group>

            {isLoadingCapes || loadingProfiles ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : capeTab === 'mine' && capesError ? (
              <Empty
                description={
                  <div>
                    <div style={{ color: '#ff4d4f', marginBottom: 8 }}>加载失败: {capesError}</div>
                    <Button size="small" onClick={() => window.location.reload()}>刷新重试</Button>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : displayedCapes.length === 0 ? (
              <Empty
                description={capeTab === 'mine' ? '暂无披风，请先上传' : '暂无收藏，去披风库收藏吧'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[8, 8]}>
                {displayedCapes.map(cape => {
                  const isSelected = selectedCapeId === cape.id
                  const isApplied = currentProfile?.cape_id === cape.id
                  return (
                    <Col key={cape.id} xs={12} sm={8} md={6}>
                      <Card
                        hoverable
                        size="small"
                        onClick={() => handleCapeCardClick(cape.id)}
                        style={{
                          border: isSelected
                            ? '2px solid #4f46e5'
                            : isApplied
                              ? '2px solid #52c41a'
                              : '1px solid #e5e7eb',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        styles={{ body: { padding: 8 } }}
                      >
                        {isApplied && (
                          <Badge
                            count="使用中"
                            style={{ position: 'absolute', top: 4, right: 4 }}
                            status="success"
                          />
                        )}
                        <div style={{ marginBottom: 6 }}>
                          <SkinThumbnail3D
                            skinUrl="/steve.png"
                            capeUrl={cape.file_path}
                            modelType="default"
                            width={100}
                            height={120}
                          />
                        </div>
                        <div style={{ fontSize: 11, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cape.name || `#${cape.id}`}
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 4 }}>
                          <Tag style={{ margin: 0 }}>{cape.width}×{cape.height}</Tag>
                          {cape.approval_status === 'pending' && (
                            <Tag color="orange" style={{ marginLeft: 4 }}>待审核</Tag>
                          )}
                          {cape.approval_status === 'rejected' && (
                            <Tag color="red" style={{ marginLeft: 4 }}>已拒绝</Tag>
                          )}
                        </div>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
