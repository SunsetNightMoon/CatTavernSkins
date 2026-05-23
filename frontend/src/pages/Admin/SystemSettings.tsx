import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSiteStore } from '../../store/siteStore'
import { clearSiteTitleCache } from '../../hooks/usePageTitle'
import { Form, Input, Switch, Button, message, Card, Spin, Modal, Upload, Space, Slider } from 'antd'
import { SendOutlined, EditOutlined, CloseOutlined, UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import './SystemSettings.css'
import { isVideoFile } from '../../utils/media'

const { TextArea } = Input

interface HomepageButton {
  text: string
  link: string
}

/* ============================================================
   全局自动更新 Switch（复用组件）
   ============================================================ */
function GlobalAutoApplySwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      checkedChildren="全局自动更新"
      unCheckedChildren="全局自动更新"
      style={{ marginLeft: 12 }}
    />
  )
}

/* ============================================================
   注册设置卡片
   ============================================================ */
function RegistrationSettings({ token, autoApply, onAutoApplyChange }: { token: string; autoApply: boolean; onAutoApplyChange: (v: boolean) => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  const loadSettings = async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('读取失败')
      const data = await res.json()
      form.setFieldsValue({
        allow_registration: data.ALLOW_REGISTRATION !== 'false',
        require_email_verification: data.REQUIRE_EMAIL_VERIFICATION === 'true',
        enable_captcha: data.ENABLE_CAPTCHA !== 'false',
      })
    } catch (err: any) {
      message.error(err.message || '读取设置失败')
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.errorMessage || '保存失败')
      }
      message.success('注册设置已保存')
      if (autoApply) {
        useSiteStore.getState().loadSettings()
      }
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (loadingSettings) {
    return <Card style={{ marginBottom: 16 }}><Spin /></Card>
  }

  return (
    <Card title="注册设置" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="允许注册"
          name="allow_registration"
          valuePropName="checked"
          tooltip="关闭后，新用户无法注册"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          label="需要邮箱验证"
          name="require_email_verification"
          valuePropName="checked"
          tooltip="开启后，注册时需要验证邮箱"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          label="启用人机验证"
          name="enable_captcha"
          valuePropName="checked"
          tooltip="开启后，注册需要完成人机验证"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存注册设置
          </Button>
          <GlobalAutoApplySwitch checked={autoApply} onChange={onAutoApplyChange} />
        </Form.Item>
      </Form>
    </Card>
  )
}

/* ============================================================
   站点设置卡片
   ============================================================ */
