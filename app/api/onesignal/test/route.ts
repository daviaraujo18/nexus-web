import { NextResponse } from 'next/server';

/**
 * ⚠️ DEPRECATED: Esta API route não deve mais ser usada.
 * TODO: Remover após migração completa para Firebase Functions.
 *
 * O envio de notificações deve ser feito EXCLUSIVAMENTE via:
 * - NotificationEventService.dispatch() (para eventos de domínio)
 * - NotificationService.sendTypedNotification() (para envio manual tipado)
 *
 * Ambos usam internamente a Firebase Function `sendPushNotification`.
 *
 * Esta route retorna 410 Gone para forçar migração do código cliente.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'DEPRECATED: Use NotificationService.sendTypedNotification() ou NotificationEventService.dispatch()',
      migration: {
        use: 'NotificationService.sendTypedNotification()',
        via: 'Firebase Function sendPushNotification',
        docs: 'lib/services/NotificationService.ts',
      },
    },
    { status: 410 }
  );
}