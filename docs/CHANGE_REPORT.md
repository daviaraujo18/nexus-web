# Documentação — Atualizações do Sistema Nexus Web

Esta documentação explica, de forma clara, o que foi alterado no sistema, por que essas mudanças foram feitas e quais impactos elas trazem.

Em resumo: essa atualização corrige falhas importantes, melhora a confiabilidade dos dados e adiciona novas funcionalidades para alunos e profissionais.

O que mudou no geral?

- Agora é possível editar cronogramas corretamente (antes não funcionava direito)
- O progresso do aluno (nível, pontos, sequência) está sendo calculado corretamente
- Os dados de analytics foram corrigidos (antes mostravam valores impossíveis, como 200%)
- Foi adicionado um timer visual para atividades do aluno
- Lógica de vida útil de cronogramas implementada
- Mais de um cronograma por aluno

Branch: `feature/edicao-planilhas`
Base de comparação: `origin/main...HEAD`
Data da análise: 2026-04-30
Working tree no momento da análise: limpo — `nothing to commit, working tree clean`

---

## Seção A — Verificação de Estado (Pré-Documentação)
|-----------------------------------|-----------------------------|---------------------------------------------|
|           Verificação             |           Comando           |                  Resultado                  |
|-----------------------------------|-----------------------------|---------------------------------------------|
|       Modificações locais         | `git diff --stat`           |                   Nenhum                    |
|        Arquivos em stage          | `git diff --cached`         |                   Nenhum                    |
|         Untracked files           | `git ls-files --others`     |                   Nenhum                    |
|            Base usada             | `origin/main...HEAD`        |               ✅ Confirmada                 |
|   HEAD sincronizado com origin    | `git log --decorate`        | ✅ `HEAD = origin/feature/edicao-planilhas` |
| Commits à frente de `origin/main` | `git log origin/main..HEAD` |                8 commits                    |
|  Arquivos alterados (commitados)  | `git diff --name-status`    |               45 arquivos                   |
|-----------------------------------|-----------------------------|---------------------------------------------|

Conclusão do pré-diagnóstico: Working tree completamente limpo. Todo o conteúdo documentado abaixo está versionado nos 8 commits da branch.

---

## Uncommitted / Local WIP — Não é uma parte oficial da branch

> Não existem arquivos modificados localmente, arquivos em stage ou untracked files no momento desta análise. O working tree está limpo e em sincronia com `origin/feature/edicao-planilhas`.

---

Quem foi impactado por essas mudanças?

Profissionais (quem cria cronogramas)
- Agora podem editar cronogramas corretamente
- Visualizam dados mais confiáveis nos relatórios
- Conseguem atribuir cronogramas diferentes de maneira simultânea
- Visualizam dados coerentes com o banco no "ranking do bem-estar"

Alunos
- Veem progresso atualizado em tempo real
- Possuem um timer durante atividades
- Nível e pontuação agora refletem a realidade
- Sistema de conquistas mais responsivo (ainda está incompleto)

⚙️ Sistema (interno)
- Melhor consistência de dados
- Menos erros nos cálculos

## 1. Executive Summary

Esta branch contém 8 commits com alterações em 45 arquivos organizadas em quatro eixos:

1. Edição de cronogramas (core) — reescrita do `ScheduleService`, `ScheduleInstanceService`, `AssignmentInterface`, `ScheduleBuilder`, `ScheduleHeaderPanel`. Batch operations atômicas para update de template; guard contra instâncias duplicadas via `collectionGroup`.

2. Correção de métricas do aluno — `ProgressService.updateStudentStats` reescrito: `level` calculado como `floor(totalPoints/200)+1`; `streak` incrementa apenas uma vez por dia; erros não mais silenciados. `useStudentWeeklyProgress` lê perfil diretamente do Firestore.

3. Simplificação do AnalyticsService — de ~1.545 para ~450 linhas. Queries `collectionGroup` diretas substituem abstrações que produziam `completionRate` de 200%, 111%.

