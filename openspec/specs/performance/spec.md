# Delta for Performance

## ADDED Requirements

### Requirement: Virtualized Message List Rendering

The system SHALL render the message list using windowed virtualization so that the DOM node count remains constant regardless of total message count.

The message list component MUST use `@tanstack/react-virtual` to render only visible rows. The virtualizer MUST preserve scroll position during updates without auto-scrolling to the bottom.

#### Scenario: Message list with 500+ messages

- GIVEN a message list containing 500+ messages
- WHEN the list is rendered
- THEN the DOM contains ≤50 message-related nodes
- AND scroll position is preserved from the previous render
- AND no auto-scroll to bottom occurs

#### Scenario: Scroll position stability during filter changes

- GIVEN a user has scrolled to a specific position in the message list
- WHEN a filter change triggers a re-render
- THEN the scroll position remains unchanged

### Requirement: Memoized Message Components

The system SHALL wrap `Message` and `Badge` components with `React.memo` to prevent re-renders caused by unrelated parent state changes.

#### Scenario: No re-render on unrelated state change

- GIVEN a `Message` component displaying a message
- WHEN parent state changes in a way that does not affect message data or callbacks
- THEN the `Message` component re-render count = 0
- AND the `Badge` component re-render count = 0

#### Scenario: Re-render on legitimate message change

- GIVEN a `Message` component
- WHEN its message data or associated callback changes
- THEN the component re-renders with updated content

## REMOVED Requirements

### Requirement: Direct Map Rendering

(Reason: Replaced by virtualized list rendering to improve performance. No behavior change — only DOM efficiency.)

(Migration: N/A — purely internal rendering optimization)