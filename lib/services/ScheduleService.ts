// lib/services/ScheduleService.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import {
  ScheduleTemplate,
  ScheduleActivity,
  CreateScheduleDTO,
  CreateActivityDTO,
  ScheduleCategory
} from '@/types/schedule';
import { ValidationUtils } from '@/lib/utils/validationUtils';

const DEBUG = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';
function debugLog(...args: any[]) { if (DEBUG) console.log(...args); }

// * Serviço responsável pela gestão de cronogramas (templates).
// *
// * Responsabilidades:
// * - Criar e editar templates de cronogramas
// * - Gerenciar atividades associadas ao template
// * - Controlar ciclo de vida (ativo, arquivado, deletado)
// * - Preservar integridade dos dados dos alunos ao alterar/remover cronogramas
// *
// * ⚠️ IMPORTANTE:
// * Este serviço impacta diretamente:
// * - criação de atividades
// * - geração de instâncias
// * - dados históricos do aluno (activityProgress)
// *
// * Qualquer alteração aqui pode afetar:
// * - execução de atividades
// * - analytics
// * - progresso do aluno
export class ScheduleService {
  private static readonly COLLECTIONS = {
    TEMPLATES: 'weeklySchedules',
    ACTIVITIES: 'scheduleActivities',
    INSTANCES: 'scheduleInstances',
    PROGRESS: 'activityProgress'
  };

