import { useState, useMemo, useEffect } from 'react'
import { Form, Upload, Select, Input, Button, message, Radio, Alert, Tabs } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd/es/upload/interface'
import { Skin3DViewer } from '../../components/Skin3DViewer/Skin3DViewer'
import { usePageTitle } from '../../hooks/usePageTitle'

const LICENSE_OPTIONS = [
  { value: 'CC0_1.0', label: 'CC0 1.0 - 公有领域' },
  { value: 'CC_BY_3.0', label: 'CC BY 3.0 - 署名' },
  { value: 'CC_BY_4.0', label: 'CC BY 4.0 - 署名' },
  { value: 'CC_BY-SA_3.0', label: 'CC BY-SA 3.0 - 署名-相同方式共享' },
  { value: 'CC_BY-SA_4.0', label: 'CC BY-SA 4.0 - 署名-相同方式共享' },
  { value: 'CC_BY-NC_3.0', label: 'CC BY-NC 3.0 - 署名-非商业性使用' },
  { value: 'CC_BY-NC_4.0', label: 'CC BY-NC 4.0 - 署名-非商业性使用' },
  { value: 'ARR', label: 'ARR - 保留所有权利' },
  { value: 'AI_CC0', label: 'AI CC0 - AI生成内容公有领域' },
  { value: 'Custom', label: '自定义协议' },
]

