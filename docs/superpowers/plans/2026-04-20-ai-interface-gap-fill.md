# AI Interface Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four gaps found during the sub-project 7 audit: missing SSE protocol events that prevent the stream from rendering, unguarded AI nav link, missing "Try again" button on error, and missing `MessageBubble` unit tests.

**Architecture:** Backend `stream_response` is missing the `start`, `start-step`, and `finish-step` envelope events required by the Vercel AI SDK UI message stream protocol (`x-vercel-ai-ui-message-stream: v1`). Without `start` the SDK never creates an assistant message, making the feature silently broken in production. The three frontend gaps are small, self-contained UI fixes.

**Tech Stack:** Python / FastAPI / PydanticAI (backend), Next.js / Vercel AI SDK `ai@6` + `@ai-sdk/react@3` / PostHog (frontend), pytest-asyncio, Vitest / React Testing Library (tests)

---

## Files

| Action | Path | What changes |
|---|---|---|
| Modify | `apps/api/src/services/ai_service.py` | Add `encode_start`, `encode_start_step`, `encode_finish_step`; update `stream_response` to emit them |
| Modify | `apps/api/tests/test_ai_service.py` | Update `TestStreamEncoder` + `TestStreamResponse` to cover new events |
| Modify | `apps/web/src/components/ui/top-nav.tsx` | Gate AI nav link behind `ai-interface` PostHog feature flag |
| Modify | `apps/web/src/app/ai/AIChatPage.tsx` | Add "Try again" button (clears error by re-mounting) to error banner |
| Create | `apps/web/src/app/ai/MessageBubble.test.tsx` | Vitest tests for user/assistant rendering and disabled-while-streaming state |

---

## Task 1: Add missing SSE envelope events to `stream_response`

The Vercel AI SDK UI message stream protocol (`x-vercel-ai-ui-message-stream: v1`) requires three envelope events that the backend currently never emits:
- `{"type":"start"}` — tells the SDK to open a new assistant message
- `{"type":"start-step"}` — opens an agent step within that message
- `{"type":"finish-step"}` — closes the step

Without `start`, `DefaultChatTransport` silently discards all text deltas. The Storybook mock in `AIChatPage.stories.tsx` already shows the correct full sequence.

**Files:**
- Modify: `apps/api/src/services/ai_service.py`
- Modify: `apps/api/tests/test_ai_service.py`

- [ ] **Step 1.1: Write failing tests for the new encoder functions**

Add these three test methods to the `TestStreamEncoder` class in `apps/api/tests/test_ai_service.py`, after `test_encode_error`:

```python
def test_encode_start(self):
    from src.services.ai_service import encode_start

    result = encode_start()
    data = self._parse_sse(result)
    assert data["type"] == "start"

def test_encode_start_step(self):
    from src.services.ai_service import encode_start_step

    result = encode_start_step()
    data = self._parse_sse(result)
    assert data["type"] == "start-step"

def test_encode_finish_step(self):
    from src.services.ai_service import encode_finish_step

    result = encode_finish_step()
    data = self._parse_sse(result)
    assert data["type"] == "finish-step"
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
just test-api -k "test_encode_start or test_encode_start_step or test_encode_finish_step"
```

Expected: 3 FAILures — `ImportError: cannot import name 'encode_start'`

- [ ] **Step 1.3: Add the three encoder functions to `ai_service.py`**

In `apps/api/src/services/ai_service.py`, add these three functions after `encode_text_end` (around line 32):

```python
def encode_start() -> str:
    return _sse({"type": "start"})


def encode_start_step() -> str:
    return _sse({"type": "start-step"})


def encode_finish_step() -> str:
    return _sse({"type": "finish-step"})
```

- [ ] **Step 1.4: Run encoder tests to confirm they pass**

```bash
just test-api -k "test_encode_start or test_encode_start_step or test_encode_finish_step"
```

Expected: 3 PASSes

- [ ] **Step 1.5: Update `stream_response` to emit the envelope events**

In `apps/api/src/services/ai_service.py`, update `stream_response` so the `try` block reads:

```python
    try:
        agent = get_agent()
        yield encode_start()
        yield encode_start_step()
        yield encode_text_start(text_id)
        async with agent.run_stream(
            user_prompt, message_history=message_history, deps=deps
        ) as result:
            async for chunk in result.stream_text(delta=True):
                yield encode_text_delta(text_id, chunk)
        yield encode_text_end(text_id)

        for i, part in enumerate(deps.result_parts):
            data_type = part["type"]
            yield encode_data_part(data_type, f"data-{i}", part)

        yield encode_finish_step()
        yield encode_finish()
    except Exception as e:
        yield encode_error(str(e))
        yield encode_finish("error")
```

