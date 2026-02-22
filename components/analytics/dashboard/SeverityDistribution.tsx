// components/analytics/dashboard/SeverityDistribution.tsx
'use client';

import { useEffect, useRef } from 'react';

interface SeverityDistributionProps {
  distribution: {
    minimal: number;
    mild: number;
    moderate: number;
    severe: number;
  };
}

export function SeverityDistribution({ distribution }: SeverityDistributionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    const data = [
      { label: 'Mínimo', value: distribution.minimal, color: '#10b981' },
      { label: 'Leve', value: distribution.mild, color: '#f59e0b' },
      { label: 'Moderado', value: distribution.moderate, color: '#f97316' },
      { label: 'Severo', value: distribution.severe, color: '#ef4444' }
    ].filter(d => d.value > 0);

    let startAngle = 0;
    const total = data.reduce((sum, d) => sum + d.value, 0);

    // Desenhar fatias do gráfico de pizza
    data.forEach(item => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = item.color;
      ctx.fill();
      
      startAngle += sliceAngle;
    });

    // Desenhar círculo interno para efeito de donut
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Legenda
    let legendY = height - 100;
    data.forEach((item, index) => {
      const legendX = 50;
      
      // Quadrado da legenda
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY + index * 25, 15, 15);
      
      // Texto da legenda
      ctx.fillStyle = '#374151';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(
        `${item.label}: ${item.value.toFixed(1)}%`, 
        legendX + 25, 
        legendY + index * 25 + 12
      );
    });

  }, [distribution]);

  return (
    <div className="w-full h-80">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={400}
        className="w-full h-full"
      />
    </div>
  );
}