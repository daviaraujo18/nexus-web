'use client';

import React, { useEffect, useState } from 'react';
import { useActivityTimer } from '@/context/ActivityTimerContext';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';
import { ProgressService } from '@/lib/services/ProgressService';

function AnalogClock({ elapsedSeconds, totalSeconds }: { elapsedSeconds: number; totalSeconds: number }) {
  const cx = 60;
  const cy = 60;
  const r = 52;

  // Elapsed rotations
  const secs = elapsedSeconds % 60;
  const mins = Math.floor(elapsedSeconds / 60) % 60;
  const hours = Math.floor(elapsedSeconds / 3600) % 12;

  const secAngle = (secs / 60) * 360;
  const minAngle = (mins / 60) * 360 + (secs / 60) * 6;
  const hourAngle = (hours / 12) * 360 + (mins / 60) * 30;

  // Progress arc for elapsed time (relative to total)
  const progress = Math.min(elapsedSeconds / totalSeconds, 1);
  const arcAngle = progress * 360;
  const arcRad = ((arcAngle - 90) * Math.PI) / 180;
  const startRad = (-90 * Math.PI) / 180;
  const arcX = cx + r * Math.cos(arcRad);
  const arcY = cy + r * Math.sin(arcRad);
  const startX = cx + r * Math.cos(startRad);
  const startY = cy + r * Math.sin(startRad);
  const largeArc = arcAngle > 180 ? 1 : 0;

  const hand = (angle: number, length: number, width: number, color: string) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = cx + length * Math.cos(rad);
    const y = cy + length * Math.sin(rad);
    return <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  };

  // Hour markers
  const markers = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const inner = i % 3 === 0 ? 42 : 46;
    const outer = 50;
    return (
      <line
        key={i}
        x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
        x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
        stroke={i % 3 === 0 ? '#6d28d9' : '#c4b5fd'}
        strokeWidth={i % 3 === 0 ? 2 : 1}
      />
    );
  });

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#ede9fe" strokeWidth="2" />

      {/* Progress arc */}
      {elapsedSeconds > 0 && progress < 1 && (
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.25"
        />
      )}
      {/* Completed ring */}
      {progress >= 1 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#7c3aed" strokeWidth="4" opacity="0.3" />
      )}

      {/* Hour markers */}
      {markers}

      {/* Hands */}
      {hand(hourAngle, 28, 3.5, '#1e1b4b')}
      {hand(minAngle, 38, 2.5, '#4c1d95')}
      {hand(secAngle, 44, 1.5, '#7c3aed')}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="#7c3aed" />
      <circle cx={cx} cy={cy} r={1.5} fill="white" />
    </svg>
  );
}

export default function FloatingTimer() {
  const { active, elapsedSeconds, stopTimer } = useActivityTimer();
  const [completing, setCompleting] = useState(false);

  if (!active) return null;

  const totalSeconds = active.estimatedMinutes * 60;
  const remaining = Math.max(totalSeconds - elapsedSeconds, 0);
  const remMins = Math.floor(remaining / 60);
  const remSecs = remaining % 60;
  const elapsedMins = Math.floor(elapsedSeconds / 60);
  const overtime = elapsedSeconds > totalSeconds;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await ProgressService.completeActivity(active.progressId, active.studentId, {
        timeSpent: Math.ceil(elapsedSeconds / 60)
      });
    } catch (e) {
      // best-effort
    } finally {
      stopTimer();
      setCompleting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-purple-100 p-4 w-64 select-none">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-0.5">Em andamento</p>
          <p className="text-sm font-bold text-gray-800 truncate">{active.title}</p>
        </div>
        <button
          onClick={stopTimer}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
          title="Cancelar timer"
        >
          <FaTimes className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Clock */}
      <div className="flex justify-center mb-3">
        <AnalogClock elapsedSeconds={elapsedSeconds} totalSeconds={totalSeconds} />
      </div>

      {/* Time info */}
      <div className="text-center mb-3">
        {overtime ? (
          <p className="text-sm font-bold text-amber-600">
            +{elapsedMins - active.estimatedMinutes} min além do estimado
          </p>
        ) : (
          <p className="text-sm font-bold text-gray-700">
            {String(remMins).padStart(2, '0')}:{String(remSecs).padStart(2, '0')} restantes
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{elapsedMins} min decorridos</p>
      </div>

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={completing}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <FaCheckCircle className="w-3.5 h-3.5" />
        {completing ? 'Concluindo...' : 'Concluir Atividade'}
      </button>
    </div>
  );
}
