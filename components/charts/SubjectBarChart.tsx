'use client';

import React from 'react';

export interface SubjectStat {
  subject: string;
  count: number;
}

interface SubjectBarChartProps {
  data: SubjectStat[];
  title?: string;
  emptyMessage?: string;
}

const COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#7c3aed', '#4f46e5',
];

export default function SubjectBarChart({ data, title, emptyMessage }: SubjectBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm gap-2">
        <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {emptyMessage || 'Nenhuma atividade com matéria concluída ainda'}
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="w-full">
      {title && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</p>}
      <div className="space-y-2.5">
        {data.map((item, i) => {
          const pct = Math.round((item.count / max) * 100);
          const color = COLORS[i % COLORS.length];
          return (
            <div key={item.subject} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-slate-600 text-right truncate flex-shrink-0" title={item.subject}>
                {item.subject}
              </div>
              <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}
                >
                  <span className="text-white text-[10px] font-bold">{item.count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function computeSubjectStats(activities: Array<{ status: string; activitySnapshot?: any }>): SubjectStat[] {
  const map = new Map<string, number>();
  for (const act of activities) {
    if (act.status !== 'completed') continue;
    const subject = act.activitySnapshot?.metadata?.subject;
    if (!subject) continue;
    map.set(subject, (map.get(subject) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}
