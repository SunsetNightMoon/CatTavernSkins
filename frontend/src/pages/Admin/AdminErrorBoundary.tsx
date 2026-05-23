import React from 'react';
import { Button, Card, Typography, Collapse } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

/**
 * 管理面板错误边界
 * 捕获所有子组件的运行时错误，并显示友好的错误界面
 */
export default class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: '' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || '',
    });
    console.error('管理面板运行时错误:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
          <Card
            type="inner"
            title={
              <span style={{ color: '#ff4d4f' }}>
                <BugOutlined style={{ marginRight: 8 }} />
                管理面板运行时错误
              </span>
            }
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleReload}>
                刷新页面
              </Button>
            }
          >
            <Paragraph>
              <Text strong>错误类型：</Text> {this.state.error.name || 'Unknown Error'}
            </Paragraph>

            <Paragraph>
              <Text strong>错误信息：</Text>
              <Text type="danger">{this.state.error.message || '未知错误'}</Text>
            </Paragraph>

            {this.state.error.stack && (
              <Collapse style={{ marginTop: 16 }}>
                <Panel header="查看完整堆栈跟踪" key="stack">
                  <Paragraph>
                    <pre
                      style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 16,
                        borderRadius: 8,
                        overflow: 'auto',
                        fontSize: 12,
                        maxHeight: 400,
                      }}
                    >
                      {this.state.error.stack}
                    </pre>
                  </Paragraph>
                </Panel>
              </Collapse>
            )}

            {this.state.errorInfo && (
              <Collapse style={{ marginTop: 16 }}>
                <Panel header="组件堆栈" key="componentStack">
                  <Paragraph>
                    <pre
                      style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 16,
                        borderRadius: 8,
                        overflow: 'auto',
                        fontSize: 12,
                        maxHeight: 400,
                      }}
                    >
                      {this.state.errorInfo}
                    </pre>
                  </Paragraph>
                </Panel>
              </Collapse>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button type="primary" onClick={this.handleRetry} style={{ marginRight: 12 }}>
                重试
              </Button>
              <Button onClick={this.handleReload}>刷新页面</Button>
            </div>

            <Paragraph style={{ marginTop: 16, fontSize: 12, color: '#8c8c8c' }}>
              如果此错误持续出现，请：
              <ol>
                <li>打开浏览器开发者工具（F12）查看控制台错误</li>
                <li>检查网络连接是否正常</li>
                <li>确认您有管理员权限</li>
                <li>联系开发者并提供上述错误信息</li>
              </ol>
            </Paragraph>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