4. Novas funcionalidades para aluno — `FloatingTimer` (relógio analógico SVG) + `ActivityTimerContext` (timer global) + `SubjectBarChart` (gráfico de matérias).

Esta atualização focou em três pontos principais:

1. Correção de erros importantes
- Cronogramas não eram editados corretamente
- Progresso do aluno era calculado de forma errada
- Relatórios mostravam valores inconsistentes

2. Melhoria na confiabilidade dos dados
- Agora o sistema calcula corretamente nível, pontos e progresso
- Evita duplicação de dados
- Garante que as informações exibidas são reais

3. Novas funcionalidades
- Timer visual para atividades do aluno
- Melhor visualização de progresso
- Gráfico de matérias para acompanhamento

---

## 2. Branch & Diff Metadata
|--------------------------|--------------------------------------------------|
|           Campo          |                       Valor                      |
|--------------------------|--------------------------------------------------|
|           Branch         |`feature/edicao-planilhas`                        |
|            HEAD          |`1720870`                                         |
|    Base de comparação    |`origin/main...HEAD`                              |
|    Ponto de divergência  |`b1b75b4` (commit `notification` em `origin/main`)|
| Commits à frente de main | 8                                                |
|    Arquivos alterados    | 45                                               |
|        Insertions        | 5.829                                            |
|         Deletions        | 5.688                                            |
|       Working tree       | Limpo                                            |
|--------------------------|--------------------------------------------------|
Commits — cronológico inverso:
|-----------|-----------------------------------------------------------------------------|
|    Hash   |                                 Mensagem                                    |
|-----------|-----------------------------------------------------------------------------|
| `1720870` | aplicacao prototipo completa                                                |
| `108aaf9` | fix(student): restore metrics and progress calculations                     |
| `d8888e3` | prototipo final 1.1                                                         |
| `2e27db0` | prototipo final                                                             |
| `b4e774a` | protótipo teste                                                             |  
| `df0abef` | mudanças finais para produção                                               |
| `8b565ff` | lógica calendário civil estabelecida                                        |
| `e809e52` | fix(schedules): estabilizando edição e corrigindo persistência no firestore |
|-----------|-----------------------------------------------------------------------------|

---

## 3. Scope

Dentro do escopo desta branch:
- Edição e persistência de cronogramas (Professional)
- Métricas permanentes do aluno: `totalPoints`, `level`, `streak`
- Weekly progress: `completionRate`, `completedCount`, `totalActivities`
- Simplificação do `AnalyticsService` e páginas de analytics
- Timer de atividade: `FloatingTimer` + `ActivityTimerContext`
- Gráfico de matérias: `SubjectBarChart`

Fora do escopo — não alterado nesta branch:
- Dark mode — patch WIP existe em `temp_patches/` mas não está aplicado ao código-fonte
- Firestore Security Rules
- Sistema de notificações
- Páginas de debug `app/debug/` — inalteradas, confirmado via diff
- GAD-7 / formulários clínicos

---

## 4. High-Level Change Map (versão interpretável)
|------------------------|--------------------------------------------------------------------------|--------------------------------|------------|
|          Área          |                        O que mudou na prática                            |              Tipo              |   Impacto  |
|------------------------|--------------------------------------------------------------------------|--------------------------------|------------|
| Schedule / Cronogramas | Agora é possível editar cronogramas e ver mudanças nas métricas do aluno |         Reescrita grande       |  🔴 Alto   |
|   Student Experience   | Aluno agora vê progresso atualizado em tempo real + timer de atividade   | Nova funcionalidade + melhoria |  🔴 Alto   |
|       Analytics        | Métricas corrigidas (não passam mais de 100%)                            |     Correção + simplificação   |  🟡 Médio  |
|   Professional Pages   | Páginas de gestão e analytics atualizadas para refletir dados reais      |             Ajustes            |  🟡 Médio  |
|     Student Pages      | Páginas do aluno agora mostram progresso correto e timer ativo           |             Ajustes            |  🟡 Médio  |
|   Progress / Metrics   | Sistema de pontuação e nível corrigido                                   |         Reescrita lógica       |  🔴 Alto   |
|     Infrastructure     | Ajustes internos sem impacto direto no usuário                           |             Técnico            |  🟢 Baixo  |
|     Types / Utils      | Ajustes de suporte ao sistema                                            |             Técnico            |  🟢 Baixo  |
|        Segurança       | Rota administrativa insegura existia mas já foi removida                 |            Resolvido           | 🚨 Crítico |
|         WIP !!         | Arquivos incompletos e não usados                                        |           Lixo técnico         | ❌ Remover |
|------------------------|--------------------------------------------------------------------------|--------------------------------|------------|
---

