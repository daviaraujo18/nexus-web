// components/analytics/common/ChartContainer.tsx
'use client';

import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMaximize2, FiMinimize2, FiMoreVertical } from 'react-icons/fi';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  onExpand?: () => void;
  isLoading?: boolean;
}

export function ChartContainer({ 
  title, 
  subtitle, 
  children, 
  action,
  onExpand,
  isLoading 
}: ChartContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    if (onExpand) onExpand();
  };

  return (
    <motion.div 
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden ${
        isExpanded ? 'fixed inset-4 z-50' : ''
      }`}
      layout
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {action}
          
          <button
            onClick={handleExpand}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isExpanded ? 'Minimizar' : 'Expandir'}
          >
            {isExpanded ? <FiMinimize2 className="h-4 w-4" /> : <FiMaximize2 className="h-4 w-4" />}
          </button>
          
          <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <FiMoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 ${isExpanded ? 'h-[calc(100%-64px)] overflow-auto' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}