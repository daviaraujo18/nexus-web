# Arquitetura do Sistema — Nexus Web

**Data:** 2026-05-21
**Versão:** 2.0
**Confidencial:** Documento técnico de apoio para due diligence

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Diagrama de Camadas](#2-diagrama-de-camadas)
3. [Mapa de Módulos e Responsabilidades](#3-mapa-de-módulos-e-responsabilidades)
4. [Fluxos de Dados Principais](#4-fluxos-de-dados-principais)
5. [Dependências Externas](#5-dependências-externas)
6. [Padrões Arquiteturais](#6-padrões-arquiteturais-identificados)
7. [Modelo de Dados (Firestore)](#7-modelo-de-dados-firestore)
8. [Segurança e Conformidade](#8-segurança-e-conformidade)
9. [Escalabilidade e Infraestrutura](#9-escalabilidade-e-infraestrutura)
10. [Roadmap Técnico e Dívida](#10-roadmap-técnico-e-dívida-técnica)

---

## 1. Visão Geral do Sistema

O **Nexus** é uma plataforma terapêutico-educacional SaaS que conecta profissionais de saúde mental (psicólogos, psiquiatras, monitores, coordenadores) a estudantes. A plataforma digitaliza e automatiza o acompanhamento terapêutico escolar, permitindo:

- Criação de **cronogramas de atividades personalizados** por profissional
- **Execução guiada** das atividades pelo aluno (quizzes, vídeos, checklists, registros textuais, etc.)
- **Avaliação contínua de ansiedade** via escala GAD-7 validada clinicamente
- **Analytics comparativo** em tempo real (engajamento, bem-estar, risco)
- **Notificações push** com lembretes diários ao aluno
- **Gamificação** (pontos, streak, níveis) para engajamento contínuo

### Perfis de Usuário

| Role | Capacidades |
|---|---|
| **Profissional** | Cria cronogramas, atribui atividades a alunos, acompanha analytics, aplica GAD-7 |
| **Coordenador** | Supervisão de múltiplos profissionais e turmas |
| **Monitor** | Acompanhamento operacional de alunos |
| **Aluno** | Executa atividades, visualiza progresso, responde GAD-7 |

### Stack Principal

| Camada | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| Framework frontend | Next.js (App Router) | 16.1.1 | SSR/SSG, roteamento por arquivo, suporte nativo a React Server Components |
| Linguagem | TypeScript | ^5 | Tipagem estática em todo o codebase, incluindo serviços e tipos Firestore |
| Estilização | Tailwind CSS | ^4 | Utilitária, sem CSS customizado — manutenção simplificada |
| Backend-as-a-Service | Firebase (Auth + Firestore + Storage + FCM) | ^12.7.0 | Escalabilidade automática, sem servidor para gerenciar |
| Cloud Functions | Firebase Functions (Node.js) | ^7.0.3 | Jobs assíncronos (reset semanal, notificações) sem infra adicional |
| Formulários | React Hook Form + Zod | ^7 / ^4 | Validação type-safe end-to-end |
| Animações | Framer Motion | ^12 | UX fluida em transições de estado e modais |
| Datas | date-fns | ^4 | Manipulação de semanas e períodos sem dependência pesada |
| Ícones | react-icons | ^5 | Biblioteca unificada, tree-shakeable |
| Runtime | React 19 | 19.2.3 | Concurrent Mode, Suspense, Server Actions |

---

## 2. Diagrama de Camadas

```
┌─────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                │
│  app/                                                    │
│  ├── (auth)/login, register          → Autenticação      │
│  ├── professional/                   → Portal Profissional│
│  │   ├── dashboard, students         → Gestão de alunos  │
│  │   ├── schedules/[id]              → CRUD cronogramas  │
│  │   └── analytics/                  → Dashboards        │
│  ├── student/                        → Portal Aluno       │
│  │   ├── dashboard, progress         → Progresso pessoal │
│  │   ├── schedules/[id]              → Visualizar cronogr│
│  │   └── activity/[id]              → Executar atividade │
│  └── debug/                          → Ferramentas debug │
├─────────────────────────────────────────────────────────┤
│                   CAMADA DE COMPONENTES                  │
│  components/                                             │
│  ├── auth/        → Forms de login e registro            │
│  ├── activities/  → Executores por tipo de atividade     │
│  ├── analytics/   → Dashboards e relatórios visuais      │
│  ├── layout/      → Navbars e sidebars por role          │
│  ├── schedule/    → Builder de cronogramas (profissional)│
│  ├── schedules/   → Visualização de cronogramas (aluno)  │
│  ├── student/     → Dashboard e progresso do aluno       │
│  └── students/    → Listagem e gestão de alunos          │
├─────────────────────────────────────────────────────────┤
│               CAMADA DE ESTADO E EFEITOS                 │
│  context/                                                │
│  ├── AuthContext.tsx    → Estado global de autenticação  │
│  └── ActivityTimerContext.tsx → Timer de atividades      │
│                                                          │
│  hooks/                                                  │
│  ├── useAuth (via context)                               │
│  ├── useSchedules, useScheduleForm, useScheduleDetail    │
│  ├── useStudentProgress, useStudentSchedule              │
│  ├── useAnalytics, useStudentAnalytics                   │
│  ├── useComparativeAnalytics, useStudentReports          │
│  ├── useGAD7Assessment, useWeeklyReset                   │
│  └── useNotifications, useSystemStatus                   │
├─────────────────────────────────────────────────────────┤
│                  CAMADA DE SERVIÇOS                      │
│  lib/                                                    │
│  ├── auth/          → AuthService, UserService, Audit    │
│  ├── services/      → Serviços de domínio (ver seção 3)  │
│  ├── utils/         → Utilitários transversais           │
│  └── validation/    → Validadores de domínio             │
├─────────────────────────────────────────────────────────┤
│                    CAMADA DE DADOS                       │
│  firebase/config.ts → Firebase SDK inicializado          │
│                                                          │
│  Firebase Auth      → Identidade dos usuários            │
│  Firestore          → Banco de dados principal (NoSQL)   │
│  Firebase Storage   → Arquivos e anexos                  │
│  FCM (Messaging)    → Notificações push                  │
├─────────────────────────────────────────────────────────┤
│                  CAMADA DE FUNÇÕES                       │
│  cloud-functions/src/                                    │
│  ├── weeklyReset.ts           → Reset semanal automático │
│  └── notifications/           → Agendamento de push      │
│      ├── dailyReminderScheduler.ts                       │
│      ├── manageUserTokens.ts                             │
│      └── sendPushNotification.ts                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Mapa de Módulos e Responsabilidades

### `app/` — Rotas (Next.js App Router)

| Rota | Responsabilidade |
|---|---|
| `(auth)/login` | Tela de login com `LoginFormContainer` |
| `(auth)/register` | Tela de cadastro com `RegisterFormContainer` |
| `professional/dashboard` | Dashboard com instâncias ativas de alunos |
| `professional/students` | Listagem e busca de alunos |
| `professional/students/[id]` | Perfil individual do aluno |
| `professional/students/assign` | Atribuir alunos ao profissional |
| `professional/schedules` | Listagem de cronogramas |
| `professional/schedules/new` | Criação de novo cronograma |
| `professional/schedules/[id]` | Detalhes do cronograma |
| `professional/schedules/[id]/edit` | Edição do cronograma |
| `professional/schedules/[id]/assign` | Atribuir cronograma a alunos |
| `professional/analytics` | Analytics comparativo da turma |
| `professional/analytics/student/[id]` | Analytics individual do aluno |
| `student/dashboard` | Dashboard com atividades do dia |
| `student/schedules` | Lista de cronogramas ativos do aluno |
| `student/schedules/[id]` | Semana atual do cronograma |
| `student/activity/[id]` | Execução de atividade individual |
| `student/progress` | Histórico e conquistas do aluno |
| `student/notifications` | Configuração de notificações push |
| `debug/*` | Ferramentas de diagnóstico (não para produção) |

### `components/` — Componentes UI

| Subpasta | Responsabilidade |
|---|---|
| `activities/` | Componentes de execução por tipo (`QuickActivity`, `TextActivity`, `QuizActivity`, `VideoActivity`, `ChecklistActivity`, `FileActivity`, `AppActivity`). Orquestrados pelo `ActivityExecutor` |
| `analytics/` | Dashboards de analytics em dois níveis: `dashboard/` (visão da turma) e `student/` (visão individual). `common/` contém primitivos reutilizáveis (`KPICard`, `ChartContainer`, etc.) |
| `analytics/` (raiz) | `AnalyticsDashboard.tsx`, `StudentReports.tsx`, `StudentSelector.tsx` — componentes legados não referenciados por rotas ativas |
| `auth/` | `AuthLayout/` (visual), `forms/` (formulários por tipo de usuário), `ui/` (primitivos de formulário), `ProtectedRoute.tsx` |
| `assessments/` | `GAD7Modal.tsx` — aplicação do questionário de ansiedade GAD-7 |
| `charts/` | `SubjectBarChart.tsx` — gráfico de barras por disciplina |
| `debug/` | `DataCard.tsx` — card de debug genérico |
| `layout/` | `ProfessionalNavbar`, `ProfessionalSidebar`, `StudentNavbar`, `StudentSidebar`, `MainContent` |
| `notifications/` | `NotificationManager.tsx`, `IOSInstructions.tsx` |
| `schedule/` | Builder de cronograma para profissional (`ScheduleBuilder`, `ActivityEditor`, `WeekScheduleGrid`, etc.) |
| `schedules/` | Visualização de cronograma para aluno (`ScheduleCalendar`, `ScheduleList`, `ScheduleWeekView`) |
| `student/` | Componentes do portal aluno (`StudentDashboard`, `TodayActivities`, `ProgressTracking`, `FloatingTimer`) |
| `students/` | Componentes do portal profissional para gestão de alunos (`StudentList`, `StudentCard`, `StudentManagementDashboard`) |

### `context/` — Estado Global

| Arquivo | Responsabilidade |
|---|---|
| `AuthContext.tsx` | Provê `user`, `loading`, `login`, `register`, `logout`. Gerencia redirect automático por role. Integra FCM no login. Safety timeout de 8s |
| `ActivityTimerContext.tsx` | Gerencia timer durante execução de atividade (tempo gasto) |

### `hooks/` — Lógica de UI

| Hook | Responsabilidade |
|---|---|
| `useSchedules` | Lista cronogramas do profissional |
| `useScheduleForm` | Estado do formulário de criação/edição |
| `useScheduleDetail` | Detalhes de um cronograma específico |
| `useScheduleTemplates` | Templates disponíveis |
| `useScheduleAssignment` | Atribuição de cronograma a alunos |
| `useStudentSchedule` | Cronograma ativo do aluno (instância atual) |
| `useStudentProgress` | Progresso histórico e conquistas do aluno |
| `useStudentWeeklyProgress` | Atividades da semana corrente |
| `useActivity` | Estado de execução de atividade individual |
| `useGAD7Assessment` | Aplicação e persistência do GAD-7 |
| `useAnalytics` | Analytics individual de aluno (para profissional) |
| `useStudentAnalytics` | Analytics de aluno (usado em rotas /analytics) |
| `useComparativeAnalytics` | Analytics comparativo da turma |
| `useStudentReports` | Relatórios de desempenho |
| `useExport` | Exportação de dados |
| `useProfessionalInstances` | Instâncias ativas gerenciadas pelo profissional |
| `useWeeklyReset` | Trigger manual do reset semanal |
| `useSystemStatus` | Status geral do sistema |

### `lib/` — Serviços e Utilitários

**`lib/auth/`**

| Arquivo | Responsabilidade |
|---|---|
| `AuthService.ts` | Login, registro, logout com Firebase Auth. Rate limiting via Firestore |
| `UserService.ts` | Leitura e atualização de perfis (Student/Professional) |
| `AuditService.ts` | Registro de eventos de auditoria (login, operações críticas) |

**`lib/services/`**

| Serviço | Responsabilidade |
|---|---|
| `ScheduleService.ts` | CRUD de templates de cronogramas (`weeklySchedules`) |
| `ScheduleInstanceService.ts` | Gestão de instâncias de cronograma atribuídas a alunos |
| `ActivityService.ts` | Leitura de atividades (`scheduleActivities`) |
| `ProgressService.ts` | Registro e consulta de progresso de atividades (`activityProgress`). Atualiza pontos/streak/level do aluno |
| `StudentService.ts` | Gestão de alunos — busca, atribuição, listagem por profissional/coordenador |
| `ProfessionalService.ts` | Gestão de profissionais |
| `GAD7Service.ts` | Persistência de avaliações GAD-7 |
| `GAD7CorrelationService.ts` | Cálculo de correlações entre GAD-7 e engajamento |
| `AnalyticsService.ts` | Agregação de analytics comparativo da turma. Usa `SnapshotAggregator` internamente |
| `SnapshotAggregator.ts` | Agrega snapshots semanais para métricas analíticas |
| `WeeklySnapshotService.ts` | Geração de snapshots semanais de desempenho |
| `WeeklyResetService.ts` | Orquestra o reset semanal (avança semana, gera snapshot, cria novas atividades) |
| `RepetitionService.ts` | Lógica de repetição de cronogramas (não utilizado ativamente) |
| `ReportService.ts` | Geração de relatórios detalhados |
| `SimpleReportService.ts` | Versão simplificada de relatórios |
| `StudentMetricsService.ts` | Métricas individuais do aluno |
| `NotificationService.ts` | Registro de token FCM, listener foreground |
| `FirebaseMessagingService.ts` | Gestão de tokens FCM (multi-dispositivo) |
| `ExportService.ts` | Exportação de dados (CSV/JSON) |

**`lib/utils/`**

| Arquivo | Responsabilidade |
|---|---|
| `achievementUtils.ts` | Cálculo de conquistas baseado em progresso |
| `dateUtils.ts` | Manipulação de datas (semanas, períodos) |
| `debugUtils.ts` | Utilitários de debug (logging condicional) |
| `encryption.ts` | Criptografia de CPF e dados sensíveis |
| `errors.ts` | Classes de erro customizadas (`ConcurrentResetError`) |
| `formatters.ts` | Formatação de CPF, telefone, etc. |
| `levelUtils.ts` | Cálculo de nível e streak do aluno |
| `validationUtils.ts` | Validações genéricas |
| `weeklyMetrics.ts` | Cálculo de métricas semanais (usado também em cloud-functions via cópia) |
| `constants.ts` | Constantes do sistema |

**`lib/validation/`**

| Arquivo | Responsabilidade |
|---|---|
| `cpfValidator.ts` | Validação e formatação de CPF |
| `emailValidator.ts` | Validação de e-mail |
| `phoneValidator.ts` | Validação de telefone brasileiro |
| `professionalValidator.ts` | Validação de CRP/CRM |
| `dateValidator.ts` | Validação de datas |
| `index.ts` | Re-exportação unificada (`ValidationService`) |

### `firebase/`

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | Inicialização centralizada de todos os serviços Firebase (Auth, Firestore, Storage, FCM, Functions). Inicialização condicional de Messaging (apenas no cliente) |

### `types/`

| Arquivo | Responsabilidade |
|---|---|
| `auth.ts` | `User`, `Student`, `Professional`, `AuthContextType`, `RegisterData`, `LoginResult` |
| `schedule.ts` | `ScheduleTemplate`, `ScheduleActivity`, `ScheduleInstance`, `ActivityProgress`, `PerformanceSnapshot`, `WeeklySnapshot`, DTOs |
| `GAD7.ts` | `GAD7Assessment`, `GAD7Severity`, constantes e funções utilitárias do GAD-7 |
| `analytics.ts` | `ComparativeAnalysis`, `StudentAnalyticsSummary`, `AggregatedMetrics`, `Insight`, tipos de estado |
| `notification.ts` | Tipos de notificação push |
| `index.ts` | Re-exportação de todos os tipos |

### `cloud-functions/src/`

| Arquivo | Responsabilidade |
|---|---|
| `weeklyReset.ts` | Função agendada (cron) que executa o reset semanal de todas as instâncias ativas |
| `notifications/dailyReminderScheduler.ts` | Agenda lembretes diários aos alunos via FCM |
| `notifications/sendPushNotification.ts` | Envio de notificação push individual |
| `notifications/manageUserTokens.ts` | Manutenção de tokens FCM (cleanup de tokens inválidos) |
| `shared/weeklyMetrics.ts` | Cópia local de `lib/utils/weeklyMetrics.ts` (cloud-functions é um pacote npm separado) |

---

## 4. Fluxos de Dados Principais

### 4.1 Autenticação

```
Login Page
  └── LoginFormContainer
        └── AuthContext.login()
              └── AuthService.login()
                    ├── ValidationService (email)
                    ├── checkRateLimit() → Firestore (rateLimits)
                    ├── signInWithEmailAndPassword() → Firebase Auth
                    ├── UserService.getUserType() → Firestore (students/professionals)
                    └── AuditService.logLogin() → Firestore (auditLogs)
                          ↓
              onAuthStateChanged dispara
                    └── fetchUserData(uid)
                          ├── UserService.getUserType()
                          └── UserService.getUser() → Firestore
                                ↓
                          setUser(userData)
                                ↓
                          Redirect effect → /student/dashboard ou /professional/dashboard
```

### 4.2 Criação e Atribuição de Cronograma

```
professional/schedules/new
  └── ScheduleBuilder (components/schedule/)
        └── useScheduleForm
              └── ScheduleService.createSchedule()
                    ├── Firestore: weeklySchedules (template)
                    └── Firestore: scheduleActivities (por atividade)
                          ↓
professional/schedules/[id]/assign
  └── AssignmentInterface
        └── useScheduleAssignment
              └── ScheduleInstanceService.assignSchedule()
                    ├── Firestore: scheduleInstances (instância por aluno)
                    └── ScheduleInstanceService.generateWeekActivities()
                          └── Firestore: activityProgress (uma entrada por atividade/dia)
```

### 4.3 Execução de Atividade pelo Aluno

```
student/activity/[id]
  └── ActivityExecutor
        ├── ActivityTimerContext (tempo gasto)
        ├── EmotionalStateModal (estado emocional antes/depois)
        └── [QuickActivity|TextActivity|QuizActivity|VideoActivity|...]
              └── useActivity
                    └── ProgressService.completeActivity()
                          ├── Firestore: activityProgress (status=completed, executionData)
                          ├── ProgressService.updateStudentPoints()
                          │     └── Firestore: students (totalPoints, streak, level)
                          └── ProgressService.updateProgressCache()
                                └── Firestore: scheduleInstances (progressCache)
```

### 4.4 Reset Semanal

```
[Trigger: Cloud Function cron OU WeeklyResetService manual]
  └── WeeklyResetService.processWeeklyReset()
        └── Para cada instância ativa:
              ├── WeeklySnapshotService.generateSnapshot()
              │     └── Firestore: weeklySnapshots (métricas da semana encerrada)
              ├── ScheduleInstanceService.advanceWeek()
              │     └── Firestore: scheduleInstances (currentWeekNumber++)
              └── ScheduleInstanceService.generateWeekActivities()
                    └── Firestore: activityProgress (novas entradas para a semana)
```

### 4.5 Analytics

```
professional/analytics
  └── useComparativeAnalytics
        └── AnalyticsService.getComparativeAnalysis()
              ├── SnapshotAggregator.aggregateStudentsData()
              │     └── Firestore: weeklySnapshots (histórico)
              ├── GAD7Service.getStudentAssessments()
              │     └── Firestore: gad7Assessments
              └── StudentService.getProfessionalStudents()
                    └── Firestore: students

professional/analytics/student/[id]
  └── useStudentAnalytics
        └── AnalyticsService.getStudentAnalytics()
              ├── SnapshotAggregator (snapshots do aluno)
              └── ProgressService (atividades completadas)
```

### 4.6 Notificações Push

```
AuthContext (login bem-sucedido)
  └── NotificationService.requestFCMToken()
        ├── getToken() → Firebase Messaging SDK
        └── FirebaseMessagingService.saveUserToken()
              └── Firestore: userFCMTokens

[Cloud Function: dailyReminderScheduler]
  └── Busca alunos com atividades pendentes
        └── sendPushNotification()
              └── FCM Admin SDK → dispositivo do aluno
```

---

## 5. Dependências Externas

### Dependências de Produção

| Pacote | Uso | Observação |
|---|---|---|
| `firebase` ^12.7.0 | Auth, Firestore, Storage, FCM, Functions | Core do backend |
| `firebase-admin` ^13.6.0 | Admin SDK nas Cloud Functions | **Não deve ser usado no frontend** |
| `firebase-functions` ^7.0.3 | Definição de Cloud Functions | Somente em `cloud-functions/` |
| `next` 16.1.1 | Framework SSR/SSG/App Router | Core do frontend |
| `react` 19.2.3 | UI | — |
| `react-hook-form` ^7.70.0 | Formulários performáticos | Usado em auth forms e schedule builder |
| `@hookform/resolvers` ^5.2.2 | Integração Zod + React Hook Form | — |
| `zod` ^4.3.5 | Validação de schemas | Usado nos resolvers de form |
| `framer-motion` ^12.29.2 | Animações | Usado em auth UI e analytics |
| `date-fns` ^4.1.0 | Manipulação de datas | Amplamente usado em utils e serviços |
| `react-icons` ^5.5.0 | Ícones | Usado extensivamente em toda UI |

### Dependências de Desenvolvimento

| Pacote | Uso |
|---|---|
| `tailwindcss` ^4 | Estilização utilitária |
| `typescript` ^5 | Tipagem estática |
| `jest` ^30 + `ts-jest` ^29 | Testes unitários |
| `eslint` ^9 | Linting |

---

## 7. Modelo de Dados (Firestore)

O banco de dados é **Firestore** (NoSQL orientado a documentos, Google Cloud). O modelo é desnormalizado por design para otimizar leituras — padrão recomendado pelo Firebase.

### Coleções Principais

```
firestore/
│
├── students/{userId}
│     Perfil do aluno. Campos: name, email, cpf (criptografado), school,
│     grade, professionalId, totalPoints, streak, level, lastActiveAt
│
├── professionals/{userId}
│     Perfil do profissional. Campos: name, email, role (professional/coordinator/monitor),
│     crp, phone, coordinatorId
│
├── weeklySchedules/{scheduleId}
│     Template de cronograma criado pelo profissional. Contém metadados
│     (nome, descrição, duração em semanas) mas NÃO as atividades.
│
├── scheduleActivities/{activityId}
│     Atividade individual vinculada a um template. Campos: scheduleId,
│     dayOfWeek, weekNumber, type, config (JSON polimórfico por type),
│     estimatedMinutes, points
│
├── scheduleInstances/{instanceId}
│     Instância de um cronograma atribuído a um aluno específico.
│     Campos: scheduleId, studentId, professionalId, currentWeekNumber,
│     startDate, status, progressCache (métricas resumidas da semana atual)
│
├── activityProgress/{progressId}
│     Registro de execução de uma atividade por um aluno em uma semana.
│     Campos: instanceId, activityId, studentId, weekNumber, status
│     (pending/completed/skipped), completedAt, executionData (resposta do aluno),
│     activitySnapshot (cópia da atividade no momento da atribuição — imutável),
│     emotionalStateBefore, emotionalStateAfter, timeSpentMinutes
│
├── weeklySnapshots/{snapshotId}
│     Snapshot de desempenho gerado ao final de cada semana por aluno/instância.
│     Alimenta o AnalyticsService sem recalcular dados históricos a cada query.
│     Campos: studentId, instanceId, weekNumber, completionRate, streak,
│     pointsEarned, activitiesCompleted, averageTimePerActivity
│
├── gad7Assessments/{assessmentId}
│     Resultado de uma avaliação GAD-7. Campos: studentId, professionalId,
│     answers (array de 7 respostas 0-3), totalScore, severity
│     (minimal/mild/moderate/severe), assessedAt
│
├── userFCMTokens/{tokenId}
│     Tokens FCM por dispositivo. Permite notificações multi-dispositivo.
│     Campos: userId, token, platform, createdAt, lastUsedAt
│
├── rateLimits/{identifier}
│     Controle de rate limiting de login por e-mail/IP.
│     Campos: attempts, firstAttemptAt, lockedUntil
│
└── auditLogs/{logId}
      Registro de eventos de segurança (login, alterações críticas).
      Campos: userId, action, timestamp, metadata
```

### Relacionamentos Chave

```
Professional ──(1:N)──► Student
Student ──(N:M via ScheduleInstance)──► WeeklySchedule
ScheduleInstance ──(1:N)──► ActivityProgress
ScheduleInstance ──(1:N)──► WeeklySnapshot
Student ──(1:N)──► GAD7Assessment
```

### Estratégia de Queries

- **Leituras quentes** (dashboard do aluno, lista de atividades do dia): feitas diretamente em `activityProgress` com índice composto `(instanceId, weekNumber, status)`.
- **Analytics histórico**: lido de `weeklySnapshots`, nunca recalculado de `activityProgress` — garante O(1) por semana independente do volume de dados históricos.
- **Cache local**: `scheduleInstances.progressCache` armazena métricas resumidas da semana atual, evitando contagem de `activityProgress` a cada renderização do dashboard do aluno.

---

## 8. Segurança e Conformidade

### Autenticação e Autorização

- **Autenticação**: Firebase Authentication com e-mail/senha. Tokens JWT gerenciados automaticamente pelo SDK.
- **Controle de acesso**: verificado em dois níveis — (1) `AuthContext` no frontend redireciona usuários para o portal correto com base no `role`; (2) regras do Firestore (Security Rules) impedem acesso direto a dados de outros usuários no banco.
- **Rate limiting de login**: implementado via `AuthService.checkRateLimit()`, que armazena contadores de tentativas no Firestore com bloqueio temporário após múltiplas falhas.
- **Audit trail**: `AuditService` registra eventos críticos (login, operações de escrita) na coleção `auditLogs`.

### Proteção de Dados

- **CPF e dados sensíveis** são criptografados em `lib/utils/encryption.ts` antes de serem persistidos no Firestore. Nunca trafegam em texto plano.
- **Snapshot imutável de atividade** (`activitySnapshot` em `ActivityProgress`) garante que a resposta do aluno não é adulterada retroativamente por edições no template.
- **Tokens FCM** são isolados por usuário e dispositivo, com cleanup automático de tokens inválidos via Cloud Function.

### Conformidade (LGPD)

A arquitetura foi projetada considerando a Lei Geral de Proteção de Dados (LGPD):
- Dados de saúde mental (GAD-7) são classificados como **dados sensíveis** e trafegam apenas entre profissional e aluno vinculados.
- CPF é criptografado em repouso.
- O `AuditService` provê rastreabilidade de acesso.

> **Nota:** A implementação formal de relatório de impacto (RIPD) e termos de consentimento está fora do escopo desta documentação técnica.

---

## 9. Escalabilidade e Infraestrutura

### Modelo de Hospedagem

O Nexus opera inteiramente sobre **Google Cloud / Firebase**, sem servidores próprios a gerenciar:

| Componente | Serviço Google Cloud | Escala |
|---|---|---|
| Aplicação Web | Firebase Hosting (CDN global) | Automática |
| Banco de dados | Cloud Firestore | Automática (serverless) |
| Autenticação | Firebase Authentication | Automática |
| Arquivos | Firebase Storage (Cloud Storage) | Automática |
| Jobs assíncronos | Cloud Functions (gen2) | Automática |
| Notificações push | Firebase Cloud Messaging (FCM) | Automática |

### Gargalos Conhecidos e Mitigações

| Ponto | Risco | Mitigação implementada |
|---|---|---|
| Analytics de turma | Query em N alunos × M semanas | Snapshot Pattern — lê `weeklySnapshots` pré-agregados |
| Dashboard do aluno | Contagem de atividades a cada render | `progressCache` em `scheduleInstances` |
| Reset semanal | Processamento de todas as instâncias ativas | Cloud Function com batch write e `ConcurrentResetError` para evitar duplo processamento |
| Login sob ataque | Tentativas de força bruta | Rate limiting via Firestore + lockout temporário |

### Estimativa de Capacidade

O Firestore suporta **1 milhão de operações de leitura por dia** no plano Spark (gratuito) e escala sem limite no plano Blaze (pay-as-you-go). O modelo de dados atual foi projetado para minimizar leituras por sessão de usuário. Estima-se capacidade confortável para **até 10.000 alunos ativos** sem qualquer alteração arquitetural.

---

## 10. Roadmap Técnico e Dívida Técnica

### Componentes Legados (identificados, não bloqueantes)

Os itens abaixo existem no codebase mas foram **substituídos por versões mais recentes**. Estão comentados com aviso explícito de legado e mantidos para referência histórica:

| Arquivo | Substituído por | Status |
|---|---|---|
| `components/analytics/AnalyticsDashboard.tsx` | UI inline em `app/professional/analytics/page.tsx` | Legado documentado |
| `components/analytics/StudentReports.tsx` | Rota `app/professional/analytics/student/[id]/` | Legado documentado |
| `components/analytics/StudentSelector.tsx` | `components/analytics/common/StudentSelector.tsx` | Legado documentado |
| `lib/services/RepetitionService.ts` | Não substituído — feature pausada | Feature em hold |
| `lib/services/GAD7CorrelationService.ts` | Não substituído — feature em desenvolvimento | Feature em desenvolvimento |

### Melhorias Técnicas Planejadas

- **Testes automatizados**: estrutura Jest configurada, cobertura ainda baixa — prioridade para serviços críticos (`ProgressService`, `WeeklyResetService`).
- **Server Components**: migração progressiva de páginas do portal profissional para React Server Components, reduzindo bundle JavaScript no cliente.
- **Validação de quiz**: implementação pendente da validação de respostas corretas no `QuizActivity` (TODO identificado em código).
- **Filtros de analytics**: bloco de filtros por aluno temporariamente desabilitado na UI (`page.tsx` linhas 324-352) — aguarda definição de UX.
- **Separação de pacotes**: `firebase-admin` e `firebase-functions` estão listados no `package.json` do Next.js mas deveriam existir apenas em `cloud-functions/package.json`.

---

## 6. Padrões Arquiteturais Identificados

### 6.1 Repository Pattern via Service Classes

Todos os serviços são classes estáticas que encapsulam as operações Firestore. Não existe ORM — as queries Firestore são escritas diretamente nos serviços. Exemplo: `ScheduleService`, `StudentService`, `ProgressService`.

### 6.2 Context + Hooks para Estado

O estado global é limitado ao `AuthContext`. Todo estado de domínio é gerenciado em hooks customizados co-localizados com as páginas que os consomem. Não há Redux ou Zustand.

### 6.3 Role-Based Routing

O `AuthContext` gerencia redirecionamentos baseados no `user.role` após autenticação. Dois portais distintos: `/professional/*` e `/student/*`. Cada portal tem seu próprio `layout.tsx` com sidebar/navbar específico.

### 6.4 Snapshot Pattern para Analytics

Em vez de recalcular métricas em tempo real (custoso no Firestore), o sistema usa snapshots semanais (`weeklySnapshots`) gerados ao final de cada semana. Analytics lê esses snapshots agregados via `SnapshotAggregator`.

### 6.5 Activity Config Polymorphism

Cada tipo de atividade (`quick`, `text`, `quiz`, `video`, `checklist`, `file`, `app`) tem uma interface de configuração específica (`QuickActivityConfig`, `QuizActivityConfig`, etc.), unificadas via union type `ActivityConfig`. O `ActivityExecutor` delega a renderização ao componente correto.

### 6.6 Data Snapshot em ActivityProgress

Ao criar um `ActivityProgress`, o sistema salva um `activitySnapshot` (cópia da atividade no momento da atribuição). Isso garante que alterações futuras no template não corrompam dados históricos do aluno.

### 6.7 Criptografia de Dados Sensíveis

CPF e dados médicos sensíveis são criptografados em `AuthService` e `UserService` via `lib/utils/encryption.ts` antes de serem persistidos no Firestore.

### 6.8 Rate Limiting via Firestore

`AuthService.checkRateLimit()` implementa rate limiting de tentativas de login usando um documento Firestore (sem estado no servidor), adequado para o modelo serverless.

### 6.9 Service Worker para FCM

O `app/layout.tsx` registra manualmente o service worker `/firebase-messaging-sw.js` (arquivo externo não rastreado neste repositório) para suporte a notificações push mesmo com a aba fechada. O registro inclui lógica de desregistro e re-registro para forçar atualização.

### 6.10 Cloud Functions como Backend Autônomo

`cloud-functions/` é um pacote npm independente com seu próprio `package.json` e `tsconfig.json`. A pasta `shared/weeklyMetrics.ts` é uma cópia intencional de `lib/utils/weeklyMetrics.ts`, pois cloud-functions não pode importar do código do app Next.js.
