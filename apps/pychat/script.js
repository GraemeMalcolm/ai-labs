// Global variables
let engine = null;
let modelLoaded = false;
let virtualFiles = {}; // Store virtual files
let currentFile = 'script.py';
let pyodideReady = false;
let pyWorker = null;

// Constants
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const codeEditor = document.getElementById('code-editor');
const filenameInput = document.getElementById('filename-input');
const saveBtn = document.getElementById('save-btn');
const newBtn = document.getElementById('new-btn');
const runBtn = document.getElementById('run-btn');
const fileList = document.getElementById('file-list');

// Expose a synchronous-looking wrapper for WebLLM chat
window.webllmChatSync = function(messagesJson) {
    // This returns a promise, but we'll handle it in Python with asyncio.run()
    return window.webllmChat(messagesJson);
};

// Wait for PyScript worker to be ready
window.addEventListener('py:ready', async () => {
    console.log('PyScript is ready!');
    pyodideReady = true;
    
    // Find the worker script element
    const workerScript = document.querySelector('script[type="py"][worker]');
    if (workerScript) {
        pyWorker = workerScript;
        console.log('PyScript worker terminal ready');
    }
});

// Run Python File
function runPythonFile(filename) {
    if (!pyodideReady) {
        alert('PyScript is still initializing. Please wait...');
        return;
    }
    
    if (!virtualFiles[filename]) {
        alert(`Error: File '${filename}' not found. Save it first.`);
        return;
    }

    const code = virtualFiles[filename];
    const outputDiv = document.getElementById('output-display');
    
    console.log(`Running ${filename}...`);
    outputDiv.innerHTML = '';
    
    // Setup code that creates openai module and custom input/print
    const fullCode = `
import json
import sys
from js import document, window, webllmChat, prompt as js_prompt

# Custom print that writes to output div
def print(*args, **kwargs):
    output = ' '.join(str(arg) for arg in args)
    div = document.getElementById('output-display')
    div.innerHTML += output + '\\n'

# Custom input using browser prompt
def input(prompt_text=''):
    if prompt_text:
        print(prompt_text, end='')
    result = js_prompt(prompt_text)
    if result is None:
        raise KeyboardInterrupt('Input cancelled')
    print(result)  # Echo the input
    return str(result)

# OpenAI shim
class ChatCompletion:
    @staticmethod
    async def create(model, messages, **kwargs):
        messages_json = json.dumps(messages)
        response_json = await webllmChat(messages_json)
        response_dict = json.loads(response_json)
        return OpenAIResponse(response_dict)

class OpenAIResponse:
    def __init__(self, data):
        self.choices = [Choice(c) for c in data.get('choices', [])]

class Choice:
    def __init__(self, data):
        self.message = Message(data.get('message', {}))

class Message:
    def __init__(self, data):
        self.content = data.get('content', '')
        self.role = data.get('role', '')

class OpenAIModule:
    ChatCompletion = ChatCompletion

sys.modules['openai'] = OpenAIModule()

# User code
${code}
`;
    
    // Create and execute the script
    const script = document.createElement('script');
    script.type = 'py';
    script.textContent = fullCode;
    document.body.appendChild(script);
    
    setTimeout(() => script.remove(), 100);
}

// Initialize WebLLM
async function initWebLLM() {
    try {
        statusIndicator.textContent = "Loading model...";
        
        const initProgressCallback = (report) => {
            statusIndicator.textContent = report.text;
        };

        // Use the global window.webllm object loaded in index.html
        engine = await window.webllm.CreateMLCEngine(
            MODEL_ID,
            { initProgressCallback: initProgressCallback }
        );

        modelLoaded = true;
        statusIndicator.textContent = "Ready";
        statusIndicator.classList.add('ready');
        console.log(`Model ${MODEL_ID} loaded successfully.`);
    } catch (error) {
        console.error("WebLLM Init Error:", error);
        statusIndicator.textContent = "Error loading model";
    }
}

// Expose Chat function to Python
window.webllmChat = async function (messagesJson) {
    if (!engine) {
        throw new Error("Model not loaded yet.");
    }
    const messages = JSON.parse(messagesJson);
    const reply = await engine.chat.completions.create({
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
    });
    return JSON.stringify(reply);
};

// File Management Functions
function saveFile() {
    const filename = filenameInput.value.trim();
    if (!filename) {
        alert('Please enter a filename');
        return;
    }
    
    if (!filename.endsWith('.py')) {
        alert('Filename must end with .py');
        return;
    }
    
    const code = codeEditor.value;
    virtualFiles[filename] = code;
    currentFile = filename;
    
    updateFileList();
    console.log(`Saved ${filename}`);
}

function newFile() {
    const filename = prompt('Enter new filename (must end with .py):', 'new_script.py');
    if (!filename) return;
    
    if (!filename.endsWith('.py')) {
        alert('Filename must end with .py');
        return;
    }
    
    codeEditor.value = '# New Python script\n';
    filenameInput.value = filename;
    currentFile = filename;
}

function loadFile(filename) {
    if (virtualFiles[filename]) {
        codeEditor.value = virtualFiles[filename];
        filenameInput.value = filename;
        currentFile = filename;
    }
}

function updateFileList() {
    fileList.innerHTML = '<option value="">-- Select File --</option>';
    
    Object.keys(virtualFiles).forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        if (filename === currentFile) {
            option.selected = true;
        }
        fileList.appendChild(option);
    });
}

// Event Listeners
saveBtn.addEventListener('click', saveFile);
newBtn.addEventListener('click', newFile);
runBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim();
    if (filename && virtualFiles[filename]) {
        runPythonFile(filename);
    } else {
        alert('Please save the file first');
    }
});
fileList.addEventListener('change', (e) => {
    if (e.target.value) {
        loadFile(e.target.value);
    }
});

// Save default file on load
window.addEventListener('load', () => {
    virtualFiles['script.py'] = codeEditor.value;
    updateFileList();
});

// Main Init
async function main() {
    await initWebLLM();
    console.log("System initialization complete");
}

main();
