export type NotificationKind =
    | 'activity_reminder'
    | 'therapeutic_reminder'
    | 'educational_reminder'
    | 'achievement'
    | 'schedule_update'
    | 'message';

export class NotificationPreferenceService {
    static async canSend(params: {
        userId: string;
        type: NotificationKind;
    }) {
        // aqui entra sua leitura de preferências persistidas
        // e regras de horário/dia/canal
        return true;
    }
}