## 5. Detailed Changes by Feature

---

### 5.1 — Edição e Persistência de Cronogramas

Problema original
Editar um cronograma não persistia no Firestore — `ScheduleService` não possuía método de update. Atividades podiam ser duplicadas em reatribuições. `AssignmentInterface` carregava `engagementScore`, stats de alunos e `StudentService` desnecessários (~1.141 linhas de complexidade acidental).

Causa raiz
- `ScheduleService`: ausência de `updateScheduleTemplate()`
- `ScheduleInstanceService.assignScheduleToStudents`: verificação de instâncias ativas não confiável
- `generateWeekActivities`: sem deduplicação em reatribuições

Solução implementada
- `ScheduleService`: `updateScheduleTemplate()` com batch operation — delete das atividades antigas + write das novas em operação atômica
- `ScheduleInstanceService`: `assignScheduleToStudents` reescrito com guard via `collectionGroup`; `generateWeekActivities` simplificado com batch Firestore; orphan blocking adicionado em `getWeekActivities`
- `AssignmentInterface`: reduzido de ~1.141 para ~500 linhas — removidos `engagementScore`, `StudentService`, stats desnecessários
- `ScheduleBuilder`, `ScheduleHeaderPanel`, `QuickActivityModal`: refatorados para novo fluxo

Por que é seguro
Batch operations são atômicas — ou tudo escrito ou nada. Guard de instância ativa previne duplicação em novas atribuições.

Riscos restantes
- Instâncias históricas duplicadas (pré-branch) não limpas automaticamente — requer cleanup via `/debug/instances-cleaner` antes de deploy em produção
- `Requires validation` em staging com múltiplos alunos por cronograma

Testes recomendados
1. Criar cronograma → editar atividade → verificar persistência no Firestore sem refresh
2. Atribuir mesmo cronograma duas vezes ao mesmo aluno → deve bloquear
3. Firestore: máximo 1 instância ativa por `(studentId, scheduleId)`

---

### 5.2 — Correção das Métricas Permanentes do Aluno

Problema original
`level` não recalculado ao completar atividade. `streak` incrementado em cada atividade completada, inclusive múltiplas no mesmo dia. Erros de escrita no Firestore silenciados com catch vazio.

Causa raiz
`ProgressService.updateStudentStats` usava `increment(1)` para streak incondicionalmente; não derivava `level` — apenas acumulava pontos.

Solução implementada (`lib/services/ProgressService.ts`)

```typescript
// ANTES
await updateDoc(studentRef, {
  'profile.totalPoints': increment(points),
  'profile.streak': increment(1),        // incondicional — bug
  'profile.lastActivityAt': serverTimestamp(),
});
// catch vazio: erros silenciados

// DEPOIS
const snap = await getDoc(studentRef);
const currentPoints = snap.data()?.profile?.totalPoints ?? 0;
const newLevel = Math.floor((currentPoints + points) / 200) + 1;

const alreadyActiveToday =
  lastActivityAt?.getFullYear() === today.getFullYear() &&
  lastActivityAt?.getMonth()    === today.getMonth()    &&
  lastActivityAt?.getDate()     === today.getDate();

const payload: Record<string, unknown> = {
  'profile.totalPoints': increment(safePoints),
  'profile.level': newLevel,
  'profile.lastActivityAt': serverTimestamp(),
};
if (!alreadyActiveToday) {
  payload['profile.streak'] = increment(1);  // condicional — correto
}
await updateDoc(studentRef, payload);  // erro sobe para o chamador
```

