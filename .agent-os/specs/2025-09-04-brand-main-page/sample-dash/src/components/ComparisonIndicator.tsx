import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
interface ComparisonIndicatorProps {
  value: number;
  size?: 'sm' | 'md';
}
export const ComparisonIndicator: React.FC<ComparisonIndicatorProps> = ({
  value,
  size = 'sm'
}) => {
  const isPositive = value >= 0;
  return <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      {isPositive ? <ChevronUpIcon size={size === 'sm' ? 12 : 16} className="mr-0.5" /> : <ChevronDownIcon size={size === 'sm' ? 12 : 16} className="mr-0.5" />}
      <span>{Math.abs(value)}%</span>
    </div>;
};