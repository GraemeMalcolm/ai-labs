import "./llm.js";

const statusRuntime = document.getElementById("runtime-status");
const statusModel = document.getElementById("model-status");
const runBtn = document.getElementById("run-btn");
const stopBtn = document.getElementById("stop-btn");
const retryBtn = document.getElementById("retry-btn");
const themeBtn = document.getElementById("theme-btn");
const savedIndicator = document.getElementById("saved-indicator");
const templateSelect = document.getElementById("template-select");
const resetLayoutBtn = document.getElementById("reset-layout-btn");
const paneSplitter = document.getElementById("pane-splitter");
const workspace = document.querySelector(".workspace");
const THEME_STORAGE_KEY = "model-coder-theme";

const PY_PACKAGES = ["numpy", "pandas", "matplotlib", "scikit-learn"];

const TEMPLATE_SNIPPETS = {
    "blank-page": "",
    "simple-chat-chatcompletions": String.raw`# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        key = "key123"
        model_name = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=key
        )
        
        # Loop until the user wants to quit
        while True:
            input_text = input('\nEnter a prompt (or type "quit" to exit): ')
            if input_text.lower() == "quit":
                print("Goodbye!")
                break
            if len(input_text) == 0:
                print("Please enter a prompt.")
                continue

            # Get a response
            completion = openai_client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "developer",
                        "content": "You are a helpful AI assistant that answers questions and provides information."
                    },
                    {
                        "role": "user",
                        "content": input_text
                    }
                ]
            )
            print(completion.choices[0].message.content)
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
`,
    "simple-chat-responses": String.raw`# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        key = "key123"
        model_name = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=key
        )
        
        # Loop until the user wants to quit
        while True:
            input_text = input('\nEnter a prompt (or type "quit" to exit): ')
            if input_text.lower() == "quit":
                print("Goodbye!")
                break
            if len(input_text) == 0:
                print("Please enter a prompt.")
                continue

            # Get a response
            response = openai_client.responses.create(
                        model=model_name,
                        instructions="You are a helpful AI assistant that answers questions and provides information.",
                        input=input_text
            )
            print(response.output_text)
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
`,
    "conversation-tracking-chatcompletions": String.raw`# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        key = "key123"
        model_name = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=key
        )

        # Initial messages
        conversation_messages=[
                    {
                        "role": "developer",
                        "content": "You are a helpful AI assistant that answers questions and provides information."
                    }
        ]
        
        # Loop until the user wants to quit
        print("Enter a prompt (or type 'quit' to exit)")
        while True:
            input_text = input('You: ')
            if input_text.lower() == "quit":
                print("Goodbye!")
                break
            if len(input_text) == 0:
                print("Please enter a prompt:")
                continue

            # Add the user message
            conversation_messages.append({"role": "user", "content": input_text})

            # Get a response
            completion = openai_client.chat.completions.create(
                model=model_name,
                messages=conversation_messages
            )
            assistant_text = completion.choices[0].message.content
            print("Assistant:", assistant_text)
            conversation_messages.append({"role": "assistant", "content": assistant_text})
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
`,
    "conversation-tracking-responses": String.raw`# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        key = "key123"
        model_name = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=key
        )
        
        # Track responses
        last_response_id = None

        # Loop until the user wants to quit
        print("Enter a prompt (or type 'quit' to exit)")
        while True:
            input_text = input('You: ')
            if input_text.lower() == "quit":
                print("Goodbye!")
                break
            if len(input_text) == 0:
                print("Please enter a prompt:")
                continue

            # Get a response
            response = openai_client.responses.create(
                        model=model_name,
                        instructions="You are a helpful AI assistant that answers questions and provides information.",
                        input=input_text,
                        previous_response_id=last_response_id
            )
            assistant_text = response.output_text
            print("Assistant:", assistant_text)
            last_response_id = response.id
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
`,
    "streaming-responses": String.raw`# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        key = "key123"
        model_name = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=key
        )
        
        # Track responses
        last_response_id = None
        print("Enter a prompt (or type 'quit' to exit)")
        while True:
            input_text = input('You: ')
            if input_text.lower() == "quit":
                print("Goodbye!")
                break
            if len(input_text) == 0:
                print("Please enter a prompt:")
                continue

            # Get a response
            stream = openai_client.responses.create(
                        model=model_name,
                        instructions="You are a helpful AI assistant that answers questions and provides information.",
                        input=input_text,
                        previous_response_id=last_response_id,
                        stream=True
            )
            print("Assistant:")
            for event in stream:
                if event.type == "response.output_text.delta":
                    print(event.delta, end="")
                elif event.type == "response.completed":
                    last_response_id = event.response.id
            print()
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
`,
    "async-chat": String.raw`import asyncio
from openai import AsyncOpenAI


async def main():
    client = AsyncOpenAI(base_url="https://localmodel", api_key="key123")

    # Async response (wait for complete response)
    response = await client.responses.create(
        model="localmodel",
        instructions="You are a concise Python tutor.",
        input="Show a Python class with __init__ and one method."
    )
    print("Async response:\n", response.output_text)

    # Async Streaming response
    print("\nStreaming response:")
    stream = await client.responses.create(
        model="localmodel",
        input="Give 3 bullet points about Python dictionaries.",
        stream=True
    )

    async for event in stream:
        if hasattr(event, "delta"):
            print(event.delta, end="")

    print("\n")


asyncio.run(main())
`
};

