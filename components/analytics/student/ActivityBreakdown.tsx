// components/analytics/student/ActivityBreakdown.tsx
'use client';

import { StudentWeeklyMetrics } from '@/types/analytics';
import { ActivityType } from '@/types/schedule';

interface ActivityBreakdownProps {
  breakdown: StudentWeeklyMetrics[];
}

export function ActivityBreakdown({ breakdown }: ActivityBreakdownProps) {
  // Calcular médias por tipo de atividade
  const activityTypes: ActivityType[] = ['quick', 'text', 'quiz', 'video', 'checklist', 'file', 'app'];
  
  const averages = activityTypes.reduce((acc, type) => {
    const weeksWithType = breakdown.filter(w => w.activityBreakdown[type]);
    
    if (weeksWithType.length === 0) {
      acc[type] = { completion: 0, time: 0, points: 0 };
      return acc;
    }
    
    const avgCompletion = weeksWithType.reduce(
      (sum, w) => sum + (w.activityBreakdown[type]?.completed / w.activityBreakdown[type]?.total * 100 || 0), 
      0
    ) / weeksWithType.length;
    
    const avgTime = weeksWithType.reduce(
      (sum, w) => sum + (w.activityBreakdown[type]?.averageTime || 0), 
      0
    ) / weeksWithType.length;
    
    const avgPoints = weeksWithType.reduce(
      (sum, w) => sum + (w.activityBreakdown[type]?.pointsEarned || 0), 
      0
    ) / weeksWithType.length;
    
    acc[type] = {
      completion: avgCompletion,
      time: avgTime,
      points: avgPoints
    };
    
    return acc;
  }, {} as Record<ActivityType, { completion: number; time: number; points: number }>);

  const getActivityIcon = (type: ActivityType) => {
    const icons: Record<ActivityType, string> = {
      quick: '⚡',
      text: '📝',
      quiz: '❓',
      video: '🎥',
      checklist: '✅',
      file: '📎',
      app: '📱',
      physical_activity: '🏃'
    };
    return icons[type] || '📋';
  };

  const getActivityName = (type: ActivityType) => {
    const names: Record<ActivityType, string> = {
      quick: 'Rápida',
      text: 'Texto',
      quiz: 'Quiz',
      video: 'Vídeo',
      checklist: 'Checklist',
      file: 'Arquivo',
      app: 'App',
      physical_activity: 'Ativ. Física'
    };
    return names[type] || type;
  };

  return (
    <div className="space-y-4">
      {activityTypes.map(type => {
        const data = averages[type];
        if (data.completion === 0 && data.time === 0) return null;
        
        return (
          <div key={type} className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-lg">
              {getActivityIcon(type)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {getActivityName(type)}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {data.completion.toFixed(0)}% concluído
                </span>
              </div>
              
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500"
                  style={{ width: `${data.completion}%` }}
                />
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>⏱️ {data.time.toFixed(0)} min médio</span>
                <span>⭐ {data.points.toFixed(0)} pts médios</span>
              </div>
            </div>
          </div>
        );
      })}

      {activityTypes.every(type => averages[type].completion === 0) && (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado de atividade disponível
        </div>
      )}
    </div>
  );
}