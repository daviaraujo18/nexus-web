// context/AuthContext.tsx - REFATORADO E CORRIGIDO
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { AuthContextType, User, LoginResult, RegisterResult, AuthError } from '@/types';
import { usePathname, useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth/AuthService';
import { UserService } from '@/lib/auth/UserService';
import { NotificationService } from '@/lib/services/NotificationService';
import { getToken } from 'firebase/messaging';
import { messaging } from '@/firebase/config';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const [profileReady, setProfileReady] = useState(false);


  // Função para buscar usuário completo
  const fetchUserData = async (userId: string): Promise<User | null> => {
    const getFullData = async () => {
      const userType = await UserService.getUserType(userId);
      return await UserService.getUser(userId, userType) as User;
    };

    try {
      const data = await getFullData();
      setProfileReady(true);
      return data;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'User profile not found or inactive') {
        console.log('⏳ Profile ainda não criado, aguardando...');
        setProfileReady(true);

        await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const retryData = await getFullData();
          setProfileReady(true);
          return retryData;
        } catch {
          setProfileReady(true);
          return null;
        }
      }

      setProfileReady(true);
      return null;
    }
  };

  // Login unificado com redirecionamento
  const login = async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const result = await AuthService.login(email, password);

      // Buscar dados completos do usuário
      const userData = await fetchUserData(result.userId);
      if (userData) {
        setUser(userData);

        // Redirecionar baseado no tipo
        if (result.userType === 'professional') {
          router.push('/professional/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      }

      if (result.success) {
        // REGISTRAR TOKEN FCM APÓS LOGIN BEM-SUCEDIDO
        try {
          // Aguardar um pouco para garantir que o usuário está carregado
          setTimeout(async () => {
            if (userData && userData.id) {
              console.log('🔄 Registrando token FCM para notificações...');

              // Solicitar permissão e token FCM
              const token = await NotificationService.requestFCMToken(userData.id);

              if (token) {
                console.log('✅ Token FCM registrado com sucesso');

                // Configurar listener para mensagens em foreground
                NotificationService.setupForegroundMessageListener((payload) => {
                  console.log('Notificação recebida em foreground:', payload);
                  // Aqui você pode mostrar um toast ou atualizar UI
                });
              } else {
                console.log('⚠️ Token FCM não obtido (usuário pode ter negado)');
              }
            }
          }, 1000);
        } catch (fcmError) {
          console.warn('⚠️ Erro ao registrar token FCM:', fcmError);
          // Não falhar o login por causa do FCM
        }
      }

      return result;
    } catch (error: any) {
      console.error('Login error in context:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Registro unificado com redirecionamento
  const register = async (data: any): Promise<RegisterResult> => {
    setLoading(true);
    try {
      const result = await AuthService.register(data);

      // Se registro foi bem sucedido, fazer login automático
      if (result.success && result.userId) {
        // Em produção, aqui faríamos login automático ou redirecionaria para confirmação
        // Por enquanto, redirecionar para login
        router.push('/login');
      }

      return result;
    } catch (error: any) {
      console.error('Registration error in context:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout com redirecionamento
  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
      setUser(null);
      router.push('/login');
    } catch (error: any) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  };

  // Listener de estado de autenticação SIMPLIFICADO
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = await fetchUserData(firebaseUser.uid);
          setUser(userData);
        } catch (error) {
          console.error('Error fetching user on auth state change:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Redirecionamento baseado em autenticação - LÓGICA SIMPLIFICADA
  useEffect(() => {
    if (loading) return;
    if (!profileReady) return;

    const publicPaths = ['/login', '/register', '/', '/forgot-password'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.push('/login');
      return;
    }

    if (user && isPublicPath) {
      const targetPath =
        user.role === 'student'
          ? '/student/dashboard'
          : '/professional/dashboard';

      router.push(targetPath);
      return;
    }

    if (user) {
      if (user.role === 'student' && pathname.startsWith('/professional')) {
        router.push('/student/dashboard');
      } else if (user.role !== 'student' && pathname.startsWith('/student')) {
        router.push('/professional/dashboard');
      }
    }
  }, [user, loading, profileReady, pathname]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};