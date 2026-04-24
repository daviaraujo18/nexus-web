// components/schedule/ScheduleHeaderPanel.tsx
'use client';

import React from 'react';
import { CreateScheduleDTO, ScheduleCategory } from '@/types/schedule';
import {
  FaCalendarAlt,
  FaClock,
  FaTag,
  FaInfoCircle,
  FaCalendarCheck
} from 'react-icons/fa';

interface ScheduleHeaderPanelProps {
  formData: CreateScheduleDTO;
  errors: Record<string, string>;
  updateField: (field: keyof CreateScheduleDTO, value: any) => void;
  totalActivities: number;
  totalDuration: number;
  totalPoints: number;
  activeDaysCount: number;
}

export default function ScheduleHeaderPanel({
  formData,
  errors,
  updateField,
  totalActivities,
  totalDuration,
  totalPoints,
  activeDaysCount
}: ScheduleHeaderPanelProps) {
  const categories: { value: ScheduleCategory; label: string; color: string }[] = [
    { value: 'therapeutic', label: 'Terapêutico', color: 'from-blue-500 to-cyan-500' },
    { value: 'educational', label: 'Educacional', color: 'from-purple-500 to-pink-500' },
    { value: 'mixed', label: 'Misto', color: 'from-green-500 to-emerald-500' }
  ];

  // Helper para converter string de input para Date sem erro de timezone
  const stringToDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // T12 para evitar bug de fuso
  };

  const getNextSunday = (date: Date): Date => {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 0) return result;
    const daysUntilSunday = 7 - dayOfWeek;
    result.setDate(result.getDate() + daysUntilSunday);
    return result;
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localDate = stringToDate(e.target.value);
    console.log('📅 [HEADER] Alterando Início para:', localDate.toLocaleDateString('pt-BR'));
    
    updateField('startDate', localDate);
    
    // Sugestão inteligente: define o fim para o domingo subsequente, mas o usuário pode mudar
    const nextSunday = getNextSunday(localDate);
    console.log('💡 [HEADER] Sugerindo Término (Próximo Domingo):', nextSunday.toLocaleDateString('pt-BR'));
    updateField('endDate', nextSunday);
  };

  // 🔥 NOVA FUNÇÃO: Handler para mudança manual da data de término
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localDate = stringToDate(e.target.value);
    console.log('🎯 [HEADER] Alterando Término MANUALMENTE para:', localDate.toLocaleDateString('pt-BR'));
    updateField('endDate', localDate);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
              <FaCalendarAlt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Configurações do Cronograma</h2>
              <p className="text-gray-600 text-sm">Controle as janelas de vigência e categorias</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div><div className="text-lg font-bold text-indigo-600">{totalActivities}</div><div className="text-xs text-gray-500">Items</div></div>
            <div><div className="text-lg font-bold text-green-600">{(totalDuration / 60).toFixed(1)}h</div><div className="text-xs text-gray-500">Semana</div></div>
            <div><div className="text-lg font-bold text-amber-600">{totalPoints}</div><div className="text-xs text-gray-500">Pontos</div></div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Esquerdo */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Cronograma *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
              placeholder="Ex: Treino de Elite"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => updateField('category', cat.value)}
                  className={`py-2 px-1 border-2 rounded-xl text-xs font-black transition-all ${
                    formData.category === cat.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-400'
                  }`}
                >
                  {cat.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lado Direito: Datas (LIBERADO) */}
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <FaCalendarAlt className="text-indigo-500" /> Início da Vigência *
            </label>
            <input
              type="date"
              value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
              onChange={handleStartDateChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-500/10 font-bold text-gray-800"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <FaCalendarCheck className="text-emerald-500" /> Término da Vigência *
            </label>
            <input
              type="date"
              // 🔥 CORREÇÃO: Removido o 'readOnly' e adicionado 'onChange'
              value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
              onChange={handleEndDateChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-4 transition-all font-bold ${
                errors.endDate 
                ? 'border-red-400 focus:ring-red-500/10 text-red-700' 
                : 'border-gray-300 focus:ring-emerald-500/10 text-gray-800'
              }`}
            />
            {errors.endDate && <p className="mt-1 text-xs text-red-600 font-bold">{errors.endDate}</p>}
            <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1 leading-tight">
              <FaInfoCircle />
              O cronograma encerra no fim deste dia. O sistema sugere o domingo subsequente, mas você pode alterar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}