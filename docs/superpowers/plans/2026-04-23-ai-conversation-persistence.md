# AI Conversation Persistence — Follow-up from Sub-project 10

**Surfaced by:** `docs/superpowers/plans/2026-04-23-verify-existing-functionality.md` Task 2
**Current state:** `/api/v1/ai/chat` accepts a full message history on every POST as an in-flight `ChatRequest` and replays it into the pydantic-ai agent. There is no `conversations` or `messages` SQL table. `apps/api/src/models/ai.py` defines only ephemeral pydantic models; `AIChatPage.tsx` keeps state in memory. Reloading the browser loses the history.
**Gap:** No persistence layer. To meet the "AI Interface V2" vision the app needs: (a) `conversations` + `messages` tables + migration, (b) a route to list and resume a conversation, (c) client hydration that loads the latest conversation on mount, (d) pagination / truncation for long threads, (e) ownership enforcement (conversation scoped to user_id + org_id).
**Estimated effort:** ~1–2 days. Schema + migration is straightforward; harder bits are hydration UX (which conversation do we load?), retention policy, and token-window truncation when replaying.
**Next step:** Fold into the AI Interface V2 sub-project spec rather than a standalone plan — persistence is one of several V2 concerns alongside multi-turn correction and tool-call visibility. Brainstorm the UX first (single rolling conversation vs. sidebar list vs. project-scoped threads).

---
