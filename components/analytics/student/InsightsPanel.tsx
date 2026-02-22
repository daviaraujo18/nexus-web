// components/analytics/student/InsightsPanel.tsx
'use client';

import { motion } from 'framer-motion';
import { 
  FiAlertCircle, 
  FiCheckCircle, 
  FiInfo, 
  FiTrendingUp,
  FiTrendingDown,
  FiArrowRight
} from 'react-icons/fi';
import { Insight } from '@/types/analytics';

interface InsightsPanelProps {
  insights: Insight[];
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'risk':
        return <FiAlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <FiAlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <FiCheckCircle className="h-5 w-5 text-green-500" />;
      case 'trend':
        return <FiTrendingUp className="h-5 w-5 text-blue-500" />;
      default:
        return <FiInfo className="h-5 w-5 text-gray-500" />;
    }
  };

  const getBgColor = (type: Insight['type']) => {
    switch (type) {
      case 'risk':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'trend':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <motion.div
          key={insight.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`p-4 rounded-lg border ${getBgColor(insight.type)}`}
        >
          <div className="flex items-start gap-3">
            {getIcon(insight.type)}
            
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {insight.title}
              </h4>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {insight.description}
              </p>
              
              {insight.metric && insight.value !== undefined && (
                <div className="mt-2 flex items-center gap-4">
                  <div className="text-xs text-gray-500">
                    {insight.metric}: {insight.value.toFixed(1)}
                    {insight.threshold && ` / ${insight.threshold}`}
                  </div>
                  
                  {insight.trend && (
                    <div className={`flex items-center gap-1 text-xs ${
                      insight.trend === 'improving' ? 'text-green-600' :
                      insight.trend === 'declining' ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {insight.trend === 'improving' ? <FiTrendingUp /> :
                       insight.trend === 'declining' ? <FiTrendingDown /> : null}
                      <span>{insight.trend}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {insight.action && (
              <button
                onClick={insight.action.onClick}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <span>{insight.action.label}</span>
                <FiArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}