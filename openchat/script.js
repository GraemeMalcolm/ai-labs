// OpenChat - JavaScript Functionality

// Virtual file system for storing scripts
let virtualFS = {
    'chat_example.py': `# OpenChat - Learn to build chatbots with OpenAI syntax
# Import the openai module (behaves like the openai SDK)
import openai

# Clear the screen
print(chr(27) + "[2J")

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
`,
    'conversation_example.py': `# Example: Building a conversation with history
import openai

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Who was Ada Lovelace?"}
]

response = openai.chat.completions.create(
    model="wiked",
    messages=messages
)

print("Assistant:", response.choices[0].message.content)

# Add the assistant's response to the history
messages.append({
    "role": "assistant", 
    "content": response.choices[0].message.content
})

# Continue the conversation
messages.append({
    "role": "user", 
    "content": "What were her contributions?"
})

response = openai.chat.completions.create(
    model="wiked",
    messages=messages
)

print("\\nAssistant:", response.choices[0].message.content)
`,
    'interactive_chat.py': `# Interactive chat example
import openai

messages = [
    {"role": "system", "content": "You are a helpful assistant."}
]

print("Welcome to OpenChat! Type 'quit' to exit.")
print()

while True:
    user_input = input("You: ")
    
    if user_input.lower() == 'quit':
        print("Goodbye!")
        break
    
    messages.append({"role": "user", "content": user_input})
    
    response = openai.chat.completions.create(
        model="wiked",
        messages=messages
    )
    
    assistant_message = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_message})
    
    print(f"Assistant: {assistant_message}")
    print()
`
};

let currentFile = 'chat_example.py';
let terminalReady = false;
let terminalScript = null;

// DOM Elements
const codeEditor = document.getElementById('codeEditor');
const filenameInput = document.getElementById('filename');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const newBtn = document.getElementById('newBtn');
const runBtn = document.getElementById('runBtn');
const clearTerminal = document.getElementById('clearTerminal');
const statusBar = document.getElementById('status');

// Wait for PyScript to be ready
document.addEventListener('DOMContentLoaded', () => {
    loadFile(currentFile);
    updateStatus('Loading PyScript...');
});

// Listen for PyScript ready event
addEventListener('py:ready', () => {
    console.log('PyScript ready event fired');
    terminalScript = document.getElementById('pyTerminal');
    console.log('Terminal script element:', terminalScript);
    
    if (terminalScript) {
        // Wait a bit for terminal worker to be ready
        setTimeout(() => {
            terminalReady = true;
            updateStatus('Ready');
            console.log('Terminal is ready');
        }, 1000);
    }
});

// Save current file
saveBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim();
    if (!filename) {
        updateStatus('Error: Please enter a filename', 'error');
        return;
    }
    
    if (!filename.endsWith('.py')) {
        updateStatus('Error: Filename must end with .py', 'error');
        return;
    }
    
    virtualFS[filename] = codeEditor.value;
    currentFile = filename;
    updateStatus(`Saved: ${filename}`, 'success');
});

// Load file
loadBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim();
    
    if (!filename) {
        updateStatus('Error: Please enter a filename', 'error');
        return;
    }
    
    if (!virtualFS[filename]) {
        updateStatus(`Error: File '${filename}' not found. Available files: ${Object.keys(virtualFS).join(', ')}`, 'error');
        return;
    }
    
    loadFile(filename);
    updateStatus(`Loaded: ${filename}`, 'success');
});

// New file
newBtn.addEventListener('click', () => {
    const filename = filenameInput.value.trim() || 'untitled.py';
    
    if (!filename.endsWith('.py')) {
        filenameInput.value = filename + '.py';
    }
    
    codeEditor.value = `# New Python script
import openai

# Your code here
`;
    currentFile = filename;
    updateStatus(`New file: ${filename}`, 'success');
});

// Clear terminal
clearTerminal.addEventListener('click', async () => {
    if (!terminalReady || !terminalScript) {
        updateStatus('Please wait for PyScript to load...', 'error');
        return;
    }
    
    try {
        // Use the terminal's process method to clear
        await terminalScript.process('__terminal__.clear()');
        updateStatus('Terminal cleared', 'success');
    } catch (error) {
        console.error('Clear error:', error);
        updateStatus(`Error: ${error.message}`, 'error');
    }
});

// Helper: Load file
function loadFile(filename) {
    if (virtualFS[filename]) {
        codeEditor.value = virtualFS[filename];
        filenameInput.value = filename;
        currentFile = filename;
    }
}

// Helper: Update status bar
function updateStatus(message, type = 'info') {
    statusBar.textContent = message;
    
    // Update status bar color based on type
    if (type === 'error') {
        statusBar.style.backgroundColor = '#f14c4c';
    } else if (type === 'success') {
        statusBar.style.backgroundColor = '#13a830';
    } else if (type === 'running') {
        statusBar.style.backgroundColor = '#ffa500';
    } else {
        statusBar.style.backgroundColor = '#007acc';
    }
}

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