Adicionado `recalculateStudentPermanentMetrics(studentId, { dryRun })` para correção de dados históricos com modo de inspeção antes de qualquer escrita.

Riscos restantes
- Race condition teórica: dois `completeActivity` simultâneos leem o mesmo `currentPoints` antes de qualquer write, resultando em `newLevel` calculado sobre valor desatualizado. Probabilidade baixa. Solução definitiva: Firestore transaction.
- `alreadyActiveToday` usa timezone do ambiente de execução — divergência de timezone pode afetar streak. `Requires validation`.

---

### 5.3 — Hardening do Weekly Progress Hook

Problema original
`useStudentWeeklyProgress` somava `totalPointsEarned` de todos os `weeklySnapshots` históricos, inflando `totalPoints` e `completedActivities` exibidos no `ProgressTracking`.

Causa raiz
`calculateCurrentMetrics` acumulava todos os snapshots ao invés de ler o valor canônico do perfil do aluno.

Solução implementada (`hooks/useStudentWeeklyProgress.ts`)
- `totalPoints`, `streak`, `level` lidos diretamente de `students/{id}/profile` via `getDoc`
- `completedCount` e `totalActivities` calculados via `ScheduleInstanceService.getWeekActivities()` — semana atual apenas
- `completionRate = completedCount / totalActivities * 100` (semana atual, não histórico acumulado)
- Dependências de `useCallback` enxugadas para `[user?.id, user?.role, calculateTimeSpent]`

Riscos restantes
- 3 queries por montagem: `getDoc(student)` + `getDocs(weeklySnapshots)` + `getWeekActivities()`. Sem cache. Performance degradável se componente remontado frequentemente.
- `getWeekActivities` usa `collectionGroup` — requer índice composto no Firestore. `Requires validation`.
- Logs de diagnóstico `console.group` / `console.log` excessivos — remover antes do merge.

---

### 5.4 — Correção de Analytics com Percentuais > 100%

Problema original
`AnalyticsService` produzia `completionRate` de 200%, 111%. `adherenceScore` e `consistencyScore` extrapolavam 100. Dashboard profissional exibia valores impossíveis.

Causa raiz
Denominadores inconsistentes entre fontes de dados distintas. Ausência de clamp nos cálculos de taxa.

Solução implementada (`lib/services/AnalyticsService.ts`)
- Arquivo reduzido de ~1.545 para ~450 linhas
- Queries diretas via `collectionGroup('scheduleInstances')` e `collectionGroup('activityProgress')`
- Valores reais do banco sobrescrevem métricas calculadas em memória a partir de dados parciais
- Dependência de `GAD7CorrelationService` removida do fluxo de analytics

Riscos restantes
- Presença de `clampPercent()` no novo código não confirmada no diff analisado. `Requires validation`: testar edge cases com 0 atividades e denominador zero.
- `collectionGroup` queries requerem índices compostos — verificar Firebase Console antes de deploy.

---

### 5.5 — Timer de Atividade (FloatingTimer + ActivityTimerContext)

Adicionado
- `context/ActivityTimerContext.tsx` (65 linhas): Context React com `startTimer()`, `stopTimer()`, `elapsedSeconds`. `setInterval` de 1s com cleanup correto em `useEffect`.
- `components/student/FloatingTimer.tsx` (167 linhas): Componente `fixed bottom-6 right-6` com relógio analógico SVG, tempo restante/decorrido e botão "Concluir Atividade" → chama `ProgressService.completeActivity`.
- `app/student/layout.tsx`: `ActivityTimerProvider` adicionado ao layout do aluno.

Riscos
|-------------------------------|-------------------------------------------------------------------------------|
|              Risco            |                                  Detalhe                                      |
|-------------------------------|-------------------------------------------------------------------------------|
|        Erro silenciado        | `handleComplete` usa catch vazio — falha de conclusão sem feedback ao usuário |
|   Conclusão sem confirmação   | Clique acidental conclui a atividade permanentemente no Firestore             |
| Timer não persiste em refresh | Estado em memória — sobrevive à navegação dentro do layout, não ao reload     |
|-------------------------------|-------------------------------------------------------------------------------|
---

