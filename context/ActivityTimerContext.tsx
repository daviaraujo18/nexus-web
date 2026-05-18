'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface TimerActivity {
  progressId: string;
  activityId: string;
  studentId: string;
  title: string;
  estimatedMinutes: number;
  startedAt: Date;
}

interface ActivityTimerContextValue {
  active: TimerActivity | null;
  elapsedSeconds: number;
  startTimer: (activity: TimerActivity) => void;
  stopTimer: () => void;
  // ID do progressId que foi efetivamente concluído pelo FloatingTimer (null = nenhum ou cancelado)
  completedProgressId: string | null;
  markCompleted: (progressId: string) => void;
}

const ActivityTimerContext = createContext<ActivityTimerContextValue>({
  active: null,
  elapsedSeconds: 0,
  startTimer: () => {},
  stopTimer: () => {},
  completedProgressId: null,
  markCompleted: () => {}
});

export function ActivityTimerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TimerActivity | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedProgressId, setCompletedProgressId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback((activity: TimerActivity) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(activity);
    setElapsedSeconds(0);
    setCompletedProgressId(null);

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setActive(null);
    setElapsedSeconds(0);
  }, []);

  // Sinaliza conclusão real antes de parar — distingue de cancelamento ou desmontagem
  const markCompleted = useCallback((progressId: string) => {
    setCompletedProgressId(progressId);
    stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <ActivityTimerContext.Provider value={{ active, elapsedSeconds, startTimer, stopTimer, completedProgressId, markCompleted }}>
      {children}
    </ActivityTimerContext.Provider>
  );
}

export function useActivityTimer() {
  return useContext(ActivityTimerContext);
}
