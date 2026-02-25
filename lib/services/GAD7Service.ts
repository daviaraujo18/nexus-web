// lib\services\GAD7Service.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
  orderBy
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { GAD7Assessment, GAD7Response, GAD7Status } from '@/types/GAD7';
import { DateUtils } from '@/lib/utils/dateUtils';

export class GAD7Service {
  private static readonly COLLECTIONS = {
    ASSESSMENTS: 'gad7Assessments',
    STATUS: 'gad7Status'
  };

  static readonly ASSESSMENT_INTERVAL_WEEKS = 4; // 4 semanas = 1 mês

  // Perguntas GAD-7 em português (validadas)
  static readonly QUESTIONS = [
    {
      id: 1,
      question: "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 2,
      question: "Não ser capaz de parar ou controlar a preocupação",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 3,
      question: "Preocupar-se demasiado com diferentes coisas",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 4,
      question: "Dificuldade para relaxar",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 5,
      question: "Ficar tão inquieto(a) que não consegue ficar parado(a)",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 6,
      question: "Ficar facilmente aborrecido(a) ou irritado(a)",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    },
    {
      id: 7,
      question: "Sentir medo como se algo horrível fosse acontecer",
      options: [
        { value: 0, label: "Nenhuma vez" },
        { value: 1, label: "Vários dias" },
        { value: 2, label: "Mais da metade dos dias" },
        { value: 3, label: "Quase todos os dias" }
      ]
    }
  ];

  /**
   * Verifica se aluno precisa preencher GAD-7 esta semana
   */
  static async needsAssessment(studentId: string): Promise<boolean> {
    try {
      const statusRef = doc(firestore, this.COLLECTIONS.STATUS, studentId);
      const statusDoc = await getDoc(statusRef);

      const currentWeek = this.getCurrentWeekNumber();

      if (!statusDoc.exists()) {
        // Primeiro acesso - criar status e marcar como precisa
        await this.createInitialStatus(studentId);
        return true;
      }

      const status = statusDoc.data() as GAD7Status;

      // Se NUNCA completou, precisa
      if (!status.lastCompletedWeek) {
        return true;
      }

      // ⭐ NOVA LÓGICA: Verificar se passaram 4 semanas desde a última avaliação
      const weeksSinceLastAssessment = currentWeek - status.lastCompletedWeek;
      const needsNewAssessment = weeksSinceLastAssessment >= this.ASSESSMENT_INTERVAL_WEEKS;

      console.log('📊 Verificação GAD-7:', {
        currentWeek,
        lastCompletedWeek: status.lastCompletedWeek,
        weeksSinceLastAssessment,
        needsNewAssessment,
        interval: this.ASSESSMENT_INTERVAL_WEEKS
      });

      return needsNewAssessment;

    } catch (error) {
      console.error('Erro ao verificar necessidade de avaliação:', error);
      return true; // Em caso de erro, pedir para preencher
    }
  }

  /**
  * Cria status inicial para aluno - NOVO
  */
  private static async createInitialStatus(studentId: string): Promise<void> {
    try {
      const status: GAD7Status = {
        studentId,
        needsAssessment: true,
        lastReminder: new Date()
      };

      await setDoc(doc(firestore, this.COLLECTIONS.STATUS, studentId), {
        ...status,
        lastReminder: serverTimestamp()
      });
    } catch (error) {
      console.error('Erro ao criar status inicial:', error);
    }
  }

