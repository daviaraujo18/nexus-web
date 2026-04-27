'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CreateActivityDTO,
  ActivityType,
  DifficultyLevel,
  CreateScheduleDTO,
  ActivityConfig
} from '@/types/schedule';
import {
  FaTimes,
  FaSave,
  FaFileAlt,
  FaVideo,
  FaQuestionCircle,
  FaList,
  FaFile,
  FaSync,
  FaStar,
  FaClock,
  FaUpload,
  FaCheck,
  FaTag,
  FaPlus,
  FaTrash,
  FaRunning,
  FaChevronDown
} from 'react-icons/fa';

interface QuickActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityData: CreateActivityDTO, repeatDays: number[]) => void;
  initialDay: number;
  isEditing?: boolean;
  initialData?: CreateActivityDTO;
  availableDays: number[];
  formData: CreateScheduleDTO;
}

const SUBJECTS_BY_GRADE: Record<string, string[]> = {
  '1ano-em': [
    'Língua Portuguesa',
    'Leitura e Produção de Textos',
    'Inglês',
    'Literatura',
    'Arte',
    'Filosofia',
    'Sociologia',
    'Geografia Humana',
    'Geografia Física',
    'História do Brasil',
    'História Geral',
    'História da América',
    'Química 1',
    'Química 2',
    'Biologia 1',
    'Biologia 2',
    'Física 1',
    'Física 2',
    'Matemática Básica',
    'Álgebra',
    'Geometria',
  ],
  '2ano-em': [
    'Língua Portuguesa',
    'Leitura e Produção de Texto',
    'Arte',
    'Inglês',
    'Literatura',
    'Filosofia',
    'Sociologia',
    'História do Brasil',
    'História Geral',
    'História Contemporânea',
    'Geografia Física',
    'Geografia Humana',
    'Geografia Política',
    'Química Orgânica',
    'Físico-Química',
    'Física 1',
    'Física 2',
    'Física 3',
    'Biologia 1',
    'Biologia 2',
    'Biologia 3',
    'Matemática Básica',
    'Álgebra',
    'Geometria',
  ],
};

const GRADE_LABELS: Record<string, string> = {
  '1ano-em': '1ª Série',
  '2ano-em': '2ª Série',
};

const activityTypes: Array<{
  type: ActivityType;
  icon: React.ReactNode;
  label: string;
  color: string;
  description: string;
}> = [
    {
      type: 'quick',
      icon: '⚡',
      label: 'Rápida',
      color: 'bg-blue-500',
      description: 'Atividade simples sem detalhes'
    },
    {
      type: 'app',
      icon: '📱',
      label: 'App',
      color: 'bg-purple-500',
      description: 'Atividade em aplicativo externo'
    },
    {
      type: 'file',
      icon: <FaFile />,
      label: 'Arquivo',
      color: 'bg-indigo-500',
      description: 'Upload de arquivos'
    },
    {
      type: 'physical_activity',
      icon: <FaRunning />,
      label: 'Atividade Física',
      color: 'bg-emerald-500',
      description: 'Exercício ou esporte'
    }
  ];

const difficultyOptions: Array<{
  value: DifficultyLevel;
  label: string;
  color: string;
}> = [
    { value: 'easy', label: 'Fácil', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Médio', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'hard', label: 'Difícil', color: 'bg-red-100 text-red-800' }
  ];

const dayLabels: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua',
  4: 'Qui', 5: 'Sex', 6: 'Sáb'
};

