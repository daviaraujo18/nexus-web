// components/analytics/student/ProgressTimeline.tsx
'use client';

import { StudentWeeklyMetrics } from '@/types/analytics';

interface ProgressTimelineProps {
  history: StudentWeeklyMetrics[];
  selectedWeek: number | null;
  onSelectWeek: (week: number | null) => void;
}

export function ProgressTimeline({ history, selectedWeek, onSelectWeek }: ProgressTimelineProps) {
  const sortedHistory = [...history].sort((a, b) => b.weekNumber - a.weekNumber);

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-green-400';
    if (rate >= 40) return 'bg-yellow-500';
    if (rate >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {sortedHistory.map((week, index) => (
        <button
          key={week.weekNumber}
          onClick={() => onSelectWeek(selectedWeek === week.weekNumber ? null : week.weekNumber)}
          className={`w-full p-4 rounded-lg transition-all ${
            selectedWeek === week.weekNumber
              ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
              : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900 dark:text-white">
              Semana {week.weekNumber}
            </span>
            <span className="text-sm text-gray-500">
              {week.weekStartDate.toLocaleDateString()} - {week.weekEndDate.toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Conclusão</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getStatusColor(week.completionRate)}`}
                    style={{ width: `${week.completionRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {week.completionRate.toFixed(0)}%
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Consistência</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {week.consistencyScore.toFixed(0)}%
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Pontos</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {week.pointsEarned}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">GAD-7</div>
              <div className={`text-sm font-medium ${
                !week.gad7 ? 'text-gray-400' :
                week.gad7.score <= 4 ? 'text-green-600' :
                week.gad7.score <= 9 ? 'text-yellow-600' :
                week.gad7.score <= 14 ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {week.gad7 ? week.gad7.score : '—'}
              </div>
            </div>
          </div>

          {/* Indicadores de melhora/piora */}
          {(week.isImprovement || week.isDecline) && (
            <div className="mt-2 flex items-center gap-2">
              {week.isImprovement && (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                  ↑ Melhor que semana anterior
                </span>
              )}
              {week.isDecline && (
                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full">
                  ↓ Pior que semana anterior
                </span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}