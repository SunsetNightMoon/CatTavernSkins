import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message, Alert } from 'antd'
import { authService } from '../../services/authService'
import type { RegisterDTO } from '../../types'

export function Register() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [captchaSessionId, setCaptchaSessionId] = useState<string>('')
  const [captchaQuestion, setCaptchaQuestion] = useState<string>('')

  // 获取验证码
  const loadCaptcha = async () => {
    try {
      const sessionId = Math.random().toString(36).substring(2, 15)
      const response = await fetch(`/api/captcha/generate?sessionId=${sessionId}`)
      const data = await response.json()
      setCaptchaSessionId(sessionId)
      setCaptchaQuestion(data.question)
    } catch (error) {
      console.error('加载验证码失败:', error)
    }
  }

  // 初始化时加载验证码
  useEffect(() => {
    loadCaptcha()
  }, [])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const registerData: RegisterDTO = {
        email: values.email,
        password: values.password,
        profile_name: values.profile_name,
        captcha_session_id: captchaSessionId,
        captcha_answer: values.captcha_answer,
      }

      const result = await authService.register(registerData)

      if (result.isFirstUser) {
        message.success('注册成功！您是第一位用户，已自动设为超级管理员')
      } else {
        message.success('注册成功！请查收验证邮件')
      }
      navigate('/login')
    } catch (error: any) {
      message.error(error.response?.data?.errorMessage || '注册失败')
      loadCaptcha() // 刷新验证码
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '50px auto', padding: '20px' }}>
      <h2>注册</h2>
      <Alert
        message="注册说明"
        description="注册时必须填写 Minecraft 游戏名（角色ID），3-16个字符，仅限字母、数字和下划线。第一个注册用户自动成为超级管理员。"
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Minecraft 游戏名（角色ID）"
          name="profile_name"
          rules={[
            { required: true, message: '请输入角色ID' },
            { min: 3, max: 16, message: '角色ID需3-16个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '仅限字母、数字和下划线' },
          ]}
        >
          <Input placeholder="例如: Steve_2024" />
        </Form.Item>

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
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6位' },
          ]}
        >
          <Input.Password placeholder="请输入密码（至少6位）" />
        </Form.Item>

        <Form.Item label="人机验证（计算下面的结果）">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Input value={captchaQuestion} disabled style={{ width: '180px', fontWeight: 'bold' }} />
            <Button onClick={loadCaptcha} icon="🔄">换一道</Button>
          </div>
        </Form.Item>

        <Form.Item
          name="captcha_answer"
          label="你的答案"
          rules={[{ required: true, message: '请输入答案' }]}
        >
          <Input placeholder="输入数字答案" style={{ width: '180px' }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            注册
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          <span>已有账户？ </span>
          <Link to="/login">立即登录</Link>
        </div>
      </Form>
    </div>
  )
}
