# Design: `critical-perf-virtualization-memo`

## Technical Approach

Replace the unconstrained `filtered.map()` with `@tanstack/react-virtual`'s `useVirtualizer`, and wrap `Message`/`Badge` with `React.memo`. The virtualizer wraps the same `<div ref={listRef}>` scroll container — only the rendered subset of `filtered` is mounted in the DOM at any time, capping real DOM nodes at ≤50 regardless of total message count.

## Architecture Decisions

### Decision: useVirtualizer over manual windowing

**Choice**: `useVirtualizer` from `@tanstack/react-virtual`
**Alternatives considered**: Manual `slice` + `startIndex` state, `react-window`
**Rationale**: `@tanstack/react-virtual` integrates cleanly with React's render model, handles dynamic measurement via `measureElement`, and has no layout shift issues. It is already the project's established choice (no other windowing lib present). `react-window` would work but is less flexible for variable-height items.

### Decision: estimateSize = 60px

**Choice**: Fixed estimate of 60px per message row
**Alternatives considered**: Dynamic `measureElement` on first render
**Rationale**: The proposal requires ≤50 DOM nodes. With a 60px estimate and ~52px visible viewport height (h-[60vh] minus padding), the virtualizer renders ~12 items — well under the 50-node budget. Most messages are single-line text (~40–50px). Super Chat rows may be taller but the over-estimate only adds a couple extra rendered rows, which is acceptable. Adding dynamic measurement would require a `measureElement` callback and extra infrastructure for marginal gain.

### Decision: NO auto-scroll in the virtualizer

**Choice**: `useVirtualizer.scrollOffset` is NOT adjusted when new messages arrive and `autoScroll=false`
**Alternatives considered**: Smart auto-scroll (only if user is within N px of bottom)
**Rationale**: The proposal explicitly excludes scroll-to-bottom UI and opts out of auto-scroll. In a virtualized list, auto-scroll means re-focusing to the last index. Without it, the user's viewport stays fixed — new messages appear below the fold, exactly like reading a forum thread. This is the correct behavior for a live chat viewer where you want to read history without interruption.

### Decision: React.memo on Message and Badge

**Choice**: `React.memo(Message)` and `React.memo(Badge)` with stable `key` and stable callback refs
**Alternatives considered**: No memo, `useMemo` inside Message
**Rationale**: The `onToggleRead={() => toggleRead(m.id)}` pattern creates a new function reference on every render of the parent. Without memo, every one of the 500 `Message` components re-renders on every keystroke in the search box. `React.memo` with `key={m.id}` (stable) + `useCallback` on the callback solves this. `Badge` is already cheap but gets memoized for consistency.

### Decision: Stable toggleRead callback via useCallback

**Choice**: Wrap `onToggleRead` in `useCallback(id, [])` inside a `getItemArgs` ref pattern
**Alternatives considered**: Inline `useCallback` in JSX, `useMemo` per item
**Rationale**: A naive `filtered.map((m) => <Message ... onToggleRead={useCallback(() => toggleRead(m.id), [m.id])} />` ) violates the hooks rule. The correct pattern is a stable `getItemArgs(id)` ref that returns a stable callback — no new function created on re-render.

## Data Flow

```
messages state (updating)
  └─ useMemo: filtered ──► useVirtualizer.getVirtualItems()
        │                       │
        │                  ┌────┴────┐
        │                  │ virtual │
        │                  │ render  │
        │                  └─────────┘
        │
  setMessages([...prev, ...fresh]) during polling
        │
  new message arrives → virtualizer recalculates totalSize
        │
  autoScroll=true → scrollOffset → last index
  autoScroll=false → scrollOffset unchanged (user keeps position)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@tanstack/react-virtual ^3.x` |
| `src/routes/index.tsx` | Modify | Integrate useVirtualizer, memo wrappers, stable callback pattern |

## Interface Changes

