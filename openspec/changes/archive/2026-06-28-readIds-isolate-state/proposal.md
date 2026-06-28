# Proposal: readIds-isolate-state

## Intent

Eliminate full-list re-render on `toggleRead` by moving read state into each Message component. Currently every `toggleRead` call creates a new `Set<string>(readIds)`, which changes the `useMemo(filtered)` dependency array, causing all 500 messages to re-filter on every toggle.

## Scope

### In Scope
- Extract `read` state from parent into per-Message `useState`
- Remove `readIds` from parent's state and `filtered` useMemo dependencies
- Update `toggleRead` to operate on the target message directly

### Out of Scope
- Changes to filtering logic
- Changes to existing badge or memo implementation

## Capabilities

### New Capabilities
- `message-read-state`: Each Message component independently tracks its own read state via internal `useState`

### Modified Capabilities
- None (purely an implementation refactor — no spec-level behavior changes)

## Approach

Replace the global `readIds: Set<string>` in the parent with per-Message `useState(false)`. The `toggleRead` callback receives the message ID and updates only that component's state. This breaks the dependency chain: `filtered` useMemo no longer depends on anything that `toggleRead` mutates.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `Message` component | Modified | Add internal `useState` for read tracking |
| Parent component | Modified | Remove `readIds` state, update `toggleRead` signature |
| `filtered` useMemo | Modified | Remove `readIds` from dependency array |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Inconsistent read state if message list is re-fetched | Low | Ensure parent re-initializes children on data refresh |

## Rollback Plan

Revert Message component to accept `read` prop; restore `readIds` state in parent and add it back to `filtered` useMemo deps.

## Dependencies

- None

## Success Criteria

- [ ] `toggleRead` re-renders exactly 1 Message component, not the full list
- [ ] Filtered useMemo deps no longer include `readIds`
- [ ] All existing Message interactions continue to work correctly