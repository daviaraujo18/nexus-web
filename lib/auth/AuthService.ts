import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  type UserCredential,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from 'firebase/firestore';
import { auth, firestore } from '@/firebase/config';
import { UserService } from './UserService';

type RegisterInput = {
  type: 'student' | 'professional';
  name: string;
  email: string;
  password: string;
  cpf?: string;
  birthday?: string;
  school?: string;
  grade?: string;
  role?: string;
};

type LoginResult = {
  success: boolean;
  userId: string;
  userType: 'student' | 'professional';
};

type RegisterResult = {
  success: boolean;
  userId: string;
  requiresVerification: boolean;
};

export class AuthService {
  static async login(email: string, password: string): Promise<LoginResult> {
    try {
      console.log('🔐 Login attempt:', email);

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userId = credential.user.uid;
      const normalizedEmail = credential.user.email?.toLowerCase() ?? email.toLowerCase();

      const userType = await UserService.getUserType(userId, normalizedEmail);

      return {
        success: true,
        userId,
        userType,
      };
    } catch (error: any) {
      console.error('❌ Login error:', error);

      await this.safeAuditLog({
        action: 'login_failed',
        email,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? 'Erro no login',
        createdAt: serverTimestamp(),
      });

      throw error;
    }
  }

  static async register(data: RegisterInput): Promise<RegisterResult> {
    let credential: UserCredential | null = null;

    try {
      console.log('📝 Register attempt:', data.email, data.type);

      await this.checkUniqueness(data);

      credential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const uid = credential.user.uid;
      const now = serverTimestamp();
      const normalizedEmail = data.email.trim().toLowerCase();
      const normalizedCpf = data.cpf ? data.cpf.replace(/\D/g, '') : null;

      await setDoc(doc(firestore, 'users', uid), {
        id: uid,
        userId: uid,
        email: normalizedEmail,
        name: data.name,
        type: data.type,
        role: data.type === 'student' ? 'student' : (data.role ?? 'professional'),
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      if (data.type === 'student') {
        await setDoc(doc(firestore, 'students', uid), {
          id: uid,
          userId: uid,
          name: data.name,
          email: normalizedEmail,
          cpf: normalizedCpf,
          birthday: data.birthday ?? null,
          school: data.school ?? null,
          grade: data.grade ?? null,
          role: 'student',
          active: true,
          profile: {
            totalPoints: 0,
            streak: 0,
            level: 1,
          },
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await setDoc(doc(firestore, 'professionals', uid), {
          id: uid,
          userId: uid,
          name: data.name,
          email: normalizedEmail,
          cpf: normalizedCpf,
          birthday: data.birthday ?? null,
          role: data.role ?? 'professional',
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      await this.safeAuditLog({
        action: 'register_success',
        userId: uid,
        email: normalizedEmail,
        type: data.type,
        createdAt: now,
      });

      console.log('✅ Registration successful:', uid);

      return {
        success: true,
        userId: uid,
        requiresVerification: false,
      };
    } catch (error: any) {
      console.error('❌ Registration error:', error);

      if (credential?.user) {
        try {
          await deleteUser(credential.user);
          console.log('↩️ Rolled back auth user after profile creation failure');
        } catch (rollbackError) {
          console.warn('⚠️ Failed to rollback auth user:', rollbackError);
        }
      }

      await this.safeAuditLog({
        action: 'register_failed',
        email: data.email,
        type: data.type,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? 'Erro no cadastro',
        createdAt: serverTimestamp(),
      });

      throw error;
    }
  }

  static async logout(): Promise<void> {
    await signOut(auth);
  }

  static async checkUniqueness(data: RegisterInput): Promise<void> {
    const emailExists = await UserService.checkEmailExists(data.email);

    if (emailExists) {
      throw new Error('E-mail já cadastrado');
    }

    if (data.cpf) {
      const cpfExists = await UserService.checkCpfExists(data.cpf);

      if (cpfExists) {
        throw new Error('CPF já cadastrado');
      }
    }
  }

  private static async safeAuditLog(payload: Record<string, any>): Promise<void> {
    try {
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      await addDoc(collection(firestore, 'auditLogs'), cleanPayload);
    } catch (logError) {
      console.warn('⚠️ Falha ao gravar audit log:', logError);
    }
  }
}