import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Steps,
  Form,
  Input,
  Button,
  message,
  Card,
  Typography,
  Space,
  Switch,
  Result,
  Divider,
  Alert,
} from 'antd'
import {
  DatabaseOutlined,
  MailOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import axios from 'axios'

const { Title, Text, Paragraph } = Typography
// Step is available via Steps component, no need to destructure

const API_BASE = '/api'

// ─── Step 0: 欢迎页 ───────────────────────────────────────────────────────────
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <SettingOutlined style={{ fontSize: 64, color: '#1677ff', marginBottom: 24 }} />
      <Title level={2}>欢迎使用 Minecraft Skin Server</Title>
      <Paragraph type="secondary" style={{ maxWidth: 480, margin: '0 auto 32px' }}>
        这是首次安装向导，将帮助你完成基本配置：数据库连接、邮件服务以及超级管理员账号创建。
        整个过程大约需要 2-3 分钟。
      </Paragraph>
      <Alert
        type="info"
        showIcon
        message="注意：安装向导只能运行一次。完成后，此页面将自动禁用。"
        style={{ maxWidth: 480, margin: '0 auto 32px', textAlign: 'left' }}
      />
      <Button type="primary" size="large" onClick={onNext}>
        开始配置
      </Button>
    </div>
  )
}

// ─── Step 1: 数据库配置 ──────────────────────────────────────────────────────
function DatabaseStep({
  onNext,
  onPrev,
}: {
  onNext: (values: any) => void
  onPrev: () => void
}) {
  const [form] = Form.useForm()
  const [dbType, setDbType] = useState<'sqlite' | 'postgres'>('sqlite')
  const [testing, setTesting] = useState(false)

  const testConnection = async () => {
    const values = form.getFieldsValue()
    setTesting(true)
    try {
      await axios.post(`${API_BASE}/setup/test-db`, { ...values, db_type: dbType })
      message.success('数据库连接成功！')
    } catch (err: any) {
      message.error(err.response?.data?.message || '数据库连接失败，请检查配置')
    } finally {
      setTesting(false)
    }
  }

  const onFinish = (values: any) => {
    onNext({ ...values, db_type: dbType })
  }

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Title level={4}>
        <DatabaseOutlined /> 数据库配置
      </Title>

      <Form.Item label="数据库类型">
        <Space>
          <Button
            type={dbType === 'sqlite' ? 'primary' : 'default'}
            onClick={() => setDbType('sqlite')}
          >
            SQLite（推荐，零配置）
          </Button>
          <Button
            type={dbType === 'postgres' ? 'primary' : 'default'}
            onClick={() => setDbType('postgres')}
          >
            PostgreSQL（生产推荐）
          </Button>
        </Space>
      </Form.Item>

      {dbType === 'sqlite' ? (
        <Form.Item
          label="数据库文件路径"
          name="db_path"
          initialValue="./data/skin_server.db"
          tooltip="SQLite 数据库文件的存储路径，相对于项目根目录"
        >
          <Input placeholder="./data/skin_server.db" />
        </Form.Item>
      ) : (
        <>
          <Form.Item
            label="主机地址"
            name="db_host"
            initialValue="localhost"
            rules={[{ required: true, message: '请输入数据库主机地址' }]}
          >
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item
            label="端口"
            name="db_port"
            initialValue="5432"
            rules={[{ required: true, message: '请输入端口号' }]}
          >
            <Input placeholder="5432" />
          </Form.Item>
          <Form.Item
            label="数据库名"
            name="db_database"
            initialValue="skin_server"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="skin_server" />
          </Form.Item>
          <Form.Item
            label="用户名"
            name="db_user"
            initialValue="postgres"
            rules={[{ required: true, message: '请输入数据库用户名' }]}
          >
            <Input placeholder="postgres" />
          </Form.Item>
          <Form.Item label="密码" name="db_password">
            <Input.Password placeholder="数据库密码" />
          </Form.Item>
        </>
      )}

      <Space>
        <Button onClick={onPrev}>上一步</Button>
        <Button onClick={testConnection} loading={testing}>
          测试连接
        </Button>
        <Button type="primary" htmlType="submit">
          下一步
        </Button>
      </Space>
    </Form>
  )
}

