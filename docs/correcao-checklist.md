# Checklist de Correções e Melhorias

## 🔴 Fase 1 — Correções Obrigatórias (bugs)

- [ ] **1.1** `cloud-functions/src/notifications/dailyReminderScheduler.ts:252–254` — `getPendingActivities` ignora `endDate` do template. Notifica cronogramas vencidos.
  - Adicionar validação: buscar `weeklySchedules/{scheduleTemplateId}`, checar se `endDate < hoje`, pular se expirado.
- [ ] **1.2** `cloud-functions/src/notifications/dailyReminderScheduler.ts:246–248` — Cálculo do dia da semana frágil.
  - Trocar `new Date(now.toLocaleString(...)).getDay()` por `parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'numeric' }).format(now))`.
- [ ] **1.3** `lib/auth/AuthService.ts:282–294` — `checkCPFExists` via Cloud Function. Se CF não existir, retorna `false` e CPF duplicado passa.
  - Garantir que a Cloud Function `checkCPFUnique` esteja deployada **antes** deste merge. Ou adicionar fallback que bloqueie o cadastro se CF estiver indisponível.
- [ ] **1.4** `cloud-functions/src/notifications/sendPushNotification.ts:28–36` — `sanitizeData` aceita qualquer chave.
  - Implementar whitelist: `['type', 'period', 'date', 'activityCount', 'route', 'idempotencyKey']`.

## 🟡 Fase 2 — Aperfeiçoamentos na Feature

- [ ] **2.1** `cloud-functions/src/notifications/dailyReminderScheduler.ts:252–254` — `getPendingActivities` não verifica `activeDays` do template. Consulta atividades mesmo em dias sem atividade.
  - Adicionar `activeDays.includes(jsDay)` após validar `endDate`, antes de consultar `scheduleActivities`.
- [ ] **2.2** `app/professional/analytics/student/[id]/page.tsx:832–858` — Card "Desempenho por dia" mostra só barras. Adicionar **checklist compacto por dia** no formato `(segunda: 3/5; terça: 5/5; quarta: 1/4)`.

### Especificação do patch 2.2

**Arquivo:** `app/professional/analytics/student/[id]/page.tsx`

**Onde:** Dentro do bloco expandido da semana (~linha 832), após o bloco "Desempenho por dia" existente **ou** substituindo-o.

**Dado disponível:**
```typescript
// types/analytics.ts:153–159
dailyBreakdown: Record<number, {
  completed: number;  // ← usado para o numerador (3/5)
  total: number;      // ← usado para o denominador (3/5)
  pointsEarned: number;
  timeSpent: number;
}>
```

**Chaves do objeto:** índice numérico 0–6 (0=Dom, 1=Seg, ..., 6=Sáb).

**Formato esperado:**
> **Checklist por dia**  
> domingo: 0/3 ⏳ segunda: 3/5 ⏳ terça: 5/5 ✅ quarta: 1/4 ⏳ quinta: 0/0 sexta: 0/0 sábado: 0/0

**Regras de cor:**
- `data.completed === data.total && data.total > 0` → verde (`text-emerald-600`) + ✅
- Caso contrário → cor padrão + ⏳
- `data.total === 0` → cinza claro, sem emoji

**Código a inserir** (após o bloco de "Desempenho por dia" ~linha 858):

```tsx
{/* Checklist compacto por dia */}
<div className="mt-4 pt-4 border-t border-slate-100">
  <h5 className="text-sm font-medium text-slate-700 mb-2">Checklist por dia</h5>
  {Object.keys(week.dailyBreakdown || {}).length > 0 ? (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {[1,2,3,4,5,6,0].map(dayIdx => { // Seg-Sáb primeiro, Dom por último
        const data = week.dailyBreakdown[dayIdx];
        if (!data) return null;
        const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        const allDone = data.total > 0 && data.completed === data.total;
        return (
          <span
            key={dayIdx}
            className={`${allDone ? 'text-emerald-600 font-medium' : data.total === 0 ? 'text-slate-300' : 'text-slate-600'}`}
          >
            {days[dayIdx]}: {data.completed}/{data.total}
            {data.total > 0 && (allDone ? ' ✅' : ' ⏳')}
          </span>
        );
      })}
    </div>
  ) : (
    <p className="text-sm text-slate-400">Nenhum dado disponível para esta semana</p>
  )}
</div>
```

## 🟡 Fase 3 — Performance

- [ ] **3.1** `cloud-functions/src/notifications/dailyReminderScheduler.ts:257–273` — N+1 queries. Para cada atividade, faz 1 query em `activityProgress`. Otimizar com `collectionGroup('activityProgress')` + `where('studentId', ...)` + `where('scheduledDate', ...)`.

## 🟢 Fase 4 — Segurança

- [ ] **4.1** `cloud-functions/src/notifications/sendPushNotification.ts` — Adicionar rate limiting por IP (ex: 10 req/min) na HTTP function.
- [ ] **4.2** `firestore.rules` — Testar as 7 coleções alteradas no simulador local antes do deploy.

## 🧪 Fase 5 — Testes

- [ ] **5.1** Teste unitário: `getPendingActivities` com template válido → retorna atividades
- [ ] **5.2** Teste unitário: `getPendingActivities` com template expirado → retorna `[]`
- [ ] **5.3** Teste unitário: `getPendingActivities` com dia fora do `activeDays` → retorna `[]`
- [ ] **5.4** Teste unitário: `sanitizeData` com chaves não permitidas → filtra
- [ ] **5.5** Teste de regra: `firestore.rules` — `notificationPreferences` allow read apenas para owner
- [ ] **5.6** Teste de regra: `firestore.rules` — `auditLogs` allow create para qualquer autenticado

## 🚀 Fase 6 — Deploy

- [ ] **6.1** Deploy da Cloud Function `checkCPFUnique` **antes** do merge do client
- [ ] **6.2** Deploy das Firestore rules atualizadas
- [ ] **6.3** Deploy das Cloud Functions de notificação (`morningReminder`, `middayReminder`, `afternoonReminder`, `eveningReminder`)
- [ ] **6.4** Remover function legada `dailyReminderScheduler` (vazia) após deploy das novas

---

### Ordem recomendada de execução

```
Fase 1 (bugs) → Fase 2 (feature) → Fase 4.2 (rules) → Fase 5 (testes) → Fase 6 (deploy) → Fase 3 (otimização) → Fase 4.1 (rate limit)
```
