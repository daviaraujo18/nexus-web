---
description: Busca por bugs e problemas no código
---

Search the codebase for potential bugs, focusing on:

1. **Logic errors** — Off-by-one, incorrect conditionals, race conditions, null pointer dereferences
2. **Type safety** — Missing type guards, `any` usage, incorrect type assertions
3. **Error handling** — Silent catch blocks, unhandled promise rejections, missing error boundaries
4. **State management** — Stale closures, missing dependencies in useEffect, incorrect state updates
5. **Data integrity** — Race conditions in Firestore writes, missing transactions, inconsistent updates
6. **Security** — Missing auth checks, exposed credentials, insecure data handling

Run `!git diff --stat` and `!git log --oneline -10` for context on recent changes. Then systematically analyze the changed files for bugs. Report findings with file paths and line numbers, severity (high/medium/low), and suggested fixes.
