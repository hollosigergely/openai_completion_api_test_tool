# Presentation Plan: The OpenAI REST API

Plan for a short introduction talk. This is not the deck itself. Facts were checked on 2026-10-30; see [Sources](#sources).

## Assumptions

- **Audience:** developers in a corporate course. They know HTTP and JSON, but may not have used an LLM API.
- **Length:** 20 minutes, slides only. There are no live demos and no tools during the talk.
- **Afterwards:** attendees use the course tool for the hands-on exercises. The talk gives them what they need to read the requests and responses there.

## Storyline

The four required topics work best as one story rather than four separate lectures:

> An LLM API is one HTTP POST with a JSON body. That shape was set by Chat Completions in 2023, and most of the industry copied it. Learn it once and you can read nearly any LLM API.

The topics follow in your order, because each one prepares the next. History explains why the API looks the way it does, endpoints show what is available, and authentication gets a request accepted. JSON comes last and gets the most time, because attendees will use it directly in the exercises.

| # | Section | Minutes | Slides |
|---|---------|---------|--------|
| 0 | Opening: one real call | 2 | 1-2 |
| 1 | History | 4 | 3-4 |
| 2 | Endpoints | 4 | 5-7 |
| 3 | Authentication | 3 | 8-9 |
| 4 | JSON format | 6 | 10-14 |
| 5 | Wrap-up | 1 | 15 |
| | **Total** | **20** | **15** |

## Slide outline

### 0. Opening (2 min)

1. **Title** (0.5 min)
2. **One real call** (1.5 min). A static request and response, side by side, in the fewest lines that work. Point out that there is no SDK and no magic, then ask: "Why does it look like this?"

### 1. History (4 min)

Teach this as four eras, not a list of dates. Each era should explain something attendees will see in today's API.

3. **Four eras** (2.5 min). One timeline:
   - **2020-2022, text in, text out:** private beta with GPT-3, `/v1/completions`.
   - **2023, messages:** Chat Completions with `gpt-3.5-turbo` and role-tagged messages.
   - **2023-2024, tools and structure:** function calling, JSON mode, Structured Outputs.
   - **2025-2026, stateful agents:** Responses API, Conversations, Assistants API shut down in August 2026.
4. **Why this history matters** (1.5 min). The `messages` shape is what other providers copied, which is why it counts as a de facto standard. Endpoints and models also retire, so plan for migration.

### 2. Endpoints (4 min)

5. **The API map** (1.5 min). Group by job, not alphabetically:

   | Job | Endpoints |
   |-----|-----------|
   | Generate text | `/v1/responses`, `/v1/chat/completions` |
   | Represent meaning | `/v1/embeddings` |
   | Audio, images | Audio, Images, Realtime APIs |
   | Run at scale | Batch, Files |
   | Discover | `/v1/models` |
   | Administer | Administration API |

6. **Chat Completions vs Responses** (1.5 min). The key slide of this section:

   | | Chat Completions | Responses |
   |---|---|---|
   | Input | `messages` | `input`, `instructions` |
   | Output | `choices[].message` | `output[]` typed items |
   | State | You resend the transcript | Optional: `previous_response_id`, Conversations |
   | Portability | Copied widely | Check per provider |
   | OpenAI's advice | Still supported | Recommended for new projects |

7. **Which endpoint should I use?** (1 min). A small decision tree. Learn Chat Completions for portability, and use Responses for new OpenAI-only work.

### 3. Authentication (3 min)

8. **The header and the credentials** (1.5 min). `Authorization: Bearer <credential>`, then a short table:

   | Credential | Use it for |
   |-----------|-----------|
   | API key (project key) | Normal application requests |
   | Admin API key | Administration endpoints only |
   | Workload identity federation | Short-lived tokens instead of a stored secret |

   Mention that `OpenAI-Organization` and `OpenAI-Project` choose what a call is billed to.
9. **Keeping keys safe** (1.5 min). Never in browsers or apps. Load keys on the server from an environment variable or a key manager. Some open endpoints need no key at all. Failures to recognize: 401 is a bad key, 403 an unsupported region, 429 a rate or quota limit.

### 4. JSON format (6 min)

Use one running example throughout, so attendees follow a single request rather than unrelated snippets.

10. **Request anatomy** (1 min). `model`, `messages`, sampling and limit fields. Mention that `max_completion_tokens` replaces the deprecated `max_tokens`, because older tutorials still use it.
11. **Messages and roles** (1.5 min). `system`/`developer`, `user`, `assistant`, `tool`. The key idea: **the API is stateless, so you resend the conversation every time**.
12. **Response anatomy** (1.5 min). `choices[0].message`, `finish_reason` (`stop`, `length`, `tool_calls`, `content_filter`), and `usage`, which is what you pay for.
13. **Beyond plain text** (1 min). Tools: the model asks for a function call, your code runs it, and you send back the result. Structured output: `response_format` with a JSON schema, and the answer is still a string you parse.
14. **Errors** (1 min). The error object (`message`, `type`, `param`, `code`), and what to retry: 429 rate limits and 5xx yes; 400, 401 and exhausted quota no.

### 5. Wrap-up (1 min)

15. **Five things to remember** (1 min). It is one HTTP POST. The API is stateless. Check `finish_reason`. `usage` is your bill. Keep keys on the server. Then hand over to the exercises.

## Running the talk

- **Diagrams needed:** era timeline (slide 3), API map (5), decision tree (7).
- **If behind schedule:** shorten slide 4, then drop slide 7. Do not cut slides 6, 11 or 12.
- **Left out for time:** streaming and tool calling details. Tools can be introduced with the exercises.
- **Model names:** keep them to a minimum on slides, because they age quickly.

## Check before the exercises

These findings affect the hands-on part, not the slides. The tool has not been changed.

1. **`max_tokens`:** the tool's guided form still sends it, and OpenAI lists it as deprecated and incompatible with o-series models. It may fail on current reasoning models. Test it, and consider switching to `max_completion_tokens`. The batman server also needs checking.
2. **Tool calling:** GPT-6 Astra and GPT-6.1 Sol need the Responses API for tool calling, so the tools exercise will not work with them on Chat Completions. Use the batman endpoint if it supports tools, or another model that does.
3. **Default OpenAI models:** `gpt-4o-mini-2024-07-18` and the later `gpt-4o` snapshots retire on 14 January 2027. `gpt-4o-2024-05-13` retired on 23 October 2026. Update the tool's suggestions if the course runs near that date.
4. **Responses API in the tool:** the guided form only builds Chat Completions. Responses can be tried by hand-editing the URL and body, but the parsed view and "Add reply" will not work there.
5. **`ONE_PAGER.md`:** it uses `max_tokens` and does not mention the Responses API. Align it with the talk.

## Facts to confirm

Secondary sources only, so check these before they go on a slide:

- API private beta on 11 June 2020.
- Chat Completions launch on 1 March 2023.
- `text-embedding-ada-002` in December 2022.
- Legacy Completions: its models `davinci-002`, `babbage-002` and `gpt-3.5-turbo-instruct` were listed for shutdown on 28 September 2026. Confirm whether the endpoint has any model left before describing its status.
- The complete current endpoint list. OpenAI's overview page names only Responses, Realtime and Administration, and the API map on slide 5 is grouped from other pages.

## Timeline reference

| Date | Event |
|------|-------|
| Jun 2020 | API private beta with GPT-3 |
| Dec 2022 | `text-embedding-ada-002` |
| Mar 2023 | Chat Completions and `gpt-3.5-turbo` |
| 13 Jun 2023 | Function calling |
| Nov 2023 | DevDay: JSON mode, Assistants API, GPT-4 Turbo |
| 4 Jan 2024 | Base GPT models and `/v1/edits` shut down |
| 25 Jan 2024 | `text-embedding-3` models |
| 15 Apr 2024 | Batch API |
| 6 Aug 2024 | Structured Outputs |
| 1 Oct 2024 | Realtime API beta (GA 28 Aug 2025) |
| 11 Mar 2025 | Responses API |
| 7 Aug 2025 | GPT-5 |
| 20 Aug 2025 | Conversations API |
| 26 Aug 2026 | Assistants API shut down |
| 3 Sep 2026 | GPT-6 Astra; tool calling needs Responses for it |

## Sources

- [OpenAI API overview](https://developers.openai.com/api/docs/api-reference/introduction): authentication, headers, compatibility policy
- [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations): shutdown dates
- [OpenAI changelog](https://developers.openai.com/api/docs/changelog): feature dates
- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses): Chat Completions vs Responses
- [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create): request and response fields
- [Function calling guide](https://developers.openai.com/api/docs/guides/function-calling): tool calling limits
- [Models](https://developers.openai.com/api/docs/models): current models
- [Error codes](https://developers.openai.com/api/docs/guides/error-codes): error meanings
- [Function calling announcement](https://openai.com/blog/function-calling-and-other-api-updates)
- [DevDay announcement](https://openai.com/index/new-models-and-developer-products-announced-at-devday/)
- [Structured Outputs announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/)
- [New embedding models](https://openai.com/index/new-embedding-models-and-api-updates/)
- [OpenAI API on AI Wiki](https://aiwiki.ai/wiki/openai_api): secondary source for early history