export default function QuickActivityModal({
  isOpen,
  onClose,
  onSave,
  initialDay,
  isEditing = false,
  initialData,
  availableDays,
  formData
}: QuickActivityModalProps) {
  const [selectedType, setSelectedType] = useState<ActivityType>('quick');
  const [repeatDays, setRepeatDays] = useState<number[]>([initialDay]);
  const [form, setForm] = useState<Partial<CreateActivityDTO>>({
    title: '',
    description: '',
    instructions: '',
    type: 'quick',
    dayOfWeek: initialDay,
    orderIndex: 0,
    config: {},
    scoring: {
      isRequired: true,
      pointsOnCompletion: 10,
      bonusPoints: 0
    },
    metadata: {
      estimatedDuration: 60,
      difficulty: 'medium',
      therapeuticFocus: [],
      educationalFocus: [],
      gradeLevel: null,
      subject: null
    },
    estimatedDuration: 60,
    pointsOnCompletion: 10
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Inicializar com dados existentes
  useEffect(() => {
    if (initialData) {
      // ✅ CORREÇÃO: Limpar campos duplicados
      const { estimatedDuration, pointsOnCompletion, ...cleanData } = initialData;

      setForm({
        ...cleanData,
        config: initialData.config || {},
        scoring: initialData.scoring || {
          isRequired: true,
          pointsOnCompletion: 10,
          bonusPoints: 0
        },
        metadata: {
          estimatedDuration: initialData.metadata?.estimatedDuration || 60,
          difficulty: initialData.metadata?.difficulty || 'medium',
          therapeuticFocus: initialData.metadata?.therapeuticFocus || [],
          educationalFocus: initialData.metadata?.educationalFocus || [],
          gradeLevel: initialData.metadata?.gradeLevel || null,
          subject: initialData.metadata?.subject || null
        }
      });

      setSelectedType(initialData.type);
    }
  }, [initialData]);

  useEffect(() => {
    if (isOpen) {
      // Previne scroll do body
      document.body.style.overflow = 'hidden';

      // Foca no título quando abre
      setTimeout(() => {
        const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        titleInput?.focus();
      }, 100);

      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const toggleRepeatDay = (day: number) => {
    setRepeatDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title?.trim()) {
      alert('Por favor, informe o título da atividade');
      return;
    }

    // Preparar dados finais
    const activityData: CreateActivityDTO = {
      ...form as CreateActivityDTO,
      type: selectedType,
      dayOfWeek: initialDay, // Baseado no dia original
      orderIndex: formData.activities.filter(a => a.dayOfWeek === initialDay).length,
      config: getConfigForType(),
      metadata: {
        estimatedDuration: form.metadata?.estimatedDuration || 15,
        difficulty: form.metadata?.difficulty || 'medium',
        therapeuticFocus: form.metadata?.therapeuticFocus || [],
        educationalFocus: form.metadata?.educationalFocus || [],
        gradeLevel: form.metadata?.gradeLevel || null,
        subject: form.metadata?.subject || null
      },
      estimatedDuration: form.metadata?.estimatedDuration || 15,
      pointsOnCompletion: form.scoring?.pointsOnCompletion || 10
    };

    onSave(activityData, repeatDays);
  };

  const getConfigForType = (): ActivityConfig => {
    switch (selectedType) {
      case 'file':
        return {
          allowedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.png'],
          maxSizeMB: 10
        };
      case 'app':
        return {
          autoComplete: true,
        };
      default:
        return {
          autoComplete: true
        };
    }
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isEditing ? 'Editar Atividade' : 'Nova Atividade'}
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                Configure os detalhes da atividade
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="p-8 space-y-8">
            {/* Seção 1: Tipo e Repetição */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tipo de Atividade */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de Atividade *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activityTypes.map((type) => (
                    <button
                      key={type.type}
                      type="button"
                      onClick={() => setSelectedType(type.type)}
                      className={`p-3 rounded-xl border-2 transition-all ${selectedType === type.type
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full ${type.color} flex items-center justify-center text-white`}>
                          {type.icon}
                        </div>
                        <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                          {type.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Série e Matéria */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Série
                    </label>
                    <div className="relative">
                      <select
                        value={form.metadata?.gradeLevel || ''}
                        onChange={(e) => setForm({
                          ...form,
                          metadata: {
                            ...form.metadata!,
                            gradeLevel: e.target.value || null,
                            subject: null
                          }
                        })}
                        className="w-full appearance-none px-3 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      >
                        <option value="">Selecionar série</option>
                        {Object.entries(GRADE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <FaChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Matéria
                    </label>
                    <div className="relative">
                      <select
                        value={form.metadata?.subject || ''}
                        onChange={(e) => setForm({
                          ...form,
                          metadata: { ...form.metadata!, subject: e.target.value || null }
                        })}
                        disabled={!form.metadata?.gradeLevel}
                        className="w-full appearance-none px-3 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">
                          {form.metadata?.gradeLevel ? 'Selecionar matéria' : 'Selecione a série primeiro'}
                        </option>
                        {(SUBJECTS_BY_GRADE[form.metadata?.gradeLevel || ''] || []).map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>
                      <FaChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dias de Repetição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Repetir em outros dias
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {availableDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleRepeatDay(day)}
                      className={`p-2 rounded-lg font-medium transition-all ${repeatDays.includes(day)
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {dayLabels[day]}
                        {repeatDays.includes(day) && (
                          <FaCheck className="w-3 h-3" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Atividade será criada em {repeatDays.length} dia{repeatDays.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Seção 2: Informações Básicas */}
            <div className="space-y-8">
              {/* Linha 1: Título e Dificuldade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Título */}
                <div className="space-y-3">
                  <label className="block text-base font-semibold text-gray-900">
                    Título da Atividade *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.title || ''}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900 bg-white"
                      placeholder="Ex: Meditação Guiada"
                      required
                    />
                    <div className="absolute right-3 top-3.5">
                      <span className="text-sm text-gray-400">
                        {form.title?.length || 0}/60
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dificuldade */}
                <div className="space-y-3">
                  <label className="block text-base font-semibold text-gray-900">
                    Nível de Dificuldade
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {difficultyOptions.map(diff => {
                      const isSelected = (form.metadata?.difficulty || 'medium') === diff.value;
                      return (
                        <button
                          key={diff.value}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            metadata: { ...form.metadata!, difficulty: diff.value }
                          })}
                          className={`px-4 py-3 rounded-xl border transition-all duration-200 ${isSelected
                            ? `${diff.value === 'easy' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100' :
                              diff.value === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700 ring-2 ring-amber-100' :
                                'border-rose-200 bg-rose-50 text-rose-700 ring-2 ring-rose-100'} font-semibold`
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm">{diff.label}</span>
                            <div className={`w-6 h-1 rounded-full ${diff.value === 'easy' ? 'bg-emerald-300' :
                              diff.value === 'medium' ? 'bg-amber-300' :
                                'bg-rose-300'
                              }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Descrição 
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-base font-semibold text-gray-900">
                    Descrição (Opcional)
                  </label>
                  <span className="text-sm text-gray-400">
                    {form.description?.length || 0}/200
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900 bg-white resize-none"
                    placeholder="Forneça contexto adicional sobre a atividade. O aluno verá esta descrição antes de começar."
                    rows={3}
                  />
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-gray-400">Shift + Enter para nova linha</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Contextualize a atividade para melhor engajamento
                </p>
              </div>*/}

              {/* Instruções */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-base font-semibold text-gray-900">
                    Instruções para o Aluno *
                  </label>
                  <span className="text-sm text-gray-400">
                    {form.instructions?.length || 0}/500
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-4 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <textarea
                    value={form.instructions || ''}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900 bg-white"
                    placeholder="Descreva passo a passo o que o aluno precisa fazer. Seja claro e específico."
                    rows={4}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Duração e Pontuação */}
            {/* Versão Minimalista */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Duração Simples */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Duração (min)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={form.metadata?.estimatedDuration || 15}
                    onChange={(e) => setForm({
                      ...form,
                      metadata: { ...form.metadata!, estimatedDuration: parseInt(e.target.value) || 15 }
                    })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 placeholder:text-gray-400 text-gray-900"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    min
                  </span>
                </div>
              </div>

              {/* Pontos Simples */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Pontos
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.scoring?.pointsOnCompletion || 10}
                  onChange={(e) => setForm({
                    ...form,
                    scoring: { ...form.scoring!, pointsOnCompletion: parseInt(e.target.value) || 10 }
                  })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 placeholder:text-gray-400 text-gray-900"
                />
              </div>

              {/* Requisito Simples 
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <div className="inline-flex rounded-lg border border-gray-200 p-1">
                  <button
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      scoring: { ...form.scoring!, isRequired: true }
                    })}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${form.scoring?.isRequired
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Obrigatória
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      scoring: { ...form.scoring!, isRequired: false }
                    })}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${!form.scoring?.isRequired
                        ? 'bg-gray-200 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Opcional
                  </button>
                </div>
              </div>*/}
            </div>

            {/* Seção 4: Configurações Específicas */}
            {selectedType === 'file' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Arquivo para Upload
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <FaFile className="w-12 h-12 text-indigo-500" />
                      <div>
                        <p className="font-medium text-gray-800">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Clique para alterar o arquivo
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <FaUpload className="w-12 h-12 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800">
                          Clique para selecionar um arquivo
                        </p>
                        <p className="text-sm text-gray-500">
                          PDF, DOC, JPG, PNG até 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>

          {/* Footer com Ações */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <FaSave className="w-4 h-4" />
                {isEditing ? 'Salvar Alterações' : 'Criar Atividade'}
                {repeatDays.length > 1 && (
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                    {repeatDays.length} dias
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}