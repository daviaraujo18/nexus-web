import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, query, collection, where, limit, getDoc } from 'firebase/firestore';
import { auth, firestore } from '@/firebase/config';
import {
  RegisterData,
  LoginResult,
  RegisterResult,
  AuthError,
  Student,
  Professional
} from '@/types';
import { ValidationService } from '@/lib/validation';
import { AuditService } from './AuditService';
import { UserService } from './UserService';
import { encryptData, decryptData } from '@/lib/utils/encryption';

export class AuthService {
  // SINGLE SOURCE OF TRUTH para login
  static async login(email: string, password: string): Promise<LoginResult> {
    try {
      console.log('🔐 Login attempt:', email);

      // 1. Validação básica
      const emailValidation = ValidationService.validateEmail(email);
      if (!emailValidation.valid) {
        throw new AuthError(emailValidation.error!, 'INVALID_EMAIL');
      }

      // 2. Rate limiting check (agora usando Firestore)
      const canAttempt = await this.checkRateLimit(email);
      if (!canAttempt) {
        throw new AuthError(
          'Muitas tentativas. Aguarde 15 minutos.',
          'TOO_MANY_ATTEMPTS'
        );
      }

      // 3. Firebase Auth login
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const userId = userCredential.user.uid;

      // 4. Buscar tipo de usuário
      const userType = await UserService.getUserType(userId);

      // 5. Atualizar último login
      await UserService.updateLastLogin(userId);

      // 6. Log de auditoria
      await AuditService.logLogin(userId, userType, {
        provider: 'email',
        userAgent: navigator.userAgent
      });

      // 7. Verificar se precisa de 2FA (para profissionais)
      const requiresMFA = userType === 'professional' &&
        process.env.NEXT_PUBLIC_REQUIRE_2FA === 'true';

      console.log('✅ Login successful:', { userId, userType, requiresMFA });

      return {
        success: true,
        userId,
        userType,
        requiresMFA
      };

    } catch (error: any) {
      console.error('❌ Login error:', error);

      // Log de tentativa falha
      await AuditService.logFailedLogin(email, error.code);

      // Mapear erros do Firebase para mensagens amigáveis
      const mappedError = this.mapFirebaseAuthError(error);
      throw mappedError;
    }
  }

  // SINGLE SOURCE OF TRUTH para registro
  static async register(data: RegisterData): Promise<RegisterResult> {
    try {
      console.log('📝 Register attempt:', data.email, data.type);

      // 1. Validação completa dos dados
      const validation = await ValidationService.validateRegister(data);
      if (!validation.valid) {
        throw new AuthError(validation.error!, 'VALIDATION_ERROR', validation.metadata);
      }

      // 2. Verificar unicidade
      await this.checkUniqueness(data);

      // 3. Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const userId = userCredential.user.uid;

      // 4. Atualizar nome no perfil do Auth
      await updateAuthProfile(userCredential.user, {
        displayName: data.name
      });

      // 5. Criar perfil específico no Firestore
      if (data.type === 'student') {
        await this.createStudentProfile(userId, data);
      } else {
        await this.createProfessionalProfile(userId, data);
      }

      // 6. Log de auditoria
      await AuditService.logRegistration(userId, data.type, {
        name: data.name,
        hasConsent: true
      });

      // 7. Enviar email de verificação (opcional)
      if (process.env.NEXT_PUBLIC_SEND_VERIFICATION_EMAIL === 'true') {
        await this.sendVerificationEmail(userCredential.user);
      }

      console.log('✅ Registration successful:', userId);

      const requiresVerification = data.type === 'professional' &&
        process.env.NEXT_PUBLIC_REQUIRE_PROFESSIONAL_VERIFICATION === 'true';

      return {
        success: true,
        userId,
        requiresVerification
      };

    } catch (error: any) {
      console.error('❌ Registration error:', error);

      // Log de registro falho
      await AuditService.logFailedRegistration(data.email, data.type, error.code);

      const mappedError = this.mapFirebaseAuthError(error);
      throw mappedError;
    }
  }

  // Logout
  static async logout(): Promise<void> {
    const userId = auth.currentUser?.uid;
    try {
      await signOut(auth);
      if (userId) {
        await AuditService.logLogout(userId);
      }
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new AuthError('Erro ao fazer logout', 'LOGOUT_ERROR');
    }
  }

  // Métodos privados
  private static async createStudentProfile(userId: string, data: RegisterData) {
    if (!data.cpf || !data.birthday || !data.school || !data.grade) {
      throw new AuthError('Dados do aluno incompletos', 'INCOMPLETE_DATA');
    }

    // Criptografar dados sensíveis
    const encryptedCPF = encryptData(data.cpf);
    const encryptedBirthday = encryptData(data.birthday);

    const studentData: Omit<Student, 'id'> = {
      email: data.email,
      name: data.name,
      role: 'student',
      profileComplete: false,
      isActive: true,
      consentVersion: '1.0', // ← NOVO: Versão do consentimento
      consentDate: new Date(), // ← NOVO: Data do consentimento
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        cpf: encryptedCPF,
        birthday: new Date(data.birthday),
        phone: data.phone || '',
        school: data.school,
        grade: data.grade,
        assignedProfessionals: [],
        assignedPrograms: [],
        streak: 0,
        totalPoints: 0,
        level: 1,
        achievements: []
      }
    };