function SiteSettings({ token, autoApply, onAutoApplyChange }: { token: string; autoApply: boolean; onAutoApplyChange: (v: boolean) => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [extraButtons, setExtraButtons] = useState<HomepageButton[]>([])

  const loadSettings = async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('读取失败')
      const data = await res.json()
      const buttons: HomepageButton[] = (() => {
        try {
          const parsed = JSON.parse(data.HOMEPAGE_BUTTONS || '[]')
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      })()
      setExtraButtons(buttons)
      form.setFieldsValue({
        site_title: String(data.SITE_TITLE || 'Skin2'),
        site_description: String(data.SITE_DESCRIPTION || 'Minecraft Skin Server - 自定义你的游戏形象'),
        homepage_title_text: String(data.HOMEPAGE_TITLE_TEXT || '欢迎来到'),
        homepage_text: String(data.HOMEPAGE_TEXT || 'WELCOME TO SKIN2!'),
        homepage_button_text: String(data.HOMEPAGE_BUTTON_TEXT || '进入个人中心'),
      })
    } catch (err: any) {
      message.error(err.message || '读取设置失败')
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const payload = {
        ...values,
        homepage_buttons: JSON.stringify(extraButtons),
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.errorMessage || '保存失败')
      }
      clearSiteTitleCache()
      message.success('站点设置已保存')
      if (autoApply) {
        useSiteStore.getState().loadSettings()
      }
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const addButton = () => {
    if (extraButtons.length >= 4) {
      message.warning('最多只能添加4个自定义按钮')
      return
    }
    setExtraButtons([...extraButtons, { text: '', link: '' }])
  }

  const removeButton = (index: number) => {
    setExtraButtons(extraButtons.filter((_, i) => i !== index))
  }

  const updateButton = (index: number, field: keyof HomepageButton, value: string) => {
    const updated = [...extraButtons]
    updated[index][field] = value
    setExtraButtons(updated)
  }

  if (loadingSettings) {
    return <Card style={{ marginBottom: 16 }}><Spin /></Card>
  }

  return (
    <Card title="站点设置" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="站点标题"
          name="site_title"
          rules={[{ required: true, message: '请输入站点标题' }]}
        >
          <Input placeholder="Skin2" />
        </Form.Item>

        <Form.Item
          label="站点描述"
          name="site_description"
          rules={[{ required: true, message: '请输入站点描述' }]}
        >
          <TextArea rows={3} placeholder="Minecraft Skin Server - 自定义你的游戏形象" />
        </Form.Item>

        <Form.Item
          label="首页主标题前缀"
          name="homepage_title_text"
          rules={[{ required: true, message: '请输入首页主标题前缀' }]}
          tooltip="首页大标题的前缀文字，例如：欢迎来到、欢迎光临"
        >
          <Input placeholder="欢迎来到" />
        </Form.Item>

        <Form.Item
          label="首页副标题文字"
          name="homepage_text"
          rules={[{ required: true, message: '请输入首页副标题文字' }]}
          tooltip="首页主标题下方显示的文字"
        >
          <Input placeholder="WELCOME TO SKIN2!" />
        </Form.Item>

        <Form.Item
          label="首页主按钮文字"
          name="homepage_button_text"
          rules={[{ required: true, message: '请输入主按钮文字' }]}
          tooltip="第一个按钮的文字，固定跳转到个人中心"
        >
          <Input placeholder="进入个人中心" />
        </Form.Item>

        <Form.Item label="首页额外按钮">
          <div className="homepage-extra-buttons">
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-subtle)' }}>
              最多可添加 4 个自定义按钮（当前 {extraButtons.length}/4）
            </div>
            <Space direction="vertical" style={{ width: '100%' }}>
            {extraButtons.map((btn, idx) => (
              <Card
                key={idx}
                size="small"
                style={{ background: 'var(--bg-inner)', border: '1px solid var(--border-color)', boxShadow: 'none' }}
                bodyStyle={{ padding: 12, background: 'transparent' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>按钮 #{idx + 1}</span>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeButton(idx)}
                    >
                      删除
                    </Button>
                  </Space>
                  <Input
                    placeholder="按钮文字"
                    value={btn.text}
                    onChange={(e) => updateButton(idx, 'text', e.target.value)}
                  />
                  <Input
                    placeholder="跳转链接（支持外部URL或内部路由，如 /library）"
                    value={btn.link}
                    onChange={(e) => updateButton(idx, 'link', e.target.value)}
                  />
                </Space>
              </Card>
            ))}
            {extraButtons.length < 4 && (
              <div
                className="admin-add-btn-square"
                onClick={addButton}
                title="添加按钮"
              >
                <PlusOutlined />
              </div>
            )}
            </Space>
          </div>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存站点设置
          </Button>
          <GlobalAutoApplySwitch checked={autoApply} onChange={onAutoApplyChange} />
        </Form.Item>
      </Form>
    </Card>
  )
}

/* ============================================================
   主题设置卡片（背景图 + 透明度）
   ============================================================ */
function ThemeSettings({ token, autoApply, onAutoApplyChange }: { token: string; autoApply: boolean; onAutoApplyChange: (v: boolean) => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [lightBgPreview, setLightBgPreview] = useState<string>('');
  const [darkBgPreview, setDarkBgPreview] = useState<string>('');
  const [loginBgPreview, setLoginBgPreview] = useState<string>('');
  const [loginEmbedPreview, setLoginEmbedPreview] = useState<string>('');
  // 预览视频本地静音状态（覆盖全局设置，方便测试）
  const [previewMuted, setPreviewMuted] = useState<boolean>(true);
  // 从全局设置初始化预览静音状态
  const videoMutedGlobal = useSiteStore((s) => s.videoMuted);
  useEffect(() => {
    setPreviewMuted(videoMutedGlobal);
  }, [videoMutedGlobal]);

  const loadSettings = async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('读取失败')
      const data = await res.json()
      form.setFieldsValue({
        light_bg_image: String(data.LIGHT_BG_IMAGE || ''),
        dark_bg_image: String(data.DARK_BG_IMAGE || data.HOMEPAGE_BG_IMAGE || ''),
        login_bg_image: String(data.LOGIN_BG_IMAGE || ''),
        login_embed_image: String(data.LOGIN_EMBED_IMAGE || ''),
        video_muted: String(data.VIDEO_MUTED || 'true').toLowerCase() === 'true',
        light_bg_overlay_opacity: parseInt(data.LIGHT_BG_OVERLAY_OPACITY) || 30,
        dark_bg_overlay_opacity: parseInt(data.DARK_BG_OVERLAY_OPACITY) || 30,
      })
      if (data.LIGHT_BG_IMAGE) {
        setLightBgPreview(data.LIGHT_BG_IMAGE);
      }
      if (data.DARK_BG_IMAGE) {
        setDarkBgPreview(data.DARK_BG_IMAGE);
      } else if (data.HOMEPAGE_BG_IMAGE) {
        setDarkBgPreview(data.HOMEPAGE_BG_IMAGE);
      }
      if (data.LOGIN_BG_IMAGE) {
        setLoginBgPreview(data.LOGIN_BG_IMAGE);
      }
      if (data.LOGIN_EMBED_IMAGE) {
        setLoginEmbedPreview(data.LOGIN_EMBED_IMAGE);
      }
    } catch (err: any) {
      message.error(err.message || '读取设置失败')
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      const payload = {
        light_bg_image: values.light_bg_image || '',
        dark_bg_image: values.dark_bg_image || '',
        login_bg_image: values.login_bg_image || '',
        login_embed_image: values.login_embed_image || '',
        video_muted: values.video_muted !== undefined ? String(values.video_muted) : 'true',
        light_bg_overlay_opacity: values.light_bg_overlay_opacity || 30,
        dark_bg_overlay_opacity: values.dark_bg_overlay_opacity || 30,
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.errorMessage || '保存失败')
      }
      message.success('主题设置已保存')
      if (autoApply) {
        useSiteStore.getState().loadSettings()
      }
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadLightBg = async (file: File) => {
    const formData = new FormData();
    formData.append('bgImage', file);
    try {
      const res = await fetch('/api/admin/upload-bg', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessage || '上传失败');
      setLightBgPreview(data.url);
      form.setFieldsValue({ light_bg_image: data.url });
      message.success('亮色背景图片已上传');
    } catch (err: any) {
      message.error(err.message || '上传失败');
    }
    return false;
  };

  const handleUploadDarkBg = async (file: File) => {
    const formData = new FormData();
    formData.append('bgImage', file);
    try {
      const res = await fetch('/api/admin/upload-bg', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessage || '上传失败');
      setDarkBgPreview(data.url);
      form.setFieldsValue({ dark_bg_image: data.url });
      message.success('暗色背景图片已上传');
    } catch (err: any) {
      message.error(err.message || '上传失败');
    }
    return false;
  };

  const handleUploadLoginBg = async (file: File) => {
    const formData = new FormData();
    formData.append('bgImage', file);
    try {
      const res = await fetch('/api/admin/upload-bg', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessage || '上传失败');
      setLoginBgPreview(data.url);
      form.setFieldsValue({ login_bg_image: data.url });
      message.success('登录背景图片已上传');
    } catch (err: any) {
      message.error(err.message || '上传失败');
    }
    return false;
  };

  const handleUploadLoginEmbed = async (file: File) => {
    const formData = new FormData();
    formData.append('bgImage', file);
    try {
      const res = await fetch('/api/admin/upload-bg', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errorMessage || '上传失败');
      setLoginEmbedPreview(data.url);
      form.setFieldsValue({ login_embed_image: data.url });
      message.success('登录内嵌图片已上传');
    } catch (err: any) {
      message.error(err.message || '上传失败');
    }
    return false;
  };

  if (loadingSettings) {
    return <Card style={{ marginBottom: 16 }}><Spin /></Card>
  }

  return (
    <Card title="主题设置" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        {/* 亮色模式背景图 */}
        <Form.Item label="亮色模式背景图片" name="light_bg_image" tooltip="亮色（Light）主题下显示的背景图片。支持输入图片 URL 或通过上传按钮上传。">
          <Input
            placeholder="https://example.com/light-bg.jpg"
            addonAfter={
              <Upload accept=".jpg,.jpeg,.png,.apng,.webp,.webm,.mp4" showUploadList={false} beforeUpload={handleUploadLightBg}>
                <UploadOutlined style={{ cursor: 'pointer' }} />
              </Upload>
            }
          />
        </Form.Item>

        {lightBgPreview && (
          <Form.Item label="亮色背景预览">
            {isVideoFile(lightBgPreview) ? (
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden' }}>
                <video
                  src={lightBgPreview}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay
                  loop
                  muted={previewMuted}
                  playsInline
                />
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  onClick={(e) => { e.preventDefault(); setPreviewMuted(m => !m); }}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontSize: 16,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {previewMuted ? '🔇' : '🔊'}
                </Button>
              </div>
            ) : (
              <div style={{ width: '100%', height: 200, backgroundImage: `url(${lightBgPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8, border: '1px solid #30363d' }} />
            )}
          </Form.Item>
        )}

        {/* 暗色模式背景图 */}
        <Form.Item label="暗色模式背景图片" name="dark_bg_image" tooltip="暗色（Dark）主题下显示的背景图片。支持输入图片 URL 或通过上传按钮上传。">
          <Input
            placeholder="https://example.com/dark-bg.jpg"
            addonAfter={
              <Upload accept=".jpg,.jpeg,.png,.apng,.webp,.webm,.mp4" showUploadList={false} beforeUpload={handleUploadDarkBg}>
                <UploadOutlined style={{ cursor: 'pointer' }} />
              </Upload>
            }
          />
        </Form.Item>

        {darkBgPreview && (
          <Form.Item label="暗色背景预览">
            {isVideoFile(darkBgPreview) ? (
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden' }}>
                <video
                  src={darkBgPreview}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay
                  loop
                  muted={previewMuted}
                  playsInline
                />
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  onClick={(e) => { e.preventDefault(); setPreviewMuted(m => !m); }}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontSize: 16,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {previewMuted ? '🔇' : '🔊'}
                </Button>
              </div>
            ) : (
              <div style={{ width: '100%', height: 200, backgroundImage: `url(${darkBgPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8, border: '1px solid #30363d' }} />
            )}
          </Form.Item>
        )}

        {/* 登录/注册页面背景图 */}
        <Form.Item label="登录/注册背景图片" name="login_bg_image" tooltip="登录页和注册页的背景图片。支持输入图片 URL 或通过上传按钮上传。留空则使用默认星空背景。">
          <Input
            placeholder="https://example.com/login-bg.jpg"
            addonAfter={
              <Upload accept=".jpg,.jpeg,.png,.apng,.webp,.webm,.mp4" showUploadList={false} beforeUpload={handleUploadLoginBg}>
                <UploadOutlined style={{ cursor: 'pointer' }} />
              </Upload>
            }
          />
        </Form.Item>

        {loginBgPreview && (
          <Form.Item label="登录背景预览">
            {isVideoFile(loginBgPreview) ? (
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden' }}>
                <video
                  src={loginBgPreview}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay
                  loop
                  muted={previewMuted}
                  playsInline
                />
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  onClick={(e) => { e.preventDefault(); setPreviewMuted(m => !m); }}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontSize: 16,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {previewMuted ? '🔇' : '🔊'}
                </Button>
              </div>
            ) : (
              <div style={{ width: '100%', height: 200, backgroundImage: `url(${loginBgPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8, border: '1px solid #30363d' }} />
            )}
          </Form.Item>
        )}

        {/* 登录/注册内嵌图片 */}
        <Form.Item label="登录/注册内嵌图片" name="login_embed_image" tooltip="登录页和注册页左侧展示的图片，建议尺寸比例为 9:16（竖屏）。支持输入图片 URL 或通过上传按钮上传。留空则不显示。">
          <Input
            placeholder="https://example.com/embed-image.png"
            addonAfter={
              <Upload accept=".jpg,.jpeg,.png,.apng,.webp,.webm,.mp4" showUploadList={false} beforeUpload={handleUploadLoginEmbed}>
                <UploadOutlined style={{ cursor: 'pointer' }} />
              </Upload>
            }
          />
        </Form.Item>

        {loginEmbedPreview && (
          <Form.Item label="内嵌图片预览">
            {isVideoFile(loginEmbedPreview) ? (
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden' }}>
                <video
                  src={loginEmbedPreview}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay
                  loop
                  muted={previewMuted}
                  playsInline
                />
                <Button
                  type="text"
                  shape="circle"
                  size="small"
                  onClick={(e) => { e.preventDefault(); setPreviewMuted(m => !m); }}
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontSize: 16,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {previewMuted ? '🔇' : '🔊'}
                </Button>
              </div>
            ) : (
              <div style={{ width: '100%', height: 200, backgroundImage: `url(${loginEmbedPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8, border: '1px solid #30363d' }} />
            )}
          </Form.Item>
        )}

        {/* WebM 视频静音 */}
        <Form.Item label="视频静音" name="video_muted" valuePropName="checked" tooltip="开启后，登录/注册页面的背景视频和内嵌视频将静音播放。对 MP4 和 WebM 格式均生效。">
          <Switch checkedChildren="已静音" unCheckedChildren="有声" />
        </Form.Item>

        {/* 亮色蒙版透明度 */}
        <Form.Item label="亮色蒙版透明度" name="light_bg_overlay_opacity" tooltip="亮色（Light）主题下，背景图片上方蒙版的透明度。0 为完全透明，100 为完全不透明。">
          <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
        </Form.Item>

        {/* 暗色蒙版透明度 */}
        <Form.Item label="暗色蒙版透明度" name="dark_bg_overlay_opacity" tooltip="暗色（Dark）主题下，背景图片上方蒙版的透明度。0 为完全透明，100 为完全不透明。">
          <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存主题设置
          </Button>
          <GlobalAutoApplySwitch checked={autoApply} onChange={onAutoApplyChange} />
        </Form.Item>
      </Form>
    </Card>
  )
}

/* ============================================================
   邮箱设置卡片
   ============================================================ */
function EmailSettings({ token, autoApply, onAutoApplyChange }: { token: string; autoApply: boolean; onAutoApplyChange: (v: boolean) => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // 邮件模板弹窗
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateHtml, setTemplateHtml] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  const loadSettings = async () => {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('读取失败')
      const data = await res.json()
      form.setFieldsValue({
        base_url: String(data.BASE_URL || 'http://localhost:3000'),
        smtp_host: String(data.SMTP_HOST || ''),
        smtp_port: parseInt(data.SMTP_PORT) || 587,
        smtp_secure: data.SMTP_SECURE === 'true',
        smtp_user: String(data.SMTP_USER || ''),
        smtp_pass: '',
        smtp_from: String(data.SMTP_FROM || ''),
        smtp_from_name: String(data.SMTP_FROM_NAME || ''),
      })
    } catch (err: any) {
      message.error(err.message || '读取设置失败')
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  const handleSave = async (values: any) => {
    setLoading(true)
    setTestResult(null)
    try {
      const payload: any = { ...values }
      if (!payload.smtp_pass) {
        delete payload.smtp_pass
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.errorMessage || '保存失败')
      }
      message.success('邮箱设置已保存')
      loadSettings()
      if (autoApply) {
        useSiteStore.getState().loadSettings()
      }
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  // 测试 SMTP 连接
  const handleTestSmtp = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      setTestResult({ success: data.success, message: data.message || data.error || '未知错误' })
      if (data.success) {
        message.success(data.message || 'SMTP 连接成功！')
      } else {
        message.error(data.error || 'SMTP 连接失败')
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '请求失败' })
      message.error(err.message || '请求失败')
    } finally {
      setTesting(false)
    }
  }

  // 加载邮件模板
  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      const res = await fetch('/api/admin/email-template', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      setTemplateSubject(data.subject || '')
      setTemplateHtml(data.html || '')
    } catch (err: any) {
      message.error('加载邮件模板失败')
    } finally {
      setLoadingTemplate(false)
    }
  }

  // 打开模板编辑弹窗
  const openTemplateModal = () => {
    loadTemplate()
    setTemplateModalVisible(true)
  }

  // 保存邮件模板
  const handleSaveTemplate = async () => {
    if (!templateSubject.trim()) {
      message.error('邮件主题不能为空')
      return
    }
    if (!templateHtml.trim()) {
      message.error('邮件内容不能为空')
      return
    }
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/admin/email-template', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject: templateSubject, html: templateHtml }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.errorMessage || '保存失败')
      }
      message.success('邮件模板已保存')
      setTemplateModalVisible(false)
    } catch (err: any) {
      message.error(err.message || '保存失败')
    } finally {
      setSavingTemplate(false)
    }
  }

  // 重置模板为默认
  const handleResetTemplate = () => {
    setTemplateHtml(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>邮箱验证 - Minecraft Skin Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 40px auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; color: #58a6ff; }
    .btn { display: inline-block; padding: 12px 28px; background: #238636; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .btn:hover { background: #2ea043; }
    .footer { margin-top: 24px; font-size: 12px; color: #8b949e; text-align: center; }
    .code { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; color: #58a6ff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Minecraft Skin Server</h1>
    </div>
    <p>你好 {{EMAIL}}，</p>
    <p>我们收到了你的邮箱验证请求。请点击下面的按钮完成验证：</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="{{VERIFY_URL}}" class="btn">立即验证邮箱</a>
    </p>
    <p>或者，复制以下链接到浏览器地址栏：</p>
    <div class="code">{{VERIFY_URL}}</div>
    <p style="font-size:13px;color:#8b949e;margin-top:20px;">此链接 30 分钟内有效。如果你没有请求验证，请忽略此邮件。</p>
    <div class="footer">Minecraft Skin Server &copy; {{YEAR}}</div>
  </div>
</body>
</html>`)
    setTemplateSubject('【Minecraft Skin Server】请验证你的邮箱')
    message.info('已重置为默认模板，请点保存生效')
  }

  if (loadingSettings) {
    return <Card style={{ marginBottom: 16 }}><Spin /></Card>
  }

  return (
    <>
      <Card title="邮箱设置（SMTP）" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="站点 URL"
            name="base_url"
            rules={[{ required: true, message: '请输入站点URL' }]}
            tooltip="用于生成验证邮件链接"
          >
            <Input placeholder="https://skin.example.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 服务器"
            name="smtp_host"
            rules={[{ required: true, message: '请输入SMTP服务器' }]}
          >
            <Input placeholder="smtp.163.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 端口"
            name="smtp_port"
            rules={[{ required: true, message: '请输入SMTP端口' }]}
          >
            <Input type="number" placeholder="465 或 587" />
          </Form.Item>

          <Form.Item
            label="使用 SSL/TLS"
            name="smtp_secure"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            label="SMTP 用户名"
            name="smtp_user"
            rules={[{ required: true, message: '请输入SMTP用户名' }]}
            tooltip="通常是你的邮箱地址"
          >
            <Input placeholder="your_email@163.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 密码"
            name="smtp_pass"
            tooltip="留空表示不修改；填入新密码将覆盖原密码"
          >
            <Input.Password placeholder="新密码（留空则不修改）" />
          </Form.Item>

          <Form.Item
            label="发件人邮箱"
            name="smtp_from"
            rules={[{ required: true, message: '请输入发件人邮箱' }]}
            tooltip="邮件中显示的发件人地址"
          >
            <Input placeholder="noreply@example.com" />
          </Form.Item>

          <Form.Item
            label="发件人名称"
            name="smtp_from_name"
            tooltip="邮件中显示的名称，例如：Minecraft Skin Server"
          >
            <Input placeholder="Minecraft Skin Server" />
          </Form.Item>

          <Form.Item>
            <Button
              icon={<SendOutlined />}
              onClick={handleTestSmtp}
              loading={testing}
            >
              测试 SMTP 连接
            </Button>
            {testResult && (
              <span style={{
                marginLeft: 12,
                color: testResult.success ? '#52c41a' : '#ff4d4f',
                fontSize: 13,
              }}>
                {testResult.success ? '✅ ' : '❌ '}{testResult.message}
              </span>
            )}
          </Form.Item>

          <Form.Item label="验证邮件模板">
            <Button
              icon={<EditOutlined />}
              onClick={openTemplateModal}
              loading={loadingTemplate}
            >
              编辑邮件模板
            </Button>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-subtle)' }}>
              支持占位符：<code style={{ background: '#1e3a5f', color: '#58a6ff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{'{{EMAIL}}'}</code>、<code style={{ background: '#1e3a5f', color: '#58a6ff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{'{{VERIFY_URL}}'}</code>、<code style={{ background: '#1e3a5f', color: '#58a6ff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{'{{YEAR}}'}</code>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存邮箱设置
            </Button>
            <Button style={{ marginLeft: 10 }} onClick={() => form.resetFields()}>
              重置
            </Button>
            <GlobalAutoApplySwitch checked={autoApply} onChange={onAutoApplyChange} />
          </Form.Item>
        </Form>
      </Card>

      {/* 邮件模板编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 16 }}>
            <span style={{ color: '#cccccc', fontWeight: 500 }}>编辑验证邮件模板</span>
            <CloseOutlined
              onClick={() => setTemplateModalVisible(false)}
              style={{ color: '#cccccc', fontSize: 16, cursor: 'pointer', padding: 4, borderRadius: 4 }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#3c3c3c'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
            />
          </div>
        }
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        width={800}
        closable={false}
        styles={{
          header: { backgroundColor: '#252526', borderBottom: '1px solid #3c3c3c', padding: '12px 24px' },
          body: { padding: 0, backgroundColor: 'transparent' },
          content: { backgroundColor: '#1e1e1e' },
          footer: { backgroundColor: '#252526', borderTop: '1px solid #3c3c3c', padding: '12px 24px' },
        }}
        footer={[
          <Button key="reset" onClick={handleResetTemplate} style={{ borderColor: '#3c3c3c', color: '#cccccc' }}>
            重置为默认
          </Button>,
          <Button key="cancel" onClick={() => setTemplateModalVisible(false)} style={{ borderColor: '#3c3c3c', color: '#cccccc' }}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={savingTemplate} onClick={handleSaveTemplate}>
            保存模板
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>邮件主题</div>
          <Input
            value={templateSubject}
            onChange={(e) => setTemplateSubject(e.target.value)}
            placeholder="邮件主题，支持 {{EMAIL}} 占位符"
          />
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>邮件内容（HTML）</span>
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>可用占位符：</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#1e3a5f', color: '#58a6ff', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f6feb' }}>{'{{EMAIL}}'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>= 收件人邮箱</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#1e3a5f', color: '#58a6ff', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f6feb' }}>{'{{VERIFY_URL}}'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>= 验证链接</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#1e3a5f', color: '#58a6ff', padding: '2px 8px', borderRadius: 4, border: '1px solid #1f6feb' }}>{'{{YEAR}}'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>= 当前年份</span>
        </div>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d' }}>
          <Editor
            height="55vh"
            language="html"
            theme="vs-dark"
            value={templateHtml}
            onChange={(value) => setTemplateHtml(value || '')}
            loading={
              <div style={{ color: '#ccc', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e' }}>
                正在加载编辑器...
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'all',
            }}
          />
        </div>
      </Modal>
    </>
  )
}

/* ============================================================
   主组件
   ============================================================ */
export function SystemSettings() {
  const { token } = useAuthStore()
  const [autoApply, setAutoApply] = useState(() => {
    try {
      return localStorage.getItem('admin_auto_apply') !== 'false'
    } catch {
      return true
    }
  })

  const handleAutoApplyChange = (checked: boolean) => {
    setAutoApply(checked)
    try {
      localStorage.setItem('admin_auto_apply', String(checked))
    } catch {}
  }

  if (!token) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>
  }

  return (
    <div>
      <h2>系统设置</h2>
      <RegistrationSettings token={token} autoApply={autoApply} onAutoApplyChange={handleAutoApplyChange} />
      <SiteSettings token={token} autoApply={autoApply} onAutoApplyChange={handleAutoApplyChange} />
      <ThemeSettings token={token} autoApply={autoApply} onAutoApplyChange={handleAutoApplyChange} />
      <EmailSettings token={token} autoApply={autoApply} onAutoApplyChange={handleAutoApplyChange} />
    </div>
  )
}
