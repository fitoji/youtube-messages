# Delta for Performance

## MODIFIED Requirements

### Requirement: Memoized Message Components

The system SHALL wrap `Message` and `Badge` components with `React.memo` and isolate per-message state to prevent re-renders caused by unrelated parent state changes, including `toggleRead` operations.

Each `Message` component MUST manage its own read state internally via `useState` so that calling `toggleRead` on one message does NOT cause sibling messages to re-render. The parent component MUST NOT hold `readIds` in state or as a `useMemo` dependency for filtered message computation.

(Previously: Memoized components only — no internal read state isolation)

#### Scenario: toggleRead does not re-render sibling messages

- GIVEN a `MessageList` with 3+ messages rendered
- WHEN `toggleRead(messageId)` is called on message A
- THEN message A re-renders with updated read indicator
- AND message B (sibling) re-render count = 0
- AND message C (sibling) re-render count = 0

#### Scenario: toggleRead does not re-run filtered useMemo

- GIVEN a `filteredMessages` useMemo with `[readIds]` dependency
- WHEN `toggleRead` is called on any message
- THEN the useMemo does NOT re-execute
- AND the filtered result is unchanged

#### Scenario: Read state persists across filter changes

- GIVEN message A is marked read
- WHEN the user applies a filter that excludes message A
- AND then removes the filter
- THEN message A remains marked read

#### Scenario: Re-render on legitimate message change (unchanged)

- GIVEN a `Message` component
- WHEN its message data or associated callback changes
- THEN the component re-renders with updated content
