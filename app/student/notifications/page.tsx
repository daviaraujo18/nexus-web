'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  NotificationService,
  type UserNotificationPreferences,
  type FullUserNotificationPreferences,
} from '@/lib/services/NotificationService';
import {
  FaMobileAlt,
  FaClock,
  FaCalendarDay,
  FaCog,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaFlask,
} from 'react-icons/fa';

type Preferences = FullUserNotificationPreferences;

type PushStatus = {
  available: boolean;
  subscriptionExists: boolean;
};

type NotificationTestCase = {
  key: keyof Preferences['types'];
  label: string;
  body: string;
  route?: string;
  tag: string;
};

const NOTIFICATION_TEST_CASES: NotificationTestCase[] = [
  {
    key: 'activity_reminder',
    label: 'Lembrete de Atividade',
    body: 'Hora de concluir sua atividade programada.',
    route: '/student/notifications',
    tag: 'activity-reminder-test',
  },
  {
    key: 'therapeutic_reminder',
    label: 'Lembrete Terapêutico',
    body: 'Uma mensagem de apoio foi preparada para você.',
    route: '/student/notifications',
    tag: 'therapeutic-reminder-test',
  },
  {
    key: 'educational_reminder',
    label: 'Lembrete Educacional',
    body: 'Tem conteúdo novo esperando por você.',
    route: '/student/notifications',
    tag: 'educational-reminder-test',
  },
  {
    key: 'achievement',
    label: 'Conquista',
    body: 'Parabéns! Você desbloqueou uma nova conquista.',
    route: '/student/progress',
    tag: 'achievement-test',
  },
  {
    key: 'schedule_update',
    label: 'Atualização de Agenda',
    body: 'Sua agenda recebeu uma atualização importante.',
    route: '/student/schedules',
    tag: 'schedule-update-test',
  },
  {
    key: 'message',
    label: 'Mensagem',
    body: 'Você recebeu uma nova mensagem da equipe.',
    route: '/student/notifications',
    tag: 'message-test',
  },
];

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export default function NotificationsSettingsPage() {
  const { user } = useAuth();

  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [devicePreferences, setDevicePreferences] =
    useState<UserNotificationPreferences | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [runningTestKey, setRunningTestKey] = useState<string | null>(null);
  const [testingReal, setTestingReal] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setPreferences(null);
      setDevicePreferences(null);
      setPushStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      const [devicePrefs, status, persistedPrefs] = await Promise.all([
        NotificationService.getUserPreferences(user.id),
        NotificationService.getPushStatus(),
        NotificationService.loadPreferences(user.id),
      ]);

      setDevicePreferences(devicePrefs);
      setPreferences(persistedPrefs);

      setPushStatus({
        available: status.available || devicePrefs.supported,
        subscriptionExists: status.subscriptionExists || devicePrefs.tokenExists,
      });
    } catch (error) {
      console.error('Erro ao carregar page de notificações:', error);
      setFeedback('❌ Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sendTypedTestNotification = async (testCase: NotificationTestCase) => {
    if (!user?.id || runningTestKey) return;

    setRunningTestKey(testCase.key);
    setFeedback(null);

    try {
      const response = await fetch('/api/onesignal/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: testCase.label,
          body: testCase.body,
          type: testCase.key,
          route: testCase.route,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setFeedback(
          `✅ Teste "${testCase.label}" enviado via OneSignal`
        );
      } else {
        setFeedback(
          `❌ Falha no teste "${testCase.label}"`
        );
      }
    } catch (error) {
      console.error(error);
      setFeedback(
        `❌ Erro ao enviar "${testCase.label}"`
      );
    } finally {
      setRunningTestKey(null);
    }
  };

  const sendRealTestNotification = async () => {
    if (!user?.id || testingReal) return;

    setTestingReal(true);
    setFeedback('⏳ Enviando notificação real...');

    try {
      const result = await NotificationService.sendTypedNotification({
        userId: user.id,
        title: 'Teste Real OneSignal',
        body: `Notificação de teste enviada em ${new Date().toLocaleTimeString()}`,
        type: 'message',
        route: '/student/notifications',
      });

      setFeedback(result.success ? '✅ Notificação enviada!' : `❌ Falha: ${result.reason || 'desconhecida'}`);
    } catch (error) {
      setFeedback('❌ Erro ao enviar notificação');
    } finally {
      setTestingReal(false);
    }
  };

  const currentDeviceReady = !!pushStatus?.available && !!pushStatus?.subscriptionExists;

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Painel de Testes de Notificação
      </h1>

      {feedback && (
        <div className="mb-4 p-3 border rounded bg-gray-50">
          {feedback}
        </div>
      )}

      {/* Teste Real via Cloud Function */}
      <div className="mb-4 p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
        <h2 className="font-semibold text-purple-800 mb-2">Teste Real - Cloud Function</h2>
        <button
          onClick={sendRealTestNotification}
          disabled={testingReal || !user?.id}
          className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
        >
          {testingReal ? 'Enviando...' : 'Enviar Notificação Real'}
        </button>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_TEST_CASES.map((testCase) => (
          <button
            key={testCase.key}
            onClick={() => sendTypedTestNotification(testCase)}
            disabled={!currentDeviceReady || !!runningTestKey}
            className="block w-full text-left p-4 border rounded hover:bg-gray-50"
          >
            <div className="font-semibold">{testCase.label}</div>
            <div className="text-sm text-gray-600">{testCase.body}</div>
          </button>
        ))}
      </div>
    </div>
  );
}