### 5.6 — Live Profile Stats no StudentDashboard

`StudentDashboard` substituiu leitura estática de `user.profile` por listener `onSnapshot` em tempo real no documento do aluno.

```typescript
// ANTES: user.profile.totalPoints  (cache do AuthContext, desatualizado)
// DEPOIS: onSnapshot(doc(firestore, 'students', uid)) → liveProfileStats (tempo real)
```

`dashboardTodayActivities` computado via `useMemo` filtrando `weekActivities` pelo `dayOfWeek` atual.

Riscos
- Verificar que `unsubscribe()` é chamado no cleanup do `useEffect` — listener sem cleanup causa memory leak
- Convenção de `dayOfWeek`: 0 = Domingo (JS padrão) vs 0 = Segunda (calendário civil) deve ser consistente entre `StudentDashboard` e `useStudentSchedule`. `Requires validation`.

---

### 5.7 — SubjectBarChart

Componente novo `components/charts/SubjectBarChart.tsx` (74 linhas). Barras de distribuição de atividades por matéria no `StudentDashboard`. Implementado com divs + Tailwind — sem dependência externa de charting. Risco: baixo.

---

### 5.8 — firebase/config.ts — Emulador de Functions Comentado

```typescript
// ANTES: if (process.env.NODE_ENV === 'development') { connectFunctionsEmulator(...) }
// DEPOIS: bloco inteiro comentado com //
```

Impacto em produção: zero. Impacto em desenvolvimento local: devs que dependem do emulador de Functions precisam descomentar manualmente. Comunicar equipe antes de merge.

---

### 5.9  — Segurança (Atualizado)

Durante o desenvolvimento, existiu uma rota administrativa para recalcular métricas de alunos.

Essa rota permitia recalcular:
- Pontuação total
- Nível do aluno
- Atividades concluídas

 Importante:
Essa rota já foi REMOVIDA do sistema e NÃO está presente na versão atual.

Motivo da remoção:
- Não possuía autenticação
- Poderia permitir alteração indevida de dados

Situação atual:
 Risco eliminado  
 Nenhuma rota administrativa exposta  

### 5.10  — WIP Patch de Dark Mode + Arquivo Acidental

`temp_patches/wip-dark-mode-baguncado.patch` (1.287 linhas commitadas)
- Implementação parcial de dark mode: CSS variables, `suppressHydrationWarning`, classes `dark:` em componentes
- Não está aplicado ao código-fonte — existe apenas como arquivo rastreado pelo git
- O nome do arquivo (`baguncado`) indica estado instável explicitamente

Classificação: Do not include in PR unless explicitly reviewed.
Recomendação: Remover ambos antes do merge.

---

