'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { AuthContextType, User, LoginResult, RegisterResult, Student, Professional } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth/AuthService';
import { UserService } from '@/lib/auth/UserService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ResolvedUserType = 'student' | 'professional';

const buildFallbackUser = (
  userId: string,
  userType: ResolvedUserType,
  email?: string | null
): User => {
  const now = new Date();

  if (userType === 'student') {
    const fallbackStudent: Student = {
      id: userId,
      email: email ?? '',
      name: 'Usuário',
      role: 'student',
      createdAt: now,
      updatedAt: now,
      isActive: true,
      profileComplete: false,
      profile: {
        cpf: '',
        birthday: now,
        school: '',
        grade: '',
        assignedProfessionals: [],
        assignedPrograms: [],
        streak: 0,
        totalPoints: 0,
        level: 1,
        achievements: [],
      },
    };

    return fallbackStudent;
  }

  const fallbackProfessional: Professional = {
    id: userId,
    email: email ?? '',
    name: 'Usuário',
    role: 'psychologist',
    createdAt: now,
    updatedAt: now,
    isActive: true,
    profileComplete: false,
    profile: {
      cpf: '',
      assignedStudents: [],
      canCreatePrograms: false,
      canManageStudents: false,
      canApproveRegistrations: false,
      verified: false,
    },
  };

  return fallbackProfessional;
};

const normalizeUserData = (
  rawData: any,
  userId: string,
  resolvedType: ResolvedUserType,
  email?: string | null
): User => {
  const now = new Date();

  if (resolvedType === 'student') {
    const normalizedStudent: Student = {
      ...rawData,
      id: userId,
      email: rawData?.email ?? email ?? '',
      name: rawData?.name ?? 'Usuário',
      role: 'student',
      createdAt: rawData?.createdAt instanceof Date ? rawData.createdAt : now,
      updatedAt: rawData?.updatedAt instanceof Date ? rawData.updatedAt : now,
      isActive: typeof rawData?.isActive === 'boolean' ? rawData.isActive : true,
      lastLoginAt: rawData?.lastLoginAt,
      profileComplete:
        typeof rawData?.profileComplete === 'boolean' ? rawData.profileComplete : false,
      consentVersion: rawData?.consentVersion,
      consentDate: rawData?.consentDate,
      profile: {
        cpf: rawData?.profile?.cpf ?? '',
        birthday: rawData?.profile?.birthday instanceof Date ? rawData.profile.birthday : now,
        phone: rawData?.profile?.phone,
        school: rawData?.profile?.school ?? '',
        grade: rawData?.profile?.grade ?? '',
        parentName: rawData?.profile?.parentName,
        parentEmail: rawData?.profile?.parentEmail,
        parentPhone: rawData?.profile?.parentPhone,
        medicalInfo: rawData?.profile?.medicalInfo,
        address: rawData?.profile?.address,
        assignedProfessionals: Array.isArray(rawData?.profile?.assignedProfessionals)
          ? rawData.profile.assignedProfessionals
          : [],
        assignedPrograms: Array.isArray(rawData?.profile?.assignedPrograms)
          ? rawData.profile.assignedPrograms
          : [],
        streak: rawData?.profile?.streak ?? 0,
        totalPoints: rawData?.profile?.totalPoints ?? 0,
        level: rawData?.profile?.level ?? 1,
        achievements: Array.isArray(rawData?.profile?.achievements)
          ? rawData.profile.achievements
          : [],
      },
    };

    return normalizedStudent;
  }

  const professionalRole: Professional['role'] =
    rawData?.role === 'psychologist' ||
    rawData?.role === 'psychiatrist' ||
    rawData?.role === 'monitor' ||
    rawData?.role === 'coordinator'
      ? rawData.role
      : 'psychologist';

  const normalizedProfessional: Professional = {
    ...rawData,
    id: userId,
    email: rawData?.email ?? email ?? '',
    name: rawData?.name ?? 'Usuário',
    role: professionalRole,
    createdAt: rawData?.createdAt instanceof Date ? rawData.createdAt : now,
    updatedAt: rawData?.updatedAt instanceof Date ? rawData.updatedAt : now,
    isActive: typeof rawData?.isActive === 'boolean' ? rawData.isActive : true,
    lastLoginAt: rawData?.lastLoginAt,
    profileComplete:
      typeof rawData?.profileComplete === 'boolean' ? rawData.profileComplete : false,
    consentVersion: rawData?.consentVersion,
    consentDate: rawData?.consentDate,
    profile: {
      cpf: rawData?.profile?.cpf ?? '',
      licenseNumber: rawData?.profile?.licenseNumber,
      specialization: rawData?.profile?.specialization,
      institution: rawData?.profile?.institution,
      department: rawData?.profile?.department,
      assignedStudents: Array.isArray(rawData?.profile?.assignedStudents)
        ? rawData.profile.assignedStudents
        : [],
      canCreatePrograms: !!rawData?.profile?.canCreatePrograms,
      canManageStudents: !!rawData?.profile?.canManageStudents,
      canApproveRegistrations: !!rawData?.profile?.canApproveRegistrations,
      verified: !!rawData?.profile?.verified,
      verificationDate: rawData?.profile?.verificationDate,
    },
  };

  return normalizedProfessional;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const fetchUserData = async (
    userId: string,
    userType?: ResolvedUserType,
    email?: string | null
  ): Promise<User | null> => {
    try {
      const resolvedType =
        userType ?? (await UserService.getUserType(userId, email ?? undefined));

      const data = await UserService.getUser(userId, resolvedType);

      return normalizeUserData(data, userId, resolvedType, email);
    } catch (error) {
      console.warn('⚠️ Falha ao buscar perfil completo, usando fallback:', error);
      if (userType) {
        return buildFallbackUser(userId, userType, email);
      }
      return null;
    }
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);

    try {
      const result = await AuthService.login(email, password);

      const userData =
        (await fetchUserData(result.userId, result.userType, email)) ??
        buildFallbackUser(result.userId, result.userType, email);

      setUser(userData);

      const targetPath =
        result.userType === 'student'
          ? '/student/dashboard'
          : '/professional/dashboard';

      router.replace(targetPath);

      return result;
    } catch (error: any) {
      console.error('Login error in context:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any): Promise<RegisterResult> => {
    setLoading(true);

    try {
      const result = await AuthService.register(data);

      if (result.success && result.userId) {
        router.replace('/login');
      }

      return result;
    } catch (error: any) {
      console.error('Registration error in context:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
      setUser(null);
      router.replace('/login');
    } catch (error: any) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {

          setLoading(false);
          return;
        }

        const resolvedType = await UserService.getUserType(
          firebaseUser.uid,
          firebaseUser.email ?? undefined
        );

        const userData =
          (await fetchUserData(firebaseUser.uid, resolvedType, firebaseUser.email)) ??
          buildFallbackUser(firebaseUser.uid, resolvedType, firebaseUser.email);

        setUser(userData);
        await NotificationService.registerUser(firebaseUser.uid);
      } catch (error) {
        console.warn('⚠️ Erro ao hidratar usuário autenticado:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const publicPaths = ['/login', '/register', '/', '/forgot-password'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.replace('/login');
      return;
    }

    if (user && isPublicPath) {
      const targetPath =
        user.role === 'student'
          ? '/student/dashboard'
          : '/professional/dashboard';

      router.replace(targetPath);
      return;
    }

    if (user) {
      if (user.role === 'student' && pathname.startsWith('/professional')) {
        router.replace('/student/dashboard');
      } else if (user.role !== 'student' && pathname.startsWith('/student')) {
        router.replace('/professional/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};