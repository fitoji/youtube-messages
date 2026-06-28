# Tasks: readIds-isolate-state

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 50-80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Refactor parent state management | PR 1 | Single PR covering all changes; includes verification |

## Phase 1: Parent Component Refactoring

- [ ] 1.1 Replace `readIds` Set state with `readStateRef` (Map) and `readVersion` counter in `src/routes/index.tsx`.
- [ ] 1.2 Add `isRead` and `toggleRead` callbacks using `useCallback` in `src/routes/index.tsx`.
- [ ] 1.3 Update `filtered` useMemo dependency from `readIds` to `readVersion` in `src/routes/index.tsx`.
- [ ] 1.4 Update `Message` component props in `src/routes/index.tsx` to pass `isRead` and `toggleRead` instead of `read` and `onToggleRead`.

## Phase 2: Child Component Adaptation

- [ ] 2.1 Update `MessageProps` interface in `src/components/Message.tsx` to accept `isRead` and `toggleRead` callbacks.
- [ ] 2.2 Replace `read` prop usage with `isRead(m.id)` inside `Message` component.
- [ ] 2.3 Replace `onToggleRead` prop usage with `toggleRead(m.id)` inside `Message` component.

## Phase 3: Verification and Cleanup

- [ ] 3.1 Run TypeScript type check: `npx tsc --noEmit` and fix any type errors.
- [ ] 3.2 Run build verification: `npm run build` and ensure no errors.
- [ ] 3.3 Manual verification: toggle a message and confirm only that message re-renders (using React DevTools or console logs).
- [ ] 3.4 Remove any leftover `readIds` references or dead code.