import { Wllama } from 'https://cdn.jsdelivr.net/npm/@wllama/wllama/esm/index.js';

const CONFIG = {
  modelUrl: 'https://huggingface.co/bartowski/Phi-3.1-mini-128k-instruct-GGUF/resolve/main/Phi-3.1-mini-128k-instruct-Q2_K.gguf',
  wllamaWasmPath: {
    'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama/esm/single-thread/wllama.wasm',
    'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama/esm/multi-thread/wllama.wasm',
  }
};

const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  progressBar: document.getElementById('progress-bar'),
  chatHistory: document.getElementById('chat-history'),
  userInput: document.getElementById('user-input'),
  sendBtn: document.getElementById('send-btn'),
  clearBtn: document.getElementById('clear-btn'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text')
};

let wllama = null;
let isProcessing = false;

async function init() {
  try {
    wllama = new Wllama(CONFIG.wllamaWasmPath);

    elements.loadingText.textContent = 'Downloading AI Model (automatic sharding)...';

    const threads = navigator.hardwareConcurrency || 4;
    const isIsolated = window.crossOriginIsolated;
    elements.statusText.textContent = `Phi-3 Ready (${threads} threads, Isolated: ${isIsolated})`;

    await wllama.loadModelFromUrl(CONFIG.modelUrl, {
      n_ctx: 512,
      n_batch: 256,
      n_ubatch: 256,
      n_threads: threads,
      progressCallback: ({ loaded, total }) => {
        const progress = Math.round((loaded / total) * 100);
        elements.progressBar.style.width = `${progress}%`;
        elements.loadingText.textContent = `Downloading AI Model: ${progress}%`;
      }
    });

    elements.loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      elements.loadingOverlay.style.display = 'none';
    }, 500);

    elements.statusDot.classList.add('active');
    elements.userInput.disabled = false;
    elements.sendBtn.disabled = false;

    addMessage('ai', 'Hello! I am Phi-3, your local AI assistant. How can I help you today?');
  } catch (error) {
    console.error('Initialization failed:', error);
    elements.loadingText.textContent = 'Failed to load model. Please check console.';
    elements.loadingText.style.color = '#ef4444';
  }
}

function addMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}-message`;
  msgDiv.textContent = text;
  elements.chatHistory.appendChild(msgDiv);
  elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
  return msgDiv;
}

function summarize(text) {
  if (!text) return "";
  const match = text.match(/^[^.!?\n]+[.!?]/);
  return match ? match[0] : text.substring(0, 100);
}

async function handleSend() {
  const text = elements.userInput.value.trim();
  if (!text || isProcessing) return;

  const history = Array.from(elements.chatHistory.children)
    .slice(1)
    .map(div => ({
      role: div.classList.contains('user-message') ? 'user' : 'assistant',
      text: div.textContent
    }));

  elements.userInput.value = '';
  addMessage('user', text);

  isProcessing = true;
  elements.sendBtn.disabled = true;
  elements.userInput.disabled = true;
  elements.statusDot.classList.add('loading');
  elements.statusText.textContent = 'Phi-3 is thinking (prefilling context)...';

  const aiMsgDiv = addMessage('ai', '');
  aiMsgDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

  let fullResponse = '';
  let firstTokenReceived = false;
  let typingStarted = false;
  const queue = [];
  let generationFinished = false;

  const typeResponse = () => {
    if (queue.length > 0) {
      if (aiMsgDiv.querySelector('.typing-indicator')) {
        aiMsgDiv.innerHTML = '';
      }
      const char = queue.shift();
      fullResponse += char;
      aiMsgDiv.textContent = fullResponse;
      elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
    }

    // UI-level smoothing - 200ms base delay
    if (!generationFinished || queue.length > 0) {
      // Faster if queue is backed up significantly
      const delay = queue.length > 60 ? 50 : 200;
      const pollingDelay = queue.length === 0 ? 100 : delay;
      setTimeout(typeResponse, pollingDelay);
    }
  };

  try {
    const systemPrompt = "<|system|>\nYou are a helpful AI assistant that responds concisely.<|end|>\n";
    let historyPrompt = "";
    history.forEach(msg => {
      const summary = summarize(msg.text);
      historyPrompt += `<|${msg.role}|>\n${summary}<|end|>\n`;
    });

    const prompt = `${systemPrompt}${historyPrompt}<|user|>\n${text}<|end|>\n<|assistant|>\n`;

    console.log("--- DEBUG: FULL PROMPT ---");
    console.log(prompt);
    console.log("--------------------------");

    const tokens = await wllama.createCompletion(prompt, {
      nPredict: 256,
      stream: true,
      sampling: {
        temp: 0.2,
        top_p: 0.9,
      }
    });

    const decoder = new TextDecoder();
    for await (const chunk of tokens) {
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        console.log("--- DEBUG: FIRST TOKEN RECEIVED ---");
        elements.statusText.textContent = 'Phi-3 is responding...';
      }

      const piece = typeof chunk === 'string' ? chunk : chunk.piece;
      if (piece) {
        const textPiece = typeof piece === 'string' ? piece : decoder.decode(piece, { stream: true });
        console.log(`--- DEBUG: CHUNK ARRIVED (${new Date().toLocaleTimeString()}): "${textPiece}"`);
        for (const char of textPiece) {
          queue.push(char);
        }
      }

      // Lookahead: wait for 60 characters or generation to finish before starting the display
      if (!typingStarted && (queue.length >= 60 || generationFinished)) {
        typingStarted = true;
        console.log("--- DEBUG: TYPING STARTED (Lookahead satisfied) ---");
        typeResponse();
      }
    }

    generationFinished = true;

    if (!typingStarted) {
      typingStarted = true;
      typeResponse();
    }

    console.log("--- DEBUG: GENERATION COMPLETE ---");

  } catch (error) {
    console.error('Generation failed:', error);
    aiMsgDiv.textContent = 'Sorry, something went wrong during response generation.';
    aiMsgDiv.style.color = '#ef4444';
  } finally {
    isProcessing = false;
    elements.sendBtn.disabled = false;
    elements.userInput.disabled = false;
    elements.statusDot.classList.remove('loading');
    const threads = navigator.hardwareConcurrency || 4;
    const isIsolated = window.crossOriginIsolated;
    elements.statusText.textContent = `Phi-3 Ready (${threads} threads, Isolated: ${isIsolated})`;
    elements.userInput.focus();
  }
}

function clearHistory() {
  elements.chatHistory.innerHTML = '';
  addMessage('ai', 'Chat history cleared. How can I help you?');
}

elements.sendBtn.addEventListener('click', handleSend);
elements.clearBtn.addEventListener('click', clearHistory);
elements.userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

init();
