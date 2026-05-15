import { onRequest } from 'firebase-functions/v2/https';

// Exportar todas as Cloud Functions
export * from './notifications/dailyReminderScheduler';
export * from './notifications/sendPushNotification';
export * from './notifications/manageUserTokens';
export * from './weeklyReset';

// Função de health check
export const healthCheck = onRequest(
  { region: 'southamerica-east1', cors: true },
  async (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'nexus-notifications',
      version: '1.0.0',
    });
  }
);