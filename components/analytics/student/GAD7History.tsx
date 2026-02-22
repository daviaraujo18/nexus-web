// components/analytics/student/GAD7History.tsx
'use client';

import { useEffect, useRef } from 'react';

interface GAD7HistoryProps {
  history: Array<{
    weekNumber: number;
    date: Date;
    score: number;
    severity: string;
  }>;
}

export function GAD7History({ history }: GAD7HistoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Ordenar por semana
    const sortedHistory = [...history].sort((a, b) => a.weekNumber - b.weekNumber);
    
    const scores = sortedHistory.map(h => h.score);
    const maxScore = Math.max(...scores, 21); // GAD-7 máximo é 21
    const minScore = Math.min(...scores, 0);

    // Desenhar áreas de severidade
    const severityZones = [
      { max: 4, color: 'rgba(16, 185, 129, 0.1)', label: 'Mínimo' },
      { max: 9, color: 'rgba(245, 158, 11, 0.1)', label: 'Leve' },
      { max: 14, color: 'rgba(249, 115, 22, 0.1)', label: 'Moderado' },
      { max: 21, color: 'rgba(239, 68, 68, 0.1)', label: 'Severo' }
    ];

    let previousMax = 0;
    severityZones.forEach(zone => {
      const y1 = height - padding - (previousMax / maxScore) * chartHeight;
      const y2 = height - padding - (zone.max / maxScore) * chartHeight;
      
      ctx.fillStyle = zone.color;
      ctx.fillRect(padding, y2, chartWidth, y1 - y2);
      
      // Linha divisória
      ctx.beginPath();
      ctx.strokeStyle = '#e5e7eb';
      ctx.setLineDash([5, 5]);
      ctx.moveTo(padding, y2);
      ctx.lineTo(width - padding, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Rótulo da severidade
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(zone.label, width - padding + 5, y2 - 5);
      
      previousMax = zone.max;
    });

    // Desenhar linha de dados
    const pointWidth = chartWidth / (sortedHistory.length - 1 || 1);

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    
    sortedHistory.forEach((item, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (item.score / maxScore) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Pontos
    sortedHistory.forEach((item, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (item.score / maxScore) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      
      // Cor baseada na severidade
      if (item.score <= 4) ctx.fillStyle = '#10b981';
      else if (item.score <= 9) ctx.fillStyle = '#f59e0b';
      else if (item.score <= 14) ctx.fillStyle = '#f97316';
      else ctx.fillStyle = '#ef4444';
      
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Rótulo da semana
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`W${item.weekNumber}`, x - 10, height - padding + 20);
    });

    // Eixos
    ctx.beginPath();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nenhum dado GAD-7 disponível
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={300}
        className="w-full h-full"
      />
    </div>
  );
}