const state = {
    pyReady: false,
    terminalReady: false,
    modelReady: false,
    running: false,
    sessionActive: false,
    runtimeInitialized: false,
    darkTheme: false,
    savedCode: "",
    nopenaiSource: "",
};

function applyTheme(isDark) {
    state.darkTheme = Boolean(isDark);
    document.body.classList.toggle("dark-theme", state.darkTheme);

    if (themeBtn) {
        themeBtn.setAttribute("aria-pressed", state.darkTheme ? "true" : "false");
        themeBtn.classList.toggle("active", state.darkTheme);
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, state.darkTheme ? "dark" : "light");
    } catch (_error) {
        // Ignore storage failures and continue using in-memory theme state.
    }

    applyEmbeddedEditorTheme();
}

function toggleTheme() {
    applyTheme(!state.darkTheme);
}

function getSavedThemePreference() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_error) {
        return null;
    }
}

function applyEmbeddedEditorTheme() {
    const editor = getEditor();
    const container = document.getElementById("editor-container");
    if (!editor && !container) {
        return;
    }

    if (editor) {
        editor.setAttribute("data-theme", state.darkTheme ? "dark" : "light");
        editor.style.backgroundColor = state.darkTheme ? "#0d0f12" : "#ffffff";
        editor.style.color = state.darkTheme ? "#f5f6f8" : "#111111";
    }

    const styleId = "model-coder-embedded-theme";
    const roots = [];

    if (editor?.shadowRoot) {
        roots.push(editor.shadowRoot);
    }

    if (container) {
        for (const node of container.querySelectorAll("*")) {
            if (!node.shadowRoot) {
                continue;
            }
            if (node.shadowRoot.querySelector(".cm-editor")) {
                roots.push(node.shadowRoot);
            }
        }
    }

    if (roots.length === 0) {
        return;
    }

    for (const root of roots) {
        let styleEl = root.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = styleId;
            root.appendChild(styleEl);
        }

        if (state.darkTheme) {
            styleEl.textContent = `
        .cm-editor,
        .cm-scroller,
        .cm-content,
        .cm-gutters,
        .cm-activeLine,
        .cm-activeLineGutter {
            background: #0d0f12 !important;
            color: #e6edf3 !important;
        }

        .cm-gutters {
            border-right: 1px solid #2f353d !important;
        }

        .cm-line {
            color: #e6edf3 !important;
        }

        .cm-gutterElement {
            color: #9aa4af !important;
        }

        .cm-cursor,
        .cm-dropCursor {
            border-left-color: #f5f6f8 !important;
        }

        .cm-content span,
        .cm-line span,
        .cm-line span *,
        [class*="tok-"],
        [class*="cm-"] {
            color: #ffffff !important;
        }
        `;
    } else {
        // Keep PyScript/CodeMirror default syntax colors in light mode.
        styleEl.textContent = "";
        }
    }
}

