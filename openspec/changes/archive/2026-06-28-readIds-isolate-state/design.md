# Design: `readIds-isolate-state`

## Technical Approach

Replace `readIds` Set state with a **stable ref Map** (`Map<messageId, boolean>`) plus a **single `readVersion` counter** that forces the `filtered` useMemo to recompute on every toggle. Each Message reads/writes the ref directly via two stable callbacks, achieving isolated self-renders only.

## Architecture Decisions

### Decision: Ref + version counter instead of Set state

**Choice**: `readStateRef = useRef<Map<string, boolean>>(new Map())` + `readVersion = useState(0)`
**Alternatives considered**: Per-Message useState (causes parent re-render), prop drilling readIds Set (full list re-renders on any toggle)
**Rationale**: The ref is never reassigned — its identity is stable — so mutations never trigger parent re-renders. The integer `readVersion` is the only state that changes on toggle; it forces the `filtered` useMemo to recompute without the cost of a full list re-render.

### Decision: Stable callbacks via useCallback in parent

**Choice**: `isRead(messageId)` and `toggleRead(messageId)` as `useCallback` functions in parent
**Alternatives considered**: Context per Message (overkill), render-prop pattern (adds complexity)
**Rationale**: The callbacks close over the stable ref. Since neither the ref nor the functions are recreated, Message receives referentially stable props and React.memo prevents unnecessary re-renders.

## Data Flow

```
User clicks toggle on Message #42
  → toggleRead("msg-42") called inside Message
  → readStateRef.current.set("msg-42", newValue)  ← mutates ref (no re-render)
  → setReadVersion(v => v + 1)                     ← parent state change

Parent re-renders (readVersion changed)
  → filtered useMemo recomputes (depends on readVersion)
  → virtualizer.updateVirtualItems() called
  → Message #42 self-renders (memo check passes, props changed)
  → Siblings (Messages #41, #43, ...) do NOT re-render (memo + stable props)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/routes/index.tsx` | Modify | Replace `readIds` Set state with `readStateRef` + `readVersion`. Update `filtered` useMemo dependency. Add `isRead`/`toggleRead` callbacks. |
| `src/components/Message.tsx` | Modify | Accept `isRead: (id: string) => boolean` and `toggleRead: (id: string) => void` instead of `read: boolean` + `onToggleRead: () => void`. |

## Interfaces / Contracts

```typescript
// Parent (index.tsx) — new state and callbacks
const readStateRef = useRef<Map<string, boolean>>(new Map());
const [readVersion, setReadVersion] = useState(0);

const isRead = useCallback((id: string) => readStateRef.current.get(id) ?? false, []);
const toggleRead = useCallback((id: string) => {
  const next = !readStateRef.current.get(id);
  readStateRef.current.set(id, next);
  setReadVersion(v => v + 1);
}, []);

// filtered useMemo — depends on readVersion (int), not readIds
const filtered = useMemo(() => {
  return messages.filter((m) => {
    if (hideRead && isRead(m.id)) return false;
    // ...other filters
  });
}, [messages, search, authorFilter, onlyHighlight, onlySuperChat, hideRead, readVersion]);

// Message render — stable callbacks, no prop drift
<Message
  m={m}
  isRead={isRead}
  toggleRead={toggleRead}
/>
```

```typescript
// Message props (updated)
interface MessageProps {
  m: ChatMessage;
  isRead: (id: string) => boolean;
  toggleRead: (id: string) => void;
}

// Inside Message — read initial state from ref-derived callback
const read = isRead(m.id);
// toggleRead is a stable function reference
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `isRead` returns correct value from ref; `toggleRead` mutates ref and increments version | Vitest: mock ref, assert map.set called + setReadVersion called |
| Unit | `filtered` recomputes when readVersion changes but not on other deps | Vitest: render with spy on filter logic |
| Integration | Toggle a message → only that message re-renders | React DevTools + render count spy |
| E2E | Hide-read filter + toggle several messages → correct messages visible | Playwright: click toggle N times, assert visibility |

## Migration / Rollout

No migration required. The change is a refactor of internal state management only. `readIds` state is removed entirely; the Map is initialized empty. Existing users see no change in behavior.

## Open Questions

None — the corrected approach fully specifies the implementation.
