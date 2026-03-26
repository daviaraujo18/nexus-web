// app/(auth)/register/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/ui/AuthCard';
import RegisterFormContainer from '@/components/auth/forms/RegisterFormContainer';
import { FaUserPlus } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'Cadastro - Nexus Platform',
  description: 'Crie sua conta na Nexus Platform',
};

interface RegisterPageProps {
  searchParams: Promise<{
    type?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  // Garantindo que o tipo seja válido
  const defaultUserType =
    (params.type === 'professional' ? 'professional' : 'student') as
      | 'student'
      | 'professional';

  const isStudent = defaultUserType === 'student';
  const accentColor = isStudent ? 'text-purple-600' : 'text-indigo-600';

  return (
    <AuthLayout
      title={isStudent ? 'Comece sua Jornada' : 'Junte-se à Nossa Rede'}
      subtitle={
        isStudent
          ? 'Cadastre-se para uma experiência gamificada de aprendizado'
          : 'Faça parte da plataforma que conecta terapia e educação'
      }
      type="register"
      userType={defaultUserType}
    >
      <AuthCard
        title={isStudent ? 'Cadastro do Aluno' : 'Cadastro Profissional'}
        subtitle={
          isStudent
            ? 'Preencha os dados para criar sua conta de aluno'
            : 'Complete suas informações profissionais'
        }
        icon={<FaUserPlus size={32} className={accentColor} />}
        footer={
          <div className="flex flex-col gap-2">
            <div className="text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link
                href="/login"
                className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
              >
                Faça login
              </Link>
            </div>
          </div>
        }
      >
        <RegisterFormContainer defaultUserType={defaultUserType} />
      </AuthCard>
    </AuthLayout>
  );
}