function queueEmbeddedEditorThemeSync() {
    let attempts = 0;
    const maxAttempts = 20;
    const timer = setInterval(() => {
        attempts += 1;
        applyEmbeddedEditorTheme();
        if (getEditor()?.shadowRoot || attempts >= maxAttempts) {
            clearInterval(timer);
        }
    }, 150);
}

function setPill(el, text, mode = "") {
    el.textContent = text;
    el.classList.remove("ready", "error");
    if (mode) {
        el.classList.add(mode);
    }
}

function updateRunState() {
    runBtn.disabled = !state.pyReady || !state.terminalReady || !state.modelReady || state.running || state.sessionActive;
    if (stopBtn) {
        stopBtn.disabled = !(state.sessionActive || state.running);
    }
}

function getEditor() {
    return document.getElementById("python-editor");
}

function getTerminal() {
    return document.getElementById("python-terminal");
}

function setPaneSizes(editorPx, terminalPx) {
    if (!workspace) {
        return;
    }
    workspace.style.setProperty("--editor-size", `${Math.round(editorPx)}px`);
    workspace.style.setProperty("--terminal-size", `${Math.round(terminalPx)}px`);
}

function resetPaneSizes() {
    if (!workspace) {
        return;
    }

    const splitterSize = 12;
    const rect = workspace.getBoundingClientRect();
    const available = rect.height - splitterSize;
    if (available <= 0) {
        return;
    }

    const half = available / 2;
    setPaneSizes(half, half);
}

function initializePaneSplitter() {
    if (!paneSplitter || !workspace) {
        return;
    }

    const minPane = 160;
    const splitterSize = 12;
    let dragging = false;

    const clampEditorHeight = (value, available) => {
        const maxEditor = Math.max(minPane, available - minPane);
        return Math.min(Math.max(value, minPane), maxEditor);
    };

    const applyFromClientY = (clientY) => {
        const rect = workspace.getBoundingClientRect();
        const available = rect.height - splitterSize;
        if (available <= minPane * 2) {
            return;
        }

        const nextEditor = clampEditorHeight(clientY - rect.top, available);
        const nextTerminal = available - nextEditor;
        setPaneSizes(nextEditor, nextTerminal);
    };

    const onPointerMove = (event) => {
        if (!dragging) {
            return;
        }
        applyFromClientY(event.clientY);
    };

    const stopDrag = () => {
        if (!dragging) {
            return;
        }
        dragging = false;
        paneSplitter.classList.remove("dragging");
    };

    paneSplitter.addEventListener("pointerdown", (event) => {
        dragging = true;
        paneSplitter.classList.add("dragging");
        paneSplitter.setPointerCapture(event.pointerId);
        applyFromClientY(event.clientY);
    });

    paneSplitter.addEventListener("pointermove", onPointerMove);
    paneSplitter.addEventListener("pointerup", stopDrag);
    paneSplitter.addEventListener("pointercancel", stopDrag);

    paneSplitter.addEventListener("keydown", (event) => {
        if (!workspace) {
            return;
        }

        const rect = workspace.getBoundingClientRect();
        const available = rect.height - splitterSize;
        if (available <= minPane * 2) {
            return;
        }

        const styles = getComputedStyle(workspace);
        const currentEditor = parseFloat(styles.getPropertyValue("--editor-size")) || (available / 2);
        const delta = event.shiftKey ? 40 : 20;
        let nextEditor = currentEditor;

        if (event.key === "ArrowUp") {
            nextEditor -= delta;
        } else if (event.key === "ArrowDown") {
            nextEditor += delta;
        } else {
            return;
        }

        event.preventDefault();
        nextEditor = clampEditorHeight(nextEditor, available);
        setPaneSizes(nextEditor, available - nextEditor);
    });

    resetPaneSizes();
}

function resetTerminalContainer() {
    const current = document.getElementById("terminal-container");
    if (!current) {
        throw new Error("Terminal container not found.");
    }

    const replacement = current.cloneNode(false);
    replacement.innerHTML = "";
    current.replaceWith(replacement);
    return replacement;
}