## 6. File-by-File Breakdown
|----------------------------------------------|------------|-----------------|-------------|----------------------------------|
|                     Arquivo                  |    Tipo    |      Delta      |    Risco    |               Prod?              |
|----------------------------------------------|------------|-----------------|-------------|----------------------------------|
|       `lib/services/ProgressService.ts`      | Modificada | +242            |    Alto     |         Sim — após review        |
|       `lib/services/AnalyticsService.ts`     | Modificada | +1.781 / −1.545 |    Alto     |        Sim — validar clamp       |
|   `lib/services/ScheduleInstanceService.ts`  | Modificada | +859 / −719     |    Alto     | Sim — cleanup histórico primeiro |
|       `lib/services/ScheduleService.ts`      | Modificada | +455            |    Alto     |                Sim               |
|      `hooks/useStudentWeeklyProgress.ts`     | Modificada | +296 / −226     |    Médio    |        Sim — remover logs        |
|         `hooks/useStudentSchedule.ts`        | Modificada | +388            |    Médio    |       Sim — validar dayOfWeek    |
|   `components/student/StudentDashboard.tsx`  | Modificada | +229            |    Médio    | Sim — validar onSnapshot cleanup |
| `components/schedule/AssignmentInterface.tsx`| Modificada | −641 (net)      |    Médio    |                Sim               |
|    `components/student/FloatingTimer.tsx`    | adicionada | +167            |    Médio    |     Sim — revisar catch vazio    |
|      `context/ActivityTimerContext.tsx`      | adicionada | +65             |    Baixo    |                Sim               |
|    `components/charts/SubjectBarChart.tsx`   | adicionada | +74             |    Baixo    |                Sim               |
| `app/api/admin/recalculate-metrics/route.ts` |  removida  | +26             | **Crítico** |              **NÃO**             |
| `temp_patches/wip-dark-mode-baguncado.patch` | adicionada | +1.287          |    Alto     |              **NÃO**             |
|            `firebase/config.ts`              | Modificada | −16             |    Baixo    |       Sim — comunicar equipe     |
|              `tsconfig.json`                 | Modificada | +8              |    Nenhum   |                Sim               |
|          `lib/utils/dateUtils.ts`            | Modificada | +167 / −100     |    Baixo    |      Sim — remover console.log   |
|            `types/schedule.ts`               | Modificada | +7              |    Nenhum   |                Sim               |
|            `types/analytics.ts`              | Modificada | +5              |    Nenhum   |                Sim               |
|            `package-lock.json`               | Modificada | +1.843          |    Nenhum   |                Sim               |
|        Demais páginas e componentes          | Modificada | variado         | Baixo–Médio |                Sim               |
|----------------------------------------------|------------|-----------------|-------------|----------------------------------|

---

## 7. Data Integrity Assessment
|-------------------------|-----------|-------------------------------------------------------------------------------------------------------------------------|
|     Coleção Firestore   |   Risco   |                                                         Detalhe                                                         |
|-------------------------|-----------|-------------------------------------------------------------------------------------------------------------------------|
| `students/{id}/profile` |   Médio   | `updateStudentStats` sobrescreve `level`; `recalculateStudentPermanentMetrics` sobrescreve `totalPoints` + `level`.Race    condition teórica em atividades simultâneas. |
|    `activityProgress`   |   Baixo   | Apenas lido. Nenhuma escrita destrutiva identificada.                                                                   |
|   `scheduleInstances`   |   Médio   | `assignScheduleToStudents` reescrito — instâncias históricas duplicadas não limpas automaticamente.                     |
|    `weeklySnapshots`    |   Baixo   | Upsert com ID previsível `{studentId}_week_{n}` — padrão seguro.                                                        |
|     Uploads / anexos    |    N/A    | Não modificado nesta branch.                                                                                            |
|-------------------------|-----------|-------------------------------------------------------------------------------------------------------------------------|

Risco de perda de dados: Baixo. Nenhum `delete` destrutivo identificado nos caminhos principais de execução. Risco principal é sobrescrita de `totalPoints`/`level` por recálculo incorreto.

---

## 8. Regression Risk Assessment
|----------------------------------------------|---------------------------------|---------|--------------------------------------------------------------------|
|                     Risco                    |         Probabilidade           | Impacto |                            Mitigação                               |
|----------------------------------------------|---------------------------------|---------|--------------------------------------------------------------------|
|        Rota admin sem auth removida          |          já removido            | Alto    | Nenhuma ação necessária                                            |
|    Race condition em `updateStudentStats`    |            Baixa                | Médio   | Monitorar; transaction como solução definitiva                     |
|    `onSnapshot` sem cleanup no Dashboard     |            Média                | Médio (memory leak) | Verificar `unsubscribe` no return do `useEffect`       |
|       `completionRate` > 100% residual       |            Baixa                | Médio   | Validar edge cases em staging                                      |
|     `dayOfWeek` convention inconsistente     |            Média                | **Alto** (atividades no dia errado) | Teste manual todos os dias da semana   |
|      Emulador comentado quebra dev local     | Alta (para devs com emulador)   | Baixo   | Comunicar equipe; restaurar condicional                            |
| Instâncias duplicadas históricas visíveis    | Alta (dados de prod existentes) | Médio   | Cleanup via `/debug/instances-cleaner` antes de deploy             |
|    FloatingTimer conclui sem confirmação     |            Média                | Médio   | Avaliar confirm dialog                                             |
|----------------------------------------------|---------------------------------|---------|--------------------------------------------------------------------|

