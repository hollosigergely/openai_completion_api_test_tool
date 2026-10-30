# The OpenAI REST API in one page

Every call to the OpenAI API — and to almost every other LLM provider's API,
since most copy this shape — is a plain HTTP request. No SDK is required.

## Anatomy of a request

```
POST https://api.openai.com/v1/chat/completions
Content-Type: application/json
Authorization: Bearer sk-...your-key...

{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 1,
  "max_tokens": 200
}
```

- **Method + URL**: always `POST` for the endpoints we'll use.
- **`Content-Type: application/json`**: tells the server the body is JSON.
- **`Authorization: Bearer <key>`**: proves who's calling and who gets
  billed. Some non-OpenAI, open endpoints skip this header entirely.
- **Body**: a JSON object. Its shape depends on the endpoint.

## Chat Completions — `/v1/chat/completions`

**Request body fields:**
- `model` — which model answers (e.g. `gpt-4o-mini`)
- `messages` — the conversation so far, as a list of `{role, content}`.
  `role` is one of `system` (instructions), `user` (what the person said),
  or `assistant` (what the model said before, if continuing a conversation)
- `temperature` (0–2) — higher = more random/creative, lower = more
  deterministic
- `max_tokens` — hard cap on how long the answer can be

**Response shape (simplified):**
```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "Hi there!" } }
  ],
  "usage": { "prompt_tokens": 20, "completion_tokens": 3, "total_tokens": 23 }
}
```
The answer is at `choices[0].message.content`. `usage` is what you're
billed for.

## Embeddings — `/v1/embeddings`

**Request body fields:**
- `model` — e.g. `text-embedding-3-small`
- `input` — one string, or a list of strings, to convert into vectors

**Response shape (simplified):**
```json
{
  "data": [
    { "embedding": [0.0123, -0.0456, ...] },
    { "embedding": [0.0119, -0.0441, ...] }
  ]
}
```
Each `embedding` is a long list of numbers representing the *meaning* of
the input text. Two inputs with similar meaning produce similar vectors —
measured with **cosine similarity** (1.0 = same meaning, 0 = unrelated).
This is the basis of semantic search and "find similar documents" features.

## Errors are JSON too

A bad request doesn't crash anything silently — it comes back as a normal
HTTP response with a non-2xx status and a JSON body explaining what's
wrong, e.g.:
```json
{ "error": { "message": "Incorrect API key provided.", "type": "invalid_request_error" } }
```

## Try it

Use the course tool to send both of these requests yourself, edit the JSON
body directly, and see real responses (and real errors) come back.