function launchTerminalScript(scriptCode) {
    const terminalContainer = resetTerminalContainer();

    // Remove any stale terminal scripts still bound to this target.
    const staleRunners = document.querySelectorAll('script[type="py"][terminal][target="terminal-container"]');
    staleRunners.forEach((node) => node.remove());

    const runner = document.createElement("script");
    runner.id = "python-terminal-runner";
    runner.type = "py";
    runner.setAttribute("terminal", "");
    runner.setAttribute("worker", "");
    runner.setAttribute("target", "terminal-container");
    runner.setAttribute("config", JSON.stringify({ packages: PY_PACKAGES }));
    runner.textContent = scriptCode;
    document.body.appendChild(runner);
}

function stopActiveRun(message = "Run stopped. You can load another template or run code again.") {
    const staleRunners = document.querySelectorAll('script[type="py"][terminal][target="terminal-container"]');
    staleRunners.forEach((node) => node.remove());

    const terminalContainer = resetTerminalContainer();
    const note = document.createElement("pre");
    note.textContent = message;
    note.style.margin = "0";
    note.style.padding = "12px";
    note.style.whiteSpace = "pre-wrap";
    terminalContainer.appendChild(note);

    state.sessionActive = false;
    state.running = false;
    updateRunState();
}

function hasTerminalRunner() {
    return document.querySelector('script[type="py"][terminal][target="terminal-container"]') !== null;
}

function setEditorCode(value) {
    const editor = getEditor();
    if (!editor) {
        return false;
    }

    const code = String(value ?? "");
    let applied = false;

    if ("code" in editor) {
        try {
            editor.code = code;
            applied = true;
        } catch (_err) {
            // Fall through to textContent path.
        }
    }

    try {
        editor.textContent = code;
        applied = true;
    } catch (_err) {
        // Ignore.
    }

    return applied;
}

function readEditorCode() {
    const editor = getEditor();
    if (!editor) {
        return "";
    }

    if ("code" in editor && typeof editor.code === "string") {
        return editor.code;
    }

    return String(editor.textContent || "");
}

async function loadSelectedTemplate() {
    if (!templateSelect) {
        return;
    }

    const selected = templateSelect.value;
    if (!(selected in TEMPLATE_SNIPPETS)) {
        return;
    }

    const snippet = TEMPLATE_SNIPPETS[selected];

    if (state.sessionActive || hasTerminalRunner()) {
        stopActiveRun("Previous run stopped to load a new template.");
    }

    try {
        if (typeof window.modelCoderResetSession === "function") {
            await window.modelCoderResetSession();
        }
    } catch (error) {
        console.warn("Unable to reset model session on template switch.", error);
    }

    const ok = setEditorCode(snippet);
    savedIndicator.textContent = ok
        ? `Loaded template: ${selected}`
        : "Unable to load template into editor.";
}

function initializeEditorEmpty() {
    const existing = readEditorCode();
    if (existing.trim()) {
        return;
    }

    setEditorCode("");
    savedIndicator.textContent = "Editor empty. Pick a template or start typing.";
}

function markRuntimeReady() {
    if (state.runtimeInitialized) {
        return;
    }

    state.runtimeInitialized = true;
    state.pyReady = true;
    state.terminalReady = true;
    setPill(statusRuntime, "PyScript runtime ready", "ready");
    setupEditorAsEditOnly();
    suppressNativeEditorRunButton();
    queueEmbeddedEditorThemeSync();
    initializeEditorEmpty();
    updateRunState();
}

