// app/professional/schedules/[id]/assign/page.tsx - VERSÃO OTIMIZADA
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AssignmentInterface from '@/components/schedule/AssignmentInterface';
import {
  FaArrowLeft,
  FaUsers,
  FaCalendarAlt,
  FaLightbulb,
  FaChartLine,
  FaUserCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import { MdOutlineTipsAndUpdates } from 'react-icons/md';

export default function AssignSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => {
      router.push('/professional/schedules');
    }, 2500);
  };

  const handleCancel = () => {
    const confirmCancel = () => {
      router.push('/professional/schedules');
    };
    
    // Implementar modal de confirmação personalizado
    if (window.confirm('Tem certeza que deseja cancelar? As alterações serão perdidas.')) {
      confirmCancel();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header Principal */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            {/* Navegação Superior */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <Link
                  href="/professional/schedules"
                  className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-indigo-50 transition-colors">
                    <FaArrowLeft className="w-4 h-4" />
                  </div>
                  <span className="font-medium">Voltar para Cronogramas</span>
                </Link>
              </div>
              
              <div className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 rounded-full">
                <FaUsers className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">Atribuição de Cronograma</span>
              </div>
            </nav>

            {/* Título e Descrição */}
            <div className="mb-2">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Atribuir Cronograma
                  </h1>
                </div>
              </div>
            </div>

            {/* Feedback de Sucesso */}
            {showSuccess && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <FaCalendarAlt className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800 text-lg mb-1">
                        ✅ Cronograma atribuído com sucesso!
                      </h3>
                      <p className="text-green-700">
                        Os alunos selecionados começaram a receber as atividades. 
                        Redirecionando em instantes...
                      </p>
                    </div>
                    <div className="animate-pulse">
                      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Card de Informações Rápidas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <FaUsers className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Passo 1: Selecionar Alunos</h3>
                <p className="text-sm text-gray-500">
                  Filtre e selecione os alunos que receberão o cronograma
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <FaUserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Passo 2: Personalizar (Opcional)</h3>
                <p className="text-sm text-gray-500">
                  Ajuste atividades específicas para cada aluno
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <FaCalendarAlt className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Passo 3: Configurar Data</h3>
                <p className="text-sm text-gray-500">
                  Defina quando o cronograma começará
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-start space-x-3 p-4 bg-amber-50 rounded-xl">
              <FaExclamationTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 mb-0.5">
                  Alunos com cronograma ativo
                </p>
                <p className="text-sm text-amber-700">
                  Alunos que já possuem este cronograma ativo aparecerão com indicador amarelo.
                  Você pode permitir múltiplos cronogramas na configuração abaixo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interface de Atribuição */}
        <div className="mb-8">
          <AssignmentInterface
            scheduleId={scheduleId}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>

        {/* Card de Dicas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-2 mb-5">
            <MdOutlineTipsAndUpdates className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-gray-800">Dicas para Atribuição</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center space-x-2 mb-1">
                <FaUserCheck className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800 text-sm">Personalize por Aluno</span>
              </div>
              <p className="text-sm text-blue-700">
                Exclua atividades específicas para alunos que não precisam delas.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center space-x-2 mb-1">
                <FaCalendarAlt className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-800 text-sm">Data de Início Estratégica</span>
              </div>
              <p className="text-sm text-emerald-700">
                Inicie cronogramas nas segundas-feiras para facilitar o acompanhamento semanal.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center space-x-2 mb-1">
                <FaUsers className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-800 text-sm">Múltiplos Cronogramas</span>
              </div>
              <p className="text-sm text-purple-700">
                Permita que alunos tenham mais de um cronograma ativo se necessário.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-center space-x-2 mb-1">
                <FaChartLine className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-800 text-sm">Acompanhamento</span>
              </div>
              <p className="text-sm text-amber-700">
                Após atribuir, monitore o progresso dos alunos no dashboard.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}