// lib/services/StudentService.ts
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  DocumentData,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  documentId,
  runTransaction,
  QueryConstraint
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { Student, StudentProfile, UserRole } from '@/types/auth';

export class StudentService {
  private static readonly COLLECTIONS = {
    STUDENTS: 'students',
    PROFESSIONALS: 'professionals'
  };

  /**
 * Obtém um aluno específico por ID com validação de permissões
 */
  static async getStudentById(
    studentId: string,
    requestingProfessionalId: string
  ): Promise<Student> {
    try {
      // Buscar aluno
      const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
      const studentDoc = await getDoc(studentRef);

      if (!studentDoc.exists()) {
        throw new Error('Aluno não encontrado');
      }

      const studentData = studentDoc.data();

      // Verificar se é realmente um aluno
      if (studentData.role !== 'student') {
        throw new Error('O usuário não é um aluno');
      }

      // Buscar profissional para verificar permissões
      const professionalRef = doc(firestore, 'professionals', requestingProfessionalId);
      const professionalDoc = await getDoc(professionalRef);

      if (!professionalDoc.exists()) {
        throw new Error('Profissional não encontrado');
      }

      const professionalData = professionalDoc.data();

      // Verificar permissões:
      // 1. Coordenadores podem acessar qualquer aluno
      // 2. Outros profissionais só se estiverem na lista assignedProfessionals
      if (professionalData.role === 'coordinator') {
        // Permissão concedida para coordenador
      } else if (!studentData.profile?.assignedProfessionals?.includes(requestingProfessionalId)) {
        throw new Error('Você não tem permissão para acessar este aluno');
      }

      // Converter timestamps
      return {
        id: studentDoc.id,
        email: studentData.email,
        name: studentData.name,
        role: studentData.role,
        isActive: studentData.isActive ?? true,
        profileComplete: studentData.profileComplete ?? false,
        createdAt: studentData.createdAt?.toDate() ?? new Date(),
        updatedAt: studentData.updatedAt?.toDate() ?? new Date(),
        lastLoginAt: studentData.lastLoginAt?.toDate(),
        profile: {
          cpf: studentData.profile?.cpf || '',
          birthday: studentData.profile?.birthday?.toDate() ?? undefined,
          phone: studentData.profile?.phone,
          school: studentData.profile?.school || '',
          grade: studentData.profile?.grade || '',
          parentName: studentData.profile?.parentName,
          parentEmail: studentData.profile?.parentEmail,
          parentPhone: studentData.profile?.parentPhone,
          assignedProfessionals: studentData.profile?.assignedProfessionals || [],
          assignedPrograms: studentData.profile?.assignedPrograms || [],
          streak: studentData.profile?.streak || 0,
          totalPoints: studentData.profile?.totalPoints || 0,
          level: studentData.profile?.level || 1,
          achievements: studentData.profile?.achievements || [],
          medicalInfo: studentData.profile?.medicalInfo,
          address: studentData.profile?.address
        }
      } as Student;

    } catch (error: any) {
      console.error('Erro ao buscar aluno por ID:', error);
      throw new Error(error.message || 'Não foi possível carregar o aluno');
    }
  }

