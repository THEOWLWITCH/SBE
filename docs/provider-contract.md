# Provider and scenario contracts

The existing Anthropic default (`claude-opus-5`) and OpenAI default (`gpt-4.1`) remain unchanged. API model IDs come from explicit adapter configuration or `MODEL`; Codex desktop model settings do not select an API model. No paid model call was made for this change.

## Completion request

`getProvider(name).complete(request)` accepts one of `prompt: string` or `messages: [{role:'user'|'assistant', content:string|ContentBlock[]}]`. Supplying both fails instead of dropping content. `system` is separate text (or text blocks). Ordered history includes text, `tool_use` and `tool_result` blocks; the OpenAI adapter converts the latter to ordered Responses `function_call` and `function_call_output` items. It does not flatten the history into one string.

The shared file envelope is `{name, mediaType, data}` where `data` is base64. PDF, raster image, and text files are supported; native Anthropic image/document blocks remain accepted. OpenAI receives PDF `input_file`, image `input_image`, and text `input_text` parts. Other file formats fail as unsupported rather than being silently removed. Provider file IDs, arbitrary native built-in tools, audio, and video are outside this shared contract.

Function tools accept `{name,description?,input_schema,strict?}` or OpenAI function definitions with `parameters`. The adapter maps only declared tools. `toolChoice` supports `auto`, `none`, `any`/`required`, and `{type:'tool',name}`/`{type:'function',name}`. Forcing an undeclared tool fails before transport. Request metadata outside the contract, such as a message's `privateNotes`, is not copied. This is a payload boundary, not a substitute for the server's authorized audience/context envelope: text and tool arguments intentionally supplied in the envelope remain model inputs.

`variation` defaults to `medium`; `maxTokens` defaults to 220. The local hard ceiling is 64,000 tokens. GPT-4.1 requests above its documented 32,768 output limit fail before transport; `provider.maxOutputTokens` exposes that limit for the server. Unknown models receive no assumed temperature option and retain their exact configured ID; the local ceiling does not establish their API availability or actual limits. Anthropic keeps adaptive thinking and its existing effort mapping. Documented models that reject forced tool use (Opus/Sonnet 5.5 and Fable/Mythos 5.1) fail explicitly for those choices. Timeout and AbortSignal are supported; only retryable transport/HTTP errors receive one retry. The pipeline does not add another retry layer.

## Completion result and errors

Successful results have `{text,toolCalls,usage,status:'completed',refusal:null,truncation:null,raw}`. Tool calls are `{id,name,input}` with object JSON input. Text can be empty for a valid tool-only result. Usage preserves provider token keys and adds `inputTokens`, `outputTokens`, and `totalTokens`; unavailable values are `null`.

Refusal, truncation, failed status, empty output, malformed tool JSON, and invalid response shape raise `ProviderError` instead of becoming success. The error has `code`, `retryable`, HTTP `status` when known, `completionStatus`, `usage`, `refusal`, `truncation`, and a normalized `result` when a response was received. HTTP error bodies are not included in the user-visible message. Raw model responses contain private content and must not be logged in routine traces. `assertCompletionResult` enforces the same completion boundary for injected providers; legacy synthetic providers may omit status, but real adapters always include it.

For deterministic testing, `getProvider(name,{apiKey:'synthetic',transport})` accepts a transport function receiving `{url,headers,body,stream,timeoutMs,signal}` and returning the real provider response shape. Keys and transport overrides are server/test configuration, never request-body options.

## Pipeline and persistence

`runPipeline(input,provider,{sourceLibrary,maxTokens,signal,onStage})` validates input, snapshots it, checks each stage after parsing, and checks final gates before returning. A rejected stage is marked `error`, never `done`. Empty/partial JSON, absent required character or document fields, invalid branch enums, missing endings, malformed trainee sections, unsupported languages, altered locks, and unapproved citations fail with `OutputContractError {code:'output_contract',stage,details}`. The final result includes the exact server-owned `given` snapshot and all required stage fields, gate outcomes, and aggregate usage. Stage validation follows the existing simulation prompt schemas; it does not claim to implement future reviewer/synthesis or activityArtifact contracts.

Locks target exact dotted paths such as `characters.actor.role` or `given.whatHappened`; equality preserves whitespace and spelling. Legacy `who` means `characters.trainee.role`; `actorRole`, `whatHappened`, and `goals` map to their explicit paths. Finding the same phrase elsewhere does not satisfy a lock. A lock on an absent path fails. The entire final `given` object must equal the captured input. This proves data preservation; it cannot prove that narrative prose contains no semantic contradiction.

The server selects the source bank. The third argument to `runGates(output,input,{sourceLibrary})` is authoritative; `input.sourceLibrary` has no authority. Only entries `{sourceId,title,citation?,approved:true,hidden:false}` are eligible. Approval here means inclusion in the existing curated bank, not educational efficacy. Output `sources` is an array of `{sourceId,citation?,title?}`; supplied text must equal the bank. Unknown IDs, citations without IDs, duplicate IDs, and unpublished/hidden entries fail. An empty bank requires `sources:[]`.

`toScenario(output,{input,meta,sourceLibrary})` checks final gates again immediately before conversion. It preserves the input snapshot and source IDs, and resolves citations from the server bank for the existing document renderer. Rejections occur before the caller can persist a converted candidate. Existing saved scenarios are not mutated or migrated by these functions; older output needs an explicit validated adaptation before being regenerated.

Exact gates prevent known structural failures and literal leakage in all trainee-visible sections, including trainee stakes. Semantic leakage, pedagogy, gender heuristics, and narrative quality still require human review. Passing gates never grants publication/approval status, authorizes sharing, or establishes educational benefit.

## Verification

Run `node --preserve-symlinks --preserve-symlinks-main --test harness/tests/provider-gates.test.mjs harness/tests/baseline.test.mjs`. The new regressions were run against the original implementation first: empty objects passed, invalid stage 1 reached done, and provider transport injection was unsupported. The updated tests exercise synthetic real payloads for both adapters, ordered history and tools, files, separate system instructions, refusal/truncation/usage, bounded retry/cancel, every stage boundary, approved source selection, exact locks, input snapshot preservation, and the conversion guard. No live-model or human-quality result is inferred from these tests.

API mappings were checked on 2026-10-07 against [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [GPT-4.1 limits](https://developers.openai.com/api/docs/models/gpt-4.1), and [Anthropic tool choice](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools).