// ─── Step 2: 邮件配置（可选）────────────────────────────────────────────────
function MailStep({
  onNext,
  onPrev,
}: {
  onNext: (values: any) => void
  onPrev: () => void
}) {
  const [form] = Form.useForm()
  const [enableMail, setEnableMail] = useState(false)
  const [testing, setTesting] = useState(false)

  const testMail = async () => {
    const values = form.getFieldsValue()
    if (!values.smtp_user) {
      message.warning('请先填写 SMTP 配置')
      return
    }
    setTesting(true)
    try {
      await axios.post(`${API_BASE}/setup/test-mail`, values)
      message.success('测试邮件已发送，请检查收件箱')
    } catch (err: any) {
      message.error(err.response?.data?.message || '邮件发送失败')
    } finally {
      setTesting(false)
    }
  }

  const onFinish = (values: any) => {
    onNext({ ...values, enable_mail: enableMail })
  }

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Title level={4}>
        <MailOutlined /> 邮件配置（可选）
      </Title>

      <Form.Item label="启用邮件服务" valuePropName="checked">
        <Switch
          checked={enableMail}
          onChange={setEnableMail}
          checkedChildren="开启"
          unCheckedChildren="关闭"
        />
        <Text type="secondary" style={{ marginLeft: 12 }}>
          用于邮箱验证、密码重置等功能
        </Text>
      </Form.Item>

      {enableMail && (
        <>
          <Divider />
          <Form.Item
            label="SMTP 服务器"
            name="smtp_host"
            rules={[{ required: true, message: '请输入SMTP服务器地址' }]}
          >
            <Input placeholder="smtp.gmail.com" />
          </Form.Item>
          <Form.Item
            label="SMTP 端口"
            name="smtp_port"
            initialValue={587}
            rules={[{ required: true, message: '请输入SMTP端口' }]}
          >
            <Input type="number" placeholder="587" />
          </Form.Item>
          <Form.Item label="使用 SSL/TLS" name="smtp_secure" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item
            label="SMTP 用户名"
            name="smtp_user"
            rules={[{ required: true, message: '请输入SMTP用户名' }]}
          >
            <Input placeholder="your_email@gmail.com" />
          </Form.Item>
          <Form.Item
            label="SMTP 密码"
            name="smtp_pass"
            rules={[{ required: true, message: '请输入SMTP密码' }]}
            tooltip="建议使用应用专用密码"
          >
            <Input.Password placeholder="应用专用密码" />
          </Form.Item>
          <Form.Item label="发件人地址" name="smtp_from" initialValue="noreply@example.com">
            <Input placeholder="noreply@example.com" />
          </Form.Item>
          <Form.Item>
            <Button onClick={testMail} loading={testing}>
              发送测试邮件
            </Button>
          </Form.Item>
        </>
      )}

      <Space style={{ marginTop: 8 }}>
        <Button onClick={onPrev}>上一步</Button>
        <Button type="primary" htmlType="submit">
          {enableMail ? '下一步' : '跳过，下一步'}
        </Button>
      </Space>
    </Form>
  )
}

// ─── Step 3: 创建超级管理员 ──────────────────────────────────────────────────
function AdminStep({
  onNext,
  onPrev,
}: {
  onNext: (values: any) => void
  onPrev: () => void
}) {
  const [form] = Form.useForm()

  return (
    <Form form={form} layout="vertical" onFinish={onNext}>
      <Title level={4}>
        <UserAddOutlined /> 创建超级管理员
      </Title>
      <Paragraph type="secondary">
        超级管理员（Level 2）拥有系统的最高权限，包括管理其他管理员、修改系统配置等。
      </Paragraph>

      <Form.Item
        label="用户名"
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, max: 20, message: '用户名长度 3-20 位' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
        ]}
      >
        <Input placeholder="admin" />
      </Form.Item>

      <Form.Item
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input placeholder="admin@example.com" />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 8, message: '密码至少 8 位' },
        ]}
        tooltip="至少 8 位，建议包含大小写字母和数字"
      >
        <Input.Password placeholder="请输入密码" />
      </Form.Item>

      <Form.Item
        label="确认密码"
        name="confirm_password"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error('两次输入的密码不一致'))
            },
          }),
        ]}
      >
        <Input.Password placeholder="请再次输入密码" />
      </Form.Item>

      <Space>
        <Button onClick={onPrev}>上一步</Button>
        <Button type="primary" htmlType="submit">
          下一步
        </Button>
      </Space>
    </Form>
  )
}