  /**
 * Atribui um aluno a um profissional
 */
  static async assignStudentToProfessional(
    studentId: string,
    professionalId: string
  ): Promise<void> {
    try {
      const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
      const professionalRef = doc(firestore, 'professionals', professionalId);

      await runTransaction(firestore, async (transaction) => {
        const [studentSnap, professionalSnap] = await Promise.all([
          transaction.get(studentRef),
          transaction.get(professionalRef)
        ]);

        if (!studentSnap.exists()) {
          throw new Error('Aluno não encontrado');
        }

        if (!professionalSnap.exists()) {
          throw new Error('Profissional não encontrado');
        }

        const studentData = studentSnap.data();
        const professionalData = professionalSnap.data();

        if (studentData.role !== 'student') {
          throw new Error('Usuário não é um aluno');
        }

        if (!professionalData.profile?.canManageStudents && professionalData.role !== 'coordinator') {
          throw new Error('Profissional não pode gerenciar alunos');
        }

        const currentAssigned = studentData.profile?.assignedProfessionals || [];
        if (currentAssigned.includes(professionalId)) {
          throw new Error('Aluno já está atribuído a este profissional');
        }

        transaction.update(studentRef, {
          'profile.assignedProfessionals': arrayUnion(professionalId),
          updatedAt: new Date()
        });

        transaction.update(professionalRef, {
          'profile.assignedStudents': arrayUnion(studentId),
          updatedAt: new Date()
        });
      });

      console.log(`Aluno ${studentId} atribuído ao profissional ${professionalId}`);

    } catch (error: any) {
      console.error('Erro ao atribuir aluno:', error);
      throw new Error(error.message || 'Não foi possível atribuir o aluno');
    }
  }

  /**
   * Remove um aluno da lista de um profissional
   */
  static async removeStudentFromProfessional(
    studentId: string,
    professionalId: string
  ): Promise<void> {
    try {
      const studentRef = doc(firestore, this.COLLECTIONS.STUDENTS, studentId);
      const professionalRef = doc(firestore, 'professionals', professionalId);

      await runTransaction(firestore, async (transaction) => {
        const [studentSnap, professionalSnap] = await Promise.all([
          transaction.get(studentRef),
          transaction.get(professionalRef)
        ]);

        if (!studentSnap.exists()) {
          throw new Error('Aluno não encontrado');
        }

        if (!professionalSnap.exists()) {
          throw new Error('Profissional não encontrado');
        }

        const studentData = studentSnap.data();
        const professionalData = professionalSnap.data();

        const currentAssigned = studentData.profile?.assignedProfessionals || [];
        if (!currentAssigned.includes(professionalId)) {
          throw new Error('Aluno não está atribuído a este profissional');
        }

        transaction.update(studentRef, {
          'profile.assignedProfessionals': arrayRemove(professionalId),
          updatedAt: new Date()
        });

        transaction.update(professionalRef, {
          'profile.assignedStudents': arrayRemove(studentId),
          updatedAt: new Date()
        });
      });

      console.log(`Aluno ${studentId} removido do profissional ${professionalId}`);

    } catch (error: any) {
      console.error('Erro ao remover aluno:', error);
      throw new Error(error.message || 'Não foi possível remover o aluno');
    }
  }

  /**
   * Atribui múltiplos alunos a um profissional (em massa)
   */
  static async bulkAssignStudents(
    studentIds: string[],
    professionalId: string
  ): Promise<{ success: string[]; failed: Array<{ studentId: string; error: string }> }> {
    const settled = await Promise.allSettled(
      studentIds.map(studentId => this.assignStudentToProfessional(studentId, professionalId).then(() => studentId))
    );

    return settled.reduce<{ success: string[]; failed: Array<{ studentId: string; error: string }> }>(
      (acc, result, i) => {
        if (result.status === 'fulfilled') {
          acc.success.push(result.value);
        } else {
          acc.failed.push({ studentId: studentIds[i], error: (result.reason as any)?.message || 'Erro desconhecido' });
        }
        return acc;
      },
      { success: [], failed: [] }
    );
  }

  /**
   * Remove múltiplos alunos de um profissional (em massa)
   */
  static async bulkRemoveStudents(
    studentIds: string[],
    professionalId: string
  ): Promise<{ success: string[]; failed: Array<{ studentId: string; error: string }> }> {
    const settled = await Promise.allSettled(
      studentIds.map(studentId => this.removeStudentFromProfessional(studentId, professionalId).then(() => studentId))
    );

    return settled.reduce<{ success: string[]; failed: Array<{ studentId: string; error: string }> }>(
      (acc, result, i) => {
        if (result.status === 'fulfilled') {
          acc.success.push(result.value);
        } else {
          acc.failed.push({ studentId: studentIds[i], error: (result.reason as any)?.message || 'Erro desconhecido' });
        }
        return acc;
      },
      { success: [], failed: [] }
    );
  }

