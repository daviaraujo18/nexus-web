'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  NotificationService,
  type UserNotificationPreferences,
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

type Preferences = {
  enabled: boolean;
  channels: {
    push: boolean;
    in_app: boolean;
    email: boolean;
  };
  allowedHours: {
    start: string;
    end: string;
  };
  allowedDays: number[];
  types: {
    activity_reminder: boolean;
    therapeutic_reminder: boolean;
    educational_reminder: boolean;
    achievement: boolean;
    schedule_update: boolean;
    message: boolean;
  };
  therapeuticSettings?: {
    avoidEveningNotifications: boolean;
    weekendReducedFrequency: boolean;
    maxDailyNotifications: number;
  };
};

type FcmStatus = {
  available: boolean;
  tokenExists: boolean;
};

type NotificationTestCase = {
  key: string;
  label: string;
  body: string;
  route?: string;
  tag: string;
  data?: Record<string, unknown>;
};

const NOTIFICATION_TEST_CASES: NotificationTestCase[] = [
  {
    key: 'activity_reminder',
    label: 'Lembrete de Atividade',
    body: 'Hora de concluir sua atividade programada.',
    route: '/student/activities',
    tag: 'activity-reminder-test',
    data: { type: 'activity_reminder', priority: 'normal' },
  },
  {
    key: 'therapeutic_reminder',
    label: 'Lembrete Terapêutico',
    body: 'Uma mensagem de apoio foi preparada para você.',
    route: '/student/notifications',
    tag: 'therapeutic-reminder-test',
    data: { type: 'therapeutic_reminder', priority: 'normal' },
  },
  {
    key: 'educational_reminder',
    label: 'Lembrete Educacional',
    body: 'Tem conteúdo novo esperando por você.',
    route: '/student/notifications',
    tag: 'educational-reminder-test',
    data: { type: 'educational_reminder', priority: 'normal' },
  },
  {
    key: 'achievement',
    label: 'Conquista',
    body: 'Parabéns! Você desbloqueou uma nova conquista.',
    route: '/student/notifications',
    tag: 'achievement-test',
    data: { type: 'achievement', priority: 'high' },
  },
  {
    key: 'schedule_update',
    label: 'Atualização de Agenda',
    body: 'Sua agenda recebeu uma atualização importante.',
    route: '/student/schedule',
    tag: 'schedule-update-test',
    data: { type: 'schedule_update', priority: 'high' },
  },
  {
    key: 'message',
    label: 'Mensagem',
    body: 'Você recebeu uma nova mensagem da equipe.',
    route: '/student/messages',
    tag: 'message-test',
    data: { type: 'message', priority: 'high' },
  },
];

