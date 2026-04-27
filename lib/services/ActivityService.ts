// lib/services/ActivityService.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { 
  ScheduleActivity, 
  ActivityType,
  ActivityConfig
} from '@/types/schedule';

export class ActivityService {
  private static readonly COLLECTION = 'scheduleActivities';

  /**
   * Busca atividade por ID
   */
  static async getActivity(activityId: string): Promise<ScheduleActivity> {
    try {
      const activityDoc = await getDoc(
        doc(firestore, this.COLLECTION, activityId)
      );

      if (!activityDoc.exists()) {
        throw new Error('Atividade não encontrada');
      }

      const data = activityDoc.data();
      return {
        id: activityDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as ScheduleActivity;

    } catch (error: any) {
      console.error('Erro ao buscar atividade:', error);
      throw error;
    }
  }

  /**
   * Lista atividades de um cronograma
   */
  static async listScheduleActivities(
    scheduleId: string,
    options: {
      dayOfWeek?: number;
      type?: ActivityType;
      includeInactive?: boolean;
    } = {}
  ): Promise<ScheduleActivity[]> {
    try {
      // Usa apenas igualdade simples para evitar índice composto obrigatório no Firestore.
      // Filtragem e ordenação são feitas em memória.
      const q = query(
        collection(firestore, this.COLLECTION),
        where('scheduleTemplateId', '==', scheduleId)
      );

      const snapshot = await getDocs(q);
      let activities: ScheduleActivity[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as ScheduleActivity);
      });

      // Filtros em memória
      if (!options.includeInactive) {
        activities = activities.filter(a => a.isActive !== false);
      }
      if (options.dayOfWeek !== undefined) {
        activities = activities.filter(a => a.dayOfWeek === options.dayOfWeek);
      }
      if (options.type) {
        activities = activities.filter(a => a.type === options.type);
      }

      // Ordenação em memória
      activities.sort((a, b) =>
        a.dayOfWeek !== b.dayOfWeek
          ? a.dayOfWeek - b.dayOfWeek
          : (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );

      return activities;

    } catch (error: any) {
      console.error('Erro ao listar atividades:', error);
      throw error;
    }
  }

  /**
   * Valida configuração de atividade baseada no tipo
   */
  static validateActivityConfig(type: ActivityType, config: ActivityConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (type) {
      case 'quick':
        // Validação mínima para atividades rápidas
        if (!config || typeof config !== 'object') {
          errors.push('Configuração inválida para atividade rápida');
        }
        break;

      case 'text':
        const textConfig = config as any;
        if (textConfig.minWords && textConfig.maxWords) {
          if (textConfig.minWords > textConfig.maxWords) {
            errors.push('minWords não pode ser maior que maxWords');
          }
        }
        break;

      case 'quiz':
        const quizConfig = config as any;
        if (!Array.isArray(quizConfig.questions) || quizConfig.questions.length === 0) {
          errors.push('Quiz deve ter pelo menos uma pergunta');
        }
        if (typeof quizConfig.passingScore !== 'number' || quizConfig.passingScore < 0) {
          errors.push('Pontuação mínima deve ser um número positivo');
        }
        break;

      case 'video':
        const videoConfig = config as any;
        if (!videoConfig.url || !videoConfig.url.includes('http')) {
          errors.push('URL do vídeo inválida');
        }
        break;

      case 'checklist':
        const checklistConfig = config as any;
        if (!Array.isArray(checklistConfig.items) || checklistConfig.items.length === 0) {
          errors.push('Checklist deve ter pelo menos um item');
        }
        break;

      case 'file':
        const fileConfig = config as any;
        if (!Array.isArray(fileConfig.allowedTypes) || fileConfig.allowedTypes.length === 0) {
          errors.push('Deve especificar os tipos de arquivo permitidos');
        }
        if (typeof fileConfig.maxSizeMB !== 'number' || fileConfig.maxSizeMB <= 0) {
          errors.push('Tamanho máximo deve ser um número positivo');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gera preview de uma atividade
   */
  static generateActivityPreview(activity: ScheduleActivity): {
    title: string;
    description: string;
    estimatedTime: string;
    typeLabel: string;
    difficulty: string;
  } {
    const typeLabels: Record<ActivityType, string> = {
      'quick': 'Atividade Rápida',
      'text': 'Texto',
      'quiz': 'Quiz',
      'video': 'Vídeo',
      'checklist': 'Checklist',
      'file': 'Arquivo',
      'app': 'App',
      'physical_activity': 'Atividade Física'
    };

    const difficultyLabels: Record<string, string> = {
      'easy': 'Fácil',
      'medium': 'Médio',
      'hard': 'Difícil'
    };

    return {
      title: activity.title,
      description: activity.description || activity.instructions.substring(0, 100) + '...',
      estimatedTime: `${activity.metadata.estimatedDuration} min`,
      typeLabel: typeLabels[activity.type],
      difficulty: difficultyLabels[activity.metadata.difficulty]
    };
  }

  /**
   * Calcula pontos máximos de uma atividade
   */
  static calculateMaxPoints(activity: ScheduleActivity): number {
    let points = activity.scoring.pointsOnCompletion || 0;
    
    if (activity.scoring.bonusPoints) {
      points += activity.scoring.bonusPoints;
    }

    // Para quizzes, calcular pontos totais das questões
    if (activity.type === 'quiz') {
      const quizConfig = activity.config as any;
      if (quizConfig.questions) {
        const quizPoints = quizConfig.questions.reduce(
          (total: number, question: any) => total + (question.points || 0), 
          0
        );
        points += quizPoints;
      }
    }

    return points;
  }
}