/**
 * ⚠️ DEPRECATED - NÃO USAR NO FRONTEND
 *
 * Este gateway faz chamada DIRETA à API OneSignal usando ONESIGNAL_REST_API_KEY.
 * Isso expõe a chave de API no cliente, o que é uma vulnerabilidade de segurança.
 *
 * ✅ Use em vez disso:
 * - NotificationService.sendTypedNotification() - para envio manual tipado
 * - NotificationEventService.dispatch() - para eventos de domínio
 *
 * Ambos usam a Firebase Function `sendPushNotification` no backend.
 *
 * TODO: Mover este arquivo para pasta de backend-only ou remover completamente.
 */
type SendPushInput = {
  userId: string;
  title: string;
  body: string;
  type: string;
  route: string;
  data?: Record<string, string>;
};

export class OneSignalGateway {
  static async send(input: SendPushInput) {
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.ONESIGNAL_APP_ID;

    if (!apiKey) {
      throw new Error('ONESIGNAL_REST_API_KEY is not configured');
    }

    if (!appId) {
      throw new Error('ONESIGNAL_APP_ID is not configured');
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: [input.userId],
        headings: { en: input.title },
        contents: { en: input.body },
        data: {
          type: input.type,
          route: input.route,
          ...(input.data ?? {}),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || data?.errors?.length) {
      throw new Error(`OneSignal send failed: ${JSON.stringify(data)}`);
    }

    return data;
  }
}