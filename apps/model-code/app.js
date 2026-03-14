import "./llm.js";

const statusRuntime = document.getElementById("runtime-status");
const statusModel = document.getElementById("model-status");
const runBtn = document.getElementById("run-btn");
const stopBtn = document.getElementById("stop-btn");
const retryBtn = document.getElementById("retry-btn");
const savedIndicator = document.getElementById("saved-indicator");
const templateSelect = document.getElementById("template-select");
const loadTemplateBtn = document.getElementById("load-template-btn");

const PY_PACKAGES = ["numpy", "pandas", "matplotlib", "scikit-learn"];

const TEMPLATE_SNIPPETS = {
    "simple-chat-responses": String.raw`# import namespace
from openai import OpenAI


def main():
    try:
        # Configuration settings
        endpoint = "https://localmodel"
        api_key = "key123"
        model = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=api_key
        )

        # Loop until the user wants to quit
        while True:
            input_text = input('\nEnter a prompt (or type "quit" to exit): ')
            if input_text.lower() == "quit":
                break
            if len(input_text) == 0:
                print("Please enter a prompt.")
                continue

            # Get a response
            response = openai_client.responses.create(
                model=model,
                instructions="You are a helpful AI assistant that answers questions and provides information.",
                input=input_text
            )
            print(response.output_text)

    except Exception as ex:
        print(ex)


if __name__ == '__main__':
    main()
`,
    "sync-basic": String.raw`"""Sync OpenAI-style examples."""

from openai import OpenAI

client = OpenAI(base_url="https://localmodel", api_key="demo-key")

response = client.responses.create(
    model="localmodel",
    instructions="You are a concise Python tutor.",
    input="Explain list comprehension with a short example."
)
print("Responses API:\n", response.output_text)

chat_result = client.chat.completions.create(
    model="localmodel",
    messages=[
        {"role": "developer", "content": "Keep answers short and practical."},
        {"role": "user", "content": "Write a Python function for factorial."}
    ]
)
print("\nChat Completions API:\n", chat_result.choices[0].message.content)
`,
    "async-basic": String.raw`"""Async OpenAI-style examples."""

import asyncio
from openai import AsyncOpenAI


async def main():
    client = AsyncOpenAI(base_url="https://localmodel", api_key="demo-key")

    response = await client.responses.create(
        model="localmodel",
        instructions="You are a concise Python tutor.",
        input="Show a Python class with __init__ and one method."
    )
    print("Async response:\n", response.output_text)

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
`,
    "history-loop": String.raw`"""Conversation history loop using chat.completions.create."""

from openai import OpenAI

client = OpenAI(base_url="https://localmodel", api_key="demo-key")
messages = [
    {"role": "developer", "content": "Be concise and helpful."}
]

print("Type 'quit' to stop.")

while True:
    user_text = input("You: ").strip()
    if user_text.lower() == "quit":
        print("Goodbye")
        break
    if not user_text:
        print("Please type a prompt.")
        continue

    messages.append({"role": "user", "content": user_text})
    response = client.chat.completions.create(
        model="localmodel",
        messages=messages
    )

    assistant_text = response.choices[0].message.content
    print("Assistant:", assistant_text)
    messages.append({"role": "assistant", "content": assistant_text})
`,
    "previous-chain": String.raw`"""Chain responses with previous_response_id."""

from openai import OpenAI

client = OpenAI(base_url="https://localmodel", api_key="demo-key")

first = client.responses.create(
    model="localmodel",
    instructions="Answer in short bullet points.",
    input="Explain what a Python dictionary is."
)
print("First response:\n", first.output_text)

follow_up = client.responses.create(
    model="localmodel",
    previous_response_id=first.id,
    input="Now provide one practical coding tip."
)
print("\nFollow-up response:\n", follow_up.output_text)
`
};

const state = {
    pyReady: false,
    terminalReady: false,
    modelReady: false,
    running: false,
    sessionActive: false,
    runtimeInitialized: false,
    savedCode: "",
    nopenaiSource: "",
};

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
    runBtn.textContent = "Run Code";
    updateRunState();
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

function loadSelectedTemplate() {
    if (!templateSelect) {
        return;
    }

    const selected = templateSelect.value;
    const snippet = TEMPLATE_SNIPPETS[selected];
    if (!snippet) {
        return;
    }

    if (state.sessionActive) {
        stopActiveRun("Previous run stopped to load a new template.");
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
    runBtn.textContent = "Running...";

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
        runBtn.textContent = "Run Code";
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

    window.addEventListener("py:ready", markRuntimeReady, { once: true });

    runBtn.addEventListener("click", runCurrentCode);
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            stopActiveRun();
        });
    }
    retryBtn.addEventListener("click", initializeModel);
    if (loadTemplateBtn) {
        loadTemplateBtn.addEventListener("click", loadSelectedTemplate);
    }
    if (templateSelect) {
        templateSelect.addEventListener("change", loadSelectedTemplate);
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