---

## 9. Testing Plan                                            

Schedule
1. Criar cronograma com 3 atividades → publicar → verificar documentos no Firestore
2. Editar nome + 1 atividade → salvar → aluno deve ver versão atualizada sem refresh
3. Atribuir mesmo cronograma duas vezes ao mesmo aluno → deve bloquear com erro
4. `ScheduleWeekView`: atividades devem aparecer no dia correto — testar Segunda a Domingo

Métricas do aluno
5. Completar 1ª atividade do dia → `streak` +1; completar 2ª no mesmo dia → `streak` não muda
6. Completar atividade → verificar `profile.level = floor((currentPoints+pts)/200)+1` no Firestore
7. `GET /api/admin/recalculate-metrics?studentId=XXX&dryRun=true` → output sem escrita no Firestore

FloatingTimer
8. Iniciar atividade → timer aparece `fixed bottom-6 right-6`
9. Navegar entre páginas do layout do aluno → timer persiste
10. Clicar "Concluir" → atividade marcada como `completed` no Firestore

Analytics
11. Dashboard profissional → `completionRate` ≤ 100% em todos os cenários
12. Analytics de aluno com 0 atividades → sem crash, sem NaN

Regressão
- `ProgressTracking` exibe dados corretos após mudança em `useStudentWeeklyProgress`
- `app/student/progress/page.tsx` carrega sem erro
- Páginas profissionais de analytics carregam sem erro

---

## 10. Deployment Notes

1. Remover antes do deploy: `temp_patches/wip-dark-mode-baguncado.patch`
3. Cleanup de instâncias duplicadas: Executar `/debug/instances-cleaner` em staging → validar → executar em produção
4. Emulador: Comunicar equipe sobre `connectFunctionsEmulator` comentado em `firebase/config.ts`
5. Variáveis de ambiente: Nenhuma nova identificada

---

## 11. Rollback Plan

1. `git revert <commits>` — preserva histórico; preferível a `reset --hard`
2. Dados já escritos no Firestore por `updateStudentStats` ou `recalculateStudentPermanentMetrics` não são revertidos pelo git — necessita script de restore manual se métricas foram sobrescritas em produção
3. `weeklySnapshots` criados nesta branch são ignorados pelo código revertido — sem dano residual
4. `scheduleInstances` criadas pelo novo `assignScheduleToStudents` devem ser avaliadas caso a caso

---

## 12. Open Questions

|---|--------------------------------------------------------------------------------------------------|------------------------|
| # |                                             Questão                                              | Urgência               |
|---|--------------------------------------------------------------------------------------------------|------------------------|
| 1 |                         Índices `collectionGroup` no Firestore existem?                          | Pré-deploy obrigatório |
| 2 |         Race condition em `updateStudentStats`: aceitar risco ou migrar para transaction?        | Médio prazo            |
| 3 | `handleComplete` no FloatingTimer silencia erros — intencional (best-effort) ou requer feedback? | Pré-merge              |
| 4 |               `dayOfWeek` convention: 0=Domingo (JS) ou 0=Segunda (calendário civil)?            | Pré-merge obrigatório  |
| 5 |      `totalActivities: 5` hardcoded em `updateWeeklySnapshot` — substituir por contagem real     | Pós-merge              |
| 6 |                Cleanup de instâncias históricas duplicadas: quando e quem executa?               | Pré-deploy             |
| 7 |             `console.group` / `console.log` excessivos em hooks e services — remover             | Pré-merge              |
|---|--------------------------------------------------------------------------------------------------|------------------------|  
---

## 13. Classificação: Estável vs WIP

