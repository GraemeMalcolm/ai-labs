// OpenChat - JavaScript functionality

// Virtual file system
let virtualFS = {
    'chat_example.py': `# Import the openai module (a shim that behaves like the openai SDK)
import openai

# Create a simple chat
messages = [
    {"role": "system", "content": "You are a helpful assistant."}
]

while True:
    # Get input text
    print("Enter the prompt (or type 'quit' to exit)")
    input_text = input("> ")
    if input_text.lower() == "quit":
        break
    if len(input_text) == 0:
        print("Please enter a prompt.")
        continue
            
    # Get a chat completion
    messages.append({"role": "user", "content": input_text})

    response = openai.chat.completions.create(
        model="wiked",
        messages=messages
    )

    completion = response.choices[0].message.content
    print("\\n" + completion + "\\n")
    messages.append({"role": "assistant", "content": completion})

print(messages)
`
};

let currentFile = 'chat_example.py';
let pythonRunning = false;
let waitingForInput = false;
let inputResolve = null;
let pyodide = null;

// WebLLM variables
let mlcEngine = null;
let modelLoaded = false;
let modelLoading = false;

// DOM Elements
const codeEditor = document.getElementById('codeEditor');
const filenameInput = document.getElementById('filename');
const newBtn = document.getElementById('newBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const terminalOutput = document.getElementById('terminalOutput');
const terminalInput = document.getElementById('terminalInput');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadFile(currentFile);
    appendToTerminal('OpenChat Terminal Loading...', 'success');
    appendToTerminal('Initializing Pyodide...', 'success');
    
    try {
        // Load Pyodide
        pyodide = await loadPyodide();
        
        // Setup the openai module
        await setupOpenAIModule();
        
        appendToTerminal('Python Ready!', 'success');
        appendToTerminal('Type "python filename.py" to run a script', 'success');
        appendToTerminal('', '');
        
        // Start loading WebLLM model in the background
        appendToTerminal('Starting to load Phi-2 model in background...', 'success');
        loadWebLLMModel().catch(err => {
            console.error('WebLLM loading error:', err);
        });
    } catch (e) {
        appendToTerminal('Error initializing Python: ' + e.message, 'error');
        console.error(e);
    }
});

// Setup the OpenAI module in Python
async function setupOpenAIModule() {
    const openaiCode = await fetch('./openai.py').then(r => r.text());
    await pyodide.runPythonAsync(openaiCode);
}

// Load WebLLM model
async function loadWebLLMModel() {
    if (modelLoaded || modelLoading) {
        return;
    }
    
    modelLoading = true;
    appendToTerminal('Loading Phi-2 model... This may take a minute.', 'success');
    
    try {
        const webllm = window.webllm;
        if (!webllm) {
            throw new Error('WebLLM library not loaded');
        }
        
        // Create the MLC engine with Phi-2 model (correct ID format)
        const MODEL_ID = "phi-2-q4f16_1-MLC";
        
        mlcEngine = await webllm.CreateMLCEngine(
            MODEL_ID,
            { 
                initProgressCallback: (progress) => {
                    if (progress.text) {
                        appendToTerminal(progress.text, 'success');
                    }
                }
            }
        );
        
        modelLoaded = true;
        modelLoading = false;
        appendToTerminal('Phi-2 model loaded successfully!', 'success');
        appendToTerminal('', '');
    } catch (error) {
        modelLoading = false;
        appendToTerminal(`Failed to load model: ${error.message}`, 'error');
        console.error('WebLLM Error:', error);
        throw error;
    }
}

// Generate chat completion using WebLLM
async function generateChatCompletion(messages) {
    if (!modelLoaded) {
        await loadWebLLMModel();
    }
    
    try {
        const response = await mlcEngine.chat.completions.create({
            messages: messages,
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        appendToTerminal(`Error generating response: ${error.message}`, 'error');
        throw error;
    }
}

// Make functions available to Python
window.generateChatCompletion_js = generateChatCompletion;
window.appendToTerminal_py = function(text) {
    appendToTerminal(text);
};
window.getInput_py = function() {
    return new Promise((resolve) => {
        waitingForInput = true;
        inputResolve = resolve;
    });
};

// New file
newBtn.addEventListener('click', () => {
    const filename = prompt('Enter new filename (must end with .py):', 'script.py');
    if (filename && filename.endsWith('.py')) {
        codeEditor.value = '# New Python script\nimport openai\n\n# Your code here\n';
        filenameInput.value = filename;
        currentFile = filename;
        appendToTerminal(`New file created: ${filename}`, 'success');
    } else if (filename) {
        appendToTerminal('Error: Filename must end with .py', 'error');
    }
});

// Save file
saveBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim();
    if (!filename) {
        appendToTerminal('Error: Please enter a filename', 'error');
        return;
    }
    if (!filename.endsWith('.py')) {
        appendToTerminal('Error: Filename must end with .py', 'error');
        return;
    }
    
    virtualFS[filename] = codeEditor.value;
    currentFile = filename;
    appendToTerminal(`Saved: ${filename}`, 'success');
});

