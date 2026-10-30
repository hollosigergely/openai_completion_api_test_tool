# OpenAI REST API — Course Tool

A self-hosted, no-install tool for teaching the OpenAI REST API. Attendees
open one page, enter the course password, and send real HTTP requests
(Chat Completions, Embeddings) using their own API key — or no key, for
open endpoints. The backend is a generic relay: it forwards whatever
URL/headers/body the browser sends and returns the response verbatim, so
it works for the OpenAI API and other OpenAI-compatible or open endpoints
without code changes.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set COURSE_PASSWORD and COOKIE_SECRET to real values
npm start
```

Then open `http://localhost:3000` (or your server's address). Share the
course password with attendees at the start of the session.

To host for a class, run this on any machine reachable by attendees (a
small VPS, a laptop on the same network, etc.), optionally behind a
reverse proxy for HTTPS. No database, no API key of your own, and no
per-attendee accounts are needed.

## Docker

```bash
cp .env.example .env    # set COURSE_PASSWORD and COOKIE_SECRET
docker compose up -d --build
```

The app is then on `http://localhost:3000` (set `HOST_PORT` to publish another
port). Settings come from `.env` at start; `.env` is never copied into the
image, so after editing it run `docker compose up -d` again. Without Compose:

```bash
docker build -t openai-api-course-tool .
docker run -d --name course-tool --restart unless-stopped \
  --env-file .env -e PORT=3000 -p 3000:3000 openai-api-course-tool
```

The relay runs inside the container, so endpoints like `localhost` mean the
container itself, not your machine; use a reachable hostname or IP.

## How it works

- `server/index.js` — Express app. Serves the frontend, checks the course
  password (`POST /api/login`, sets a signed cookie), and exposes the
  relay (`POST /api/relay`, requires the cookie).
- `server/relay.js` — forwards `{ url, method, headers, body }` to the
  target and returns `{ status, headers, body }` unmodified. Doesn't know
  anything about OpenAI specifically — the frontend decides what to send.
- `public/` — the page attendees use: endpoint URL + API key fields, a
  Chat Completions tab and an Embeddings tab (each with a guided form and
  an editable raw JSON body), and always-visible raw request/response
  panels.

Nothing is stored server-side beyond the course password check — each
attendee's API key only ever passes through a single relayed request.

## Exercises

See [ONE_PAGER.md](ONE_PAGER.md) for the short theory handout to present
before the exercises. Suggested flow:
1. Send a basic Chat Completions request with the guided form, read the
   raw request/response.
2. Edit the raw JSON body directly (e.g. change `temperature` or add a
   message) and resend.
3. Break it on purpose — use a bad API key or an invalid `model` — and
   look at the real error response.
4. Switch to Embeddings, compare two sentences, and look at the cosine
   similarity score.
   Structured output exercise (Chat tab, "Structured output" section):
   ask for name, email and sentiment of a pasted customer email with plain
   prompting (free text); then JSON mode; then JSON schema (use "Insert
   example"); then break the schema (remove `additionalProperties: false`
   or a `required` entry) and read the 400; finally set max tokens to 10 and
   see the truncated, unparseable answer.
5. (Optional, for groups with their own key) Point the endpoint URL at a
   different OpenAI-compatible provider and see the same request shape work.