    await setDoc(doc(firestore, 'students', userId), {
      ...studentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      consentDate: serverTimestamp()
    });
  }

  private static async createProfessionalProfile(userId: string, data: RegisterData) {
    if (!data.cpf) { // ← NOVA VALIDAÇÃO: CPF obrigatório
      throw new AuthError('CPF é obrigatório para profissionais', 'CPF_REQUIRED');
    }

    // Criptografar dados sensíveis
    const encryptedCPF = encryptData(data.cpf);

    const professionalData: Omit<Professional, 'id'> = {
      email: data.email,
      name: data.name,
      role: data.role || 'coordinator',
      profileComplete: false, // ← Perfil incompleto (campos opcionais faltando)
      isActive: true,
      consentVersion: '1.0', // ← NOVO: Versão do consentimento
      consentDate: new Date(), // ← NOVO: Data do consentimento
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        cpf: encryptedCPF, // ← NOVO CAMPO OBRIGATÓRIO
        licenseNumber: '', // ← VAZIO (será preenchido no perfil)
        specialization: '', // ← VAZIO (será preenchido no perfil)
        institution: '', // ← VAZIO (será preenchido no perfil)
        department: '',
        assignedStudents: [],
        canCreatePrograms: data.role === 'coordinator' || data.role === 'monitor',
        canManageStudents: true,
        canApproveRegistrations: data.role === 'coordinator',
        verified: false
      }
    };

    await setDoc(doc(firestore, 'professionals', userId), {
      ...professionalData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      consentDate: serverTimestamp() // ← NOVO
    });
  }

  private static async checkUniqueness(data: RegisterData): Promise<void> {
    // Verificar email único
    const emailExists = await UserService.checkEmailExists(data.email);
    if (emailExists) {
      throw new AuthError('Este email já está em uso', 'EMAIL_EXISTS');
    }

    // Verificar CPF único (para estudantes E profissionais)
    if (data.cpf) {
      const cpfExists = await this.checkCPFExists(data.cpf);
      if (cpfExists) {
        throw new AuthError('Este CPF já está cadastrado', 'CPF_EXISTS');
      }
    }

    // Removida verificação de licenseNumber (agora opcional)
  }

  private static async checkCPFExists(cpf: string): Promise<boolean> {
    try {
      const encryptedCPF = encryptData(cpf);

      // Verificar em students
      const studentsQuery = query(
        collection(firestore, 'students'),
        where('profile.cpf', '==', encryptedCPF),
        limit(1)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      if (!studentsSnapshot.empty) return true;

      // Verificar em professionals
      const professionalsQuery = query(
        collection(firestore, 'professionals'),
        where('profile.cpf', '==', encryptedCPF),
        limit(1)
      );
      const professionalsSnapshot = await getDocs(professionalsQuery);
      return !professionalsSnapshot.empty;
    } catch (error) {
      console.error('Error checking CPF existence:', error);
      return false;
    }
  }

  private static async checkRateLimit(email: string): Promise<boolean> {
    try {
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutos
      const maxAttempts = 5;

      // Buscar tentativas recentes do Firestore
      const rateLimitRef = collection(firestore, 'rate_limits');
      const q = query(
        rateLimitRef,
        where('email', '==', email),
        where('timestamp', '>', new Date(now - windowMs))
      );

      const snapshot = await getDocs(q);
      const recentAttempts = snapshot.docs.length;

      if (recentAttempts >= maxAttempts) {
        return false;
      }

      // Registrar nova tentativa
      await setDoc(doc(rateLimitRef), {
        email,
        timestamp: new Date(now),
        type: 'login_attempt'
      });

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Em caso de erro, permitir tentativa
    }
  }

  private static mapFirebaseAuthError(error: any): AuthError {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return new AuthError('Este email já está em uso', 'EMAIL_EXISTS');
      case 'auth/invalid-email':
        return new AuthError('Email inválido', 'INVALID_EMAIL');
      case 'auth/weak-password':
        return new AuthError('Senha muito fraca. Use pelo menos 8 caracteres com letras e números', 'WEAK_PASSWORD');
      case 'auth/user-not-found':
        return new AuthError('Usuário não encontrado', 'USER_NOT_FOUND');
      case 'auth/wrong-password':
        return new AuthError('Senha incorreta', 'WRONG_PASSWORD');
      case 'auth/too-many-requests':
        return new AuthError('Muitas tentativas. Tente novamente mais tarde.', 'TOO_MANY_REQUESTS');
      case 'auth/network-request-failed':
        return new AuthError('Erro de conexão. Verifique sua internet.', 'NETWORK_ERROR');
      default:
        return new AuthError(
          error.message || 'Erro na autenticação',
          error.code || 'UNKNOWN_ERROR'
        );
    }
  }

  private static async sendVerificationEmail(user: FirebaseUser): Promise<void> {
    // Implementar envio de email via SendGrid/Resend
    // Por enquanto, apenas log
    console.log('Verification email would be sent to:', user.email);
  }
}