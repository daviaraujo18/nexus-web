// lib/utils/validationUtils.ts
import { ActivityType, CreateScheduleDTO } from "@/types/schedule";

export class ValidationUtils {
  static validateScheduleData(data: CreateScheduleDTO): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length < 3) {
      errors.push('Nome do cronograma deve ter pelo menos 3 caracteres');
    }

    // Datas - Protegido contra undefined
    const normalizeDate = (date: Date | string | undefined) => {
      if (!date) return new Date();
      const d = typeof date === 'string'
        ? new Date(date + 'T00:00:00')
        : new Date(date);

      d.setHours(0, 0, 0, 0);
      return d;
    };

    const today = normalizeDate(new Date());
    const startDate = data.startDate ? normalizeDate(data.startDate) : today;

    // A data de hoje é permitida, só datas anteriores são bloqueadas
    if (startDate < today) {
      errors.push('Data de início não pode ser no passado');
    }

    // Data de término
    if (!data.endDate) {
      errors.push('Data de término é obrigatória');
    } else {
      const endDate = normalizeDate(data.endDate);

      // IMPORTANTE: Compare as datas zeradas
      if (endDate <= startDate) {
        errors.push('Data de término deve ser posterior à data de início');
      }
    }

    // Dias ativos - 🔥 BLINDADO: Verifica se é undefined ANTES de ler o length
    if (!data.activeDays || data.activeDays.length === 0) {
      errors.push('Selecione pelo menos um dia da semana');
    } else if (data.activeDays.some(day => day < 0 || day > 6)) {
      errors.push('Dias da semana devem estar entre 0 (domingo) e 6 (sábado)');
    }

    // Atividades - 🔥 BLINDADO: Verifica se é undefined ANTES de ler o length
    if (!data.activities || data.activities.length === 0) {
      errors.push('Adicione pelo menos uma atividade');
    } else {
      // Validar atividades individuais apenas se o array existir
      data.activities.forEach((activity, index) => {
        if (activity.dayOfWeek < 0 || activity.dayOfWeek > 6) {
          errors.push(`Atividade ${index + 1}: Dia da semana inválido`);
        }

        if (activity.metadata.estimatedDuration <= 0) {
          errors.push(`Atividade ${index + 1}: Duração estimada deve ser positiva`);
        }

        if (activity.scoring.pointsOnCompletion < 0) {
          errors.push(`Atividade ${index + 1}: Pontuação não pode ser negativa`);
        }

        // Validação extra: atividade em dia não ativo (blindado com array fallback)
        if (data.activeDays && !data.activeDays.includes(activity.dayOfWeek)) {
          errors.push(`Atividade ${index + 1}: Dia ${activity.dayOfWeek} não está ativo no cronograma`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateActivityConfig(type: ActivityType, config: any): boolean {
    if (!config) return false; // Fallback de segurança

    switch (type) {
      case 'quick':
        return typeof config.autoComplete === 'boolean';

      case 'text':
        return typeof config.minWords === 'number' &&
          typeof config.maxWords === 'number';

      case 'quiz':
        return Array.isArray(config.questions) &&
          config.questions.length > 0 &&
          typeof config.passingScore === 'number';

      case 'video':
        return typeof config.url === 'string' &&
          config.url.includes('http');

      case 'checklist':
        return Array.isArray(config.items) &&
          config.items.length > 0;

      case 'file':
        return Array.isArray(config.allowedTypes) &&
          typeof config.maxSizeMB === 'number';

      default:
        return false;
    }
  }

  static sanitizeScheduleData(data: any): CreateScheduleDTO {
    // Array fallbacks para garantir que a interface ou backend não mandem undefined no lugar de Arrays
    const activeDays = Array.isArray(data.activeDays) ? data.activeDays : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];

    return {
      ...data,
      name: (data.name || '').trim(),
      description: (data.description || '').trim(),
      // Garantir que endDate está presente (se não estiver, calcula 4 semanas)
      endDate: data.endDate || new Date(
        (data.startDate || new Date()).getTime() + (28 * 24 * 60 * 60 * 1000)
      ),
      activeDays: Array.from(new Set(activeDays)).sort(),
      activities: activities.map((activity: any) => ({
        ...activity,
        title: (activity.title || '').trim(),
        instructions: (activity.instructions || '').trim(),
        description: (activity.description || '').trim(),
      }))
    };
  }
}