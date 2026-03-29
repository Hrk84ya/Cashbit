import { formatMoney } from '../utils/format';

interface MoneyDisplayProps {
  value: string;
  currency?: string;
  className?: string;
}

export default function MoneyDisplay({ value, currency = 'INR', className = '' }: MoneyDisplayProps) {
  return <span className={className}>{formatMoney(value, currency)}</span>;
}
