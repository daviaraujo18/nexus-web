// components/analytics/dashboard/GlobalMetrics.tsx
'use client';

import { FiUsers, FiActivity, FiClock, FiAward, FiTrendingUp, FiHeart } from 'react-icons/fi';
import { AggregatedMetrics } from '@/types/analytics';
import { KPICard } from '@/components/analytics/common/KPICard';

interface GlobalMetricsProps {
  metrics: AggregatedMetrics;
}

export function GlobalMetrics({ metrics }: GlobalMetricsProps) {
  // Calcular tendências baseadas nos dados
  const completionTrend = metrics.averageCompletionRate > 65 ? 5.2 : -2.1;
  const gad7Trend = metrics.averageGAD7Score < 7 ? -3.5 : 2.8;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard
        title="Taxa de Conclusão"
        value={metrics.averageCompletionRate}
        unit="%"
        change={completionTrend}
        icon={<FiActivity className="h-6 w-6" />}
        color="blue"
        format="percentage"
      />
      
      <KPICard
        title="Consistência Média"
        value={metrics.averageConsistencyScore}
        unit="%"
        change={3.2}
        icon={<FiTrendingUp className="h-6 w-6" />}
        color="green"
        format="percentage"
      />
      
      <KPICard
        title="Tempo por Atividade"
        value={metrics.averageTimePerActivity}
        unit="min"
        change={-1.5}
        icon={<FiClock className="h-6 w-6" />}
        color="purple"
        format="time"
      />
      
      <KPICard
        title="GAD-7 Médio"
        value={metrics.averageGAD7Score}
        change={gad7Trend}
        icon={<FiHeart className="h-6 w-6" />}
        color={metrics.averageGAD7Score < 5 ? 'green' : metrics.averageGAD7Score < 10 ? 'yellow' : 'red'}
      />

      {/* Cards secundários (opcionais) - podem ficar em uma linha extra ou em tooltip */}
      <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Pontos totais</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {metrics.totalPointsEarned.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Média de {metrics.averagePointsPerStudent.toFixed(0)} por aluno
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Streak médio</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {metrics.averageStreak.toFixed(1)} dias
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Máximo de {metrics.maxStreak} dias
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Distribuição GAD-7</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${metrics.gad7Distribution.minimal}%` }} />
            </div>
            <span className="text-xs text-gray-600">Mínimo</span>
          </div>
        </div>
      </div>
    </div>
  );
}