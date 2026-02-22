// components/analytics/dashboard/TrendsChart.tsx
'use client';

import { useEffect, useRef } from 'react';
import { ComparativeAnalysis } from '@/types/analytics';

interface TrendsChartProps {
  data: ComparativeAnalysis;
}

export function TrendsChart({ data }: TrendsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Configurar dimensões
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Dados mockados para demonstração (8 semanas)
    const weeks = Array.from({ length: 8 }, (_, i) => `Semana ${i + 1}`);
    const completionData = [45, 52, 48, 61, 58, 65, 62, 68];
    const gad7Data = [12, 11, 10, 9, 8, 8, 7, 6];

    // Encontrar valores máximos para escala
    const maxCompletion = Math.max(...completionData) * 1.1;
    const maxGAD7 = Math.max(...gad7Data) * 1.1;

    // Desenhar eixos
    ctx.beginPath();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Eixo Y esquerdo (Completion)
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    
    // Eixo Y direito (GAD7)
    ctx.moveTo(width - padding, padding);
    ctx.lineTo(width - padding, height - padding);
    
    // Eixo X
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Desenhar linhas de grade
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Desenhar rótulos dos eixos
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Taxa de Conclusão (%)', 10, 20);
    ctx.fillText('GAD-7', width - 60, 20);

    // Desenhar linhas de dados
    const pointWidth = chartWidth / (weeks.length - 1);

    // Linha de Completion Rate
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    
    completionData.forEach((value, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (value / maxCompletion) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Pontos da linha de Completion
    ctx.fillStyle = '#3b82f6';
    completionData.forEach((value, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (value / maxCompletion) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Linha de GAD7
    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    
    gad7Data.forEach((value, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (value / maxGAD7) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Pontos da linha de GAD7
    ctx.fillStyle = '#ef4444';
    gad7Data.forEach((value, index) => {
      const x = padding + (index * pointWidth);
      const y = height - padding - (value / maxGAD7) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Rótulos das semanas
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Inter, sans-serif';
    weeks.forEach((week, index) => {
      const x = padding + (index * pointWidth) - 20;
      ctx.fillText(week, x, height - padding + 20);
    });

  }, [data]);

  return (
    <div className="w-full h-80">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={400}
        className="w-full h-full"
      />
    </div>
  );
}