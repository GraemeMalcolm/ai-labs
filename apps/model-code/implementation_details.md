# Model Coder Implementation Details

This document explains the current implementation and how to trace runtime behavior across files.

## 1. File Map

- `index.html`
  - Declares app shell, toolbar controls, status pills, editor/terminal containers, splitter, and About modal.
  - Includes `coi-serviceworker.js`, `styles.css`, PyScript runtime, and `app.js`.
- `styles.css`
  - Contains layout, theming (light/dark), terminal/editor visual integration, splitter styles, focus/a11y styles, and modal styles.
- `app.js`
  - Main orchestration layer for UI, template loading, run lifecycle, terminal session control, theme persistence, accessibility helpers, modal behavior.
- `llm.js`
  - Local model runtime using `wllama`; receives OpenAI-like payloads, builds ChatML prompts, returns response data/streams.
- `nopenai.py`
  - Python compatibility layer exposing `OpenAI` and `AsyncOpenAI` with chat/responses APIs and streaming interfaces.
- `coi-serviceworker.js`
  - Service worker bootstrap to support COOP/COEP behavior on static hosting.

## 2. Startup Flow

### 2.1 HTML and runtime bootstrap

1. Browser loads `index.html`.
2. `coi-serviceworker.js` is loaded early.
3. PyScript runtime scripts load.
4. `app.js` loads as module and imports `llm.js`.

### 2.2 Bridge and model runtime registration (`llm.js`)

1. `llm.js` creates `ModelCoderLLM` instance (`llmRuntime`).
2. It defines bridge functions:
   - `modelCoderSetStatusListener`
   - `modelCoderInit`
   - `modelCoderRequest`
   - `modelCoderResetSession`
   - `modelCoderNextStreamChunk`
3. It builds `modelCoderBridge` object and attaches both object + individual functions to:
   - `globalThis`
   - `window` (if present)
   - `self` (if present)

This attachment strategy is critical for PyScript execution contexts.

### 2.3 App initialization (`app.js`)

`initializeApp()` performs:

1. Sets initial status pills.
2. Registers status callback through `window.modelCoderSetStatusListener(...)`.
3. Registers `window.modelCoderMarkRunComplete` callback used by Python wrapper completion path.
4. Applies saved theme and initializes splitter.
5. Hooks all UI events:
   - Run/Stop/Retry
   - template change
   - reset layout
   - theme toggle
   - About modal open/close
6. Loads `nopenai.py` source into memory (`state.nopenaiSource`).
7. Waits for `py:ready` (with fallback polling) and calls `markRuntimeReady()`.
8. Initializes local model via `initializeModel()`.

## 3. UI Behavior and State Management (`app.js`)

## 3.1 State model

`state` tracks runtime and UI status:

- runtime readiness (`pyReady`, `terminalReady`, `modelReady`)
- run/session control (`running`, `sessionActive`, `activeRunId`)
- theme and editor state (`darkTheme`, `savedCode`)
- template selection (`selectedTemplate`)
- modal focus restoration (`aboutReturnFocus`)

### 3.2 Run/Stop button enablement

`updateRunState()` enforces:

- Run enabled only when runtime+terminal+model are ready and nothing is actively running.
- Stop enabled only when a run/session is active.

### 3.3 Sample loading

`loadSelectedTemplate()`:

1. Validates selected key from `TEMPLATE_SNIPPETS`.
2. If sample changed:
   - clears terminal output (`clearTerminalOutput()`)
   - resets model session context
3. Loads code into editor via `setEditorCode(...)`.
4. Updates selected-template tracking and status text.

### 3.4 About modal

- `openAboutModal()` stores previous focus and opens dialog.
- `closeAboutModal()` closes dialog and restores focus.
- `initializeAboutModal()` wires:
  - toolbar ? button
  - modal close button
  - backdrop click to close
  - Escape key close

## 4. Editor and Terminal Integration

### 4.1 Editor as authoring-only surface

`setupEditorAsEditOnly()` disables native editor execution pathway so app-level Run controls execution.

`suppressNativeEditorRunButton()` hides embedded run-like controls using mutation observation.

### 4.2 Terminal runner creation

`launchTerminalScript(scriptCode, runId)`:

1. Replaces `terminal-container` to clear stale DOM hooks.
2. Removes stale `<script type="py" terminal ...>` runners.
3. Creates new runner with attributes:
   - `type="py"`
   - `terminal`
   - `target="terminal-container"`
   - `worker` when `shouldUseTerminalWorker()` returns true
4. Registers completion listeners (`py:done`, `py:error`, `error`) that call `completeActiveRun(runId)`.
5. Appends script to document body.

### 4.3 Runtime mode decision

`shouldUseTerminalWorker()` currently prefers worker mode for GitHub Pages and otherwise checks `window.crossOriginIsolated`.

