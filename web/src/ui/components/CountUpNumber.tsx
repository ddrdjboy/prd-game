import { useCountUp } from '../motion'

export function CountUpNumber({ value }: { value: number }) {
  return <strong className="count-up">{useCountUp(value)}</strong>
}