async function loadNopenaiSource() {
    const response = await fetch("./nopenai.py", { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Failed to load nopenai.py");
    }
    state.nopenaiSource = await response.text();
}

function setupEditorAsEditOnly() {
    const editor = getEditor();
    if (!editor || typeof editor.handleEvent === "undefined") {
        return;
    }

    // The editor remains available for editing; execution is routed through the terminal run button.
    editor.handleEvent = () => false;
}

function suppressNativeEditorRunButton() {
    const container = document.getElementById("editor-container");
    if (!container) {
        return;
    }

    const hideRunControls = () => {
        const candidates = container.querySelectorAll("button, [role='button']");
        for (const node of candidates) {
            if (node.dataset.modelCoderRunHidden === "true") {
                continue;
            }

            const title = String(node.getAttribute("title") || "").toLowerCase();
            const label = String(node.getAttribute("aria-label") || "").toLowerCase();
            const className = String(node.className || "").toLowerCase();
            const text = String(node.textContent || "").trim().toLowerCase();

            const looksLikeRun =
                title.includes("run") ||
                label.includes("run") ||
                className.includes("run") ||
                text === "run" ||
                text === "▶" ||
                text === "►";

            if (looksLikeRun) {
                node.style.display = "none";
                node.setAttribute("aria-hidden", "true");
                node.dataset.modelCoderRunHidden = "true";
            }
        }
    };

    hideRunControls();

    if (container.dataset.runButtonObserverAttached === "true") {
        return;
    }

    const observer = new MutationObserver(() => {
        hideRunControls();
    });
    observer.observe(container, { childList: true, subtree: true });
    container.dataset.runButtonObserverAttached = "true";
}

function buildExecutionCode(userCode) {
    const serializedNopenai = JSON.stringify(state.nopenaiSource || "");
    const serializedUserCode = JSON.stringify(String(userCode || ""));
    return `
import sys
import types

module = types.ModuleType("nopenai")
__nopenai_source = ${serializedNopenai}
exec(__nopenai_source, module.__dict__)
sys.modules["nopenai"] = module
sys.modules["openai"] = module

globals()["__name__"] = "__main__"
__user_code = ${serializedUserCode}
print("Model Coder ready. Running script...")
try:
    exec(__user_code, globals())
finally:
    try:
        import js
        if hasattr(js, "modelCoderMarkRunComplete"):
            js.modelCoderMarkRunComplete()
    except Exception:
        pass
`;
}

async function runCurrentCode() {
    const editor = getEditor();
    if (!editor) {
        return;
    }

    state.running = true;
    updateRunState();

    try {
        await loadNopenaiSource();

        const code = readEditorCode();
        if (!code.trim()) {
            launchTerminalScript("print('Editor is empty. Load a template or type code first.')");
            return;
        }

        state.savedCode = code;
        savedIndicator.textContent = `Saved and ran at ${new Date().toLocaleTimeString()}`;

        launchTerminalScript(buildExecutionCode(code));
        state.sessionActive = true;
    } catch (error) {
        const msg = JSON.stringify(`Execution failed: ${String(error.message || error)}`);
        launchTerminalScript(`print(${msg})`);
        state.sessionActive = false;
    } finally {
        state.running = false;
        updateRunState();
    }
}

async function initializeModel() {
    state.modelReady = false;
    updateRunState();
    retryBtn.hidden = true;

    try {
        await window.modelCoderInit(3);
        state.modelReady = true;
        setPill(statusModel, "Model ready: localmodel", "ready");
    } catch (error) {
        setPill(statusModel, `Model failed: ${error.message}`, "error");
        retryBtn.hidden = false;
    }

    updateRunState();
}

async function initializeApp() {
    setPill(statusRuntime, "PyScript loading...");
    setPill(statusModel, "Model initializing...");

    window.modelCoderSetStatusListener(({ kind, message }) => {
        if (kind === "ready") {
            setPill(statusModel, message, "ready");
            return;
        }
        if (kind === "error") {
            setPill(statusModel, message, "error");
            return;
        }
        setPill(statusModel, message);
    });

    window.modelCoderMarkRunComplete = () => {
        state.sessionActive = false;
        updateRunState();
    };

    const savedTheme = getSavedThemePreference();
    applyTheme(savedTheme === "dark");

    initializePaneSplitter();

    window.addEventListener("py:ready", markRuntimeReady, { once: true });

    runBtn.addEventListener("click", runCurrentCode);
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            stopActiveRun();
        });
    }
    retryBtn.addEventListener("click", initializeModel);
    if (templateSelect) {
        templateSelect.addEventListener("change", () => {
            void loadSelectedTemplate();
        });
    }
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener("click", resetPaneSizes);
    }
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }

    await loadNopenaiSource();
    const pyReadyFallback = setInterval(() => {
        const editor = getEditor();
        if (editor) {
            markRuntimeReady();
            clearInterval(pyReadyFallback);
        }
    }, 300);

    setTimeout(() => clearInterval(pyReadyFallback), 15000);

    await initializeModel();
}

initializeApp().catch((error) => {
    setPill(statusRuntime, `Startup failed: ${error.message}`, "error");
    console.error(error);
});