## 5. Python Execution Wrapper (`buildExecutionCode` in `app.js`)

Before user code executes, the wrapper performs these steps:

1. Imports runtime helpers (`sys`, `types`, `builtins`, `asyncio`).
2. Loads the fetched `nopenai.py` source into a synthetic module and registers aliases:
   - `sys.modules["nopenai"]`
   - `sys.modules["openai"]`
3. Wraps `builtins.input` as `__modelcoder_input` to normalize async-returning input values to strings.
4. Executes user code via `exec(__user_code, globals())`.
5. Calls JS completion callback in `finally` block:
   - `js.modelCoderMarkRunComplete(__run_id)` when available.

This wrapper is applied to all user-entered code, not only built-in samples.

## 6. Run Lifecycle and Async Safety

### 6.1 Starting a run

`runCurrentCode()`:

1. Marks `state.running = true`.
2. Loads `nopenai.py` source if needed.
3. Reads code from editor.
4. Assigns monotonic `runId` (`state.activeRunId + 1`) and marks `sessionActive = true`.
5. Launches terminal runner.

### 6.2 Completion and cleanup

- `completeActiveRun(runId)` ignores stale completion events by checking against `state.activeRunId`.
- It removes stale runners, resets running/session flags, and calls `requestModelSessionReset()`.
- Output stays visible after normal completion.

### 6.3 Manual stop

`stopActiveRun()`:

1. Invalidates run id (`activeRunId += 1`).
2. Removes runners.
3. Replaces terminal with a stop note.
4. Resets run/session and model session.

### 6.4 Terminal clear (sample switch)

`clearTerminalOutput()`:

- removes runner scripts
- resets terminal container
- resets run/session/model session state

## 7. Local Model Runtime (`llm.js`)

### 7.1 Initialization

`ModelCoderLLM.initialize(maxRetries)`:

- retries model load with status updates
- uses `Wllama.loadModelFromHF(...)`
- emits loading/ready/error statuses to UI callback

### 7.2 Request handling

`request(payload)` supports two request types:

- `chat.completions.create`
- `responses.create`

For both:

1. validates model and messages
2. builds ChatML prompt (`_toChatML`)
3. either returns full response or creates streaming session metadata

### 7.3 Streaming

- `_createStreamSession(...)` stores queue + metadata in `streamSessions`.
- `_complete(...)` pushes deltas into queue.
- `nextStreamChunk(streamId)` drains queue for Python stream iterators.

### 7.4 Session reset semantics

`resetSession()`:

- increments `sessionVersion`
- clears stream/response maps
- clears KV cache

`sessionVersion` is checked in generation/stream paths to ignore stale outputs after reset.

## 8. Python OpenAI Wrapper (`nopenai.py`)

### 8.1 API surface

- `OpenAI` and `AsyncOpenAI`
- nested `chat.completions.create(...)`
- nested `responses.create(...)`
- stream iterators:
  - sync: `ChatCompletionsStream`, `ResponsesStream`
  - async: `AsyncChatCompletionsStream`, `AsyncResponsesStream`

### 8.2 Bridge invocation strategy

`_bridge_call(method_name, *args)`:

1. Enumerates candidate JS bridge objects from multiple globals.
2. Prefers `modelCoderBridge.<method>` if available.
3. Falls back to direct method calls.
4. Falls back to `.call(...)` style invocation.
5. Handles both sync and awaitable return values.

This design is to survive runtime differences between PyScript contexts.

## 9. COI Service Worker (`coi-serviceworker.js`)

- Registers service worker in browser context when supported.
- Reloads page once when controller is first established.
- Intercepts fetches in worker context and sets response headers:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: cross-origin`

This is included to improve static-host compatibility for browser features that benefit from COI semantics.

## 10. Accessibility and Keyboard Navigation

Implemented in `index.html`, `styles.css`, and `app.js`:

- semantic toolbar labels and status announcements
- skip link
- keyboard splitter controls
- clear focus-visible styles
- Escape key behavior:
  - closes About modal
  - exits editor focus trap behavior to splitter (`enableEditorEscapeToTabOut()`)

## 11. Developer Trace Recipe

For most debugging tasks, follow this sequence:

1. Start at `initializeApp()` in `app.js`.
2. Check model initialization path in `initializeModel()` (`app.js`) and `initialize()` (`llm.js`).
3. Check run flow in `runCurrentCode()` and `launchTerminalScript()` (`app.js`).
4. Inspect generated Python wrapper from `buildExecutionCode()` (`app.js`).
5. Inspect bridge calls in `_bridge_call()` (`nopenai.py`).
6. Inspect model request translation and generation in `request()` / `_complete()` (`llm.js`).
7. Validate cleanup behavior via `completeActiveRun()`, `stopActiveRun()`, and `resetSession()`.