- [ ] **Step 1.6: Update `TestStreamResponse` to expect the new events**

Replace the `test_single_user_message_yields_full_text_sequence` method in `apps/api/tests/test_ai_service.py` with:

```python
async def test_single_user_message_yields_full_text_sequence(self, db):
    import src.services.ai_service as ai_svc
    from pydantic_ai import Agent
    from pydantic_ai.models.test import TestModel
    from src.models.ai import ChatMessage
    from src.services.ai_service import SYSTEM_PROMPT, AIServiceDeps

    test_agent: Agent[AIServiceDeps, str] = Agent(
        model=TestModel(custom_output_text="Hello from test."),
        system_prompt=SYSTEM_PROMPT,
        deps_type=AIServiceDeps,
    )

    original = ai_svc._agent
    ai_svc._agent = test_agent
    try:
        messages = [ChatMessage(role="user", content="What data is available?")]
        events = []
        async for chunk in ai_svc.stream_response(db, messages):
            events.append(chunk)
    finally:
        ai_svc._agent = original

    parsed = self._parse_events(events)
    types = [p["type"] for p in parsed]

    assert types[0] == "start"
    assert types[1] == "start-step"
    assert types[2] == "text-start"
    assert any(t == "text-delta" for t in types)
    assert "text-end" in types
    assert "finish-step" in types
    assert types[-1] == "finish"
    assert parsed[-1]["finishReason"] == "stop"
```

- [ ] **Step 1.7: Run full AI service test suite**

```bash
just test-api -k "test_ai_service or TestStreamEncoder or TestStreamResponse or TestListPackages or TestGetFieldTree or TestRunCrosstab or TestRunTrend"
```

Expected: all green

- [ ] **Step 1.8: Commit**

Write to `/tmp/commit-msg.txt`:

```
fix(api): emit start/start-step/finish-step SSE envelope events in stream_response

The Vercel AI SDK UI message stream protocol (x-vercel-ai-ui-message-stream: v1)
requires start, start-step, and finish-step envelope events. Without `start` the
DefaultChatTransport silently discards all text deltas, making the AI chat
feature non-functional in production.
```

Then:
```bash
git add apps/api/src/services/ai_service.py apps/api/tests/test_ai_service.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 2: Feature-flag the AI nav link

The `top-nav.tsx` currently shows the "AI" nav link unconditionally. The spec requires both the nav link and the `/ai` page to be gated by the `ai-interface` PostHog feature flag. The page already enforces this; the nav link does not.

**Files:**
- Modify: `apps/web/src/components/ui/top-nav.tsx`

- [ ] **Step 2.1: Add the feature flag hook to `top-nav.tsx`**

Replace the static `NAV_LINKS` array and add a dynamic filter. In `apps/web/src/components/ui/top-nav.tsx`:

1. Add the import after the existing imports:

```typescript
import { useFeatureFlag } from "@posthog/next"
```

2. Replace the static `NAV_LINKS` constant and update `TopNav` to filter dynamically:

```typescript
const ALL_NAV_LINKS = [
  { href: "/analytics", label: "Analytics", flag: null },
  { href: "/ai", label: "AI", flag: "ai-interface" as const },
]

export function TopNav() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const aiFlag = useFeatureFlag("ai-interface")

  const navLinks = ALL_NAV_LINKS.filter(({ flag }) => {
    if (flag === "ai-interface") return aiFlag?.enabled === true
    return true
  })
