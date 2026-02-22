// components/analytics/common/KPICard.tsx
'use client';

import { motion } from 'framer-motion';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

interface KPICardProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange';
  format?: 'number' | 'percentage' | 'time';
}

export function KPICard({ 
  title, 
  value, 
  unit, 
  change, 
  icon, 
  color = 'blue',
  format = 'number'
}: KPICardProps) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
  };

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'time':
        const hours = Math.floor(val / 60);
        const minutes = val % 60;
        return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
      default:
        return val.toFixed(1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatValue(value)}
            </span>
            {unit && (
              <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                {unit}
              </span>
            )}
          </div>
          
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {change > 0 ? (
                <FiTrendingUp className="h-4 w-4 text-green-500" />
              ) : change < 0 ? (
                <FiTrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
              <span className={`text-sm ${
                change > 0 ? 'text-green-600' : 
                change < 0 ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {change > 0 ? '+' : ''}{change?.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}