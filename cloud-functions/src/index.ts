import * as functions from 'firebase-functions/v1';

// Exportar todas as Cloud Functions
export * from './notifications/dailyReminderScheduler';
export * from './notifications/sendPushNotification';
export * from './notifications/manageUserTokens';
export * from './weeklyReset';

// Função de health check
export const healthCheck = functions
  .region('southamerica-east1')
  .https.onRequest((req, res) => {
    // Adicionar todos os headers necessários
    // Em produção: firebase functions:config:set app.allowed_origin="https://seu-dominio.com" e expor via ALLOWED_ORIGIN
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, firebase-instance-id-token');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'nexus-notifications',
      version: '1.0.0',
    });
  });