// Load file
loadBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim();
    if (!filename) {
        appendToTerminal('Error: Please enter a filename', 'error');
        return;
    }
    
    if (!virtualFS[filename]) {
        appendToTerminal(`Error: File '${filename}' not found`, 'error');
        appendToTerminal(`Available files: ${Object.keys(virtualFS).join(', ')}`, 'error');
        return;
    }
    
    loadFile(filename);
    appendToTerminal(`Loaded: ${filename}`, 'success');
});

// Load file helper
function loadFile(filename) {
    if (virtualFS[filename]) {
        codeEditor.value = virtualFS[filename];
        filenameInput.value = filename;
        currentFile = filename;
    }
}

// Handle terminal input
terminalInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const command = terminalInput.value.trim();
        terminalInput.value = '';
        
        if (!command) return;
        
        appendToTerminal(`>>> ${command}`, 'command');
        
        // Check if waiting for Python input
        if (waitingForInput && inputResolve) {
            inputResolve(command);
            waitingForInput = false;
            inputResolve = null;
            return;
        }
        
        // Handle python command
        if (command.startsWith('python ')) {
            const filename = command.substring(7).trim();
            await runPythonFile(filename);
        } else {
            appendToTerminal(`Command not recognized. Use: python filename.py`, 'error');
        }
    }
});

// Run Python file
async function runPythonFile(filename) {
    if (pythonRunning) {
        appendToTerminal('Error: A script is already running', 'error');
        return;
    }
    
    if (!virtualFS[filename]) {
        appendToTerminal(`Error: File '${filename}' not found`, 'error');
        return;
    }
    
    pythonRunning = true;
    const code = virtualFS[filename];
    
    try {
        // Execute the Python code using PyScript
        await executePythonCode(code);
    } catch (error) {
        appendToTerminal(`Error: ${error.message}`, 'error');
    } finally {
        pythonRunning = false;
    }
}

// Execute Python code
async function executePythonCode(code) {
    if (!pyodide) {
        appendToTerminal('Error: Python not ready yet', 'error');
        return;
    }
    
    try {
        // Setup a Python environment where input() and openai calls work without await
        await pyodide.runPythonAsync(`
import sys
import js
from pyodide.ffi import to_js
import asyncio

# Override print
def print(*args, sep=' ', end='\\n', **kwargs):
    text = sep.join(str(arg) for arg in args)
    js.appendToTerminal_py(text)

# Define input as async
async def input(prompt=''):
    if prompt:
        js.appendToTerminal_py(prompt)
    from js import getInput_py
    result = await getInput_py()
    return result

# Make them available in builtins
import builtins
builtins.print = print
builtins.input = input
`);

        // Transform the code using Python's AST to add await keywords
        const transformedCode = await pyodide.runPythonAsync(`
import ast
import sys

user_code = ${JSON.stringify(code)}

class AsyncTransformer(ast.NodeTransformer):
    def visit_Call(self, node):
        self.generic_visit(node)
        
        # Check if it's a call to input()
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            return ast.Await(value=node)
        
        # Check if it's openai.chat.completions.create()
        # We need to check the full chain: openai.chat.completions.create
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'create':
            if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'completions':
                if isinstance(node.func.value.value, ast.Attribute) and node.func.value.value.attr == 'chat':
                    if isinstance(node.func.value.value.value, ast.Name) and node.func.value.value.value.id == 'openai':
                        return ast.Await(value=node)
        
        return node

# Parse the code
tree = ast.parse(user_code)

# Transform it
transformer = AsyncTransformer()
new_tree = transformer.visit(tree)

# Fix missing locations
ast.fix_missing_locations(new_tree)

# Convert back to code
transformed = ast.unparse(new_tree)
transformed
`);
        
        // Wrap in async function and run
        const wrappedCode = `
async def __user_main():
${transformedCode.split('\n').map(line => '    ' + line).join('\n')}

await __user_main()
`;
        
        // Run the wrapped code
        await pyodide.runPythonAsync(wrappedCode);
    } catch (error) {
        appendToTerminal(`Error: ${error.message}`, 'error');
        console.error(error);
        throw error;
    }
};

// Append text to terminal
function appendToTerminal(text, className = '') {
    const line = document.createElement('div');
    line.className = `terminal-line ${className}`;
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Make append function available globally for Python
window.appendToTerminal = appendToTerminal;

// Handle Tab key in editor
codeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;
        
        codeEditor.value = 
            codeEditor.value.substring(0, start) + 
            '    ' + 
            codeEditor.value.substring(end);
        
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
    }
});