```

3. Update the JSX to use `navLinks` instead of `NAV_LINKS`:

```tsx
      <div className="flex gap-1">
        {navLinks.map(({ href, label }) => {
```

- [ ] **Step 2.2: Verify typecheck passes**

```bash
just typecheck
```

Expected: no errors

- [ ] **Step 2.3: Commit**

Write to `/tmp/commit-msg.txt`:

```
fix(web): gate AI nav link behind ai-interface PostHog feature flag

The /ai page already enforces the feature flag; the nav link was missing
the same guard, so the link appeared for all users regardless of flag state.
```

Then:
```bash
git add apps/web/src/components/ui/top-nav.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: Add "Try again" button to error state

The spec requires: "Stream error on frontend → rendered as a system message in the chat with a 'Try again' button." The current implementation shows a static error banner with no action.

**Files:**
- Modify: `apps/web/src/app/ai/AIChatPage.tsx`

- [ ] **Step 3.1: Add reload callback to `AIChatPage`**

Replace the contents of `apps/web/src/app/ai/AIChatPage.tsx` with:

```typescript
"use client"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { FormEvent } from "react"
import { useState } from "react"
import { ChatInput } from "./ChatInput"
import { MessageList } from "./MessageList"

export function AIChatPage() {
  const [input, setInput] = useState("")
  const [key, setKey] = useState(0)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/chat`,
    }),
  })

  const isLoading = status === "submitted" || status === "streaming"

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div key={key} data-testid="ai-chat-page" className="flex h-full flex-col">
      {error && (
        <div className="flex items-center gap-3 border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>Something went wrong. Please try again.</span>
          <button
            type="button"
            onClick={() => setKey((k) => k + 1)}
            className="underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={(value) => setInput(value)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
```

The `key` state causes React to fully remount the component (and therefore reset `useChat`) when "Try again" is clicked.

- [ ] **Step 3.2: Verify typecheck passes**

```bash
just typecheck
```

Expected: no errors

- [ ] **Step 3.3: Commit**

Write to `/tmp/commit-msg.txt`:

```
fix(web): add Try again button to AI chat error banner

Clicking Try again remounts the component, resetting the useChat hook
so the user can start a fresh conversation without a page reload.
```

Then:
```bash
git add apps/web/src/app/ai/AIChatPage.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: Add `MessageBubble` Vitest unit tests

The spec requires Vitest unit tests for `MessageBubble` covering user vs. assistant rendering and the streaming/disabled state.

**Files:**
- Create: `apps/web/src/app/ai/MessageBubble.test.tsx`

- [ ] **Step 4.1: Write the test file**

Create `apps/web/src/app/ai/MessageBubble.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MessageBubble } from "./MessageBubble"

describe("MessageBubble", () => {
  it("renders user bubble right-aligned", () => {
    render(<MessageBubble sender="user" content="Hello there" />)
    const bubble = screen.getByTestId("message-bubble-user")
    expect(bubble).toBeInTheDocument()
    expect(bubble.className).toContain("justify-end")
    expect(screen.getByText("Hello there")).toBeInTheDocument()
  })

  it("renders assistant bubble left-aligned", () => {
    render(<MessageBubble sender="assistant" content="Hi, I can help." />)
    const bubble = screen.getByTestId("message-bubble-assistant")
    expect(bubble).toBeInTheDocument()
    expect(bubble.className).toContain("justify-start")
    expect(screen.getByText("Hi, I can help.")).toBeInTheDocument()
  })

  it("renders streaming partial text as content", () => {
    render(<MessageBubble sender="assistant" content="Thinking…" />)
    expect(screen.getByText("Thinking…")).toBeInTheDocument()
  })

  it("renders ReactNode content (not just strings)", () => {
    render(
      <MessageBubble
        sender="assistant"
        content={<span data-testid="rich-content">Rich content</span>}
      />,
    )
    expect(screen.getByTestId("rich-content")).toBeInTheDocument()
  })
})
```

- [ ] **Step 4.2: Run the tests**

```bash
just test-web MessageBubble
```

Expected: 4 PASSes

- [ ] **Step 4.3: Commit**

Write to `/tmp/commit-msg.txt`:

```
test(web): add MessageBubble unit tests

Covers user/assistant alignment, streaming partial text, and ReactNode
content as required by the AI interface spec.
```

Then:
```bash
git add apps/web/src/app/ai/MessageBubble.test.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1 — stream format (start/start-step/finish-step) gap
- ✅ Task 2 — nav link feature flag gap
- ✅ Task 3 — "Try again" button gap
- ✅ Task 4 — `MessageBubble` unit test gap
- `AIServiceError` not used for HTTP 500 — intentionally excluded; SSE responses are always HTTP 200 and streaming the error is the correct pattern for this protocol

**Placeholder scan:** No TBDs, TODOs, or vague instructions — all steps have exact code.

**Type consistency:** `encode_start/encode_start_step/encode_finish_step` are defined in Task 1 and used only in Task 1. `key`/`setKey` in Task 3 are local state. No cross-task type dependencies.

**Patterns compliance:**
- Python: new encoder functions return `str`, consistent with existing encoder signatures
- Python: no `Any` introduced; `stream_response` signature unchanged
- TypeScript: no `as any`; `useFeatureFlag` return type narrowed with `?.enabled === true`; no raw hex or `text-primary` text color introduced