// ─── Step 4: 确认并完成 ──────────────────────────────────────────────────────
function ConfirmStep({
  data,
  onPrev,
  onFinish,
}: {
  data: any
  onPrev: () => void
  onFinish: () => void
}) {
  const [loading, setLoading] = useState(false)

  const doSetup = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/setup/complete`, data)
      message.success('安装完成！')
      onFinish()
    } catch (err: any) {
      message.error(err.response?.data?.message || '安装失败，请检查配置后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Title level={4}>
        <CheckCircleOutlined /> 确认配置
      </Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong>数据库类型：</Text>
        <Text>{data.db_type === 'sqlite' ? 'SQLite' : 'PostgreSQL'}</Text>
        {data.db_type === 'sqlite' && (
          <>
            <br />
            <Text strong>数据库路径：</Text>
            <Text>{data.db_path || './data/skin_server.db'}</Text>
          </>
        )}
        {data.db_type === 'postgres' && (
          <>
            <br />
            <Text strong>数据库地址：</Text>
            <Text>
              {data.db_host}:{data.db_port}/{data.db_database}
            </Text>
          </>
        )}
      </Card>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong>邮件服务：</Text>
        <Text>{data.enable_mail ? `已启用（${data.smtp_host}）` : '未启用'}</Text>
      </Card>
      <Card size="small" style={{ marginBottom: 24 }}>
        <Text strong>超级管理员：</Text>
        <Text>
          {data.username}（{data.email}）
        </Text>
      </Card>

      <Alert
        type="warning"
        showIcon
        message="点击「完成安装」后，系统将初始化数据库并创建管理员账号。此操作不可撤销。"
        style={{ marginBottom: 24 }}
      />

      <Space>
        <Button onClick={onPrev}>上一步</Button>
        <Button type="primary" loading={loading} onClick={doSetup}>
          完成安装
        </Button>
      </Space>
    </div>
  )
}

// ─── Step 5: 完成 ────────────────────────────────────────────────────────────
function DoneStep() {
  const navigate = useNavigate()

  return (
    <Result
      status="success"
      title="安装成功！"
      subTitle="Minecraft Skin Server 已配置完毕，现在可以开始使用了。"
      extra={[
        <Button type="primary" key="login" onClick={() => navigate('/login')}>
          前往登录
        </Button>,
        <Button key="home" onClick={() => navigate('/')}>
          进入皮肤库
        </Button>,
      ]}
    />
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
const STEPS = [
  { title: '欢迎', icon: <SettingOutlined /> },
  { title: '数据库', icon: <DatabaseOutlined /> },
  { title: '邮件', icon: <MailOutlined /> },
  { title: '管理员', icon: <UserAddOutlined /> },
  { title: '确认', icon: <CheckCircleOutlined /> },
]

function SetupWizard() {
  const [current, setCurrent] = useState(0)
  const [formData, setFormData] = useState<any>({})

  const next = (values?: any) => {
    if (values) setFormData((prev: any) => ({ ...prev, ...values }))
    setCurrent((c) => c + 1)
  }

  const prev = () => setCurrent((c) => c - 1)

  const renderStep = () => {
    switch (current) {
      case 0:
        return <WelcomeStep onNext={() => next()} />
      case 1:
        return <DatabaseStep onNext={next} onPrev={prev} />
      case 2:
        return <MailStep onNext={next} onPrev={prev} />
      case 3:
        return <AdminStep onNext={next} onPrev={prev} />
      case 4:
        return <ConfirmStep data={formData} onPrev={prev} onFinish={() => setCurrent(5)} />
      case 5:
        return <DoneStep />
      default:
        return null
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 640,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        bodyStyle={{ padding: '40px 48px' }}
      >
        {current < 5 && (
          <Steps
            current={current}
            size="small"
            style={{ marginBottom: 40 }}
            items={STEPS.map((s) => ({ title: s.title, icon: s.icon }))}
          />
        )}
        {renderStep()}
      </Card>
    </div>
  )
}

export default SetupWizard