  // * Cria um novo template de cronograma com suas atividades.
  // *
  // * Fluxo:
  // * 1. Valida dados de entrada
  // * 2. Sanitiza dados
  // * 3. Calcula métricas do cronograma
  // * 4. Gera ID único
  // * 5. Persiste template
  // * 6. Cria atividades associadas
  // *
  // * ⚠️ Side effects:
  // * - Escrita em coleção de templates
  // * - Escrita em coleção de atividades
  // *
  // * ⚠️ Risco:
  // * - Não usa transação entre template e activities → possível inconsistência parcial
  static async createScheduleTemplate(
    professionalId: string,
    data: CreateScheduleDTO
  ): Promise<{
    scheduleId: string;
    activityIds: string[];
    metadata: any;
  }> {
    try {
      const validation = ValidationUtils.validateScheduleData(data);
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      const sanitizedData = ValidationUtils.sanitizeScheduleData(data);
      const metrics = this.calculateScheduleMetrics(sanitizedData.activities);
      const scheduleId = this.generateScheduleId(professionalId, sanitizedData.name);

      const scheduleData: Omit<ScheduleTemplate, 'id'> = {
        professionalId,
        name: sanitizedData.name,
        description: sanitizedData.description,
        category: sanitizedData.category,
        startDate: sanitizedData.startDate,
        endDate: sanitizedData.endDate,
        activeDays: sanitizedData.activeDays,
        repeatRules: {
          type: 'weekly',
          resetOnRepeat: sanitizedData.repeatRules.resetOnRepeat,
        },
        metadata: {
          version: 1,
          estimatedWeeklyHours: metrics.estimatedWeeklyHours,
          totalActivities: metrics.totalActivities,
          tags: metrics.tags,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      await setDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId), {
        ...scheduleData,
        startDate: Timestamp.fromDate(sanitizedData.startDate),
        endDate: sanitizedData.endDate ? Timestamp.fromDate(sanitizedData.endDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const activityIds = await this.createActivities(scheduleId, sanitizedData.activities);
      return { scheduleId, activityIds, metadata: metrics };

    } catch (error: any) {
      throw new Error(`Falha ao criar cronograma: ${error.message}`);
    }
  }

  // * Atualiza um template de cronograma e substitui completamente suas atividades.
  // *
  // * Estratégia adotada:
  // * - Atualiza o template principal
  // * - REMOVE todas as atividades antigas
  // * - CRIA novas atividades do zero
  // *
  // * ⚠️ DECISÃO IMPORTANTE:
  // * Não há "diff" entre atividades → sempre recria tudo
  // *
  // * Benefício:
  // * - Simplicidade
  // *
  // * Risco:
  // * - Perda de referência de IDs antigos
  // * - Se usado em conjunto com instâncias já geradas, pode causar inconsistência
  // *
  // * ⚠️ Usa writeBatch:
  // * - Garante atomicidade ENTRE as operações dentro do batch
  // * - Mas não protege contra leitura concorrente externa
  static async updateScheduleTemplate(
    scheduleId: string,
    professionalIdOrData: string | CreateScheduleDTO,
    data?: CreateScheduleDTO
  ): Promise<void> {
    const resolvedData: CreateScheduleDTO = data ?? (professionalIdOrData as CreateScheduleDTO);
    debugLog(`🔥 [SERVICE] Atualizando Cronograma: ${scheduleId}`);
    try {
      const validation = ValidationUtils.validateScheduleData(resolvedData);
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      const sanitizedData = ValidationUtils.sanitizeScheduleData(resolvedData);
      const metrics = this.calculateScheduleMetrics(sanitizedData.activities);

      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
      const batch = writeBatch(firestore);

      // 1. Atualizar o Documento Principal (Template)
      debugLog(`📝 Preparando payload do template...`);
      batch.update(templateRef, {
        name: sanitizedData.name,
        description: sanitizedData.description,
        category: sanitizedData.category,
        startDate: Timestamp.fromDate(sanitizedData.startDate),
        endDate: sanitizedData.endDate ? Timestamp.fromDate(sanitizedData.endDate) : null,
        activeDays: sanitizedData.activeDays,
        'repeatRules.resetOnRepeat': sanitizedData.repeatRules.resetOnRepeat,
        'metadata.estimatedWeeklyHours': metrics.estimatedWeeklyHours,
        'metadata.totalActivities': metrics.totalActivities,
        'metadata.tags': metrics.tags,
        updatedAt: serverTimestamp()
      });

      // * Remove TODAS as atividades anteriores vinculadas ao template.
      // *
      // * ⚠️ Importante:
      // * - Essa abordagem descarta completamente a versão anterior
      // * - Não mantém histórico de alterações
      // *
      // * ⚠️ Risco:
      // * - Se houver instâncias já geradas, elas continuarão referenciando versões antigas
      debugLog(`🧹 Buscando atividades antigas para limpeza...`);
      const oldActivitiesQuery = query(
        collection(firestore, this.COLLECTIONS.ACTIVITIES),
        where('scheduleTemplateId', '==', scheduleId)
      );
      const oldActivitiesSnap = await getDocs(oldActivitiesQuery);
      
      oldActivitiesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      debugLog(`🗑️ ${oldActivitiesSnap.docs.length} atividades antigas removidas do lote.`);

      // * Recria todas as atividades do template.
      // *
      // * Estratégia:
      // * - Todas as atividades antigas já foram removidas
      // * - Novas atividades são criadas do zero
      // * - IDs incluem timestamp para evitar colisão
      // *
      // * ⚠️ Consequência:
      // * - IDs antigos são descartados
      // * - Não há versionamento de atividades
      // * - Qualquer referência externa aos IDs antigos se perde
      // *
      // * ⚠️ Impacto:
      // * - Instâncias já geradas continuam com snapshots antigos
      // * - Alterações não propagam retroativamente para atividades já atribuídas
      debugLog(`➕ Adicionando ${sanitizedData.activities.length} atividades novas ao lote...`);

      sanitizedData.activities.forEach((a, i) => {
        const actId = `${scheduleId}_act_${i}_${Date.now()}`; // Adiciona timestamp pra garantir ID único
        const actRef = doc(firestore, this.COLLECTIONS.ACTIVITIES, actId);
        batch.set(actRef, {
          scheduleTemplateId: scheduleId,
          ...a,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true
        });
      });

      // 4. Executa a transação no banco
      debugLog(`🚀 Disparando transação no banco...`);
      await batch.commit();

      debugLog(`✅ Cronograma ${scheduleId} atualizado com sucesso!`);
      debugLog();
    } catch (error: any) {
      console.error('❌ Erro na atualização do cronograma:', error);
      debugLog();
      throw new Error(`Falha ao atualizar cronograma: ${error.message}`);
    }
  }

  // * Exclusão segura de cronograma.
  // *
  // * Estratégia:
  // * - NÃO deleta dados
  // * - Apenas desativa e arquiva
  // *
  // * Regra de ouro:
  // * Dados do aluno NUNCA são perdidos.
  // *
  // * Fluxo:
  // * 1. Marca template como deletado
  // * 2. Desativa instâncias
  // * 3. Trata atividades de progresso
  // *
  // * ⚠️ Comportamento crítico:
  // * - Atividades concluídas NÃO são alteradas
  // * - Apenas são ocultadas do cronograma ativo
  // *
  // * Benefício:
  // * - Preserva histórico do aluno
  // * - Mantém integridade para analytics
  static async deleteSchedule(scheduleId: string, professionalId: string): Promise<void> {
    try {
      debugLog(`🛡️ Iniciando desativação segura do cronograma: ${scheduleId}`);
      const batch = writeBatch(firestore);

      // 1. Marcar Template como deletado (mas mantém o documento)
      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
      batch.update(templateRef, {
        status: 'deleted',
        isActive: false,
        isDeleted: true,
        deletedAt: serverTimestamp()
      });

      // 2. Buscar instâncias para desativar visualização
      const instancesQuery = query(
        collection(firestore, this.COLLECTIONS.INSTANCES),
        where('scheduleTemplateId', '==', scheduleId)
      );
      const instancesSnap = await getDocs(instancesQuery);
      
      for (const instanceDoc of instancesSnap.docs) {
        batch.update(instanceDoc.ref, {
          isActive: false,
          status: 'archived', // Mudamos para arquivado para indicar que os dados existem
          updatedAt: serverTimestamp()
        });

        // 3. Tratar as atividades de progresso (Filhos)
        const progressQuery = query(
          collection(firestore, this.COLLECTIONS.PROGRESS),
          where('scheduleInstanceId', '==', instanceDoc.id)
        );
        const progressSnap = await getDocs(progressQuery);
        
        progressSnap.forEach(pDoc => {
          const pData = pDoc.data();
          
          // * ⚠️ REGRA CRÍTICA DE NEGÓCIO:
          // *
          // * Se a atividade já possui dados do aluno:
          // * - NÃO deletar
          // * - NÃO alterar status crítico
          // *
          // * Apenas:
          // * - remover da visualização ativa
          // *
          // * Motivo:
          // * - preservar histórico
          // * - manter consistência de relatórios
          if (pData.status === 'completed' || pData.executionData) {
             batch.update(pDoc.ref, {
                isActive: false, // Tira do cronograma ativo
                hiddenFromSchedule: true, // Flag para relatórios saberem que foi de um cronograma removido
                updatedAt: serverTimestamp()
             });
          } else {
             // Se era uma atividade pendente sem nenhum dado, podemos marcar como cancelada
             batch.update(pDoc.ref, {
                isActive: false,
                status: 'cancelled',
                updatedAt: serverTimestamp()
             });
          }
        });
      }

      await batch.commit();
      debugLog(`✅ Cronograma desativado. Dados de evolução preservados.`);

    } catch (error: any) {
      console.error('❌ Erro na desativação segura:', error);
      throw error;
    }
  }

  // * Alterna estado entre ativo e arquivado com propagação completa.
  // *
  // * Ao ARQUIVAR: desativa instâncias + oculta activityProgress.
  // * Ao RESTAURAR: apenas reativa o template — histórico não é reativado.
    // * Alterna estado entre ativo e arquivado com propagação completa.
  // *
  // * Ao ARQUIVAR: desativa instâncias + oculta activityProgress.
  // * Ao RESTAURAR: apenas reativa o template — histórico não é reativado.
  static async archiveSchedule(scheduleId: string, professionalId: string, role?: string): Promise<void> {
    try {
      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
      const snap = await getDoc(templateRef);

      if (!snap.exists()) {
        throw new Error('Cronograma não encontrado');
      }

      const templateData = snap.data();

      if (role !== 'coordinator' && templateData.professionalId !== professionalId) {
        throw new Error('Você não tem permissão para arquivar este cronograma');
      }

      const isCurrentlyActive = templateData.isActive !== false;

      if (!isCurrentlyActive) {
        // --- RESTAURAR: apenas o template ---
        await updateDoc(templateRef, {
          isActive: true,
          status: 'active',
          updatedAt: serverTimestamp()
        });

        console.log(
          `✅ [ARCHIVE] Cronograma ${scheduleId} restaurado. Instâncias/progress históricos não reativados.`
        );
        return;
      }

      // --- ARQUIVAR: propagar para instâncias e activityProgress ---
      debugLog(`🗄️ [ARCHIVE] Arquivando cronograma ${scheduleId} com propagação...`);

      const CHUNK = 490;
      let ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

      const flush = async () => {
        if (ops.length === 0) return;

        const chunks: Array<typeof ops> = [];

        for (let i = 0; i < ops.length; i += CHUNK) {
          chunks.push(ops.slice(i, i + CHUNK));
        }

        await Promise.all(
          chunks.map(chunk => {
            const batch = writeBatch(firestore);
            chunk.forEach(operation => operation(batch));
            return batch.commit();
          })
        );

        ops = [];
      };

      ops.push(batch =>
        batch.update(templateRef, {
          isActive: false,
          status: 'archived',
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      );

      const instancesSnap = await getDocs(
        query(
          collection(firestore, this.COLLECTIONS.INSTANCES),
          where('scheduleTemplateId', '==', scheduleId)
        )
      );

      debugLog(`📦 [ARCHIVE] ${instancesSnap.size} instâncias encontradas.`);

      for (const instanceDoc of instancesSnap.docs) {
        ops.push(batch =>
          batch.update(instanceDoc.ref, {
            isActive: false,
            status: 'archived',
            archivedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        );

        const progressSnap = await getDocs(
          query(
            collection(firestore, this.COLLECTIONS.PROGRESS),
            where('scheduleInstanceId', '==', instanceDoc.id)
          )
        );

        for (const pDoc of progressSnap.docs) {
          const pData = pDoc.data();
          const hasStudentData = pData.status === 'completed' || Boolean(pData.executionData);

          if (hasStudentData) {
            ops.push(batch =>
              batch.update(pDoc.ref, {
                isActive: false,
                hiddenFromSchedule: true,
                archivedWithSchedule: true,
                updatedAt: serverTimestamp()
              })
            );
          } else {
            ops.push(batch =>
              batch.update(pDoc.ref, {
                isActive: false,
                status: 'cancelled',
                hiddenFromSchedule: true,
                archivedWithSchedule: true,
                updatedAt: serverTimestamp()
              })
            );
          }

          if (ops.length >= CHUNK * 4) {
            await flush();
          }
        }
      }

      await flush();

      debugLog(`✅ [ARCHIVE] Cronograma ${scheduleId} arquivado. Dados históricos preservados.`);
    } catch (error: any) {
      console.error('❌ [ARCHIVE] Erro ao arquivar/restaurar cronograma:', error);
      throw new Error(`Falha ao arquivar/restaurar cronograma: ${error.message}`);
    }
  }

  // * Busca um template de cronograma.
  // *
  // * Opção:
  // * - includeActivities → carrega atividades associadas
  // *
  // * ⚠️ Performance:
  // * - includeActivities = true → gera query adicional
  static async getScheduleTemplate(scheduleId: string, includeActivities = false): Promise<ScheduleTemplate & { activities?: ScheduleActivity[] }> {
    const docRef = doc(firestore, this.COLLECTIONS.TEMPLATES, scheduleId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Não encontrado');
    const data = snap.data();
    const schedule = { id: snap.id, ...data, startDate: data.startDate?.toDate(), endDate: data.endDate?.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as ScheduleTemplate;
    if (includeActivities) {
      const activities = await this.getScheduleActivities(scheduleId);
      return { ...schedule, activities };
    }
    return schedule;
  }
  
  // * Lista cronogramas de um profissional.
  // *
  // * Regras aplicadas:
  // * - Ignora cronogramas deletados
  // * - Ordena por data de criação (mais recente primeiro)
  // *
  // * ⚠️ Observação:
  // * - Filtro de categoria/ativo ainda não está sendo aplicado na query (apenas pós-processamento)
  static async listProfessionalSchedules(professionalId: string, options: { category?: ScheduleCategory; activeOnly?: boolean; limit?: number; role?: string; } = {}): Promise<ScheduleTemplate[]> {
    // Coordinator vê apenas os próprios cronogramas (igual a outros profissionais).
    // O acesso ampliado do coordinator (arquivar/deletar/atribuir cronogramas alheios) é tratado
    // nas operações específicas, não na listagem.
    const q = query(collection(firestore, this.COLLECTIONS.TEMPLATES), where('professionalId', '==', professionalId));
    const snap = await getDocs(q);
    const schedules: ScheduleTemplate[] = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.isDeleted) return;
      schedules.push({ id: doc.id, ...d, startDate: d.startDate?.toDate(), endDate: d.endDate?.toDate(), createdAt: d.createdAt?.toDate(), updatedAt: d.updatedAt?.toDate() } as ScheduleTemplate);
    });
    schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return options.limit ? schedules.slice(0, options.limit) : schedules;
  }

  // * Cria atividades em lote usando writeBatch.
  // *
  // * Benefício:
  // * - Escrita eficiente
  // *
  // * ⚠️ Limitação:
  // * - ID determinístico baseado em index
  // * - Pode gerar conflito em edições futuras
  private static async createActivities(scheduleId: string, activities: CreateActivityDTO[]): Promise<string[]> {
    const batch = writeBatch(firestore);
    const ids: string[] = [];
    activities.forEach((a, i) => {
      const id = `${scheduleId}_act_${i}`;
      const ref = doc(firestore, this.COLLECTIONS.ACTIVITIES, id);
      batch.set(ref, { scheduleTemplateId: scheduleId, ...a, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), isActive: true });
      ids.push(id);
    });
    await batch.commit();
    return ids;
  }

  private static async getScheduleActivities(scheduleId: string): Promise<ScheduleActivity[]> {
    const q = query(collection(firestore, this.COLLECTIONS.ACTIVITIES), where('scheduleTemplateId', '==', scheduleId), where('isActive', '==', true));
    const snap = await getDocs(q);
    const acts: ScheduleActivity[] = [];
    snap.forEach(d => acts.push({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() } as ScheduleActivity));
    return acts.sort((a, b) => a.dayOfWeek === b.dayOfWeek ? a.orderIndex - b.orderIndex : a.dayOfWeek - b.dayOfWeek);
  }

  // * Calcula métricas agregadas do cronograma.
  // *
  // * Retorna:
  // * - total de atividades
  // * - horas estimadas por semana
  // * - tags derivadas das atividades
  // *
  // * ⚠️ Importante:
  // * - estimativa baseada em metadata → depende da qualidade dos dados de entrada
  private static calculateScheduleMetrics(activities: CreateActivityDTO[]) {
    const total = activities.length;
    const hours = activities.reduce((t, a) => t + (a.metadata.estimatedDuration || 30), 0) / 60;
    const tags = Array.from(new Set(activities.flatMap(a => [...(a.metadata.therapeuticFocus || []), ...(a.metadata.educationalFocus || [])]))).filter(Boolean);
    return { totalActivities: total, estimatedWeeklyHours: parseFloat(hours.toFixed(1)), tags };
  }

  // * Gera ID único do cronograma.
  // *
  // * Estrutura:
  // * - prefixo do profissional
  // * - nome sanitizado
  // * - timestamp
  // *
  // * ⚠️ Risco:
  // * - não garante unicidade absoluta (mas colisão é improvável)
  private static generateScheduleId(profId: string, name: string): string {
    return `${profId.substring(0, 8)}_${name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)}_${Date.now()}`;
  }
}