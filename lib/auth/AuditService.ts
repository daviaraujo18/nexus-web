// lib/auth/AuditService.ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export type AuditEventType =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTRATION'
  | 'REGISTRATION_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PROFILE_UPDATE'
  | 'SENSITIVE_DATA_ACCESS'
  | 'PERMISSION_CHANGE';

export class AuditService {
  private static readonly COLLECTION = 'auditLogs';

  // Eventos autenticados: escreve diretamente no Firestore via SDK cliente.
  // A regra auditLogs exige isProfessional — usada apenas para usuários já logados.
  static async logEvent(
    userId: string,
    eventType: AuditEventType,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await addDoc(collection(firestore, this.COLLECTION), {
        userId,
        eventType,
        metadata,
        timestamp: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Não falhar a operação principal por causa do log
    }
  }

  static async logLogin(
    userId: string,
    userType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent(userId, 'LOGIN', {
      userType,
      ...metadata
    });
  }

  static async logFailedLogin(
    email: string,
    errorCode?: string
  ): Promise<void> {
    try {
      await addDoc(collection(firestore, this.COLLECTION), {
        eventType: 'LOGIN_FAILED',
        email,
        errorCode,
        timestamp: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      });
    } catch (error) {
      console.error('Failed to log failed login event:', error);
    }
  }

  static async logLogout(userId: string): Promise<void> {
    await this.logEvent(userId, 'LOGOUT');
  }

  static async logRegistration(
    userId: string,
    userType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent(userId, 'REGISTRATION', {
      userType,
      ...metadata
    });
  }

  // BLOCKER 2 corrigido: eventos pré-autenticação são enviados via API Route
  // que usa o Admin SDK, ignorando as regras do Firestore.
  // Isso garante que REGISTRATION_FAILED seja sempre gravado, mesmo quando
  // o usuário não está autenticado (ex.: auth/email-already-in-use).
  static async logFailedRegistration(
    email: string,
    userType: string,
    errorCode?: string
  ): Promise<void> {
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'REGISTRATION_FAILED',
          email,
          userType,
          errorCode,
        }),
      });
    } catch (error) {
      // Log de auditoria nunca deve mascarar o erro original
      console.error('Failed to log failed registration event:', error);
    }
  }

  static async logSensitiveDataAccess(
    userId: string,
    accessedUserId: string,
    dataType: string,
    reason: string
  ): Promise<void> {
    await this.logEvent(userId, 'SENSITIVE_DATA_ACCESS', {
      accessedUserId,
      dataType,
      reason
    });
  }
}
