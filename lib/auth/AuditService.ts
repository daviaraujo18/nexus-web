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
        userAgent: navigator.userAgent,
        ipAddress: await this.getClientIP(), // Será implementado via API route
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
        userAgent: navigator.userAgent,
        ipAddress: await this.getClientIP()
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

  static async logFailedRegistration(
    email: string,
    userType: string,
    errorCode?: string
  ): Promise<void> {
    await addDoc(collection(firestore, this.COLLECTION), {
      eventType: 'REGISTRATION_FAILED',
      email,
      userType,
      errorCode,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      ipAddress: await this.getClientIP()
    });
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

  private static async getClientIP(): Promise<string> {
    try {
      // Em produção, isso seria feito via API route que pega o IP real
      // Por enquanto, retornar um placeholder
      return '127.0.0.1';
    } catch {
      return 'unknown';
    }
  }
}