### MessageProps (unchanged — just memoized)

```ts
interface MessageProps {
  m: ChatMessage;
  read: boolean;
  onToggleRead: () => void;
}
```

### BadgeProps (unchanged — just memoized)

```ts
interface BadgeProps {
  label: string;
  tone: "owner" | "moderator" | "sponsor" | "superchat";
}
```

### New imports

```ts
import { useVirtualizer } from "@tanstack/react-virtual";
```

### New ref for item args (stable callbacks)

```ts
// Inside Index component, alongside listRef:
const getItemArgsRef = useRef((id: string) => () => toggleRead(id));
// Usage in map: onToggleRead={getItemArgsRef.current(m.id)}
```

### Virtualizer setup

```ts
const rowVirtualizer = useVirtualizer({
  count: filtered.length,
  getScrollElement: () => listRef.current,
  estimateSize: () => 60,
  getItemKey: (index) => filtered[index]!.id,
  overscan: 5, // renders 5 extra items above/below viewport for smooth scroll
});
```

### Render loop replaces .map()

```tsx
<div ref={listRef} className="mt-2 rounded-xl bg-card border border-border h-[60vh] overflow-y-auto p-2 space-y-1">
  {filtered.length === 0 ? (
    <p className="text-center text-sm text-muted-foreground py-12">
      Esperando mensajes...
    </p>
  ) : (
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const m = filtered[virtualRow.index]!;
        return (
          <div
            key={m.id}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <Message
              m={m}
              read={readIds.has(m.id)}
              onToggleRead={getItemArgsRef.current(m.id)}
            />
          </div>
        </div>
      })}
    </div>
  )}
</div>
```

## Auto-Scroll Behavior (Explicit)

- **autoScroll = true**: `rowVirtualizer.scrollToIndex(filtered.length - 1)` in a `useEffect` keyed on `[messages]` — same semantics as the current `el.scrollTop = el.scrollHeight` approach
- **autoScroll = false**: No scroll adjustment — user's viewport is preserved because virtualizer's totalSize grows below the fold

The existing `useEffect` at line 116-120 that sets `el.scrollTop` is removed and replaced with the virtualizer's `scrollToIndex` approach, keeping the same `autoScroll` state dependency.

## Edge Cases

| Case | Handling |
|------|----------|
| Empty `filtered` | Shows "Esperando mensajes..." placeholder — no virtualizer mount |
| Filter reduces 500 → 0 | Virtualizer unmounts, placeholder shown |
| MAX_MESSAGES trim (500→500, oldest dropped) | Virtualizer totalSize decreases — scroll position maintained naturally |
| First render with 500 messages | Only ~12 rows mounted (overscan: 5), rest virtualized |
| SuperChat (taller row) | estimateSize=60 overestimates, slight overallocation but no correctness issues |
| readIds changes | `filtered` useMemo deps include `readIds` → filtered recomputes → virtualizer re-renders only if filtered.length or order changes |
| toggleRead called | `readIds` Set replacement triggers `filtered` recompute → virtualizer items re-evaluated but Message re-renders blocked by memo + stable callback |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `filtered` useMemo recomputes only on relevant dep changes | Snapshot test on filtered output with mocked messages |
| Unit | `Message` memoizes — does NOT re-render when unrelated parent state changes | Render count assertion via `jest.fn()` spy on Message body |
| Unit | `Badge` memoizes | Same as Message |
| Integration | Virtualizer totalSize ≈ count × 60px | Assert container height matches |
| Integration | DOM node count ≤ 50 with 500 messages | `document.querySelectorAll("*").length` inside list container |
| Integration | Scroll position preserved when autoScroll=false | Set scrollTop=100, add message, assert scrollTop still 100 |
| E2E | 500+ messages render with ≤50 DOM nodes | Playwright assertion on rendered page |
| E2E | Search filter reduces visible DOM nodes | Type in search, assert filtered count < 50 |
