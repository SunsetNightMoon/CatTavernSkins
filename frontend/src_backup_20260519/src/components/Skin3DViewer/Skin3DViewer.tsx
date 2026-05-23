import { useEffect, useRef, useState, useCallback } from 'react'
import { SkinViewer, IdleAnimation, WalkingAnimation, RunningAnimation } from 'skinview3d'
import * as THREE from 'three'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _3: any = THREE

type AnimMode = 'idle' | 'walk' | 'run'

interface Props {
  skinUrl: string
  capeUrl?: string | null
  modelType?: 'default' | 'slim'
  width?: number
  height?: number
}

/**
 * 在场景中添加地面软阴影（径向渐变椭圆）
 * 返回清理函数，用于从场景中移除阴影并释放资源
 */
function addGroundShadow(viewer: any): () => void {
  // 用 Canvas2D 绘制软边椭圆阴影纹理
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  // 在 canvas 上画圆，UV 映射到 1.8:0.9 的矩形平面时会自然拉伸成椭圆
  const radius = size * 0.38

  ctx.clearRect(0, 0, size, size)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  grad.addColorStop(0, 'rgba(0,0,0,0.35)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.15)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  const texture = new _3.CanvasTexture(canvas)
  texture.needsUpdate = true

  const geo = new _3.PlaneGeometry(1.8, 0.9)
  const mat = new _3.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: _3.DoubleSide,
  })
  const mesh = new _3.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -1.49 // 紧贴玩家脚底
  mesh.name = '__groundShadow'
  viewer.scene.add(mesh)

  return () => {
    viewer.scene.remove(mesh)
    geo.dispose()
    mat.dispose()
    texture.dispose()
    // 释放 canvas
    ;(canvas as any).width = 0
  }
}

export function Skin3DViewer({ skinUrl, capeUrl, modelType = 'default', width = 360, height = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<any>(null)
  const shadowDisposeRef = useRef<(() => void) | null>(null)

  const [rotating, setRotating] = useState(false)
  const [animMode, setAnimMode] = useState<AnimMode>('idle')
  const [showCape, setShowCape] = useState(true)

  // 初始化 SkinViewer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const viewer = new SkinViewer({
      canvas,
      width,
      height,
      skin: skinUrl,
      model: modelType,
      cape: capeUrl || undefined,
      enableControls: true,
    })

    viewer.renderer.setClearColor(0x000000, 0)
    viewer.autoRotate = false

    // 添加地面阴影
    shadowDisposeRef.current = addGroundShadow(viewer)

    // 初始披风显隐
    const cape = viewer.playerObject.getObjectByName('cape')
    if (cape) cape.visible = showCape && !!capeUrl

    viewerRef.current = viewer
    return () => {
      shadowDisposeRef.current?.()
      shadowDisposeRef.current = null
      viewer.dispose()
      viewerRef.current = null
    }
  }, [skinUrl, capeUrl, modelType, width, height])

  // 动画模式
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    let anim: any
    switch (animMode) {
      case 'walk': anim = new WalkingAnimation(); break
      case 'run': anim = new RunningAnimation(); break
      default: anim = new IdleAnimation()
    }
    viewer.animation = anim
  }, [animMode])

  // 旋转开关
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.autoRotate = rotating
  }, [rotating])

  // 披风显隐
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const cape = viewer.playerObject.getObjectByName('cape')
    if (cape) cape.visible = showCape && !!capeUrl
  }, [showCape, capeUrl])

  // 复位
  const handleReset = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.playerObject.rotation.y = 0
    viewer.resetCameraPose()
  }, [])

  // 小按钮样式
  const tinyBtn = (label: string, active: boolean, onClick: () => void, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        padding: '2px 8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11,
        background: active ? '#4f46e5' : '#fff',
        color: active ? '#fff' : '#333',
        opacity: disabled ? 0.4 : 1,
      }}
    >{label}</button>
  )

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
      <div style={{
        width, height,
        maxWidth: '100%',
        backgroundImage: [
          'linear-gradient(45deg, #F8F8F8 25%, transparent 25%)',
          'linear-gradient(-45deg, #F8F8F8 25%, transparent 25%)',
          'linear-gradient(45deg, transparent 75%, #F8F8F8 75%)',
          'linear-gradient(-45deg, transparent 75%, #F8F8F8 75%)',
        ].join(','),
        backgroundSize: '64px 64px',
        backgroundColor: '#ffffff',
        backgroundPosition: '0 0, 0 32px, 32px -32px, -32px 0px',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>

      {/* 控制按钮 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '8px 0 0 0', flexWrap: 'wrap' }}>
        {tinyBtn('↻ 旋转', rotating, () => setRotating(v => !v))}
        {tinyBtn('待机', animMode === 'idle', () => setAnimMode('idle'))}
        {tinyBtn('行走', animMode === 'walk', () => setAnimMode('walk'))}
        {tinyBtn('奔跑', animMode === 'run', () => setAnimMode('run'))}
        {capeUrl && tinyBtn('披风', showCape, () => setShowCape(v => !v))}
        {tinyBtn('复位', false, handleReset)}
      </div>
    </div>
  )
}
