// components/auth/forms/StudentFields.tsx - VERSÃO CORRIGIDA
'use client';

import React, { useState } from 'react';
import InputField from '../ui/InputField';
import { FaIdCard, FaBirthdayCake, FaPhone, FaSchool, FaGraduationCap } from 'react-icons/fa';
import { formatters } from '@/lib/utils/formatters';
import { cpfValidator } from '@/lib/validation';
import { GRADE_OPTIONS, SCHOOL_OPTIONS } from '@/lib/utils/constants';

interface StudentFieldsProps {
  register: any;
  errors: any;
  loading: boolean;
  setValue?: any;
  onCPFChange?: (cleanCPF: string, isValid: boolean) => void;
}

export default function StudentFields({
  register,
  errors,
  loading,
  setValue,
  onCPFChange
}: StudentFieldsProps) {
  const [cpfValid, setCpfValid] = useState(false);

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanCPF = e.target.value.replace(/\D/g, '');
    const formatted = formatters.cpf(cleanCPF);

    // Validar CPF
    const validation = cpfValidator.validate(cleanCPF);
    setCpfValid(validation.valid);

    // Garantir que o form armazene apenas dígitos (sem máscara)
    if (setValue) {
      setValue('cpf', cleanCPF);
    }

    // Notificar componente pai (para criptografia)
    onCPFChange?.(cleanCPF, validation.valid);

    // Mostrar versão formatada no input para o usuário
    e.target.value = formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatters.phone(e.target.value);
    e.target.value = formatted;
  };

  return (
    <>
      <InputField
        label="CPF"
        type="text"
        icon={<FaIdCard className="w-3.5 h-3.5" />}
        placeholder="000.000.000-00"
        maxLength={14}
        error={errors.cpf?.message || (!cpfValid && "CPF inválido")}
        {...register('cpf', {
          onChange: handleCPFChange
        })}
        disabled={loading}
      />

      <InputField
        label="Data de nascimento"
        type="date"
        icon={<FaBirthdayCake className="w-3.5 h-3.5" />}
        error={errors.birthday?.message}
        {...register('birthday')}
        disabled={loading}
      />

      <InputField
        label="Escola"
        type="select"
        icon={<FaSchool className="w-3.5 h-3.5" />}
        error={errors.school?.message}
        options={SCHOOL_OPTIONS}
        {...register('school', { required: 'Selecione a escola' })}
        disabled={loading}
      />

      <InputField
        label="Série/Ano"
        type="select"
        icon={<FaGraduationCap className="w-3.5 h-3.5" />}
        error={errors.grade?.message}
        options={GRADE_OPTIONS}
        {...register('grade', { required: 'Selecione a série/ano' })}
        disabled={loading}
      />

      {/* Consentimento LGPD */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="lgpd-consent"
              type="checkbox"
              required
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="lgpd-consent" className="font-medium text-gray-700">
              Consentimento LGPD *
            </label>
            <p className="text-gray-600">
              Concordo com o tratamento dos meus dados pessoais conforme a
              <a href="/privacy-policy" className="text-indigo-600 hover:text-indigo-500 ml-1 underline">
                Política de Privacidade
              </a>
              <span> e</span>
              <a href="/terms" className="text-indigo-600 hover:text-indigo-500 ml-1 underline">
                Termos de Uso
              </a>
              <span> da Nexus Platform. Meu CPF será criptografado e utilizado apenas para fins de identificação única.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}