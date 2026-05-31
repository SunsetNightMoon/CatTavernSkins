import { LegalDoc } from './LegalDoc'

export function Terms() {
  return (
    <LegalDoc
      title="用户协议"
      otherLabel="隐私政策"
      otherPath="/privacy"
    >
      <p className="legal-card__placeholder">
        （占位内容）本《用户协议》正文待补充。
      </p>
      <p className="legal-card__placeholder">
        在此处填写服务条款、用户行为规范、内容版权、账号责任、免责声明等条款。
      </p>
    </LegalDoc>
  )
}
