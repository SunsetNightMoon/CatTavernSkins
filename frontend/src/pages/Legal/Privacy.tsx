import { LegalDoc } from './LegalDoc'

export function Privacy() {
  return (
    <LegalDoc
      title="隐私政策"
      otherLabel="用户协议"
      otherPath="/terms"
    >
      <p className="legal-card__placeholder">
        （占位内容）本《隐私政策》正文待补充。
      </p>
      <p className="legal-card__placeholder">
        在此处填写数据收集范围、用途、存储与安全、第三方共享、用户权利、Cookie 使用等条款。
      </p>
    </LegalDoc>
  )
}