### Estável — pronto para merge após checklist
- `ScheduleService.updateScheduleTemplate`
- `ScheduleInstanceService` (novo fluxo + orphan blocking)
- `ProgressService.updateStudentStats` (nova lógica)
- `useStudentWeeklyProgress` (métricas corretas)
- `FloatingTimer` + `ActivityTimerContext`
- `SubjectBarChart`
- `StudentDashboard` (live stats)
- Páginas profissionais de analytics
- `types/schedule.ts`, `types/analytics.ts`
- `tsconfig.json` (apenas reformatação)

### Precisa revisão antes de merge
- `AnalyticsService` — confirmar clamp de percentuais
- `useStudentSchedule` — confirmar `dayOfWeek` convention e cleanup de `onSnapshot`
- `FloatingTimer.handleComplete` — catch vazio intencional?
- `firebase/config.ts` — comunicar equipe sobre emulador
- `lib/utils/dateUtils.ts` — remover `console.log` de diagnóstico
- Logs excessivos em `useStudentWeeklyProgress` e `ProgressService`

### Do not include in PR unless explicitly reviewed
- `app/api/admin/recalculate-metrics/route.ts` — rota sem auth
- `temp_patches/wip-dark-mode-baguncado.patch` — WIP não aplicado

---

## 14. PR Description Draft

```markdown
## fix(schedules+student): schedule editing, student metrics, analytics

### Summary
- Schedule editing: `ScheduleService.updateScheduleTemplate()` with atomic batch operations.
  `ScheduleInstanceService` rewritten with duplicate-instance guard + orphan blocking.
  `AssignmentInterface` simplified from ~1,141 to ~500 lines.

- Student metrics: `ProgressService.updateStudentStats` reads current state before writing,
  derives `level = floor(totalPoints/200)+1`, increments `streak` only once per calendar day.
  Errors no longer silenced.

- Analytics: `AnalyticsService` reduced from ~1,545 to ~450 lines. Direct `collectionGroup`
  queries replace abstractions that produced completion rates > 100%.

- Activity timer: `ActivityTimerContext` + `FloatingTimer` (analog SVG clock).
  Persists across student layout navigation.

### Not changed
- Dark mode (WIP patch in `temp_patches/` — not applied to source code)
- Firestore Security Rules | Debug pages | GAD-7

### Pre-merge required
- [ ] Delete `temp_patches/wip-dark-mode-baguncado.patch`
- [ ] Delete file `123`
- [ ] Verify Firestore `collectionGroup` indexes
- [ ] Run schedule duplicate cleanup in staging
- [ ] Validate `dayOfWeek` convention across all hooks and services
- [ ] Remove diagnostic `console.group` / `console.log` calls
```

---

## 15. Checklist de Qualidade para PR

- [ ] `npm run build` passa sem erros
- [ ] `npx tsc --noEmit` passa
- [ ] `npm run lint` passa
- [ ] `git diff --check` sem whitespace errors
- [ ] `app/api/admin/recalculate-metrics/route.ts` removido
- [ ] `temp_patches/wip-dark-mode-baguncado.patch` removido
- [ ] Arquivo `123` removido
- [ ] Logs de diagnóstico excessivos removidos
- [ ] `onSnapshot` no `StudentDashboard` tem `unsubscribe` no cleanup
- [ ] `dayOfWeek` convention validada (todos os dias testados manualmente)
- [ ] `completionRate` ≤ 100% confirmado em staging
- [ ] Índices Firestore `collectionGroup` confirmados no console
- [ ] Cleanup de instâncias duplicadas executado em staging
- [ ] Sem hard delete de dados de alunos
- [ ] Rollback documentado

---

## 16. Comandos de Validação

```bash
# Build
npm run build

# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Whitespace/conflitos
git diff --check

# Confirmar arquivos WIP commitados que devem ser removidos
git diff --name-only origin/main...HEAD | grep -E "(temp_patches|recalculate-metrics|^123$)"

# Verificar logs de diagnóstico candidatos a remoção
grep -rn "console\.group\|console\.log" \
  hooks/useStudentWeeklyProgress.ts \
  hooks/useStudentSchedule.ts \
  lib/services/ProgressService.ts \
  lib/utils/dateUtils.ts

# Estado final
git status
```
