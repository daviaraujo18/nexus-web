// components/auth/forms/AuthForm.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AuthError } from '@/types';
import InputField from '../ui/InputField';
import PasswordStrength from '../ui/PasswordStrength';
import { FaEnvelope, FaLock, FaUser } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import UserTypeSelector from './UserTypeSelector';
import ProfessionalFields from './ProfessionalFields';
import StudentFields from './StudentFields';

/* =========================
   SCHEMAS
========================= */

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres')
});

const registerSchema = z.object({
  type: z.enum(['student', 'professional']),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6),
  confirmPassword: z.string(),
  // Campos opcionais
  cpf: z.string().optional(),
  birthday: z.string().optional(),
  phone: z.string().optional(),
  school: z.string().optional(),
  grade: z.string().optional(),
  role: z.enum(['psychologist', 'psychiatrist', 'monitor', 'coordinator']),
  specialization: z.string().optional(),
  licenseNumber: z.string().optional(),
  institution: z.string().optional(),
})
  .refine(data => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword']
  })
  .refine(data => {
    // Validação condicional para registro profissional
    if (data.type === 'professional') {
      if (data.role === 'psychologist' || data.role === 'psychiatrist') {
        return data.licenseNumber && data.licenseNumber.trim().length > 0;
      }
    }
    return true;
  }, {
    message: 'Registro profissional é obrigatório para psicólogos e psiquiatras',
    path: ['licenseNumber']
  });

/* =========================
   TIPO ÚNICO DO FORM
========================= */

type AuthFormData = {
  type?: 'student' | 'professional';
  name?: string;
  email: string;
  password: string;
  confirmPassword?: string;
  cpf?: string;
  birthday?: string;
  phone?: string;
  school?: string;
  grade?: string;
  role?: 'psychologist' | 'psychiatrist' | 'monitor' | 'coordinator';
  specialization?: string;
  licenseNumber?: string;
  institution?: string;
};

/* =========================
   PROPS
========================= */

interface AuthFormProps {
  mode: 'login' | 'register';
  defaultUserType?: 'student' | 'professional';
  onSuccess?: (result: any) => void;
  onError?: (error: AuthError) => void;
}

/* =========================
   COMPONENTE
========================= */

export default function AuthForm({
  mode,
  defaultUserType = 'student',
  onSuccess,
  onError
}: AuthFormProps) {

  const { login, register: contextRegister } = useAuth();
  const [userType, setUserType] =
    useState<'student' | 'professional'>(defaultUserType);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const schema = mode === 'login' ? loginSchema : registerSchema;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<AuthFormData>({
    resolver: zodResolver(schema),
    defaultValues: mode === 'register'
      ? {
        type: userType,
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'psychologist' // Valor padrão
      }
      : {
        email: '',
        password: ''
      }
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const currentRole = watch('role');

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError('');

    try {
      let result;

      if (mode === 'login') {
        result = await login(data.email, data.password);
      } else {
        // Crie um objeto completo com todos os dados
        const registerData = {
          type: userType,
          name: data.name || '',
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword || '',
          // Inclua todos os campos condicionalmente
          ...(userType === 'student' && {
            cpf: data.cpf,
            birthday: data.birthday,
            phone: data.phone,
            school: data.school,
            grade: data.grade,
          }),
          ...(userType === 'professional' && {
            cpf: data.cpf,
            role: data.role as 'psychologist' | 'psychiatrist' | 'monitor' | 'coordinator',
            specialization: data.specialization,
            licenseNumber: data.licenseNumber,
            institution: data.institution,
          }),
        };

        result = await contextRegister(registerData);
      }

      onSuccess?.(result);
    } catch (err: any) {
      const authError =
        err instanceof AuthError
          ? err
          : new AuthError(err.message, 'UNKNOWN_ERROR');

      setError(authError.message);
      onError?.(authError);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar tipo de usuário no formulário
  const handleUserTypeChange = (type: 'student' | 'professional') => {
    setUserType(type);
    setValue('type', type);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {mode === 'register' && (
        <UserTypeSelector value={userType} onChange={handleUserTypeChange} />
      )}

      {mode === 'register' && (
        <InputField
          label="Nome completo"
          icon={<FaUser />}
          error={errors.name?.message}
          {...register('name')}
          disabled={loading}
        />
      )}

      <InputField
        label="Email"
        icon={<FaEnvelope />}
        error={errors.email?.message}
        {...register('email')}
        disabled={loading}
      />

      <InputField
        label="Senha"
        type="password"
        icon={<FaLock />}
        error={errors.password?.message}
        {...register('password')}
        disabled={loading}
      />

      {mode === 'register' && password && (
        <PasswordStrength
          password={password}
          confirmPassword={confirmPassword}
        />
      )}

      {mode === 'register' && (
        <InputField
          label="Confirmar senha"
          type="password"
          icon={<FaLock />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
          disabled={loading}
        />
      )}

      {mode === 'register' && userType === 'student' && (
        <StudentFields
          register={register}
          errors={errors}
          loading={loading}
          setValue={setValue}
        />
      )}

      {mode === 'register' && userType === 'professional' && (
        <ProfessionalFields
          register={register}
          errors={errors}
          loading={loading}
          watch={watch}
          setValue={setValue}
        />
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </button>

    </form>
  );
}