  /**
   * Obtém alunos baseado nas permissões do profissional
   */
  static async getStudentsByProfessionalOrAll(
    professionalId: string,
    professionalRole: UserRole,
    options?: {
      activeOnly?: boolean;
      filters?: {
        grade?: string;
        school?: string;
      };
      search?: string;
      limit?: number;
    }
  ): Promise<Student[]> {
    try {
      const studentsRef = collection(firestore, this.COLLECTIONS.STUDENTS);

      if (professionalRole === 'coordinator') {
        // Coordenador: Buscar TODOS os alunos do sistema
        console.log('📋 Coordenador acessando TODOS os alunos do sistema');

        const constraints: QueryConstraint[] = [where('role', '==', 'student')];
        if (options?.activeOnly !== false) {
          constraints.push(where('isActive', '==', true));
        }
        let q = query(studentsRef, ...constraints);

        if (options?.filters?.grade) {
          q = query(q, where('profile.grade', '==', options.filters.grade));
        }

        if (options?.filters?.school) {
          q = query(q, where('profile.school', '==', options.filters.school));
        }

        if (options?.limit) {
          q = query(q, limit(options.limit));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            profile: {
              ...data.profile,
              birthday: data.profile?.birthday?.toDate()
            }
          } as Student;
        });
      } else {
        // Outros profissionais: Buscar apenas alunos atribuídos a eles
        console.log('📋 Profissional acessando seus alunos atribuídos');

        const constraints: QueryConstraint[] = [
          where('role', '==', 'student'),
          where('profile.assignedProfessionals', 'array-contains', professionalId)
        ];
        if (options?.activeOnly !== false) {
          constraints.push(where('isActive', '==', true));
        }
        let q = query(studentsRef, ...constraints);

        if (options?.filters?.grade) {
          q = query(q, where('profile.grade', '==', options.filters.grade));
        }

        if (options?.filters?.school) {
          q = query(q, where('profile.school', '==', options.filters.school));
        }

        if (options?.limit) {
          q = query(q, limit(options.limit));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            profile: {
              ...data.profile,
              birthday: data.profile?.birthday?.toDate()
            }
          } as Student;
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar alunos:', error);
      throw new Error('Não foi possível carregar os alunos');
    }
  }

  /**
   * Busca alunos atribuídos a um profissional
   */
  static async getStudentsByProfessional(
    professionalId: string,
    options: {
      activeOnly?: boolean;
      limit?: number;
      search?: string;
      filters?: {
        grade?: string;
        school?: string;
      };
    } = {}
  ): Promise<Student[]> {
    try {
      // 1. Buscar professional para obter lista de alunos atribuídos
      const professionalRef = doc(firestore, this.COLLECTIONS.PROFESSIONALS, professionalId);
      const professionalDoc = await getDoc(professionalRef);

      if (!professionalDoc.exists()) {
        throw new Error('Profissional não encontrado');
      }

      const professionalData = professionalDoc.data();
      const assignedStudentIds = professionalData.profile?.assignedStudents || [];

      if (assignedStudentIds.length === 0) {
        return [];
      }

      // 2. Buscar alunos em lote
      const students: Student[] = [];

      // Buscar em batches de 30 (limite do Firestore 'in')
      const batchSize = 30;
      for (let i = 0; i < assignedStudentIds.length; i += batchSize) {
        const batchIds = assignedStudentIds.slice(i, i + batchSize);

        let q = query(
          collection(firestore, this.COLLECTIONS.STUDENTS),
          where(documentId(), 'in', batchIds)
        );

        if (options.activeOnly) {
          q = query(q, where('isActive', '==', true));
        }

        if (options.filters?.grade) {
          q = query(q, where('profile.grade', '==', options.filters.grade));
        }

        if (options.filters?.school) {
          q = query(q, where('profile.school', '==', options.filters.school));
        }

        if (options.limit) {
          const remaining = options.limit - students.length;
          if (remaining <= 0) break;
          q = query(q, limit(remaining));
        }

        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
          const data = doc.data();
          students.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            lastLoginAt: data.lastLoginAt?.toDate(),
            profile: {
              ...data.profile,
              birthday: data.profile?.birthday?.toDate()
            }
          } as Student);
        });

        if (options.limit && students.length >= options.limit) {
          break;
        }
      }

      // 3. Ordenar em memória (documentId() impede orderBy no Firestore)
      students.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      // 4. Aplicar filtro de busca se necessário
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        return students.filter(student =>
          student.name.toLowerCase().includes(searchLower) ||
          student.email.toLowerCase().includes(searchLower) ||
          student.profile.school.toLowerCase().includes(searchLower)
        );
      }

      return students;

    } catch (error: any) {
      console.error('Erro ao buscar alunos do profissional:', error);
      throw error;
    }
  }

  /**
   * Verifica se aluno já tem cronograma ativo
   */
  static async hasActiveSchedule(studentId: string, scheduleTemplateId: string): Promise<boolean> {
    console.log(`📋 [hasActiveSchedule] Verificando aluno ${studentId} no cronograma ${scheduleTemplateId}`);

    try {
      const q = query(
        collection(firestore, 'scheduleInstances'),
        where('studentId', '==', studentId),
        where('scheduleTemplateId', '==', scheduleTemplateId),
        where('status', 'in', ['active', 'paused']),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);

      const temAtivo = !snapshot.empty;
      console.log(`   Resultado: ${temAtivo ? 'TEM cronograma ativo' : 'NÃO tem cronograma ativo'}`);

      if (temAtivo && snapshot.docs.length > 0) {
        console.log(`   Detalhes da instância ativa:`);
        snapshot.docs.forEach(doc => {
          console.log(`     • Instância ID: ${doc.id}`);
          console.log(`     • Status: ${doc.data().status}`);
          console.log(`     • Data início: ${doc.data().startedAt?.toDate()}`);
        });
      }

      return temAtivo;
    } catch (error) {
      console.error(`❌ Erro ao verificar cronograma ativo para aluno ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Busca estatísticas rápidas do aluno
   */
  static async getStudentStats(studentId: string): Promise<{
    totalPoints: number;
    streak: number;
    level: number;
    completionRate: number;
    hasActiveSchedule: boolean;
  }> {
    try {
      const studentDoc = await getDoc(doc(firestore, this.COLLECTIONS.STUDENTS, studentId));
      if (!studentDoc.exists()) {
        throw new Error('Aluno não encontrado');
      }

      const studentData = studentDoc.data();

      // Buscar instâncias ativas
      const instancesQuery = query(
        collection(firestore, 'scheduleInstances'),
        where('studentId', '==', studentId),
        where('status', 'in', ['active', 'paused']),
        where('isActive', '==', true)
      );

      const instancesSnapshot = await getDocs(instancesQuery);

      return {
        totalPoints: studentData.profile?.totalPoints || 0,
        streak: studentData.profile?.streak || 0,
        level: studentData.profile?.level || 1,
        completionRate: studentData.profile?.completionRate || 0,
        hasActiveSchedule: !instancesSnapshot.empty
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do aluno:', error);
      return {
        totalPoints: 0,
        streak: 0,
        level: 1,
        completionRate: 0,
        hasActiveSchedule: false
      };
    }
  }

  /**
   * Busca séries e escolas únicas dos alunos
   */
  static async getFiltersByProfessional(professionalId: string): Promise<{
    grades: string[];
    schools: string[];
  }> {
    try {
      const students = await this.getStudentsByProfessional(professionalId);

      const grades = Array.from(new Set(
        students.map(s => s.profile.grade).filter(Boolean)
      )).sort();

      const schools = Array.from(new Set(
        students.map(s => s.profile.school).filter(Boolean)
      )).sort();

      return { grades, schools };
    } catch (error) {
      console.error('Erro ao buscar filtros:', error);
      return { grades: [], schools: [] };
    }
  }
}