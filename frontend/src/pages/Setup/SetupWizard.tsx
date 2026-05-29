import { useState } from 'react';
import { Form, Input, message, Radio } from 'antd';
import { CheckOutlined, RightOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface SetupData {
  siteName: string;
  dbType: 'sqlite' | 'postgresql';
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  redisEnabled: boolean;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  mailHost: string;
  mailPort: number;
  mailUser: string;
  mailPass: string;
  mailFrom: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const STEPS = [
  { number: 1, title: '欢迎' },
  { number: 2, title: '站点配置' },
  { number: 3, title: '数据库设置' },
  { number: 4, title: 'Redis 缓存' },
  { number: 5, title: '邮箱设置' },
  { number: 6, title: '管理员账户' },
  { number: 7, title: '确认' },
];

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [testingDb, setTestingDb] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [testingRedis, setTestingRedis] = useState(false);
  const [data, setData] = useState<SetupData>({
    siteName: '',
    dbType: 'sqlite',
    redisEnabled: false,
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    mailHost: 'smtp.163.com',
    mailPort: 465,
    mailUser: '',
    mailPass: '',
    mailFrom: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [form] = Form.useForm();

  const goNext = () => {
    const fieldsToValidate: string[] = [];
    if (step === 1) {
      setStep(2);
      setAnimKey(k => k + 1);
      return;
    }
    if (step === 2) fieldsToValidate.push('siteName');
    if (step === 3) {
      if (data.dbType === 'postgresql') {
        fieldsToValidate.push('dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword');
      } else {
        setStep(4);
        setAnimKey(k => k + 1);
        return;
      }
    }
    if (step === 4) {
      // Redis 设置：启用时需要验证连接
      if (data.redisEnabled) {
        // 不在这里验证，让用户点"测试连接"按钮
      }
      setStep(5);
      setAnimKey(k => k + 1);
      return;
    }
    if (step === 5) {
      fieldsToValidate.push('mailHost', 'mailPort', 'mailUser', 'mailPass', 'mailFrom');
    }
    if (step === 6) {
      fieldsToValidate.push('username', 'email', 'password', 'confirmPassword');
    }

    if (fieldsToValidate.length > 0) {
      form.validateFields(fieldsToValidate).then((values) => {
        setData((prev) => ({ ...prev, ...values }));
        setStep(step + 1);
        setAnimKey(k => k + 1);
      }).catch(() => {});
    } else {
      setStep(step + 1);
      setAnimKey(k => k + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setAnimKey(k => k + 1);
    }
  };

  const handleTestDb = async () => {
    const values = form.getFieldsValue();
    setTestingDb(true);
    try {
      const res = await fetch('/api/setup/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_type: data.dbType,
          db_host: values.dbHost || data.dbHost,
          db_port: values.dbPort || data.dbPort,
          db_name: values.dbName || data.dbName,
          db_user: values.dbUser || data.dbUser,
          db_password: values.dbPassword || data.dbPassword,
        }),
      });
      const body = await res.json().catch(() => ({ success: false, message: '未知错误' }));
      if (body.success) {
        message.success(body.message);
      } else {
        message.error(body.message);
      }
    } catch (e: any) {
      message.error(e.message || '测试失败');
    } finally {
      setTestingDb(false);
    }
  };

  const handleTestEmail = async () => {
    const values = form.getFieldsValue();
    setTestingMail(true);
    try {
      const res = await fetch('/api/setup/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mail_host: values.mailHost || data.mailHost,
          mail_port: values.mailPort || data.mailPort,
          mail_user: values.mailUser || data.mailUser,
          mail_pass: values.mailPass || data.mailPass,
          mail_from: values.mailFrom || data.mailFrom,
        }),
      });
      const body = await res.json().catch(() => ({ success: false, message: '未知错误' }));
      if (body.success) {
        message.success(body.message);
      } else {
        message.error(body.message);
      }
    } catch (e: any) {
      message.error(e.message || '测试失败');
    } finally {
      setTestingMail(false);
    }
  };

  const handleTestRedis = async () => {
    const values = form.getFieldsValue();
    setTestingRedis(true);
    try {
      const res = await fetch('/api/setup/test-redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redis_host: values.redisHost || data.redisHost,
          redis_port: values.redisPort || data.redisPort,
          redis_password: values.redisPassword || data.redisPassword,
        }),
      });
      const body = await res.json().catch(() => ({ success: false, message: '未知错误' }));
      if (body.success) {
        message.success(body.message);
      } else {
        message.error(body.message);
      }
    } catch (e: any) {
      message.error(e.message || '测试失败');
    } finally {
      setTestingRedis(false);
    }
  };

  const handleFinish = () => {
    setLoading(true);
    const payload: any = {
      site_name: data.siteName,
      db_type: data.dbType,
      redis_enabled: data.redisEnabled,
      mail_host: data.mailHost,
      mail_port: data.mailPort,
      mail_user: data.mailUser,
      mail_pass: data.mailPass,
      mail_from: data.mailFrom,
      admin_email: data.email,
      admin_password: data.password,
      admin_username: data.username,
    };
    if (data.dbType === 'postgresql') {
      payload.db_host = data.dbHost;
      payload.db_port = data.dbPort;
      payload.db_name = data.dbName;
      payload.db_user = data.dbUser;
      payload.db_password = data.dbPassword;
    }
    if (data.redisEnabled) {
      payload.redis_host = data.redisHost;
      payload.redis_port = data.redisPort;
      payload.redis_password = data.redisPassword;
    }
    fetch('/api/setup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({ success: false, error: '未知错误' }));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!body.success) throw new Error(body.error || '设置失败');
        setCompleted(true);
        message.success('安装完成！');
      })
      .catch((err: Error) => {
        message.error(err.message || '安装失败');
      })
      .finally(() => setLoading(false));
  };

  if (completed) {
    return (
      <div style={styles.page}>
        <div style={styles.topBar}>
          <div style={styles.stepItemActive}>
            <CheckOutlined style={{ marginRight: 6, fontSize: 12 }} />
            完成
          </div>
        </div>
        <div style={styles.content}>
          <h1 style={styles.title}>安装完成</h1>
          <p style={styles.subtitle}>您的皮肤服务器已经准备好使用了</p>
          <div style={{ flex: 1 }} />
          <div style={styles.actionArea}>
            <button
              style={styles.primaryButton}
              onClick={() => (window.location.href = '/login')}
            >
              前往登录
            </button>
          </div>
        </div>
        <div style={styles.bottomBar} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .setup-fade-in {
          animation: fadeIn 0.30s ease-out both;
        }
        .ant-form-item-label > label {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 500 !important;
        }
        .ant-form-item-label > label.ant-form-item-required::before {
          color: #ff7875 !important;
        }
        .ant-input::placeholder,
        .ant-input-password input::placeholder {
          color: rgba(255,255,255,0.4) !important;
        }
        .ant-input-affix-wrapper {
          background: rgba(255,255,255,0.12) !important;
          border: 1px solid rgba(255,255,255,0.25) !important;
        }
        .ant-input-affix-wrapper .ant-input-suffix {
          color: rgba(255,255,255,0.6) !important;
        }
        .ant-select-selector {
          background: rgba(255,255,255,0.12) !important;
          border: 1px solid rgba(255,255,255,0.25) !important;
          color: #fff !important;
        }
        .ant-select-arrow {
          color: rgba(255,255,255,0.6) !important;
        }
        .ant-radio-wrapper {
          color: #ffffff !important;
        }
        .ant-radio-inner {
          border-color: rgba(255,255,255,0.4) !important;
        }
        .ant-radio-checked .ant-radio-inner {
          border-color: #0078d7 !important;
          background: #0078d7 !important;
        }
      `}</style>

      {/* 顶部导航条 */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', gap: 0 }}>
          {STEPS.map((s) => (
            <div
              key={s.number}
              style={step === s.number ? styles.stepItemActive : styles.stepItem}
            >
              {step > s.number ? (
                <><CheckOutlined style={{ marginRight: 6, fontSize: 12 }} />{s.title}</>
              ) : (
                s.title
              )}
              {step === s.number && <div style={styles.stepIndicator} />}
            </div>
          ))}
        </div>
      </div>

      {/* 主内容 */}
      <div style={styles.content}>
        {/* 步骤内容（带过渡动画） */}
        <div key={animKey} className="setup-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* 步骤1：欢迎 */}
        {step === 1 && (
          <>
            <h1 style={styles.title}>欢迎使用皮肤服务器安装向导</h1>
            <p style={styles.subtitle}>
              此向导将引导您完成服务器的初始配置。<br />
              整个过程只需几分钟。
            </p>
          </>
        )}

        {/* 步骤2：站点配置 */}
        {step === 2 && (
          <>
            <h1 style={styles.title}>配置站点信息</h1>
            <Form form={form} layout="vertical" initialValues={{ siteName: data.siteName }} style={{ width: '100%' }}>
              <Form.Item
                label="站点名称"
                name="siteName"
                rules={[{ required: true, message: '请输入站点名称' }]}
                style={{ marginBottom: 32 }}
              >
                <Input placeholder="例如：我的皮肤站" size="large" style={styles.input} />
              </Form.Item>
            </Form>
          </>
        )}

        {/* 步骤3：数据库设置 */}
        {step === 3 && (
          <>
            <h1 style={styles.title}>配置数据库</h1>
            <Form form={form} layout="vertical" initialValues={{ dbType: data.dbType, dbPort: data.dbPort || 5432 }} style={{ width: '100%' }}>
              <Form.Item label="数据库类型" style={{ marginBottom: 32 }}>
                <Radio.Group
                  value={data.dbType}
                  onChange={(e) => setData((prev) => ({ ...prev, dbType: e.target.value }))}
                  style={{ color: '#fff' }}
                >
                  <Radio value="sqlite" style={{ color: '#fff', marginRight: 32 }}>SQLite（推荐）</Radio>
                  <Radio value="postgresql" style={{ color: '#fff' }}>PostgreSQL</Radio>
                </Radio.Group>
              </Form.Item>

              {data.dbType === 'postgresql' && (
                <>
                  <Form.Item
                    label="数据库主机"
                    name="dbHost"
                    rules={[{ required: true, message: '请输入数据库主机' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input placeholder="localhost" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="端口"
                    name="dbPort"
                    rules={[{ required: true, message: '请输入端口' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input type="number" placeholder="5432" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="数据库名称"
                    name="dbName"
                    rules={[{ required: true, message: '请输入数据库名称' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input placeholder="skin_server" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="用户名"
                    name="dbUser"
                    rules={[{ required: true, message: '请输入用户名' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input placeholder="postgres" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="dbPassword"
                    rules={[{ required: true, message: '请输入密码' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input.Password placeholder="******" size="large" style={styles.input} />
                  </Form.Item>
                  <div style={{ marginBottom: 20 }}>
                    <button
                      type="button"
                      style={styles.testButton}
                      onClick={handleTestDb}
                      disabled={testingDb}
                    >
                      <ThunderboltOutlined style={{ marginRight: 6, fontSize: 12 }} />
                      {testingDb ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                </>
              )}

              {data.dbType === 'sqlite' && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                  将使用 SQLite 数据库，数据文件保存在服务器本地，无需额外配置。
                </p>
              )}
            </Form>
          </>
        )}

        {/* 步骤4：Redis 缓存设置 */}
        {step === 4 && (
          <>
            <h1 style={styles.title}>配置 Redis 缓存（可选）</h1>
            <p style={styles.subtitle}>启用 Redis 可以提升网站访问速度，不启用则使用内存缓存。</p>
            <Form form={form} layout="vertical" initialValues={{
              redisEnabled: data.redisEnabled,
              redisHost: data.redisHost,
              redisPort: data.redisPort,
              redisPassword: data.redisPassword,
            }} style={{ width: '100%' }}>
              <Form.Item label="启用 Redis 缓存" style={{ marginBottom: 24 }}>
                <Radio.Group
                  value={data.redisEnabled}
                  onChange={(e) => setData((prev) => ({ ...prev, redisEnabled: e.target.value }))}
                  style={{ color: '#fff' }}
                >
                  <Radio value={true} style={{ color: '#fff', marginRight: 32 }}>启用</Radio>
                  <Radio value={false} style={{ color: '#fff' }}>不启用</Radio>
                </Radio.Group>
              </Form.Item>

              {data.redisEnabled && (
                <>
                  <Form.Item
                    label="Redis 主机"
                    name="redisHost"
                    rules={[{ required: true, message: '请输入 Redis 主机' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input placeholder="localhost" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="端口"
                    name="redisPort"
                    rules={[{ required: true, message: '请输入端口' }]}
                    style={{ marginBottom: 20 }}
                  >
                    <Input type="number" placeholder="6379" size="large" style={styles.input} />
                  </Form.Item>
                  <Form.Item
                    label="密码（可选）"
                    name="redisPassword"
                    style={{ marginBottom: 20 }}
                  >
                    <Input.Password placeholder="留空表示无密码" size="large" style={styles.input} />
                  </Form.Item>
                  <div style={{ marginBottom: 20 }}>
                    <button
                      type="button"
                      style={styles.testButton}
                      onClick={handleTestRedis}
                      disabled={testingRedis}
                    >
                      <ThunderboltOutlined style={{ marginRight: 6, fontSize: 12 }} />
                      {testingRedis ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                </>
              )}

              {!data.redisEnabled && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                  不启用 Redis 缓存，系统将使用内存缓存，重启后缓存清空。适合个人或小流量站点。
                </p>
              )}
            </Form>
          </>
        )}

        {/* 步骤5：邮箱设置（网易邮箱模板） */}
        {step === 5 && (
          <>
            <h1 style={styles.title}>配置邮箱服务</h1>
            <p style={styles.subtitle}>用于发送验证邮件和密码重置邮件，已预填网易邮箱格式。</p>
            <Form form={form} layout="vertical" initialValues={{
              mailHost: data.mailHost,
              mailPort: data.mailPort,
              mailUser: data.mailUser,
              mailFrom: data.mailFrom,
            }} style={{ width: '100%' }}>
              <Form.Item
                label="SMTP 服务器"
                name="mailHost"
                rules={[{ required: true, message: '请输入 SMTP 服务器' }]}
                style={{ marginBottom: 20 }}
              >
                <Input placeholder="smtp.163.com" size="large" style={styles.input} />
              </Form.Item>
              <Form.Item
                label="SMTP 端口"
                name="mailPort"
                rules={[{ required: true, message: '请输入端口' }]}
                style={{ marginBottom: 20 }}
              >
                <Input type="number" placeholder="465" size="large" style={styles.input} />
              </Form.Item>
              <Form.Item
                label="发件人邮箱"
                name="mailFrom"
                rules={[
                  { required: true, message: '请输入发件人邮箱' },
                  { type: 'email', message: '邮箱格式不正确' },
                ]}
                style={{ marginBottom: 20 }}
              >
                <Input placeholder="yourname@163.com" size="large" style={styles.input} />
              </Form.Item>
              <Form.Item
                label="SMTP 用户名"
                name="mailUser"
                rules={[{ required: true, message: '请输入 SMTP 用户名' }]}
                style={{ marginBottom: 20 }}
              >
                <Input placeholder="yourname@163.com" size="large" style={styles.input} />
              </Form.Item>
              <Form.Item
                label="SMTP 授权码"
                name="mailPass"
                rules={[{ required: true, message: '请输入 SMTP 授权码' }]}
                style={{ marginBottom: 20 }}
              >
                <Input.Password placeholder="在网易邮箱设置中获取" size="large" style={styles.input} />
              </Form.Item>
              <div style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  style={styles.testButton}
                  onClick={handleTestEmail}
                  disabled={testingMail}
                >
                  <ThunderboltOutlined style={{ marginRight: 6, fontSize: 12 }} />
                  {testingMail ? '测试中...' : '测试连接'}
                </button>
              </div>
            </Form>
          </>
        )}

        {/* 步骤6：管理员账户 */}
        {step === 6 && (
          <>
            <h1 style={styles.title}>创建超级管理员账户</h1>
            <Form form={form} layout="vertical" style={{ width: '100%' }}>
              <Form.Item
                label="用户名"
                name="username"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '至少 3 个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '仅限字母、数字和下划线' },
                ]}
                style={{ marginBottom: 20 }}
              >
                <Input placeholder="admin" size="large" style={styles.input} />
              </Form.Item>

              <Form.Item
                label="电子邮箱"
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' },
                ]}
                style={{ marginBottom: 20 }}
              >
                <Input placeholder="admin@example.com" size="large" style={styles.input} />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '至少 6 位' },
                ]}
                style={{ marginBottom: 20 }}
              >
                <Input.Password placeholder="******" size="large" style={styles.input} />
              </Form.Item>

              <Form.Item
                label="确认密码"
                name="confirmPassword"
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次密码输入不一致'));
                    },
                  }),
                ]}
                style={{ marginBottom: 20 }}
              >
                <Input.Password placeholder="******" size="large" style={styles.input} />
              </Form.Item>
            </Form>
          </>
        )}

        {/* 步骤7：确认 */}
        {step === 7 && (
          <>
            <h1 style={styles.title}>确认配置信息</h1>
            <p style={styles.subtitle}>请确认以下信息是否正确，点击"开始安装"完成配置。</p>
            <div style={styles.confirmBox}>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>站点名称</span><span style={styles.confirmValue}>{data.siteName}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>数据库类型</span><span style={styles.confirmValue}>{data.dbType === 'sqlite' ? 'SQLite' : 'PostgreSQL'}</span></div>
              {data.dbType === 'postgresql' && (
                <>
                  <div style={styles.confirmRow}><span style={styles.confirmLabel}>数据库主机</span><span style={styles.confirmValue}>{data.dbHost}</span></div>
                  <div style={styles.confirmRow}><span style={styles.confirmLabel}>数据库名称</span><span style={styles.confirmValue}>{data.dbName}</span></div>
                </>
              )}
              <div style={{ height: 12 }} />
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Redis 缓存</span><span style={styles.confirmValue}>{data.redisEnabled ? `启用 (${data.redisHost}:${data.redisPort})` : '不启用'}</span></div>
              <div style={{ height: 12 }} />
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>SMTP 服务器</span><span style={styles.confirmValue}>{data.mailHost}:{data.mailPort}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>发件人邮箱</span><span style={styles.confirmValue}>{data.mailFrom}</span></div>
              <div style={{ height: 12 }} />
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>管理员用户名</span><span style={styles.confirmValue}>{data.username}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>管理员邮箱</span><span style={styles.confirmValue}>{data.email}</span></div>
            </div>
          </>
        )}

        {/* 关闭动画包裹层 */}
        </div>

        <div style={{ flex: 1 }} />
        <div style={styles.actionArea}>
          {step > 1 && (
            <button style={styles.secondaryButton} onClick={goBack}>
              返回
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 7 ? (
            <button style={styles.primaryButton} onClick={goNext} disabled={loading}>
              下一步 <RightOutlined style={{ marginLeft: 6, fontSize: 12 }} />
            </button>
          ) : (
            <button style={styles.primaryButton} onClick={handleFinish} disabled={loading}>
              {loading ? '安装中...' : '开始安装'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.bottomBar} />
    </div>
  );
}

/* ─── Win10 OOBE 风格样式 ─── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#003366',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif',
  },

  topBar: {
    background: '#1a1a1a',
    height: 48,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },

  stepItem: {
    padding: '0 20px',
    color: '#888',
    fontSize: 13,
    position: 'relative',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    cursor: 'default',
  },

  stepItemActive: {
    padding: '0 20px',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    position: 'relative',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    cursor: 'default',
  },

  stepIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: '#0078d7',
  },

  content: {
    flex: 1,
    maxWidth: 640,
    width: '100%',
    margin: '0 auto',
    padding: '80px 40px 0',
    display: 'flex',
    flexDirection: 'column',
  },

  title: {
    fontSize: 32,
    fontWeight: 300,
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 1.3,
    letterSpacing: '-0.5px',
  },

  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 400,
    marginBottom: 48,
    lineHeight: 1.6,
  },

  input: {
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 2,
    color: '#fff',
    fontSize: 16,
    height: 44,
    padding: '0 16px',
  },

  confirmBox: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  confirmRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  confirmLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },

  confirmValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 500,
  },

  actionArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '40px 0 32px',
    width: '100%',
  },

  bottomBar: {
    background: '#1a1a1a',
    height: 48,
    flexShrink: 0,
  },

  primaryButton: {
    background: '#0078d7',
    color: '#fff',
    border: 'none',
    borderRadius: 2,
    padding: '10px 28px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
  },

  secondaryButton: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: 2,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },

  testButton: {
    background: 'rgba(0,120,215,0.15)',
    color: '#4db8ff',
    border: '1px solid rgba(0,120,215,0.4)',
    borderRadius: 2,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
  },
};
