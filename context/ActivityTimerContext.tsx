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
}

const ActivityTimerContext = createContext<ActivityTimerContextValue>({
  active: null,
  elapsedSeconds: 0,
  startTimer: () => {},
  stopTimer: () => {}
});

export function ActivityTimerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TimerActivity | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback((activity: TimerActivity) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActive(activity);
    setElapsedSeconds(0);

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

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <ActivityTimerContext.Provider value={{ active, elapsedSeconds, startTimer, stopTimer }}>
      {children}
    </ActivityTimerContext.Provider>
  );
}

export function useActivityTimer() {
  return useContext(ActivityTimerContext);
}
