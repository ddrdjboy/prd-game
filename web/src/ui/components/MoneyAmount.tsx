type Props = {
  value: number
  /** 流量单位：默认万/季；自由生活用 month */
  flow?: boolean
  period?: 'season' | 'month'
  signed?: boolean
}

/** 财务报表用的金额。游戏货币单位是「万」。 */
export function MoneyAmount({
  value,
  flow = false,
  period = 'season',
  signed = false,
}: Props) {
  const v = Math.round(value * 100) / 100
  const text = `${signed && v > 0 ? '+' : ''}${v.toFixed(2)}`
  const unit = !flow ? '万' : period === 'month' ? '万/月' : '万/季'
  return (
    <>
      {text}
      <span className="money-unit">{unit}</span>
    </>
  )
}
