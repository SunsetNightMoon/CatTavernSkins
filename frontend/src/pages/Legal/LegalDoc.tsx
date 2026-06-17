import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSiteStore } from '../../store/siteStore'
import { usePageTitle } from '../../hooks/usePageTitle'
import './LegalDoc.css'

interface LegalDocProps {
  title: string
  /** 另一份文档的链接文字（如「隐私政策」） */
  otherLabel: string
  /** 另一份文档的路径（如 "/privacy"） */
  otherPath: string
  /** 文档正文（占位内容） */
  children: ReactNode
}

/**
 * 法律文档展示组件（用户协议 / 隐私政策）。
 * 目前为占位内容，正式文本待补充。
 */
export function LegalDoc({ title, otherLabel, otherPath, children }: LegalDocProps) {
  usePageTitle(title)
  const { theme } = useSiteStore()

  return (
    <div className="legal-page" data-theme={theme}>
      <div className="legal-card">
        <h1 className="legal-card__title">{title}</h1>
        <div className="legal-card__body">{children}</div>
        <div className="legal-card__footer">
          <Link to={otherPath}>{otherLabel}</Link>
          <span className="legal-card__sep">·</span>
          <Link to="/login">返回登录</Link>
        </div>
      </div>
    </div>
  )
}