const PERMISSION_OPTIONS = [
  { value: 'private', label: '私有 - 仅自己可见/可下载' },
  { value: 'public_no_download', label: '公开不可下载 - 所有人可见，但不可下载' },
  { value: 'public_downloadable', label: '公开可下载 - 所有人可见且可下载' },
]

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/* ─────────────────────── 皮肤上传面板 ─────────────────────── */
function SkinTab() {
  const [form] = Form.useForm()
  const [file, setFile] = useState<UploadFile | null>(null)
  const [modelType, setModelType] = useState<'default' | 'slim'>('default')
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedLicense, setSelectedLicense] = useState<string>('')

  // 选择公有领域协议时，禁止"公开不可下载"，自动切换到"公开可下载"
  useEffect(() => {
    const isPublicDomain = selectedLicense === 'CC0_1.0' || selectedLicense === 'AI_CC0'
    if (isPublicDomain && form.getFieldValue('permission_level') === 'public_no_download') {
      form.setFieldValue('permission_level', 'public_downloadable')
    }
  }, [selectedLicense, form])

  const { width: vw } = useViewportSize()
  const viewerSize = useMemo(() => {
    if (vw < 420) return { width: 260, height: 300 }
    if (vw < 576) return { width: 280, height: 320 }
    if (vw < 768) return { width: 320, height: 360 }
    return { width: 360, height: 400 }
  }, [vw])

  const skinUrl = useMemo(() => previewUrl || '/steve.png', [previewUrl])

  const beforeUploadSkin: UploadProps['beforeUpload'] = (file) => {
    if (file.type !== 'image/png') { message.error('仅支持PNG格式'); return false }
    if (file.size > 1 * 1024 * 1024) { message.error('文件大小不能超过1MB'); return false }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setFile(file)
    return false
  }

  const onFinish = async (values: any) => {
    if (!file) { message.error('请上传皮肤文件'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('skin', file as any)
      formData.append('name', values.name)
      formData.append('model_type', values.model_type || 'default')
      formData.append('description', values.description || '')
      formData.append('license_type', values.license_type)
      formData.append('permission_level', values.permission_level)

      const authStorage = localStorage.getItem('auth-storage')
      const token = authStorage ? JSON.parse(authStorage).state.token : null

      const response = await fetch('/api/skins/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await response.json()

      if (response.ok) {
        message.success('皮肤上传成功')
        form.resetFields()
        setFile(null)
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      } else {
        message.error(data.errorMessage || '上传失败')
      }
    } catch { message.error('网络错误') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <Alert
        message="上传说明"
        description="支持 64x64（现代）或 64x32（Legacy 1.8 以下）格式，大小 ≤1MB，仅支持 PNG 格式"
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
        {/* 左侧 3D 预览 */}
        <div style={{ flex: '0 0 auto' }}>
          <Skin3DViewer
            skinUrl={skinUrl}
            modelType={modelType}
            width={viewerSize.width}
            height={viewerSize.height}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255, 0.9)' }}>模型：</span>
            <Radio.Group
              value={modelType}
              onChange={e => setModelType(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="default">经典（Steve）</Radio.Button>
              <Radio.Button value="slim">纤细（Alex）</Radio.Button>
            </Radio.Group>
          </div>
          {!file && <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>上传皮肤后可预览</div>}
        </div>

        {/* 右侧表单 */}
        <div style={{ flex: '1 1 300px', minWidth: 280 }}>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item label="皮肤名称" name="name" rules={[{ required: true, message: '请输入皮肤名称' }]}>
              <Input placeholder="给你的作品起个名字" maxLength={50} showCount />
            </Form.Item>

            <Form.Item label="皮肤文件" required>
              <Upload beforeUpload={beforeUploadSkin} fileList={file ? [file] : []} maxCount={1} accept=".png"
                onRemove={() => { if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }; setFile(null) }}>
                <Button icon={<UploadOutlined />}>选择皮肤 PNG 文件</Button>
              </Upload>
            </Form.Item>

            <Form.Item label="模型类型" name="model_type" initialValue="default">
              <Radio.Group value={modelType} onChange={e => { setModelType(e.target.value); form.setFieldValue('model_type', e.target.value) }}>
                <Radio value="default">经典（默认）</Radio>
                <Radio value="slim">纤细（Alex模型）</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="描述" name="description">
              <Input.TextArea rows={2} placeholder="描述您的皮肤（可选）" />
            </Form.Item>

            <Form.Item label="协议类型" name="license_type" rules={[{ required: true, message: '请选择协议类型' }]}>
              <Select
                options={LICENSE_OPTIONS}
                placeholder="请选择皮肤协议"
                onChange={value => setSelectedLicense(value)}
              />
            </Form.Item>

            <Alert
              type="warning"
              showIcon
              message="关于 AI 绘制皮肤"
              description="如果您的皮肤是使用 AI（如 Midjourney、DALL-E、Stable Diffusion、LUMEN 等）绘制的，由于无法判断人类作者的归属权，请选择「AI CC0」协议。CC0 1.0 仅适用于人类创作的公有领域作品。"
              style={{ marginBottom: 16 }}
            />

            <Form.Item label="权限设置" name="permission_level" rules={[{ required: true, message: '请选择权限级别' }]} initialValue="private">
              <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PERMISSION_OPTIONS.map(opt => {
                  const isPublicDomain = selectedLicense === 'CC0_1.0' || selectedLicense === 'AI_CC0'
                  const disabled = isPublicDomain && opt.value === 'public_no_download'
                  return (
                    <Radio key={opt.value} value={opt.value} disabled={disabled}>
                      {opt.label}{disabled && '（公有领域禁止限制下载）'}
                    </Radio>
                  )
                })}
              </Radio.Group>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                上传皮肤
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────── 披风上传面板 ─────────────────────── */
function CapeTab() {
  const [form] = Form.useForm()
  const [file, setFile] = useState<UploadFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedLicense, setSelectedLicense] = useState<string>('ARR')

  // 选择公有领域协议时，禁止"公开不可下载"，自动切换到"公开可下载"
  useEffect(() => {
    const isPublicDomain = selectedLicense === 'CC0_1.0' || selectedLicense === 'AI_CC0'
    if (isPublicDomain && form.getFieldValue('permission_level') === 'public_no_download') {
      form.setFieldValue('permission_level', 'public_downloadable')
    }
  }, [selectedLicense, form])

  const { width: vw } = useViewportSize()
  const viewerSize = useMemo(() => {
    if (vw < 420) return { width: 260, height: 300 }
    if (vw < 576) return { width: 280, height: 320 }
    if (vw < 768) return { width: 320, height: 360 }
    return { width: 360, height: 400 }
  }, [vw])

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (file.type !== 'image/png') { message.error('仅支持PNG格式'); return false }
    if (file.size > 1 * 1024 * 1024) { message.error('披风文件大小不能超过1MB'); return false }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setFile(file)
    return false
  }

  const onFinish = async (values: any) => {
    if (!file) { message.error('请上传披风文件'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('cape', file as any)
      formData.append('name', values.name)
      formData.append('description', values.description || '')
      formData.append('license_type', values.license_type || 'ARR')
      formData.append('permission_level', values.permission_level || 'private')

      const authStorage = localStorage.getItem('auth-storage')
      const token = authStorage ? JSON.parse(authStorage).state.token : null

      const response = await fetch('/api/skins/upload-cape', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await response.json()

      if (response.ok) {
        message.success('披风上传成功')
        form.resetFields()
        setFile(null)
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      } else {
        message.error(data.errorMessage || '上传失败')
      }
    } catch { message.error('网络错误') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <Alert
        message="披风上传说明"
        description="披风尺寸建议 22×17（经典）或 64×32（现代披风），大小 ≤1MB，仅支持 PNG 格式"
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
        {/* 左侧 3D 预览（默认 Steve 模型，背面视角） */}
        <div style={{ flex: '0 0 auto' }}>
          <Skin3DViewer
            skinUrl="/steve.png"
            capeUrl={previewUrl}
            modelType="default"
            width={viewerSize.width}
            height={viewerSize.height}
            initialBackView={true}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            {file ? '3D 预览效果' : '上传披风后在 3D 模型上预览'}
          </div>
        </div>

        {/* 右侧表单 */}
        <div style={{ flex: '1 1 300px', minWidth: 280 }}>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item label="披风名称" name="name" rules={[{ required: true, message: '请输入披风名称' }]}>
              <Input placeholder="给你的作品起个名字" maxLength={50} showCount />
            </Form.Item>

            <Form.Item label="披风文件" required>
              <Upload beforeUpload={beforeUpload} fileList={file ? [file] : []} maxCount={1} accept=".png"
                onRemove={() => { if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }; setFile(null) }}>
                <Button icon={<UploadOutlined />}>选择披风 PNG 文件</Button>
              </Upload>
              <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>披风尺寸建议 22×17 或 64×32，大小 ≤1MB</div>
            </Form.Item>

            <Form.Item label="描述" name="description">
              <Input.TextArea rows={2} placeholder="描述您的披风（可选）" />
            </Form.Item>

            <Form.Item label="协议类型" name="license_type" initialValue="ARR">
              <Select
                options={LICENSE_OPTIONS}
                placeholder="请选择披风协议"
                onChange={value => setSelectedLicense(value)}
              />
            </Form.Item>

            <Alert
              type="warning"
              showIcon
              message="关于 AI 绘制披风"
              description="如果您的披风是使用 AI（如 Midjourney、DALL-E、Stable Diffusion、LUMEN 等）绘制的，由于无法判断人类作者的归属权，请选择「AI CC0」协议。CC0 1.0 仅适用于人类创作的公有领域作品。"
              style={{ marginBottom: 16 }}
            />

            <Form.Item label="权限设置" name="permission_level" initialValue="private">
              <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PERMISSION_OPTIONS.map(opt => {
                  const isPublicDomain = selectedLicense === 'CC0_1.0' || selectedLicense === 'AI_CC0'
                  const disabled = isPublicDomain && opt.value === 'public_no_download'
                  return (
                    <Radio key={opt.value} value={opt.value} disabled={disabled}>
                      {opt.label}{disabled && '（公有领域禁止限制下载）'}
                    </Radio>
                  )
                })}
              </Radio.Group>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                上传披风
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────── 主页面 ─────────────────────── */
export function SkinUpload() {
  usePageTitle('上传材质')
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 20px 0' }}>
      <h2>上传材质</h2>
      <Tabs
        defaultActiveKey="skin"
        items={[
          { key: 'skin', label: '上传皮肤', children: <SkinTab /> },
          { key: 'cape', label: '上传披风', children: <CapeTab /> },
        ]}
      />
    </div>
  )
}
