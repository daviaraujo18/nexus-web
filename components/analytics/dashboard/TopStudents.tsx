// components/analytics/dashboard/TopStudents.tsx
'use client';

import { motion } from 'framer-motion';
import { FiAward, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import Link from 'next/link';

interface TopStudentsProps {
  rankings: {
    byEngagement: Array<{
      studentId: string;
      studentName: string;
      studentGrade: string;
      value: number;
      trend: string;
      percentile: number;
      isAtRisk: boolean;
    }>;
  };
}

export function TopStudents({ rankings }: TopStudentsProps) {
  const topStudents = rankings.byEngagement.slice(0, 5);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <FiTrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <FiTrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {topStudents.map((student, index) => (
        <motion.div
          key={student.studentId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link
            href={`/professional/analytics/student/${student.studentId}`}
            className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Posição */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {index + 1}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {student.studentName}
                  </p>
                  {getTrendIcon(student.trend)}
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {student.studentGrade}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <FiAward className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {student.value.toFixed(1)}%
                    </span>
                  </div>
                  
                  <span className="text-xs text-gray-500">
                    Top {student.percentile}%
                  </span>
                </div>
              </div>
              
              {/* Risco */}
              {student.isAtRisk && (
                <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <FiAlertCircle className="h-3 w-3" />
                  <span>Risco</span>
                </div>
              )}
            </div>
          </Link>
        </motion.div>
      ))}

      {topStudents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível
        </div>
      )}
    </div>
  );
}