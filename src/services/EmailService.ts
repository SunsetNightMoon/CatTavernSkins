import nodemailer from 'nodemailer'
import { generateUUID } from '../utils/uuid'
import { UserModel } from '../models/User'

const TEMPLATE_FILE = 'config/email-template.json';

function getTemplateFilePath() {
  return require('path').resolve(process.cwd(), TEMPLATE_FILE);
}

async function loadTemplate(): Promise<{ subject: string; html: string }> {
  try {
    const fs = require('fs/promises');
    const content = await fs.readFile(getTemplateFilePath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      subject: '【Minecraft Skin Server】请验证你的邮箱',
      html: '',
    };
  }
}

// 创建 nodemailer transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.MAIL_HOST,
    port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587'),
    secure: (process.env.SMTP_SECURE || process.env.MAIL_SECURE) === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.MAIL_USER,
      pass: process.env.SMTP_PASS || process.env.MAIL_PASS,
    },
  })
}

// 发送验证邮件
export async function sendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查 SMTP 配置
    if (!(process.env.SMTP_HOST || process.env.MAIL_HOST) || !(process.env.SMTP_USER || process.env.MAIL_USER) || !(process.env.SMTP_PASS || process.env.MAIL_PASS)) {
      console.warn('SMTP 未配置，跳过邮件发送')
      return { success: false, error: 'SMTP_NOT_CONFIGURED' }
    }

    const user = await UserModel.findByEmail(email)
    if (!user) {
      return { success: false, error: 'USER_NOT_FOUND' }
    }
    if (user.email_verified) {
      return { success: false, error: 'ALREADY_VERIFIED' }
    }

    // 生成验证 token（32位随机字符串）
    const token = generateUUID() + generateUUID().replace(/-/g, '')
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟有效期

    await UserModel.setVerificationToken(email, token, expires)

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`

    // 读取邮件模板并替换占位符
    const template = await loadTemplate()
    let html = template.html || ''
    if (!html) {
      // 模板为空时使用内置默认模板
      html = getDefaultVerifyHTML(email, verifyUrl)
    } else {
      html = html.replace(/\{\{EMAIL\}\}/g, email)
                .replace(/\{\{VERIFY_URL\}\}/g, verifyUrl)
                .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()))
    }

    // 构建发件人（支持名称）
    const fromName = process.env.SMTP_FROM_NAME || ''
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || ''
    const fromField = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail

    const transporter = createTransporter()
    const mailOptions = {
      from: fromField,
      to: email,
      subject: (template.subject || '【Minecraft Skin Server】请验证你的邮箱').replace(/\{\{EMAIL\}\}/g, email),
      html,
    }

    await transporter.sendMail(mailOptions)
    console.log(`验证邮件已发送至: ${email}`)
    return { success: true }
  } catch (error: any) {
    console.error('发送验证邮件失败:', error)
    // 返回更友好的错误信息
    let errorMsg = error.message || '未知错误'
    if (error.code === 'EAUTH') errorMsg = 'SMTP 认证失败，请检查用户名和授权密码'
    if (error.code === 'ESOCKET') errorMsg = '无法连接 SMTP 服务器，请检查 host/端口/网络'
    if (error.code === 'ETIMEDOUT') errorMsg = '连接 SMTP 服务器超时'
    return { success: false, error: errorMsg }
  }
}

// 默认验证邮件 HTML（模板为空时备用）
function getDefaultVerifyHTML(email: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
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
    <p>你好 ${email}，</p>
    <p>我们收到了你的邮箱验证请求。请点击下面的按钮完成验证：</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${verifyUrl}" class="btn">立即验证邮箱</a>
    </p>
    <p>或者，复制以下链接到浏览器地址栏：</p>
    <div class="code">${verifyUrl}</div>
    <p style="font-size:13px;color:#8b949e;margin-top:20px;">此链接 30 分钟内有效。如果你没有请求验证，请忽略此邮件。</p>
    <div class="footer">Minecraft Skin Server &copy; ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`
}

// 验证 token 并激活邮箱
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const user = await UserModel.findByVerificationToken(token)
    if (!user) {
      return { success: false, error: 'INVALID_OR_EXPIRED_TOKEN' }
    }
    await UserModel.setEmailVerified(user.email, true)
    return { success: true, email: user.email }
  } catch (error: any) {
    console.error('验证邮箱 token 失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 生成随机重置码（8位字母数字）
 */
function generateResetCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    if (!(process.env.SMTP_HOST || process.env.MAIL_HOST) || !(process.env.SMTP_USER || process.env.MAIL_USER) || !(process.env.SMTP_PASS || process.env.MAIL_PASS)) {
      console.warn('SMTP 未配置，跳过邮件发送')
      return { success: false, error: 'SMTP_NOT_CONFIGURED' }
    }

    const user = await UserModel.findByEmail(email)
    if (!user) {
      return { success: false, error: 'USER_NOT_FOUND' }
    }

    const code = generateResetCode()
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await UserModel.setVerificationToken(email, code, expires)

    const fromName = process.env.SMTP_FROM_NAME || ''
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || ''
    const fromField = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>密码重置 - Minecraft Skin Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 40px auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; color: #58a6ff; }
    .code-box { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 24px; letter-spacing: 4px; color: #58a6ff; margin: 20px 0; }
    .footer { margin-top: 24px; font-size: 12px; color: #8b949e; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎮 Minecraft Skin Server</h1>
    </div>
    <p>你好 ${email}，</p>
    <p>我们收到了你的密码重置请求。请使用以下验证码重置你的密码：</p>
    <div class="code-box">${code}</div>
    <p style="font-size:13px;color:#8b949e;margin-top:20px;">此验证码 30 分钟内有效。如果你没有请求重置密码，请忽略此邮件。</p>
    <div class="footer">Minecraft Skin Server &copy; ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`

    const transporter = createTransporter()
    const mailOptions = {
      from: fromField,
      to: email,
      subject: '【Minecraft Skin Server】密码重置验证码',
      html,
    }

    await transporter.sendMail(mailOptions)
    console.log(`密码重置邮件已发送至: ${email}`)
    return { success: true, code }
  } catch (error: any) {
    console.error('发送密码重置邮件失败:', error)
    let errorMsg = error.message || '未知错误'
    if (error.code === 'EAUTH') errorMsg = 'SMTP 认证失败'
    if (error.code === 'ESOCKET') errorMsg = '无法连接 SMTP 服务器'
    if (error.code === 'ETIMEDOUT') errorMsg = '连接 SMTP 服务器超时'
    return { success: false, error: errorMsg }
  }
}
