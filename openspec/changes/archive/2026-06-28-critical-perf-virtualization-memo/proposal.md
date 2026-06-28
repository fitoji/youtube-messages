# Proposal: critical-perf-virtualization-memo

## Intent

Fix gradual performance degradation in long YouTube live streams (4+ hours, 500+ messages). The app slows down over time but doesn't hard-freeze — medium urgency. Viewers of gaming, IRL, and event streams are most affected.

## Scope

### In Scope
- Add `@tanstack/react-virtual` for windowed rendering of message list (only visible rows in DOM)
- Wrap `Message` and `Badge` components with `React.memo` to prevent unnecessary re-renders
- Remove direct `.map()` from `src/routes/index.tsx` in favor of virtualized list
- Preserve current scroll position — no auto-scroll to bottom behavior

### Out of Scope
- Pagination, infinite scroll UX, or any scroll-to-bottom button
- Message count indicators or new UI chrome
- Changes to message filtering logic
- Backend or API changes

## Capabilities

> No spec-level behavior changes. Pure performance refactor.

### New Capabilities
None

### Modified Capabilities
None

## Approach

1. Install `@tanstack/react-virtual`
2. Replace `filtered.map(msg => <Message ... />)` in `src/routes/index.tsx` with a `useVirtualizer` instance
3. Wrap `Message.tsx` and `Badge.tsx` with `React.memo`
4. Ensure stable `key` prop (message ID) for virtualizer diffing
5. Virtualizer preserves scroll position on re-renders — no user-facing behavior change

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/routes/index.tsx` | Modified | Replace `.map()` with `useVirtualizer` |
| `src/components/Message.tsx` | Modified | Add `React.memo` wrapper |
| `src/components/Badge.tsx` | Modified | Add `React.memo` wrapper |
| `package.json` | Modified | Add `@tanstack/react-virtual` dep |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Virtualizer height miscalculation causing layout shift | Low | Use `estimateSize` matching avg message height |
| Memo wrapper blocking legitimate updates | Low | Props are message data + callbacks; stable refs via `useCallback` in parent |
| Scroll position lost on filter change | Low | Virtualizer handles this naturally; no special logic needed |

## Rollback Plan

Revert two component files (`Message.tsx`, `Badge.tsx`) and restore original `.map()` in `index.tsx`. Remove `@tanstack/react-virtual` from `package.json`. No data migration needed.

## Dependencies

- `@tanstack/react-virtual` ^3.x

## Success Criteria

- [ ] Message list renders with ≤50 DOM nodes regardless of total message count
- [ ] `Message` and `Badge` re-render count = 0 when parent state changes unrelated to them (confirmed via React DevTools)
- [ ] Scroll position preserved during virtualized list updates
- [ ] App stays responsive with 500+ messages — no visible degradation during 4+ hour streams