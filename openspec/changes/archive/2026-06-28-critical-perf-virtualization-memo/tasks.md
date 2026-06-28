# Tasks: critical-perf-virtualization-memo

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~130 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (components + deps) → PR 2 (virtualization integration) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Extract Message/Badge to files with React.memo, install @tanstack/react-virtual | PR 1 | Base = main; self-contained, easy rollback |
| 2 | Integrate useVirtualizer in index.tsx, stabilize toggleRead with getItemArgsRef | PR 2 | Base = PR 1; needs PR 1 component files |

## Phase 1: Extract components + install dependency (PR 1)

- [ ] 1.1 Run `pnpm add @tanstack/react-virtual` in project root
- [ ] 1.2 Create `src/components/Badge.tsx` — move Badge function from index.tsx:422-441, wrap with React.memo, export default
- [ ] 1.3 Create `src/components/Message.tsx` — move Message function from index.tsx:365-420, wrap with React.memo, import Badge from Badge.tsx, export default
- [ ] 1.4 In `index.tsx` — replace inline Badge with `import Badge from "@/components/Badge"` (remove inline Badge function)
- [ ] 1.5 In `index.tsx` — replace inline Message with `import Message from "@/components/Message"` (remove inline Message function)
- [ ] 1.6 Verify `pnpm build` passes with no TypeScript errors

## Phase 2: Virtualization integration (PR 2)

- [ ] 2.1 In `index.tsx` — add `useVirtualizer` import from `@tanstack/react-virtual`
- [ ] 2.2 In `index.tsx` — create `getItemArgsRef = useRef<Record<string, () => void>>({})` after filtered declaration; inside toggleRead, populate `getItemArgsRef.current[m.id] = () => toggleRead(m.id)` so the same function reference is reused on re-renders
- [ ] 2.3 In `index.tsx` — add `estimateSize: 60` to the virtualizer config; add `overscan: 5`
- [ ] 2.4 In `index.tsx` — replace the `filtered.map()` block (lines 302-309) with virtualizer `getVirtualItems()` rendering — pass `item.index`, `item.start`, `item.size`; use `style={{ position: absolute, transform: translateY(item.start), height: item.size }}` on each Message wrapper
- [ ] 2.5 In `index.tsx` — add `paddingBottom` to the scroll container div equal to `virtualizer.getTotalSize()` so the scroll range is correct
- [ ] 2.6 In `index.tsx` — wire `autoScroll` to `scrollToIndex` on the container ref (not `scrollTop`) — scroll to `filtered.length - 1` when autoScroll is true and messages change
- [ ] 2.7 Verify `pnpm build` passes with no TypeScript errors