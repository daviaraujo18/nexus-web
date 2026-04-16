import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendOneSignalPush } from './helpers/sendOneSignalPush';

// Inicializar Firebase Admin se não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function agendada para enviar lembretes diários às 8h00
 * Cron: 0 8 * * * (todos os dias às 8h00 UTC)
 * 
 * Esta função:
 * 1. Busca todos os alunos com atividades para hoje
 * 2. Filtra pelos que têm notificações ativas
 * 3. Envia notificação personalizada via FCM
 * 4. Registra no histórico e trata erros
 */
export const dailyReminderScheduler = functions
  .region('southamerica-east1')
  .pubsub.schedule('0 8 * * *') // 8h00 UTC (5h00 BRT)
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    try {
      // Validar configuração da API key do OneSignal
      // @ts-ignore - functions.config() typing issue
      const ONESIGNAL_REST_API_KEY = functions.config().onesignal?.rest_api_key;
      if (!ONESIGNAL_REST_API_KEY) {
        throw new Error('OneSignal REST API key not configured. Run: firebase functions:config:set onesignal.rest_api_key="YOUR_KEY"');
      }

      console.log('🚀 Iniciando envio de lembretes diários...');
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 1. Buscar todos os alunos ativos
      const studentsSnapshot = await db.collection('users')
        .where('role', '==', 'student')
        .where('isActive', '==', true)
        .get();

      console.log(`📊 Total de alunos ativos: ${studentsSnapshot.size}`);

      let successCount = 0;
      let errorCount = 0;

      // 2. Para cada aluno, verificar atividades do dia
      for (const studentDoc of studentsSnapshot.docs) {
        try {
          const student = studentDoc.data();
          const studentId = studentDoc.id;

          // Verificar preferências de notificação
          const prefs = await getUserNotificationPreferences(studentId);
          if (!prefs?.enabled || !prefs.channels.push) {
            console.log(`⏭️  Aluno ${student.name} desativou notificações`);
            continue;
          }

          // Verificar se está dentro do horário permitido
          if (!isWithinAllowedHours(new Date(), prefs)) {
            console.log(`⏭️  Fora do horário permitido para ${student.name}`);
            continue;
          }

          // Buscar atividades do dia
          const activities = await getTodayActivities(studentId, today);

          if (activities.length === 0) {
            console.log(`⏭️  Nenhuma atividade hoje para ${student.name}`);
            continue;
          }

          // Preparar dados da notificação
          const title = '📚 Nexus - Atividades do Dia';
          const body = buildNotificationBody(student.name, activities);
          const data = {
            type: 'activity_reminder',
            date: todayStr,
            activityCount: activities.length.toString(),
            studentId,
            route: '/student/dashboard',
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          };

          // Enviar notificação via OneSignal
          try {
            await sendOneSignalPush({
              userId: studentId,
              title,
              body,
              data,
              apiKey: ONESIGNAL_REST_API_KEY
            });

            // Registrar no histórico
            await saveNotificationToHistory({
              userId: studentId,
              title,
              body,
              type: 'activity_reminder',
              channels: ['push'],
              data,
              successCount: 1,
              failureCount: 0,
              sentAt: Timestamp.now()
            });

            console.log(`✅ Notificação enviada para ${student.name}`);
            successCount += 1;

          } catch (sendError) {
            console.error(`❌ Erro ao enviar para ${student.name}:`, sendError);

            // Registrar falha no histórico
            await saveNotificationToHistory({
              userId: studentId,
              title,
              body,
              type: 'activity_reminder',
              channels: ['push'],
              data,
              successCount: 0,
              failureCount: 1,
              sentAt: Timestamp.now()
            });

            errorCount += 1;
          }

        } catch (studentError) {
          console.error(`❌ Erro no aluno ${studentDoc.id}:`, studentError);
          errorCount++;
        }
      }

      console.log(`🎯 Resumo: ${successCount} notificações enviadas, ${errorCount} erros`);

      // Registrar métricas
      await db.collection('notificationMetrics').add({
        date: todayStr,
        type: 'activity_reminder',
        totalStudents: studentsSnapshot.size,
        notificationsSent: successCount,
        errors: errorCount,
        timestamp: Timestamp.now()
      });

      return null;

    } catch (error) {
      console.error('❌ Erro crítico no scheduler:', error);
      throw error;
    }
  });

// ========== FUNÇÕES AUXILIARES ==========

async function getUserNotificationPreferences(userId: string): Promise<any> {
  const prefsDoc = await db.collection('notificationPreferences')
    .doc(userId)
    .get();

  if (!prefsDoc.exists) {
    // Retornar preferências padrão
    return {
      enabled: true,
      channels: { push: true, in_app: true, email: false, sms: false },
      allowedHours: { start: "08:00", end: "21:00" },
      allowedDays: [1, 2, 3, 4, 5] // Segunda a Sexta
    };
  }

  return prefsDoc.data();
}

async function getTodayActivities(studentId: string, date: Date): Promise<any[]> {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.

  // Buscar schedule instances ativas do aluno
  const instancesSnapshot = await db.collection('scheduleInstances')
    .where('studentId', '==', studentId)
    .where('status', '==', 'active')
    .get();

  const activities: any[] = [];

  for (const instanceDoc of instancesSnapshot.docs) {
    const instance = instanceDoc.data();

    // Buscar atividades do template para o dia da semana
    const activitiesSnapshot = await db.collection('scheduleActivities')
      .where('scheduleTemplateId', '==', instance.scheduleTemplateId)
      .where('dayOfWeek', '==', dayOfWeek)
      .get();

    activitiesSnapshot.forEach(doc => {
      activities.push({
        id: doc.id,
        ...doc.data()
      });
    });
  }

  return activities;
}

function buildNotificationBody(studentName: string, activities: any[]): string {
  const activityCount = activities.length;

  if (activityCount === 1) {
    const activity = activities[0];
    return `Olá ${studentName.split(' ')[0]}! Você tem 1 atividade hoje: "${activity.title}"`;
  }

  const estimatedTime = activities.reduce((total, activity) => {
    return total + (activity.metadata?.estimatedDuration || 15);
  }, 0);

  return `Olá ${studentName.split(' ')[0]}! Você tem ${activityCount} atividades hoje (~${estimatedTime}min). Vamos começar?`;
}

function isWithinAllowedHours(date: Date, prefs: any): boolean {
  const [startHour, startMinute] = prefs.allowedHours.start.split(':').map(Number);
  const [endHour, endMinute] = prefs.allowedHours.end.split(':').map(Number);

  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}


async function saveNotificationToHistory(notification: any): Promise<void> {
  await db.collection('notificationHistory').add({
    ...notification,
    createdAt: Timestamp.now()
  });
}