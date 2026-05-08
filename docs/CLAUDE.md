# Nexus Web — Project Rules

## 1. Identidade do projeto

Nexus Web é uma plataforma para criação, atribuição, execução e acompanhamento de cronogramas de atividades entre profissionais, coordenadores e alunos.

## 2. Stack

- Next.js App Router
- React
- TypeScript
- Firebase Auth
- Firestore
- Firebase Functions
- Tailwind CSS
- OneSignal
- Vercel/Firebase Hosting

## 3. Regras críticas

- Dados enviados por alunos nunca podem ser perdidos.
- Submissões devem continuar disponíveis para uso profissional posterior.
- Limpezas operacionais devem arquivar antes de remover dados ativos.
- Não deletar templates de cronograma.
- Preservar compatibilidade com dados antigos.
- Alterações em `students`, `scheduleInstances`, `activityProgress` e `weeklySnapshots` exigem cuidado extra.
- Antes de alterar código, investigar fluxo completo.

## 4. Features principais

- Autenticação e controle de acesso
- Perfis de usuário
- Dashboard profissional
- Gestão de alunos
- Criação e gestão de cronogramas
- Tipos de atividades
- Execução de atividades pelo aluno
- Upload/envio de arquivos
- Área do aluno
- Analytics profissional
- Weekly snapshots
- Relatórios
- Progresso histórico
- Reset semanal
- Repetição de cronogramas
- GAD-7 / avaliação de ansiedade
- Notificações
- Cloud Functions
- Exportação de dados
- Debug e ferramentas internas

## 5. Telas principais

- Landing/Login
- Dashboard do aluno
- Cronogramas do aluno
- Execução de atividade
- Histórico do aluno
- Dashboard profissional
- Gestão de alunos
- Perfil do aluno
- Analytics profissional
- Analytics de aluno específico
- Criação de cronograma
- Edição de cronograma
- Builder de cronograma
- Atribuição de cronograma
- Relatórios
- Configurações
- Debug interno

## 6. Coleções principais do Firestore

- `students`
- `professionals`
- `scheduleInstances`
- `weeklySchedules`
- `activityProgress`
- `weeklySnapshots`
- `notifications`
- `notificationPreferences`

## 7. Relações principais

- `students` pertence a um profissional ou pode ser visível para coordenador.
- `weeklySchedules` representa templates de cronogramas.
- `scheduleInstances` representa cronogramas atribuídos a alunos.
- `activityProgress` armazena progresso individual de atividades.
- `weeklySnapshots` armazena métricas históricas semanais.
- `notifications` registra eventos/notificações.
- `notificationPreferences` define preferências de push por usuário.

## 8. Endpoints / APIs principais

Agrupar por domínio:

### Admin
- Recalcular métricas
- Debug de dados
- Exportação

### Student
- Buscar cronograma atual
- Executar atividade
- Enviar arquivos
- Atualizar progresso

### Professional
- Gerenciar alunos
- Criar cronogramas
- Atribuir cronogramas
- Visualizar analytics

### Notifications
- Salvar preferências
- Enviar push manual
- Scheduler de lembretes

## 9. Fluxos críticos

### Dashboard do aluno
Verificar:
- `students/{uid}`
- `scheduleInstances`
- `activityProgress`
- hooks de dashboard
- cálculo de progresso semanal
- atividades do dia

### Execução de atividade
Verificar:
- carregamento da atividade
- criação/atualização de `activityProgress`
- timer persistente
- upload/envio de arquivos
- preservação de submissões

### Cronogramas
Verificar:
- template em `weeklySchedules`
- instância em `scheduleInstances`
- datas de início/fim
- repetição semanal
- limpeza/arquivamento

### Analytics
Verificar:
- `weeklySnapshots`
- dados brutos de `activityProgress`
- fallback quando snapshot não existe
- cálculo de pontos, streak e conclusão

### Notificações
Verificar:
- OneSignal
- external user id
- preferências
- scheduler
- envio manual
- service worker

## 10. Padrão de trabalho obrigatório

Antes de alterar qualquer coisa:

1. Rodar inspeção de Git.
2. Ler arquivos relevantes.
3. Mapear o fluxo.
4. Identificar causa raiz.
5. Propor patch mínimo.
6. Apontar riscos.
7. Só então alterar.
8. Rodar lint/build/testes possíveis.
9. Documentar o que mudou.

## 11. Documentação complementar

Caso existam docs detalhadas, consultar:

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API_ENDPOINTS.md`
- `docs/FEATURES.md`
- `docs/SCREENS.md`
- `docs/CHANGE_REPORT.md`