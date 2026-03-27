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
import { AuthContextType, User, LoginResult, RegisterResult } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth/AuthService';
import { UserService } from '@/lib/auth/UserService';
import { NotificationService } from '@/lib/services/NotificationService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const buildFallbackUser = (
    userId: string,
    userType: 'student' | 'professional',
    email?: string | null
  ): User =>
    ({
      id: userId,
      userId,
      email: email ?? '',
      name: 'Usuário',
      role: userType,
      type: userType,
      active: true,
      profile:
        userType === 'student'
          ? {
              totalPoints: 0,
              streak: 0,
              level: 1,
            }
          : undefined,
    } as unknown as User);

  const fetchUserData = async (
    userId: string,
    userType?: 'student' | 'professional',
    email?: string | null
  ): Promise<User | null> => {
    try {
      const resolvedType = userType ?? (await UserService.getUserType(userId, email ?? undefined));
      const data = (await UserService.getUser(userId, resolvedType)) as User;

      return {
        ...data,
        id: (data as any).id ?? userId,
        userId: (data as any).userId ?? userId,
        role: (data as any).role ?? resolvedType,
        type: (data as any).type ?? resolvedType,
        profile:
          resolvedType === 'student'
            ? {
                totalPoints: (data as any)?.profile?.totalPoints ?? 0,
                streak: (data as any)?.profile?.streak ?? 0,
                level: (data as any)?.profile?.level ?? 1,
              }
            : (data as any)?.profile,
      } as User;
    } catch (error) {
      console.warn('⚠️ Falha ao buscar perfil completo, usando fallback:', error);
      if (userType) {
        return buildFallbackUser(userId, userType, email);
      }
      return null;
    }
  };

  const registerFCMToken = async (userId: string) => {
    try {
      console.log('🔄 Registrando token FCM para notificações...');
      const token = await NotificationService.requestFCMToken(userId);

      if (token) {
        console.log('✅ Token FCM registrado com sucesso');
      } else {
        console.log('⚠️ Token FCM não obtido');
      }
    } catch (error) {
      console.warn('⚠️ Erro ao registrar token FCM:', error);
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

      await registerFCMToken(result.userId);

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
          setUser(null);
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