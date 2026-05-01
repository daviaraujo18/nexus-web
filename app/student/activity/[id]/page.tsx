// app/student/activity/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ActivityExecutor from '@/components/activities/ActivityExecutor';
import { ProgressService } from '@/lib/services/ProgressService';
import { ActivityProgress } from '@/types/schedule';
import { useAuth } from '@/context/AuthContext';
import { useActivityTimer } from '@/context/ActivityTimerContext';
import {
  FaArrowLeft,
  FaHome,
  FaCalendarAlt,
  FaStar,
  FaSpinner,
  FaExclamationTriangle,
  FaChevronLeft,
  FaChevronRight,
  FaTrophy,
  FaChartLine
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

/**
 * Página de execução de atividade do aluno.
 *
 * Responsabilidades:
 * - Carregar o progresso da atividade (activityProgress)
 * - Iniciar automaticamente atividades pendentes
 * - Integrar com o sistema de timer global (ActivityTimer)
 * - Permitir conclusão manual da atividade
 * - Sincronizar estado com o backend (ProgressService)
 *
 * ⚠️ IMPORTANTE:
 * Este componente é o ponto central da execução real da atividade.
 *
 * Impacta diretamente:
 * - pontuação do aluno
 * - tempo registrado
 * - progresso semanal
 * - analytics
 *
 * ⚠️ Qualquer bug aqui afeta o core do produto.
 */
export default function ActivityPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [activityProgress, setActivityProgress] = useState<ActivityProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { active, startTimer, stopTimer } = useActivityTimer();
  const [completedByTimer, setCompletedByTimer] = useState(false);

  /**
   * Detecta se o dispositivo é mobile para adaptar layout.
   *
   * Estratégia:
   * - usa window.innerWidth
   * - atualiza dinamicamente no resize
   *
   * ⚠️ Risco:
   * - depende do ambiente cliente (não SSR-safe)
   */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Carrega o progresso da atividade e inicia automaticamente quando necessário.
   *
   * Fluxo:
   * 1. Busca activityProgress do backend
   * 2. Se status = 'pending' → inicia automaticamente
   * 3. Se status = 'in_progress' → garante que o timer esteja ativo
   *
   * ⚠️ Decisão de UX:
   * O usuário NÃO precisa clicar em "iniciar"
   *
   * ⚠️ Risco:
   * - Pode gerar double-start se backend não for idempotente
   * - Timer pode iniciar fora de sincronia com o backend
   */
  useEffect(() => {
    if (!user || !id) return;

    const loadActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const progress = await ProgressService.getActivityProgress(
          id as string,
          user.id
        );
        
        setActivityProgress(progress);
        
        /** 
         * Auto-start da atividade ao abrir (UX otimizada)
         */
        if (progress.status === 'pending') {
          try {
            await ProgressService.startActivity(id as string, user.id);
            const updated = {
              ...progress,
              status: 'in_progress' as const,
              executionData: { ...progress.executionData, startedAt: new Date() }
            };
            setActivityProgress(updated);

            /**
             * Inicializa o timer global da atividade.
             *
             * Motivo:
             * - rastrear tempo real da execução
             * - permitir conclusão automática via FloatingTimer
             *
             * ⚠️ Risco:
             * - usa Date local → pode divergir do backend
             * - pode haver desalinhamento se startActivity falhar parcialmente
             */
            startTimer({
              progressId: updated.id,
              activityId: updated.activityId,
              studentId: updated.studentId,
              title: updated.activitySnapshot.title,
              estimatedMinutes: updated.activitySnapshot.metadata.estimatedDuration || 30,
              startedAt: new Date()
            });
          } catch (startError) {
            console.warn('Não foi possível iniciar automaticamente:', startError);
          }
        } else if (progress.status === 'in_progress' && !active) {
          startTimer({
            progressId: progress.id,
            activityId: progress.activityId,
            studentId: progress.studentId,
            title: progress.activitySnapshot.title,
            estimatedMinutes: progress.activitySnapshot.metadata.estimatedDuration || 30,
            startedAt: new Date()
          });
        }
        
      } catch (err: any) {
        console.error('Erro ao carregar atividade:', err);
        setError(err.message || 'Erro ao carregar atividade');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [id, user]);

  /**
   * Detecta conclusão automática via FloatingTimer.
   *
   * Cenário:
   * - Timer global finaliza atividade
   * - UI precisa refletir isso sem reload
   *
   * ⚠️ Importante:
   * Isso evita inconsistência entre:
   * - estado visual
   * - estado real da atividade
   */
  useEffect(() => {
    if (!active && activityProgress?.status === 'in_progress' && !loading) {
      setCompletedByTimer(true);
      setActivityProgress(prev => prev ? { ...prev, status: 'completed' } : null);
    }
  }, [active]);

  /**
   * Callback disparado após conclusão da atividade.
   *
   * Ações:
   * - para o timer
   * - redireciona para dashboard
   *
   * ⚠️ UX:
   * Delay de 1.5s permite feedback visual antes do redirect
   */
  const handleActivityCompletion = (result: any) => {
    stopTimer();
    setTimeout(() => router.push('/student/dashboard'), 1500);
  };

  /**
   * Permite conclusão manual da atividade.
   *
   * Fluxo:
   * 1. Verifica se já foi concluída (timer ou estado)
   * 2. Calcula tempo gasto
   * 3. Chama ProgressService.completeActivity
   * 4. Atualiza estado local
   * 5. Redireciona
   *
   * ⚠️ IMPORTANTE:
   * Esse método é o ponto mais crítico de integração com o backend.
   *
   * ⚠️ Riscos:
   * - pode haver corrida com FloatingTimer
   * - pode ocorrer double-complete
   *
   * ⚠️ Tratamento:
   * erro "não está em progresso" → tratado como sucesso
   */
  const handleManualComplete = async () => {
    if (!activityProgress || !user) return;
    // Já foi concluída pelo FloatingTimer
    if (activityProgress.status === 'completed' || completedByTimer) {
      router.push('/student/dashboard');
      return;
    }
    try {
      await ProgressService.completeActivity(activityProgress.id, user.id, {
        
        /**
         * Calcula tempo gasto em minutos com base no timer ativo.
         *
         * ⚠️ Risco:
         * - depende do clock do cliente
         * - pode divergir do backend
         */
        timeSpent: active ? Math.ceil((Date.now() - active.startedAt.getTime()) / 60000) : 0
      });
      stopTimer();
      setActivityProgress(prev => prev ? { ...prev, status: 'completed' } : null);
      setTimeout(() => router.push('/student/dashboard'), 1500);
    } catch (e: any) {
      if (e?.message?.includes('não está em progresso')) {
        // Já foi concluída por outra via
        stopTimer();
        setActivityProgress(prev => prev ? { ...prev, status: 'completed' } : null);
        setTimeout(() => router.push('/student/dashboard'), 1000);
      } else {
        console.error('Erro ao concluir atividade:', e);
      }
    }
  };

  /**
   * Recarrega estado da atividade após mudanças internas.
   *
   * Uso:
   * - garantir sincronização com backend
   * - evitar estado stale na UI
   */
  const handleActivityStatusChange = () => {
    if (user && id) {
      ProgressService.getActivityProgress(id as string, user.id)
        .then(setActivityProgress)
        .catch(console.error);
    }
  };

  /**
   * Tela de carregamento da atividade.
   *
   * Objetivo:
   * - Evitar tela em branco durante fetch inicial
   * - Melhorar percepção de performance com animação
   * - Indicar claramente ao usuário que a atividade está sendo preparada
   *
   * ⚠️ Importante:
   * Esse estado bloqueia toda a renderização até os dados estarem prontos
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative mb-6">
            <div className="w-24 h-24 mx-auto">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="#E5E7EB" strokeWidth="8" fill="none" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="#4F46E5"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ 
                    pathLength: 1,
                    rotate: 360
                  }}
                  transition={{
                    duration: 2,
                    ease: "linear",
                    repeat: Infinity
                  }}
                  strokeDasharray="283"
                  strokeDashoffset="0"
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <FaSpinner className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-2">Preparando sua atividade</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Carregando tudo o que você precisa para uma experiência incrível...
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /**
   * Tela de erro com fallback de navegação.
   *
   * Cenário:
   * - Falha ao carregar activityProgress
   * - Atividade inexistente ou inválida
   *
   * Ações disponíveis:
   * - Voltar para página anterior
   * - Ir para dashboard
   *
   * ⚠️ Importante:
   * Evita dead-end na navegação do usuário
   * e garante recuperação mesmo em erro crítico
   */
  if (error || !activityProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <FaExclamationTriangle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Ops! Encontramos um problema
            </h2>
          </div>
          
          <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-800 text-center">
                {error || 'Atividade não encontrada'}
              </p>
            </div>
            
            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.back()}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                <FaArrowLeft />
                <span>Voltar para página anterior</span>
              </motion.button>
              
              <motion.div
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href="/student/dashboard"
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl"
                >
                  <FaHome />
                  <span>Ir para Dashboard</span>
                </Link>
              </motion.div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Problema persistente?{' '}
                <a href="mailto:suporte@nexusplatform.com" className="text-indigo-600 hover:underline">
                  Entre em contato com o suporte
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const activity = activityProgress.activitySnapshot;
  const isQuick = activity.type === 'quick';
  const isFile = activity.type === 'file';

  // Renderização mobile vs desktop
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      {/* Floating Header - Mobile & Desktop */}

      /**
       * Header dinâmico da atividade.
       *
       * Exibe:
       * - título da atividade
       * - status atual (pending, in_progress, completed, skipped)
       * - nível de dificuldade
       *
       * ⚠️ Importante:
       * O status exibido é derivado de `activityProgress.status`,
       * que representa o estado real persistido no backend.
       *
       * ⚠️ Impacto:
       * - guia o usuário visualmente durante a execução
       * - evita confusão sobre o estado atual da atividade
       */
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Botão Voltar com animação */}
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.back()}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center group-hover:from-gray-200 group-hover:to-gray-300 transition-all">
                <FaArrowLeft className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
              </div>
              {!isMobile && (
                <div className="text-left">
                  <p className="text-sm text-gray-500 group-hover:text-gray-600">Voltar</p>
                  <p className="text-xs text-gray-400">para página anterior</p>
                </div>
              )}
            </motion.button>

            {/* Título e Status */}
            <div className="flex-1 max-w-2xl mx-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <h1 className="text-lg font-bold text-gray-800 truncate">
                  {activity.title}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                    activityProgress.status === 'pending' 
                      ? 'bg-gray-100 text-gray-700 border border-gray-300' 
                      : activityProgress.status === 'in_progress' 
                      ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-300' 
                      : activityProgress.status === 'completed' 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300' 
                      : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300'
                  }`}>
                    {activityProgress.status === 'pending' ? '🕒 Pendente' :
                     activityProgress.status === 'in_progress' ? '⚡ Em Progresso' :
                     activityProgress.status === 'completed' ? '✅ Concluída' : '⏸️ Pulada'}
                  </span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className={`text-xs font-medium ${
                    activity.metadata.difficulty === 'easy' ? 'text-green-600' :
                    activity.metadata.difficulty === 'medium' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {activity.metadata.difficulty === 'easy' ? '🥳 Fácil' :
                     activity.metadata.difficulty === 'medium' ? '🤔 Médio' : '💪 Desafiador'}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Ações Direitas */}
            <div className="flex items-center gap-2">
              {/* Botão Sidebar (apenas mobile) */}
              {isMobile && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 flex items-center justify-center"
                >
                  {showSidebar ? (
                    <FaChevronRight className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <FaChevronLeft className="w-4 h-4 text-indigo-600" />
                  )}
                </motion.button>
              )}
              
              {/* Dashboard Button */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href="/student/dashboard"
                  className="w-10 h-10 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center hover:from-gray-200 hover:to-gray-300 transition-all"
                >
                  <FaHome className="w-4 h-4 text-gray-600" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto">
        <div className="flex">
          {/* Sidebar Desktop */}
          {!isMobile && (
            <motion.aside 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="w-80 flex-shrink-0 border-r border-gray-200 p-6 hidden lg:block"
            >
              <div className="sticky top-24 space-y-6">
                {/* Carta de Informações */}
                <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <FaStar className="w-4 h-4 text-amber-500" />
                    Informações da Atividade
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Pontuação</span>
                      <span className="flex items-center gap-1 font-bold text-amber-600">
                        <FaTrophy className="w-4 h-4" />
                        {activity.scoring.pointsOnCompletion} pts
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Duração</span>
                      <span className="font-semibold text-gray-800">
                        {activity.metadata.estimatedDuration} min
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Dia da Semana</span>
                      <span className="font-semibold text-gray-800 flex items-center gap-1">
                        <FaCalendarAlt className="w-3 h-3 text-gray-400" />
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][activityProgress.dayOfWeek]}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Categoria</span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                        {activity.type || (isQuick ? 'Rápida' : 'Arquivo')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra de Progresso */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Progresso da Atividade</span>
                      <span className="font-medium text-gray-800">
                        {activityProgress.status === 'completed' ? '100%' :
                         activityProgress.status === 'in_progress' ? '50%' : '0%'}
                      </span>
                    </div>

                    /**
                     * Barra de progresso visual da atividade.
                     *
                     * Lógica simplificada:
                     * - pending → 0%
                     * - in_progress → 50%
                     * - completed → 100%
                     *
                     * ⚠️ Importante:
                     * Este progresso NÃO é granular.
                     * Ele representa apenas o estado geral da atividade,
                     * não o avanço real dentro dela.
                     *
                     * ⚠️ Impacto:
                     * - serve como feedback visual rápido
                     * - evita complexidade desnecessária na UI
                     */
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full ${
                          activityProgress.status === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                          activityProgress.status === 'in_progress' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                          'bg-gray-300'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ 
                          width: activityProgress.status === 'completed' ? '100%' :
                                 activityProgress.status === 'in_progress' ? '50%' : '0%'
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Dicas e Recursos */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <FaChartLine className="w-4 h-4 text-blue-600" />
                    Dicas para Sucesso
                  </h3>
                  
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-blue-600">📚</span>
                      </div>
                      <span className="text-gray-700">Leia atentamente as instruções</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-blue-600">⏱️</span>
                      </div>
                      <span className="text-gray-700">Gerencie seu tempo com sabedoria</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-blue-600">🤔</span>
                      </div>
                      <span className="text-gray-700">
                        {isQuick ? 'Reflita antes de responder' : 'Revise seus arquivos antes de enviar'}
                      </span>
                    </li>
                    {isFile && (
                      <li className="flex items-start gap-2 text-sm">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs text-blue-600">📁</span>
                        </div>
                        <span className="text-gray-700">Organize seus arquivos antes do upload</span>
                      </li>
                    )}
                  </ul>
                </div>
                
                {/* Ajuda Rápida */}
                <div className="text-center">
                  <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    Precisa de ajuda? Clique aqui
                  </button>
                </div>
              </div>
            </motion.aside>
          )}

          {/* Conteúdo Principal - Activity Executor */}
          <main className="flex-1 p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >

              /**
               * Componente responsável pela execução da atividade em si.
               *
               * Recebe:
               * - progress → estado atual
               * - onStatusChange → callback de sincronização
               * - onCompletion → callback final
               *
               * ⚠️ Este componente encapsula:
               * - lógica de interação
               * - envio de dados
               * - fluxo interno da atividade
               */
              <ActivityExecutor
                progress={activityProgress}
                onStatusChange={handleActivityStatusChange}
                onCompletion={handleActivityCompletion}
                readOnly={activityProgress.status === 'completed'}
              />
              
              {/* Botões de Navegação Inferior */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <motion.button
                    whileHover={{ x: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.back()}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                  >
                    <FaArrowLeft />
                    <span>Voltar para Anterior</span>
                  </motion.button>

                  <div className="flex gap-4 flex-wrap justify-end">
                    {(activityProgress.status === 'in_progress' || completedByTimer) && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleManualComplete}
                        className={`px-8 py-3 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 ${
                          completedByTimer
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-90'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90'
                        }`}
                      >
                        <FaStar className="w-4 h-4" />
                        <span>{completedByTimer ? 'Atividade Concluída ✓' : 'Concluir Atividade'}</span>
                      </motion.button>
                    )}

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link
                        href="/student/dashboard"
                        className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                      >
                        <FaHome />
                        <span>Ir para Dashboard</span>
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </main>
        </div>
      </div>

      {/* Sidebar Mobile (Overlay) */}
      <AnimatePresence>
        {isMobile && showSidebar && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            
            {/* Sidebar Content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-80 bg-white border-r border-gray-200 z-50 overflow-y-auto lg:hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-gray-800">Detalhes da Atividade</h3>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <FaChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                
                {/* Mobile Sidebar Content */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 flex items-center justify-center">
                        {isQuick ? '⚡' : '📁'}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">{activity.title}</h4>
                        <p className="text-sm text-gray-500">
                          {isQuick ? 'Atividade Rápida' : 'Upload de Arquivos'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Pontuação</span>
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          {activity.scoring.pointsOnCompletion} pts
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Duração</span>
                        <span className="font-semibold text-gray-800">
                          {activity.metadata.estimatedDuration} min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floating Action Button - Mobile */}
      {isMobile && activityProgress.status === 'in_progress' && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-6 right-6 z-30 lg:hidden"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur-lg opacity-50"></div>
            <button className="relative w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center">
              {isQuick ? '⚡' : '📁'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}