// components/analytics/dashboard/ActivityHeatmap.tsx
'use client';

interface ActivityHeatmapProps {
  data: Record<number, {
    averageCompletion: number;
    averageGAD7?: number;
    totalActivities: number;
  }>;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const days = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
  ];

  const getCompletionColor = (value: number) => {
    if (value >= 80) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    if (value >= 60) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (value >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    if (value >= 20) return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getGAD7Color = (value?: number) => {
    if (!value) return 'text-gray-400';
    if (value <= 4) return 'text-green-600 dark:text-green-400';
    if (value <= 9) return 'text-yellow-600 dark:text-yellow-400';
    if (value <= 14) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, index) => {
        const dayData = data[index] || { averageCompletion: 0, totalActivities: 0 };
        
        return (
          <div key={day} className="text-center">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {day.slice(0, 3)}
            </div>
            
            <div className={`p-3 rounded-lg border ${getCompletionColor(dayData.averageCompletion)}`}>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {dayData.averageCompletion.toFixed(0)}%
              </div>
              
              {dayData.averageGAD7 && (
                <div className={`text-xs mt-1 font-medium ${getGAD7Color(dayData.averageGAD7)}`}>
                  GAD-7: {dayData.averageGAD7.toFixed(1)}
                </div>
              )}
              
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {dayData.totalActivities} ativ.
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}