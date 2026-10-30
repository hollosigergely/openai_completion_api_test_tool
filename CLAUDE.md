# OpenAI REST API Course Tool

Self-hosted teaching tool for a business course on LLM APIs. Attendees open one page, enter a shared course password, and send real REST calls (Chat Completions, Embeddings) with their own API key (or none, for open endpoints), seeing the raw request/response JSON. Theory handout: `ONE_PAGER.md`. Setup/exercises: `README.md`.

## Run

```bash
npm install
cp .env.example .env   # set COURSE_PASSWORD, COOKIE_SECRET, optional PORT (default 3000)
npm start
```

No test suite, no build step. Node >= 18 (native `fetch`); dependencies are only express, cookie-parser, dotenv.

## Architecture

- `server/index.js`: Express app. Serves `public/`, `POST /api/login` (checks `COURSE_PASSWORD`, sets 8h signed httpOnly cookie), `POST /api/relay` (requires cookie).
- `server/relay.js`: deliberately dumb generic relay. Takes `{ url, method, headers, body }`, drops blank headers (so an empty API key sends no `Authorization`), returns `{ status, headers, body }` verbatim. No OpenAI knowledge, no host allowlist; the password gate is the only protection.
- `public/`: vanilla HTML/CSS/JS, no framework. All OpenAI-specific logic (URLs, body shapes, cosine similarity) lives in `public/app.js`.

## Design decisions (confirmed with the user)

- Attendees bring their own API key; the server holds no OpenAI key and stores nothing. Keys only pass through one relayed request, never log them.
- Access control is one shared course password, not per-attendee codes or budgets.
- Request body textarea is editable and auto-synced from the guided form until the user edits it directly (dirty flag per tab); "Re-sync from form" resets it. The Raw request panel is a read-only preview with optional key masking (display only; the real key is always what gets sent).
- Embeddings: one call with `input: [A, B]`; similarity is computed client-side. Long number arrays are truncated for display only (`truncateForDisplay`), the full response is kept for the calculation.
- Endpoint URL and model fields are free text with `<datalist>` suggestions. Defaults include `http://batman.tmit.bme.hu:8000/v1/chat/completions` and model `openai/gpt-oss-120b`. Each tab keeps its own URL in `state.urls`.
- Layout: full-width, viewport-height, panels scroll independently. The endpoint config is a single-line collapsed bar (summary shows URL and key set/not set). Narrow screens (<1000px) stack to one column.

## Gotchas

- An ID selector with `display` overrides the `hidden` attribute. `#login-screen` and `#tool-screen` each need an explicit `[hidden] { display: none; }` rule; add the same for any new element that sets `display` and is toggled via `hidden`.
- OpenAI error responses may arrive with `content-type: text/plain`, so `relay.js` only parses JSON when the content type says JSON and otherwise passes the raw text through. This is intentional.
- The `hidden`-toggled `.collapsible-content[hidden]` rule must keep higher specificity than `.endpoint-fields { display: flex }`.
- Layout changes need a real browser check; curl and tag counts do not verify them.

## Working preferences

- For non-trivial changes the user wants a plan first. They have asked for plan-only turns and then implemented with a different (Sonnet) model.
- Keep changes minimal and match the existing vanilla-JS style; no build tooling or frameworks.