function getDefaultPreferences(): Preferences {
  return {
    enabled: true,
    channels: {
      push: true,
      in_app: true,
      email: false,
    },
    allowedHours: {
      start: '08:00',
      end: '20:00',
    },
    allowedDays: [1, 2, 3, 4, 5],
    types: {
      activity_reminder: true,
      therapeutic_reminder: true,
      educational_reminder: true,
      achievement: true,
      schedule_update: true,
      message: true,
    },
    therapeuticSettings: {
      avoidEveningNotifications: false,
      weekendReducedFrequency: false,
      maxDailyNotifications: 4,
    },
  };
}

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
  const [fcmStatus, setFcmStatus] = useState<FcmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [runningTestKey, setRunningTestKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setPreferences(null);
      setDevicePreferences(null);
      setFcmStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      const [devicePrefs, status, currentToken] = await Promise.all([
        NotificationService.getUserPreferences(user.id),
        NotificationService.checkFCMAvailability(),
        NotificationService.getCurrentFCMToken(),
      ]);

      setDevicePreferences(devicePrefs);
      setPreferences((prev) => {
        const base = prev ?? getDefaultPreferences();

        return {
          ...base,
          enabled: devicePrefs.enabled,
          channels: {
            ...base.channels,
            push: devicePrefs.permission === 'granted' && devicePrefs.supported,
          },
        };
      });

      setFcmStatus({
        available: status.available || devicePrefs.supported,
        tokenExists: !!currentToken || status.tokenExists || devicePrefs.tokenExists,
      });
    } catch {
      setDevicePreferences(null);
      setPreferences(getDefaultPreferences());
      setFcmStatus({
        available: false,
        tokenExists: false,
      });
      setFeedback('❌ Erro ao carregar configurações de notificações.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updatePreference = async (path: string, value: unknown) => {
    if (!preferences || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      const newPrefs = deepClone(preferences);
      const keys = path.split('.');
      let current: Record<string, unknown> = newPrefs as Record<string, unknown>;

      for (let i = 0; i < keys.length - 1; i += 1) {
        const next = current[keys[i]];
        if (!next || typeof next !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
      setPreferences(newPrefs);

      await Promise.resolve();
    } catch {
      setFeedback('❌ Erro ao atualizar preferência.');
    } finally {
      setSaving(false);
    }
  };

  const requestFCMToken = async () => {
    if (!user?.id || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      const result = await NotificationService.enableNotifications();

      if (result.success && result.token) {
        setFeedback('✅ Token FCM registrado com sucesso neste dispositivo.');
        await loadData();
      } else if (result.permission !== 'granted') {
        setFeedback('❌ Você precisa permitir notificações no navegador.');
      } else {
        setFeedback('❌ Não foi possível registrar token FCM neste dispositivo.');
      }
    } catch {
      setFeedback('❌ Erro ao registrar token FCM.');
    } finally {
      setSaving(false);
    }
  };

  const resetFCMToken = async () => {
    if (!user?.id || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      await NotificationService.removeFCMToken();
      const result = await NotificationService.enableNotifications();

      if (result.success && result.token) {
        setFeedback('✅ Token FCM resetado e registrado novamente.');
        await loadData();
      } else if (result.permission !== 'granted') {
        setFeedback('❌ Você precisa permitir notificações no navegador.');
      } else {
        setFeedback('❌ Não foi possível resetar o token FCM.');
      }
    } catch {
      setFeedback('❌ Erro ao resetar token FCM.');
    } finally {
      setSaving(false);
    }
  };

  const sendRealTestNotification = async () => {
    if (!user?.id || runningTestKey) return;

    setRunningTestKey('real_test');
    setFeedback(null);

    try {
      const result = await NotificationService.testNotification(user.id);

      if (result?.success) {
        setFeedback(
          `✅ Notificação de teste enviada com sucesso. sent=${result.sent}, failed=${result.failed}`
        );
      } else {
        setFeedback('❌ Falha ao enviar notificação de teste.');
      }
    } catch {
      setFeedback('❌ Erro ao enviar notificação de teste.');
    } finally {
      setRunningTestKey(null);
    }
  };

  const sendUnavailableTypedTest = async (testCase: NotificationTestCase) => {
    setRunningTestKey(testCase.key);
    setFeedback(null);

    try {
      setFeedback(
        `ℹ️ O teste "${testCase.label}" ainda não está ligado ao backend atual. Hoje o NotificationService.testNotification só envia o payload padrão.`
      );
    } finally {
      setRunningTestKey(null);
    }
  };

  const currentDeviceReady = !!fcmStatus?.available && !!fcmStatus?.tokenExists;

  const permissionLabel =
    devicePreferences?.permission ??
    (typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  const isUnauthenticated = useMemo(() => !loading && !user, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (isUnauthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Sessão não encontrada
          </h1>
          <p className="text-gray-600">
            Faça login novamente para acessar as configurações de notificações.
          </p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Não foi possível carregar
          </h1>
          <p className="text-gray-600">
            Tente recarregar a página para buscar suas configurações novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Configurações de Notificações
          </h1>
          <p className="mt-2 text-gray-600">
            Configure como e quando receber lembretes das suas atividades
          </p>
        </div>

        {feedback && (
          <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-800">{feedback}</p>
          </div>
        )}

        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FaMobileAlt className="text-indigo-600" />
              Status do Firebase Cloud Messaging
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={requestFCMToken}
                disabled={saving || !fcmStatus?.available}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Processando...' : 'Ativar'}
              </button>

              <button
                onClick={resetFCMToken}
                disabled={saving || !fcmStatus?.available}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
              >
                Resetar token
              </button>
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-700">
            <p>
              Permissão de notificações:{' '}
              <span className="font-semibold">{permissionLabel}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-lg ${
                fcmStatus?.available
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">FCM Disponível</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {fcmStatus?.available
                      ? 'Este navegador atual suporta notificações push'
                      : 'Este navegador atual não suporta FCM web adequadamente'}
                  </p>
                </div>
                {fcmStatus?.available ? (
                  <FaCheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <FaTimesCircle className="w-6 h-6 text-yellow-600" />
                )}
              </div>
            </div>

            <div
              className={`p-4 rounded-lg ${
                fcmStatus?.tokenExists
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">Token deste dispositivo</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {fcmStatus?.tokenExists
                      ? 'Este navegador atual já possui token FCM'
                      : 'Este navegador atual ainda não possui token FCM'}
                  </p>
                </div>

                {fcmStatus?.tokenExists ? (
                  <FaCheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <button
                    onClick={requestFCMToken}
                    disabled={saving || !fcmStatus?.available}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Registrando...' : 'Registrar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-sm font-medium text-gray-900">
              Status deste dispositivo
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {currentDeviceReady
                ? '✅ Este dispositivo atual está pronto para receber notificações push.'
                : '⚠️ Este dispositivo atual ainda não está pronto para receber push. O envio de teste pode estar indo para outro dispositivo já registrado no mesmo usuário.'}
            </p>
          </div>

          {!fcmStatus?.available && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <FaInfoCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Compatibilidade
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Teste preferencialmente em Chrome/Chromium no desktop ou Android.
                    Em iPhone/iPad, o ideal é adicionar o app à Tela de Início
                    para validar push web.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FaFlask className="text-red-600" />
            Painel de Testes de Notificação
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <button
              onClick={sendRealTestNotification}
              disabled={!!runningTestKey || !currentDeviceReady}
              className="px-4 py-3 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {runningTestKey === 'real_test'
                ? 'Enviando teste...'
                : 'Enviar teste real'}
            </button>

            <button
              onClick={sendRealTestNotification}
              disabled={!!runningTestKey || !currentDeviceReady}
              className="px-4 py-3 rounded bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {runningTestKey === 'real_test'
                ? 'Enviando teste...'
                : 'Repetir teste padrão'}
            </button>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm font-medium text-gray-900 mb-4">
              Tipos previstos na UI
            </p>

            <div className="space-y-3">
              {NOTIFICATION_TEST_CASES.map((testCase) => (
                <div
                  key={testCase.key}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{testCase.label}</p>
                    <p className="text-sm text-gray-600">{testCase.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      type={testCase.key} | tag={testCase.tag} | route={testCase.route || '—'}
                    </p>
                  </div>

                  <button
                    onClick={() => sendUnavailableTypedTest(testCase)}
                    disabled={!!runningTestKey}
                    className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {runningTestKey === testCase.key
                      ? 'Processando...'
                      : 'Indisponível no backend atual'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-900">
                No estado atual, o backend exposto por <code>NotificationService.testNotification(userId)</code>
                envia apenas um payload padrão. Para esses botões dispararem tipos específicos,
                o próximo passo é expandir a assinatura do service e da Cloud Function.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FaCog className="text-gray-600" />
            Preferências Gerais
          </h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Ativar Notificações</p>
                <p className="text-sm text-gray-600 mt-1">
                  Estado atual do dispositivo/navegador
                </p>
              </div>
              <button
                onClick={() => updatePreference('enabled', !preferences.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                  preferences.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    preferences.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <p className="font-medium text-gray-900 mb-3">
                Canais de Notificação
              </p>
              <div className="space-y-3">
                {[
                  {
                    key: 'push',
                    label: 'Push (FCM)',
                    description: 'Notificações no dispositivo',
                  },
                  {
                    key: 'in_app',
                    label: 'Na Aplicação',
                    description: 'Alertas dentro do site',
                  },
                  {
                    key: 'email',
                    label: 'E-mail',
                    description: 'Mensagens por e-mail',
                  },
                ].map((channel) => (
                  <div
                    key={channel.key}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{channel.label}</p>
                      <p className="text-sm text-gray-600">
                        {channel.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        updatePreference(
                          `channels.${channel.key}`,
                          !preferences.channels[
                            channel.key as keyof typeof preferences.channels
                          ]
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                        preferences.channels[
                          channel.key as keyof typeof preferences.channels
                        ]
                          ? 'bg-indigo-600'
                          : 'bg-gray-200'
                      }`}
                      disabled={channel.key === 'push' && !fcmStatus?.available}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          preferences.channels[
                            channel.key as keyof typeof preferences.channels
                          ]
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Essas preferências detalhadas ainda estão em modo local na UI.
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FaClock className="text-gray-500" />
                Horário Permitido
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Início
                  </label>
                  <select
                    value={preferences.allowedHours.start}
                    onChange={(e) =>
                      updatePreference('allowedHours.start', e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = i + 6;
                      return `${hour.toString().padStart(2, '0')}:00`;
                    }).map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fim
                  </label>
                  <select
                    value={preferences.allowedHours.end}
                    onChange={(e) =>
                      updatePreference('allowedHours.end', e.target.value)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = i + 12;
                      return `${hour.toString().padStart(2, '0')}:00`;
                    }).map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Notificações só serão enviadas dentro deste horário
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <FaCalendarDay className="text-gray-500" />
                Dias da Semana
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
                  (day, index) => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = [...preferences.allowedDays];
                        const dayIndex = days.indexOf(index);

                        if (dayIndex > -1) {
                          days.splice(dayIndex, 1);
                        } else {
                          days.push(index);
                          days.sort((a, b) => a - b);
                        }

                        void updatePreference('allowedDays', days);
                      }}
                      className={`py-2 rounded-lg text-sm font-medium ${
                        preferences.allowedDays.includes(index)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day}
                    </button>
                  )
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Notificações só serão enviadas nos dias selecionados
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Tipos de Notificação
          </h2>

          <div className="space-y-4">
            {[
              {
                key: 'activity_reminder',
                label: 'Lembretes de Atividades',
                description: 'Notificações diárias das suas atividades',
              },
              {
                key: 'therapeutic_reminder',
                label: 'Lembretes Terapêuticos',
                description: 'Mensagens de apoio e acompanhamento',
              },
              {
                key: 'educational_reminder',
                label: 'Lembretes Educacionais',
                description: 'Dicas e conteúdos educativos',
              },
              {
                key: 'achievement',
                label: 'Conquistas',
                description: 'Quando você alcança uma meta ou conquista',
              },
              {
                key: 'schedule_update',
                label: 'Atualizações de Agenda',
                description: 'Mudanças na sua programação',
              },
              {
                key: 'message',
                label: 'Mensagens',
                description: 'Comunicação da equipe terapêutica',
              },
            ].map((type) => (
              <div key={type.key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{type.label}</p>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
                <button
                  onClick={() =>
                    updatePreference(
                      `types.${type.key}`,
                      !preferences.types[
                        type.key as keyof typeof preferences.types
                      ]
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    preferences.types[
                      type.key as keyof typeof preferences.types
                    ]
                      ? 'bg-indigo-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      preferences.types[
                        type.key as keyof typeof preferences.types
                      ]
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {preferences.therapeuticSettings && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Configurações Terapêuticas
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Evitar Notificações à Noite
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Não enviar notificações após as 20h
                  </p>
                </div>
                <button
                  onClick={() =>
                    updatePreference(
                      'therapeuticSettings.avoidEveningNotifications',
                      !preferences.therapeuticSettings?.avoidEveningNotifications
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    preferences.therapeuticSettings?.avoidEveningNotifications
                      ? 'bg-indigo-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      preferences.therapeuticSettings?.avoidEveningNotifications
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Reduzir Frequência no Fim de Semana
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Menos notificações aos sábados e domingos
                  </p>
                </div>
                <button
                  onClick={() =>
                    updatePreference(
                      'therapeuticSettings.weekendReducedFrequency',
                      !preferences.therapeuticSettings?.weekendReducedFrequency
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    preferences.therapeuticSettings?.weekendReducedFrequency
                      ? 'bg-indigo-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      preferences.therapeuticSettings?.weekendReducedFrequency
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Limite Diário de Notificações
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Máximo de notificações por dia
                  </p>
                </div>
                <select
                  value={preferences.therapeuticSettings?.maxDailyNotifications || 4}
                  onChange={(e) =>
                    updatePreference(
                      'therapeuticSettings.maxDailyNotifications',
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="border border-gray-300 rounded-lg px-3 py-1"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}