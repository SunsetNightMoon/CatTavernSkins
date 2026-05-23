import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'

export function Login() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((state) => state.setAuth)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const data = await authService.login({
        email: values.email,
        password: values.password,
      })

      // 保存认证信息（包含玩家名称）
      const profileName = data.profileName || null
      const profileId = data.profiles?.[0]?.id || null
      setAuth(data.accessToken, data.user, data.skinUrl, profileName, profileId)

      message.success('登录成功！')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '50px auto', padding: '20px' }}>
      <h2>登录</h2>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="邮箱"
          name="email"
          rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登录
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <span>还没有账户？ </span>
          <Link to="/register">立即注册</Link>
        </div>
      </Form>
    </div>
  )
}