  /**
   * Salva uma avaliação GAD-7
   */
  static async saveAssessment(
    studentId: string,
    responses: GAD7Response
  ): Promise<string> {
    try {
      // Validar respostas
      const allQuestionsAnswered = this.QUESTIONS.every(q =>
        responses[q.id] !== undefined
      );

      if (!allQuestionsAnswered) {
        throw new Error('Por favor, responda todas as perguntas');
      }

      // Calcular pontuação
      const totalScore = this.QUESTIONS.reduce(
        (sum, q) => sum + (responses[q.id] || 0),
        0
      );

      const severity = this.calculateSeverity(totalScore);
      const currentWeek = this.getCurrentWeekNumber();
      
      // NOVO: Calcular em qual "mês" estamos (agrupamento de 4 semanas)
      const monthGroup = Math.floor((currentWeek - 1) / this.ASSESSMENT_INTERVAL_WEEKS) + 1;

      const assessmentId = `gad7_${studentId}_month${monthGroup}_${Date.now()}`;

      const assessment: Omit<GAD7Assessment, 'id'> = {
        studentId,
        weekNumber: currentWeek,
        responses,
        totalScore,
        severity,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Salvar avaliação
      await setDoc(doc(firestore, this.COLLECTIONS.ASSESSMENTS, assessmentId), {
        ...assessment,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Atualizar status do aluno (agora com a semana atual)
      await this.updateStudentStatus(studentId, currentWeek);

      return assessmentId;

    } catch (error: any) {
      console.error('Erro ao salvar avaliação GAD-7:', error);
      throw error;
    }
  }

  /**
   * Atualiza status do aluno após completar avaliação
   */
  private static async updateStudentStatus(studentId: string, weekNumber: number): Promise<void> {
    try {
      const status: GAD7Status = {
        studentId,
        lastCompletedWeek: weekNumber,
        needsAssessment: false,
        lastReminder: new Date()
      };

      await setDoc(doc(firestore, this.COLLECTIONS.STATUS, studentId), {
        ...status,
        lastReminder: serverTimestamp()
      });

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  }

  /**
   * Obtém o número da semana atual no sistema
   */
  private static getCurrentWeekNumber(): number {
    const today = new Date();

    // Obter o primeiro dia do ano
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Obter a semana ISO (segunda-feira como início da semana)
    // Isso é padrão clínico e se alinha com seu sistema
    return this.getISOWeekNumber(today);
  }

  /**
 * Calcula número da semana ISO (segunda-feira como início da semana)
 * Compatível com padrões clínicos
 */
  private static getISOWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());

    // ISO week date weeks start on Monday
    const dayNr = (date.getDay() + 6) % 7;

    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    target.setDate(target.getDate() + 4 - dayNr);

    // Get first day of year
    const yearStart = new Date(target.getFullYear(), 0, 1);

    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return weekNo;
  }

  /**
   * Calcula severidade baseada na pontuação
   */
  private static calculateSeverity(score: number): GAD7Assessment['severity'] {
    if (score <= 4) return 'minimal';
    if (score <= 9) return 'mild';
    if (score <= 14) return 'moderate';
    return 'severe';
  }

  /**
   * Busca avaliações de um aluno (para profissionais futuramente)
   */
  static async getStudentAssessments(
    studentId: string,
    limitCount?: number
  ): Promise<GAD7Assessment[]> {
    try {
      let q = query(
        collection(firestore, this.COLLECTIONS.ASSESSMENTS),
        where('studentId', '==', studentId),
        where('isActive', '==', true),
        orderBy('weekNumber', 'desc')
      );

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const snapshot = await getDocs(q);
      const assessments: GAD7Assessment[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        assessments.push({
          id: doc.id,
          ...data,
          completedAt: data.completedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as GAD7Assessment);
      });

      return assessments;

    } catch (error: any) {
      console.error('Erro ao buscar avaliações:', error);
      throw error;
    }
  }

  /**
   * Marca lembrete para mostrar modal novamente
   */
  static async markReminder(studentId: string): Promise<void> {
    try {
      const ref = doc(firestore, this.COLLECTIONS.STATUS, studentId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // cria o status completo se não existir
        const status: GAD7Status = {
          studentId,
          needsAssessment: true,
          lastReminder: new Date()
        };

        await setDoc(ref, {
          ...status,
          lastReminder: serverTimestamp()
        });
      } else {
        await setDoc(
          ref,
          { lastReminder: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Erro ao marcar lembrete:', error);
    }
  }
}