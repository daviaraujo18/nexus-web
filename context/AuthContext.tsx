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
  const isRegisteringRef = React.useRef(false);


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
      const isProfileMissing = error instanceof Error && error.message === 'User profile not found or inactive';

      if (isProfileMissing) {
        // aguardando criação do profile (retry automático)
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
          const retryData = await getFullData();
          setProfileReady(true);
          return retryData;
        } catch (retryError: unknown) {
          const stillMissing = retryError instanceof Error && retryError.message === 'User profile not found or inactive';
          if (stillMissing) {
            // Sessão Firebase ativa mas perfil definitivamente não existe — encerrar
            console.warn('⚠️ Perfil não encontrado após retry — encerrando sessão.');
            await AuthService.logout().catch(() => {});
          } else {
            // Erro de rede/Firestore no retry — não deslogar, apenas sinalizar pronto
            console.error('❌ Erro ao buscar perfil (retry):', retryError);
          }
          setProfileReady(true);
          return null;
        }
      }

      // Erro de rede, Firestore indisponível etc. — não destruir sessão válida
      console.error('❌ Erro ao buscar perfil (não crítico, sessão mantida):', error);
      setProfileReady(true);
      return null;
    }
  };

  // Login unificado — navegação gerenciada exclusivamente pelo redirect effect
  // loading NÃO é resetado aqui: onAuthStateChanged é o único responsável por setar loading=false
  // após fetchUserData completar, evitando race onde redirect effect vê user=null e redireciona
  const login = async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const result = await AuthService.login(email, password);

      if (result.success) {
        const uid = auth.currentUser?.uid;
        if (uid) {
          NotificationService.requestFCMToken(uid)
            .then(token => {
              if (token) return NotificationService.setupForegroundMessageListener(() => {});
            })
            .catch((err) => {
              console.warn('⚠️ Erro ao registrar token FCM:', err);
            });
        }
      }

      return result;
    } catch (error: unknown) {
      console.error('Login error in context:', error);
      setLoading(false);
      throw error;
    }
  };

  // Registro unificado — navegação é responsabilidade exclusiva do componente chamador
  // loading é resetado no finally pois registro não autentica o usuário
  const register = async (data: any): Promise<RegisterResult> => {
    setLoading(true);
    isRegisteringRef.current = true;
    try {
      const result = await AuthService.register(data);
      return result;
    } catch (error: unknown) {
      console.error('Registration error in context:', error);
      throw error;
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  // Logout — navegação gerenciada pelo redirect effect via onAuthStateChanged → setUser(null)
  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
    } catch (error: unknown) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  };

  // Safety: se loading ficar true por mais de 8s, força limpeza com estado consistente
  // (proteção contra cenário onde onAuthStateChanged não dispara após login)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.warn('⚠️ [AuthContext] Timeout de loading atingido — forçando estado deslogado');
      setUser(null);
      setLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Listener de estado de autenticação SIMPLIFICADO
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Se o registro ainda está em andamento, ignorar este disparo:
        // o onAuthStateChanged é acionado imediatamente após createUserWithEmailAndPassword,
        // antes de o setDoc terminar. Após o register() completar, o listener será
        // acionado novamente (ou fetchUserData será chamado manualmente se necessário).
        if (isRegisteringRef.current) {
          return;
        }
        try {
          const userData = await fetchUserData(firebaseUser.uid);
          setUser(userData);
        } catch (error) {
          console.error('Error fetching user on auth state change:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        setProfileReady(true); // garante que o redirect effect rode após logout/sessão expirada
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