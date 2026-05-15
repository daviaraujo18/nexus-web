'use client';

import React, { useState } from 'react';
import AuthForm from './AuthForm';
import { useRouter } from 'next/navigation';
import { RegisterResult, AuthError } from '@/types';

interface RegisterFormContainerProps {
  defaultUserType: 'student' | 'professional';
}

export default function RegisterFormContainer({ 
  defaultUserType 
}: RegisterFormContainerProps) {
  const router = useRouter();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSuccess = (result: RegisterResult) => {
    console.log('Registration successful:', result);
    setGlobalError(null);
    
    if (result.requiresVerification) {
      router.push('/verify-email');
    } else {
      router.push('/login?registered=true');
    }
  };

  const handleError = (error: AuthError) => {
    console.error('Registration error:', error);
    setGlobalError(error.message || 'Erro ao criar conta. Tente novamente.');
  };

  return (
    <>
      {globalError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Erro no registro
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{globalError}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <AuthForm
        mode="register"
        defaultUserType={defaultUserType}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </>
  );
}