import { useState } from 'react'
import { Form, Input, Switch, Button, message, Card, Divider } from 'antd'

function SystemSettings() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      // TODO: 调用 API 保存系统设置
      console.log('保存系统设置:', values)
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>系统设置</h2>
      <Card style={{ maxWidth: 600, marginTop: 20 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            allow_registration: true,
            require_email_verification: true,
            enable_captcha: true,
            base_url: 'http://localhost:3000',
            smtp_host: 'smtp.gmail.com',
            smtp_port: 587,
            smtp_secure: false,
            smtp_user: '',
            smtp_from: 'noreply@example.com',
          }}
        >
          <Divider orientation="left">注册设置</Divider>
          
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
            tooltip="开启后，用户需要验证邮箱才能登录"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            label="启用人机验证"
            name="enable_captcha"
            valuePropName="checked"
            tooltip="开启后，注册和登录需要完成算术验证"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Divider orientation="left">站点设置</Divider>

          <Form.Item
            label="站点URL"
            name="base_url"
            rules={[{ required: true, message: '请输入站点URL' }]}
            tooltip="用于生成验证邮件链接"
          >
            <Input placeholder="https://skin.example.com" />
          </Form.Item>

          <Divider orientation="left">邮件设置（SMTP）</Divider>

          <Form.Item
            label="SMTP 服务器"
            name="smtp_host"
            rules={[{ required: true, message: '请输入SMTP服务器' }]}
          >
            <Input placeholder="smtp.gmail.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 端口"
            name="smtp_port"
            rules={[{ required: true, message: '请输入SMTP端口' }]}
          >
            <Input type="number" placeholder="587" />
          </Form.Item>

          <Form.Item
            label="使用SSL/TLS"
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
            <Input placeholder="your_email@gmail.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 密码"
            name="smtp_pass"
            rules={[{ required: true, message: '请输入SMTP密码' }]}
            tooltip="通常是应用专用密码，不是邮箱登录密码"
          >
            <Input.Password placeholder="your_app_password" />
          </Form.Item>

          <Form.Item
            label="发件人邮箱"
            name="smtp_from"
            rules={[{ required: true, message: '请输入发件人邮箱' }]}
            tooltip="邮件中显示的发件人地址"
          >
            <Input placeholder="noreply@example.com" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存设置
            </Button>
            <Button style={{ marginLeft: 10 }} onClick={() => form.resetFields()}>
              重置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default SystemSettings
