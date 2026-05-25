// components/schedule/ActivityEditor.tsx
'use client';

import React, { useState } from 'react';
import { CreateActivityDTO, ActivityType, DifficultyLevel } from '@/types/schedule';
import { SUBJECTS_BY_GRADE, GRADE_LABELS } from '@/lib/constants/subjects';
import {
  FaClock,
  FaStar,
  FaEdit,
  FaBook,
  FaBrain,
  FaGraduationCap,
  FaLink,
  FaPaperclip,
  FaChevronDown
} from 'react-icons/fa';

interface ActivityEditorProps {
  activity: CreateActivityDTO;
  index: number;
  onUpdate: (updates: Partial<CreateActivityDTO>) => void;
  daysOfWeek: Array<{ id: number; label: string; full: string }>;
  activityTypes: Array<{ value: ActivityType; label: string; icon: string; description: string }>;
}

export default function ActivityEditor({
  activity,
  index,
  onUpdate,
  daysOfWeek,
  activityTypes
}: ActivityEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const difficultyOptions: { value: DifficultyLevel; label: string; color: string }[] = [
    { value: 'easy', label: 'Fácil', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Médio', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'hard', label: 'Difícil', color: 'bg-red-100 text-red-800' }
  ];

  const handleConfigChange = (field: string, value: any) => {
    const newConfig = { ...activity.config, [field]: value };
    onUpdate({ config: newConfig });
  };

  const handleScoringChange = (field: string, value: any) => {
    const newScoring = { ...activity.scoring, [field]: value };
    onUpdate({ scoring: newScoring });
  };

  const handleMetadataChange = (field: string, value: any) => {
    const newMetadata = { ...activity.metadata, [field]: value };
    onUpdate({ metadata: newMetadata });
  };

  const renderConfigFields = () => {
    switch (activity.type) {
      case 'quick':
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={(activity.config as any).autoComplete || false}
                onChange={(e) => handleConfigChange('autoComplete', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-medium text-gray-700">Auto-completar</div>
                <div className="text-sm text-gray-500">
                  Atividade será marcada como concluída automaticamente ao iniciar
                </div>
              </div>
            </label>
          </div>
        );

      case 'text':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mínimo de palavras
              </label>
              <input
                type="number"
                min="1"
                value={(activity.config as any).minWords || ''}
                onChange={(e) => handleConfigChange('minWords', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Máximo de palavras
              </label>
              <input
                type="number"
                min="1"
                value={(activity.config as any).maxWords || ''}
                onChange={(e) => handleConfigChange('maxWords', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Opcional"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Formato
              </label>
              <select
                value={(activity.config as any).format || 'plain'}
                onChange={(e) => handleConfigChange('format', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="plain">Texto simples</option>
                <option value="markdown">Markdown (formatação avançada)</option>
              </select>
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                Para configurar questões do quiz, você precisará usar o editor avançado.
                Por enquanto, defina as configurações básicas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pontuação mínima (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={(activity.config as any).passingScore || 70}
                  onChange={(e) => handleConfigChange('passingScore', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tentativas máximas
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={(activity.config as any).maxAttempts || ''}
                  onChange={(e) => handleConfigChange('maxAttempts', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ilimitadas"
                />
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL do Vídeo *
              </label>
              <input
                type="url"
                value={(activity.config as any).url || ''}
                onChange={(e) => handleConfigChange('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provedor
              </label>
              <select
                value={(activity.config as any).provider || 'youtube'}
                onChange={(e) => handleConfigChange('provider', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="custom">Customizado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porcentagem mínima de visualização (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={(activity.config as any).requireWatchPercentage || ''}
                onChange={(e) => handleConfigChange('requireWatchPercentage', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Ex: 80 (para 80%)"
              />
              <p className="mt-1 text-sm text-gray-500">
                Deixe em branco se não há requisito mínimo
              </p>
            </div>
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">
                Os itens da checklist serão configurados no editor avançado.
                Por enquanto, defina se todos os itens são obrigatórios.
              </p>
            </div>
          </div>
        );

      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipos de arquivo permitidos *
              </label>
              <input
                type="text"
                value={(activity.config as any).allowedTypes?.join(', ') || ''}
                onChange={(e) => handleConfigChange('allowedTypes', e.target.value.split(',').map(t => t.trim()))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Ex: .pdf, .doc, .docx, image/*"
              />
              <p className="mt-1 text-sm text-gray-500">
                Separe com vírgula. Use * para todos os tipos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamanho máximo (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={(activity.config as any).maxSizeMB || 10}
                  onChange={(e) => handleConfigChange('maxSizeMB', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo de arquivos
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={(activity.config as any).maxFiles || ''}
                  onChange={(e) => handleConfigChange('maxFiles', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ilimitados"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título da Atividade *
          </label>
          <input
            type="text"
            value={activity.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Ex: Meditação Guiada"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Atividade
          </label>
          <select
            value={activity.type}
            onChange={(e) => onUpdate({ type: e.target.value as ActivityType })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {activityTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label} - {type.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dia da Semana
          </label>
          <select
            value={activity.dayOfWeek}
            onChange={(e) => onUpdate({ dayOfWeek: parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          >
            {daysOfWeek.map(day => (
              <option key={day.id} value={day.id}>
                {day.full}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dificuldade
          </label>
          <select
            value={activity.metadata.difficulty}
            onChange={(e) => handleMetadataChange('difficulty', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          >
            {difficultyOptions.map(diff => (
              <option key={diff.value} value={diff.value}>
                {diff.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duração Estimada (minutos) *
          </label>
          <div className="flex items-center gap-2">
            <FaClock className="text-gray-400" />
            <input
              type="number"
              min="1"
              max="480"
              value={activity.metadata.estimatedDuration}
              onChange={(e) => {
                const duration = parseInt(e.target.value);
                handleMetadataChange('estimatedDuration', duration);
                onUpdate({ estimatedDuration: duration });
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Instruções *
        </label>
        <textarea
          value={activity.instructions}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
          placeholder="Descreva claramente o que o aluno deve fazer..."
          maxLength={1000}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição (opcional)
        </label>
        <textarea
          value={activity.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          rows={2}
          placeholder="Adicione uma descrição mais detalhada da atividade..."
          maxLength={500}
        />
      </div>

      {/* Série e Matéria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            <FaGraduationCap />
            Série (opcional)
          </label>
          <div className="relative">
            <select
              value={activity.metadata.gradeLevel || ''}
              onChange={(e) => {
                onUpdate({
                  metadata: {
                    ...activity.metadata,
                    gradeLevel: e.target.value || null,
                    subject: null,
                  },
                });
              }}
              className="w-full appearance-none px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Selecionar série</option>
              {Object.entries(GRADE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            <FaBook />
            Matéria (opcional)
          </label>
          <div className="relative">
            <select
              value={activity.metadata.subject || ''}
              onChange={(e) => handleMetadataChange('subject', e.target.value || null)}
              disabled={!activity.metadata.gradeLevel}
              className="w-full appearance-none px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {activity.metadata.gradeLevel ? 'Selecionar matéria' : 'Selecione a série primeiro'}
              </option>
              {(SUBJECTS_BY_GRADE[activity.metadata.gradeLevel || ''] || []).map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Configurações Específicas */}
      <div className="border-t pt-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FaEdit />
          Configurações Específicas
        </h4>
        {renderConfigFields()}
      </div>

      {/* Pontuação */}
      <div className="border-t pt-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FaStar />
          Pontuação
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={activity.scoring.isRequired}
                onChange={(e) => handleScoringChange('isRequired', e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-medium text-gray-700">Obrigatória</div>
                <div className="text-sm text-gray-500">
                  Atividade é obrigatória para completar o dia
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pontos por Conclusão
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={activity.scoring.pointsOnCompletion}
              onChange={(e) => {
                const points = parseInt(e.target.value);
                handleScoringChange('pointsOnCompletion', points);
                onUpdate({ pointsOnCompletion: points });
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pontos Bônus (opcional)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={activity.scoring.bonusPoints || ''}
              onChange={(e) => handleScoringChange('bonusPoints', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Foco Temático (Avançado) */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium mb-4"
        >
          {showAdvanced ? '▲' : '▼'} Configurações Avançadas
        </button>

        {showAdvanced && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FaBrain />
                  Foco Terapêutico (opcional)
                </label>
                <textarea
                  value={activity.metadata.therapeuticFocus?.join(', ') || ''}
                  onChange={(e) => handleMetadataChange('therapeuticFocus', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Ex: ansiedade, atenção, autoestima"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Separe com vírgula
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FaGraduationCap />
                  Foco Educacional (opcional)
                </label>
                <textarea
                  value={activity.metadata.educationalFocus?.join(', ') || ''}
                  onChange={(e) => handleMetadataChange('educationalFocus', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Ex: matemática, leitura, lógica"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Separe com vírgula
                </p>
              </div>
            </div>

            {/* Links e Recursos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FaLink />
                Links e Recursos (opcional)
              </label>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">
                  Links e recursos podem ser adicionados após salvar o cronograma.
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={() => {/* Em produção, abriria modal de recursos */}}
                >
                  Gerenciar recursos desta atividade
                </button>
              </div>
            </div>

            {/* Anexos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FaPaperclip />
                Anexos (opcional)
              </label>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">
                  Arquivos podem ser anexados após salvar o cronograma.
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={() => {/* Em produção, abriria upload de arquivos */}}
                >
                  Adicionar anexos a esta atividade
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}