'use client';

import React, { useState, useEffect } from 'react';
import InputField from '../ui/InputField';
import { 
  FaUserTie, 
  FaIdCard, 
  FaBriefcaseMedical, 
  FaBuilding,
  FaUserMd,
  FaStethoscope,
  FaHeadset,
  FaGlobeAfrica,
  FaFingerprint
} from 'react-icons/fa';
import { formatters } from '@/lib/utils/formatters';
import { cpfValidator } from '@/lib/validation/cpfValidator';

interface ProfessionalFieldsProps {
  register: any;
  errors: any;
  loading: boolean;
  watch?: any;
  setValue?: any;
}

export default function ProfessionalFields({ 
  register, 
  errors, 
  loading, 
  watch, 
  setValue 
}: ProfessionalFieldsProps) {
  // Observar valores do formulário
  const watchedRole = watch?.('role') || 'psychologist';
  const watchedCPF = watch?.('cpf') || '';
  
  const [selectedRole, setSelectedRole] = useState<string>(watchedRole);
  const [formattedCPF, setFormattedCPF] = useState('');
  const [cpfValid, setCpfValid] = useState<boolean>(false);

  // Sincronização removida: setValue é chamado diretamente no handleRoleClick
  // para evitar dessincronização quando o usuário alterna entre os mesmos cards.

  // Formatar CPF enquanto digita
  useEffect(() => {
    if (watchedCPF) {
      const formatted = cpfValidator.format(watchedCPF);
      setFormattedCPF(formatted);
      const validation = cpfValidator.validate(watchedCPF.replace(/\D/g, ''));
      setCpfValid(validation.valid);
    } else {
      setFormattedCPF('');
      setCpfValid(false);
    }
  }, [watchedCPF]);

  const roles = [
    {
      value: 'psychologist',
      icon: FaUserMd,
      title: 'Psicólogo',
      description: 'Acompanhamento psicológico',
      requiresLicense: false, // ← Alterado: agora opcional no registro
      licenseLabel: 'CRP (Opcional)',
      licensePlaceholder: 'CRP-XX XXXXX ou XX/XXXXX'
    },
    {
      value: 'psychiatrist',
      icon: FaStethoscope,
      title: 'Psiquiatra',
      description: 'Acompanhamento psiquiátrico',
      requiresLicense: false, // ← Alterado: agora opcional no registro
      licenseLabel: 'CRM (Opcional)',
      licensePlaceholder: 'CRM-XX XXXXX'
    },
    {
      value: 'monitor',
      icon: FaHeadset,
      title: 'Monitor',
      description: 'Acompanhamento educacional',
      requiresLicense: false,
      licenseLabel: 'Registro Opcional',
      licensePlaceholder: 'Registro profissional (se houver)'
    },
    // {
    // value: 'coordinator',
    // icon: FaGlobeAfrica,
    // title: 'Coordenador',
    // description: 'Gestão e coordenação',
    // requiresLicense: false,
    // licenseLabel: 'Registro Opcional',
    // licensePlaceholder: 'Registro profissional (se houver)'
    // }
  ];

  const currentRole = roles.find(r => r.value === selectedRole) || roles[0];

  const handleRoleClick = (roleValue: string) => {
    setSelectedRole(roleValue);
    if (setValue) {
      setValue('role', roleValue);
    }
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatters.licenseNumber(e.target.value, selectedRole);
    e.target.value = formatted;
    
    if (setValue) {
      setValue('licenseNumber', formatted, { shouldValidate: true });
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    
    // Limitar a 11 dígitos
    if (value.length <= 11) {
      const formatted = cpfValidator.format(value);
      setFormattedCPF(formatted);
      
      if (setValue) {
        setValue('cpf', value, { shouldValidate: true });
      }
    }
  };

  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <FaUserTie className="w-3.5 h-3.5" />
          Função profissional *
        </label>
        <div className="grid grid-cols-2 gap-4">
          {roles.map((role) => (
            <div
              key={role.value}
              className={`
                border-2 rounded-xl p-3 cursor-pointer transition-all duration-200
                ${selectedRole === role.value 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-300 bg-white hover:border-indigo-300'
                }
                hover:-translate-y-1
              `}
              onClick={() => handleRoleClick(role.value)}
            >
              <div className="flex items-center gap-3">
                <div className={selectedRole === role.value ? 'text-indigo-600' : 'text-gray-500'}>
                  <role.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${selectedRole === role.value ? 'text-indigo-600' : 'text-gray-800'}`}>
                    {role.title}
                  </div>
                </div>
                {selectedRole === role.value && (
                  <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Campo hidden para react-hook-form */}
        <input type="hidden" {...register('role', { required: 'Função profissional é obrigatória' })} />
        {errors.role && (
          <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
        )}
      </div>

      {/* CPF - NOVO CAMPO OBRIGATÓRIO */}
      <div className="mb-4">
        <div className="relative">
          <InputField
            label="CPF *"
            type="text"
            icon={<FaFingerprint className="w-3.5 h-3.5" />}
            placeholder="000.000.000-00"
            value={formattedCPF}
            onChange={handleCPFChange}
            error={errors.cpf?.message}
            maxLength={14}
            {...register('cpf', {
              required: 'CPF é obrigatório',
              validate: (value: string) => {
                if (!value) return 'CPF é obrigatório';
                const validation = cpfValidator.validate(value);
                return validation.valid || validation.error || 'CPF inválido';
              }
            })}
            disabled={loading}
            required
          />
          {watchedCPF && !errors.cpf && (
            <div className="absolute right-3 top-10">
              {cpfValid ? (
                <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  CPF válido
                </span>
              ) : (
                <span className="text-yellow-600 text-xs font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  CPF incompleto
                </span>
              )}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Digite apenas números. Utilizado para identificação única.
        </p>
      </div>

      {/* Campos Opcionais - Mantidos mas claramente identificados 
      <div className="space-y-4 mb-6">
        <div className="border border-dashed border-gray-300 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FaIdCard className="w-3.5 h-3.5" />
            Dados profissionais (opcionais - podem ser completados depois)
          </h3>
          
          <InputField
            label={currentRole.licenseLabel}
            type="text"
            placeholder={currentRole.licensePlaceholder}
            error={errors.licenseNumber?.message}
            {...register('licenseNumber', {
              onChange: handleLicenseChange
            })}
            disabled={loading}
          />

          <InputField
            label="Especialização (opcional)"
            type="text"
            placeholder="Ex: Psicologia Infantil, Educação Especial..."
            error={errors.specialization?.message}
            {...register('specialization')}
            disabled={loading}
          />

          <InputField
            label="Instituição (opcional)"
            type="text"
            placeholder="Ex: Hospital das Clínicas, Escola Estadual..."
            error={errors.institution?.message}
            {...register('institution')}
            disabled={loading}
          />
        </div>
      </div>*/}

      {/* Mensagem informativa 
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Informação importante
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                • O <strong>CPF é obrigatório</strong> para identificação única na plataforma
              </p>
              <p className="mt-1">
                • Dados profissionais (registro, especialização, instituição) podem ser 
                completados posteriormente na sua página de perfil
              </p>
              <p className="mt-1">
                • Seu CPF será <strong>criptografado</strong> e tratado conforme a LGPD
              </p>
            </div>
          </div>
        </div>
      </div>*/}

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