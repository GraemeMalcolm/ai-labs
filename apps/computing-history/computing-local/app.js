import { Wllama } from '@wllama/wllama';

const chatContainer = document.getElementById('chat-messages');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const uploadBtn = document.getElementById('upload-btn');
const imageUpload = document.getElementById('image-upload');
const micBtn = document.getElementById('mic-btn');

// State
let model = null;
let featureExtractor = null;
let pendingFile = null;
let isVoiceInput = false; // Tracks if current message was spoken
let isResponding = false; // Tracks if bot is currently responding
let shouldStopResponse = false; // Flag to cancel ongoing response
let wllama = null; // Wllama instance for text generation
let wllamaReady = false; // Track if wllama is initialized
let mobilenetReady = false; // Track if MobileNet is initialized
let conversationHistory = []; // Track conversation for context
let inappropriateWords = []; // Loaded from moderation file
const MODEL_URL = './image_model/retro-classifier-model.json'; // Path to your exported model
const BASE_MODEL_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';

// We need to define the classes. 
const CLASSES = [
    'Altair 8800', // 0
    'Commodore 64', // 1
    'Sinclair ZX Spectrum', // 2
    'Apple II', // 3
    'Computer', // 4
    'Printed Circuit Board (PCB)', // 5
    'Unknown' // 6
];

const CLASS_INFO = {
    0: [
        'Developed by: Micro Instrumentation and Telemetry Systems (MITS)',
        'Released: 1974',
        'Processor: Intel 8080',
        'Fact: It was the first commercially successful personal computer.'
    ].join('\n'),
    1: [
        'Developed by: Commodore Business Machines',
        'Released: 1982',
        'Processor: MOS 6510',
        'Fact: It was one of the best-selling desktop computers of all time, with over 12 million units sold.'
    ].join('\n'),
    2: [
        'Developed by: Sinclair Research',
        'Released: 1982',
        'Processor: Zilog Z-80A',
        'Fact: It played a pivotal role in the development of the computer games industry, especially in the United Kingdom.'
    ].join('\n'),
    3: [
        'Developed by: Apple Computer, Inc',
        'Released: 1977',
        'Processor: MOS 6502',
        'Fact: It was one of the first personal computers to feature color graphics.'
    ].join('\n')
};

function buildClassInfoPrompt(classIndex) {
    const className = CLASSES[classIndex];
    const classInfo = CLASS_INFO[classIndex];

    if (!className || !classInfo) {
        return null;
    }

    return `Tell me about the ${className} computer using ONLY the following information:\nINFORMATION:\n---\n${classInfo}\n---\nProvide a concise summary in 2-3 sentences. Do not add any details that are not in the provided information`;
}

/**
 * Initializes the application by loading both ML models in parallel
 */
async function init() {
    // Show loading overlay
    updateLoadingStatus('mobilenet', 'loading', 'Loading...');
    updateLoadingStatus('smollm', 'loading', 'Loading...');

    // Load both models in parallel
    const mobilenetPromise = loadModel();
    const wllamaPromise = initWllama();
    const moderationPromise = loadInappropriateWords();

    try {
        await Promise.all([mobilenetPromise, wllamaPromise, moderationPromise]);

        // Both models loaded successfully
        hideLoadingOverlay();
    } catch (e) {
        console.error("Initialization error:", e);
        // Show error but still try to hide overlay after a delay
        setTimeout(() => {
            hideLoadingOverlay();
            addMessage(`Error loading models: ${e.message}. Some features may be unavailable.`, "bot");
        }, 2000);
    }
}

function reverseWord(text) {
    return text.split('').reverse().join('');
}

function shiftWord(text, amount) {
    return text
        .split('')
        .map(char => String.fromCharCode(char.charCodeAt(0) + amount))
        .join('');
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadInappropriateWords() {
    try {
        const response = await fetch('./moderation/mod.txt');
        if (!response.ok) throw new Error('Failed to load inappropriate words');

        const encodedWordsText = await response.text();
        inappropriateWords = encodedWordsText
            .split(/\r?\n/)
            .map(word => word.trim())
            .filter(word => word.length > 0)
            .map(word => shiftWord(reverseWord(word.toLowerCase()), 1));

        console.log('Loaded inappropriate words:', inappropriateWords.length);
    } catch (error) {
        console.error('Error loading inappropriate words:', error);
        throw error;
    }
}

/**
 * Loads the MobileNet and custom classifier models for image classification
 * @throws {Error} If models fail to load
 */
async function loadModel() {
    // Attempt to load the model
    // Note: If you used the Browser Trainer, it might be a LayersModel.
    // If you used the Python script export, it is also a LayersModel.
    try {
        console.log("Loading base model...");
        updateLoadingStatus('mobilenet', 'loading', '25%');
        const mobilenet = await tf.loadLayersModel(BASE_MODEL_URL);
        const layer = mobilenet.getLayer('conv_pw_13_relu');
        featureExtractor = tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
        console.log("Base model loaded.");
        updateLoadingStatus('mobilenet', 'loading', '50%');

        console.log("Loading classifier model...");
        model = await tf.loadLayersModel(MODEL_URL);
        console.log("Classifier model loaded");
        updateLoadingStatus('mobilenet', 'loading', '75%');

        // Warmup prediction to initialize GPU kernels and prevent first-run issues
        console.log("Warming up model...");
        tf.tidy(() => {
            const dummyInput = tf.zeros([1, 224, 224, 3]);
            const dummyFeatures = featureExtractor.predict(dummyInput);
            model.predict(dummyFeatures);
        });
        console.log("Model ready!");
        updateLoadingStatus('mobilenet', 'ready', '100%');
        mobilenetReady = true;
    } catch (e) {
        console.warn("Standard load failed, trying as GraphModel...", e);
        try {
            model = await tf.loadGraphModel(MODEL_URL);
            updateLoadingStatus('mobilenet', 'ready', '100%');
            mobilenetReady = true;
        } catch (e2) {
            console.error(e2);
            updateLoadingStatus('mobilenet', 'error', 'Failed');
            throw new Error(`Failed to load model from ${MODEL_URL}. \nLayers Error: ${e.message}\nGraph Error: ${e2.message}`);
        }
    }
}

/**
 * Initializes the Wllama language model for text generation
 * @throws {Error} If Wllama initialization fails
 */
async function initWllama() {
    try {
        console.log("Initializing wllama...");
        updateLoadingStatus('smollm', 'loading', '10%');

        // Configure WASM paths for CDN
        const CONFIG_PATHS = {
            'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/single-thread/wllama.wasm',
            'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/multi-thread/wllama.wasm',
        };

        const progressCallback = ({ loaded, total }) => {
            const progress = Math.round((loaded / total) * 100);
            const adjustedProgress = Math.round(20 + (progress * 0.8)); // 20% to 100%
            updateLoadingStatus('smollm', 'loading', `${adjustedProgress}%`);
            console.log(`Loading wllama: ${progress}%`);
        };

        // Try multithreaded first when cross-origin isolation is enabled, then fall back to single-threaded.
        const detectedHardwareConcurrency = Number.isFinite(navigator.hardwareConcurrency)
            ? navigator.hardwareConcurrency
            : null;
        const useMultiThread = window.crossOriginIsolated === true;
        const preferredThreads = useMultiThread
            ? (detectedHardwareConcurrency ? Math.max(2, Math.floor(detectedHardwareConcurrency / 2)) : 2)
            : 1;
        console.log(`Cross-origin isolated: ${window.crossOriginIsolated}, attempting ${preferredThreads} thread(s)`);

        try {
            wllama = new Wllama(CONFIG_PATHS);
            updateLoadingStatus('smollm', 'loading', '20%');

            await wllama.loadModelFromHF(
                'TheBloke/phi-2-GGUF',
                'phi-2.Q3_K_M.gguf',
                {
                    n_ctx: 512,
                    n_threads: preferredThreads,
                    progressCallback
                }
            );
            console.log(`Wllama initialized successfully with Phi-2 Q3_K_M (${preferredThreads} thread(s))`);
        } catch (multiErr) {
            if (preferredThreads > 1) {
                console.warn(`Multi-threaded init failed (${multiErr.message}), falling back to single thread`);
                updateLoadingStatus('smollm', 'loading', '20%');

                wllama = new Wllama(CONFIG_PATHS);
                await wllama.loadModelFromHF(
                    'TheBloke/phi-2-GGUF',
                    'phi-2.Q3_K_M.gguf',
                    {
                        n_ctx: 512,
                        n_threads: 1,
                        progressCallback
                    }
                );
                console.log('Wllama initialized successfully with Phi-2 Q3_K_M (1 thread fallback)');
            } else {
                throw multiErr;
            }
        }

        const availableCores = detectedHardwareConcurrency ?? 'unknown';
        console.log(`[wllama] configured threads=${preferredThreads}, hardwareConcurrency=${availableCores}`);

        wllamaReady = true;
        updateLoadingStatus('smollm', 'ready', '100%');
    } catch (error) {
        console.error('Failed to initialize wllama:', error);
        updateLoadingStatus('smollm', 'error', 'Failed');
        wllamaReady = false;
        throw error;
    }
}

/**
 * Updates the loading status display for a specific model
 * @param {string} modelType - Either 'mobilenet' or 'smollm'
 * @param {string} status - One of 'loading', 'ready', or 'error'
 * @param {string} progress - Progress text to display
 */
function updateLoadingStatus(modelType, status, progress) {
    const statusId = modelType === 'mobilenet' ? 'mobilenetStatus' : 'smollmStatus';
    const progressId = modelType === 'mobilenet' ? 'mobilenetProgress' : 'smollmProgress';

    const statusElement = document.getElementById(statusId);
    const progressElement = document.getElementById(progressId);

    if (!statusElement || !progressElement) return;

    const iconSpan = statusElement.querySelector('.status-icon');

    if (status === 'loading') {
        iconSpan.textContent = '⏳';
        statusElement.classList.remove('ready', 'error');
        statusElement.classList.add('loading');
    } else if (status === 'ready') {
        iconSpan.textContent = '✓';
        statusElement.classList.remove('loading', 'error');
        statusElement.classList.add('ready');
    } else if (status === 'error') {
        iconSpan.textContent = '✗';
        statusElement.classList.remove('loading', 'ready');
        statusElement.classList.add('error');
    }

    progressElement.textContent = progress;
}

/**
 * Hides the loading overlay with a fade-out animation
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
}

/**
 * Adds a message to the chat interface
 * @param {string} text - The message text
 * @param {string} sender - Either 'user' or 'bot'
 * @param {string|null} imageUrl - Optional image URL to display
 */
function setBubbleContent(bubble, text) {
    if (typeof DOMPurify !== 'undefined') {
        bubble.innerHTML = DOMPurify.sanitize(text, {
            ALLOWED_TAGS: ['b', 'i', 'br', 'small', 'a'],
            ALLOWED_ATTR: ['href', 'target', 'style'],
            ALLOW_DATA_ATTR: false
        });
    } else {
        bubble.textContent = text;
    }
}

function addMessage(text, sender, imageUrl = null, options = {}) {
    const { deferCompletion = false } = options;
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.setAttribute('role', 'article');
    div.setAttribute('aria-label', `${sender === 'user' ? 'User' : 'Assistant'} message`);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    setBubbleContent(bubble, text);

    if (imageUrl) {
        bubble.classList.add('image-bubble');
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'message-image';
        img.alt = 'Uploaded image';
        img.onload = scrollToBottom;
        bubble.appendChild(img);
    }

    div.appendChild(bubble);

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.appendChild(timestamp);

    chatContainer.appendChild(div);
    scrollToBottom();

    // Text-to-Speech for bot responses when input was spoken
    if (sender === 'bot' && isVoiceInput && !deferCompletion) {
        speakText(bubble);
        isVoiceInput = false; // Reset after speaking
    } else if (sender === 'bot' && !deferCompletion) {
        // If no speech, we can end the response state
        endResponse();
    }

    return { message: div, bubble };
}

function getBoardIdentificationMessage(text) {
    const lowerText = String(text || '').toLowerCase();

    if (lowerText.includes('assy 250')) {
        return 'The assembly number indicates that the board may have come from a Commodore 64.';
    }

    if (lowerText.includes('820-')) {
        return 'Serial numbers beginning 820- are commonly found in Apple computers.';
    }

    if (lowerText.includes('z-80')) {
        return 'The Zilog Z-80 processor is common in Sinclair computers, such as the ZX-80, ZX-81, and ZX Spectrum.';
    }

    return "I can't determine what kind of computer this came from.";
}

/**
 * Scrolls the chat container to the bottom
 */
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Shows a typing indicator in the chat
 */
function showTyping() {
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'message bot';
    div.innerHTML = getTypingIndicatorMarkup('Assistant is thinking');
    chatContainer.appendChild(div);
    scrollToBottom();

    // Enable stop button when bot starts responding
    startResponse();
}

/**
 * Removes the typing indicator from the chat
 */
function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTypingIndicatorMarkup(ariaLabel = 'Assistant is thinking') {
    return `
        <div class="typing" aria-label="${escapeHtml(ariaLabel)}">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <p style="font-size: 0.85em; color: #666; margin-top: 8px; font-style: italic;">Responses can be slow in local browser mode. Thanks for your patience!</p>
    `;
}

async function waitWithStop(ms) {
    const intervalMs = 100;
    let elapsed = 0;

    while (elapsed < ms) {
        if (checkStopResponse()) {
            return false;
        }

        const waitMs = Math.min(intervalMs, ms - elapsed);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        elapsed += waitMs;
    }

    return true;
}

async function runSearchFlow(searchKeywords, url) {
    showTyping();

    const completedThinking = await waitWithStop(5000);
    if (!completedThinking) {
        removeTyping();
        return;
    }

    removeTyping();

    if (checkStopResponse()) {
        return;
    }

    addMessage(`I'm searching Bing for ${searchKeywords}...`, 'bot', null, { deferCompletion: true });

    const completedDelay = await waitWithStop(3000);
    if (!completedDelay || checkStopResponse()) {
        return;
    }

    addMessage(`Here's what I found: <a href="${url}" target="_blank" style="color: #64185e; text-decoration: underline;">Click here to see results for ${searchKeywords}</a>`, 'bot');
}

function getRandomHoldingSentence() {
    const holdingSentences = [
        'That is a great question, let me think about it carefully.',
        'I am reviewing the relevant details so I can give you a precise answer.',
        'Let me quickly check the most relevant information before I respond.',
        'I am checking the context now to make sure the answer is accurate.',
        'I am organizing my thoughts so my explanation is clear and concise.',
        'Let me validate the facts first, then I will provide a focused response.'
    ];

    const randomIndex = Math.floor(Math.random() * holdingSentences.length);
    return holdingSentences[randomIndex];
}

async function animateHoldingSentence(element, sentence, speed = 55) {
    let partial = '';

    for (const char of sentence) {
        if (checkStopResponse()) {
            return false;
        }

        partial += char;
        element.innerHTML = `<p>${escapeHtml(partial)}</p>`;
        scrollToBottom();
        await new Promise(resolve => setTimeout(resolve, speed));
    }

    return true;
}

async function playPreResponseSequence() {
    const typingElement = document.getElementById('typing-indicator');
    if (!typingElement) {
        return true;
    }

    typingElement.innerHTML = getTypingIndicatorMarkup('Assistant is thinking');
    scrollToBottom();

    const completedThinking = await waitWithStop(15000);
    if (!completedThinking) {
        return false;
    }

    const holdingSentence = getRandomHoldingSentence();
    const completedTyping = await animateHoldingSentence(typingElement, holdingSentence, 55);
    if (!completedTyping) {
        return false;
    }

    const completedPause = await waitWithStop(650);
    if (!completedPause) {
        return false;
    }

    typingElement.innerHTML = `
        <div style="display: inline-flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 100%;">
            <div>${escapeHtml(holdingSentence)}</div>
            <div>${getTypingIndicatorMarkup('Assistant is thinking')}</div>
        </div>
    `;
    scrollToBottom();

    return true;
}

/**
 * Marks the bot as responding (enables stop button)
 */
function startResponse() {
    isResponding = true;
    shouldStopResponse = false;
    sendBtn.classList.add('stop-mode');
    sendBtn.textContent = '⬜';
    sendBtn.title = 'Stop';
}

/**
 * Marks the bot as done responding (disables stop button)
 */
function endResponse() {
    // Only end if not speaking
    if (!speechSynthesis.speaking) {
        isResponding = false;
        shouldStopResponse = false;
        sendBtn.classList.remove('stop-mode');
        sendBtn.textContent = '▶';
        sendBtn.title = 'Send';
    }
}

/**
 * Checks if the user has requested to stop the response
 * @returns {boolean} True if response should be stopped
 */
function checkStopResponse() {
    return shouldStopResponse;
}

const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'of', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'for',
    'about', 'as', 'that', 'this', 'these', 'those', 'it', 'they',
    'he', 'she', 'we', 'you', 'i', 'me', 'my', 'him', 'her', 'us',
    'them', 'which', 'who', 'whom', 'whose', 'what', 'where', 'when',
    'why', 'how', 'can', 'could', 'will', 'would', 'should',
    'may', 'might', 'must', 'find', 'search', 'show', 'tell', 'look',
    'ebay', 'sale', 'buy', 'price', 'cost', 'need', 'one'
]);

const SEARCH_EBAY_TRIGGERS = ['ebay', 'for sale', 'buy', 'purchase', 'shop'];
const SEARCH_BING_TRIGGERS = ['bing', 'search', 'find'];
const SEARCH_TRIGGER_WORD_SET = new Set([
    ...SEARCH_EBAY_TRIGGERS.join(' ').split(/\s+/),
    ...SEARCH_BING_TRIGGERS.join(' ').split(/\s+/)
]);

// Initialize
// ...

/**
 * Main message handler - processes text input, images, and commands
 */
async function handleSend() {
    const text = textInput.value.trim();

    // Check if we have a file or text
    if (!text && !pendingFile) return;

    // Clear input immediately
    textInput.value = '';
    textInput.style.height = 'auto';

    // 1. Text Processing
    if (text) {
        addMessage(text, "user");

        // Check for inappropriate content
        const lowerText = text.toLowerCase();
        const containsInappropriate = inappropriateWords.some(word => {
            const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
            return regex.test(lowerText);
        });

        if (containsInappropriate) {
            addMessage("I'm sorry, I can't help with that because it triggered a content-safety filtering policy.\nI can only help with information about the history of computing.", "bot");
            return;
        }

        // Check for Summarization Command
        const lines = text.split('\n');
        if (lines.length > 1 && lines[0].trim().toLowerCase().startsWith('summarize')) {
            const contentToSummarize = lines.slice(1).join('\n');
            showTyping();
            // Simulate "reading"
            setTimeout(() => {
                // Check if user stopped the response
                if (checkStopResponse()) {
                    removeTyping();
                    return;
                }

                const summary = summarizeText(contentToSummarize);

                // Entity Extraction
                const doc = nlp(contentToSummarize);
                const people = doc.people().out('array');
                const places = doc.places().out('array');
                // Use .match for dates
                let dates = doc.match('#Date').out('array');

                // Custom regex for years (4 digits between 1900 and current year, allowing 's' suffix)
                const currentYear = new Date().getFullYear();
                const yearRegex = /\b(19\d{2}|20\d{2})s?\b/g;
                const matches = contentToSummarize.match(yearRegex);

                if (matches) {
                    matches.forEach(item => {
                        // Remove 's' for numeric check
                        const yearNum = parseInt(item.replace('s', ''));
                        if (yearNum >= 1900 && yearNum <= currentYear) {
                            dates.push(item);
                        }
                    });
                }

                // Deduplicate and Sort
                dates = [...new Set(dates)].sort();

                let entityInfo = "";

                if (people.length > 0) {
                    entityInfo += `<br><b>People:</b> ${[...new Set(people)].join(', ')}`;
                }
                if (places.length > 0) {
                    entityInfo += `<br><b>Places:</b> ${[...new Set(places)].join(', ')}`;
                }
                if (dates.length > 0) {
                    entityInfo += `<br><b>Dates/Years:</b> ${dates.join(', ')}`;
                }

                removeTyping();
                addMessage(`<b>Summary:</b><br><br>${summary}<br><br><b>Entities Found:</b>${entityInfo}`, "bot");
            }, 1000);

            return;
        }
    }

    // 2. Handle Image
    if (pendingFile) {

        // Read file to data URL for display
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageUrl = event.target.result;

            addMessage("", "user", imageUrl);

            // Start Analysis
            showTyping();

            // Create an invisible image element for TF.js to read
            const imgEl = new Image();
            imgEl.src = imageUrl;
            imgEl.onload = async () => {
                await performClassification(imgEl, text); // Pass text context
            };
        };
        reader.readAsDataURL(pendingFile);

        // Reset pending
        removeImage();
        return;
    }

    // 3. Text Only Response (Language model, eBay, or Bing search)
    const lowerText = text.toLowerCase();
    const isEbay = hasBoundaryKeyword(lowerText, SEARCH_EBAY_TRIGGERS);
    const isBing = hasBoundaryKeyword(lowerText, SEARCH_BING_TRIGGERS);

    const keywords = extractKeywords(text);
    if (!keywords) {
        addMessage("Please enter a more specific query.", "bot");
        return;
    }

    if (isEbay) {
        const searchKeywords = extractKeywords(text, SEARCH_TRIGGER_WORD_SET);
        if (!searchKeywords) {
            addMessage("Please enter a more specific shopping query.", "bot");
            return;
        }

        const url = `https://www.bing.com/shop/topics?q=${searchKeywords.replace(/ /g, '+')}`;
        await runSearchFlow(searchKeywords, url);
        return;
    }

    if (isBing) {
        const searchKeywords = extractKeywords(text, SEARCH_TRIGGER_WORD_SET);
        if (!searchKeywords) {
            addMessage("Please enter a more specific search query.", "bot");
            return;
        }

        const url = `https://www.bing.com/search?q=${searchKeywords.replace(/ /g, '+')}`;
        await runSearchFlow(searchKeywords, url);
        return;
    }

    showTyping();

    try {
        const summary = await generateComputingInfo(text);
        removeTyping();

        if (checkStopResponse()) return;

        if (summary) {
            addMessage(`${summary}`, "bot");
            // Store in conversation history (truncated to first sentence)
            conversationHistory.push({
                user: truncateToFirstSentence(text),
                assistant: truncateToFirstSentence(summary)
            });
            // Keep only last 2 exchanges to avoid context overflow
            if (conversationHistory.length > 2) {
                conversationHistory.shift();
            }
        } else {
            addMessage(`I'm sorry. I don't know about that topic.`, "bot");
        }
    } catch (e) {
        removeTyping();
        if (checkStopResponse()) return;
        addMessage("Sorry, I had trouble searching via text. " + e.message, "bot");
    }
}

/**
 * Extracts keywords from text by removing stopwords
 * @param {string} text - The text to extract keywords from
 * @returns {string} Space-separated keywords
 */
function extractKeywords(text, excludedWords = null) {
    // Remove punctuation and split
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

    // Filter using global STOPWORDS
    return words.filter(w => !STOPWORDS.has(w) && w.length > 0 && !(excludedWords && excludedWords.has(w))).join(' ');
}

function hasBoundaryKeyword(text, keywords) {
    return keywords.some(keyword => {
        const pattern = keyword
            .split(/\s+/)
            .map(escapeRegex)
            .join('\\s+');

        const regex = new RegExp(
            `(^\\s*${pattern}(?=$|\\s|[.?!:]))|([.?!:]\\s*${pattern}(?=$|\\s|[.?!:]))|( ${pattern}(?= ))|(\\b${pattern}(?=[.?!:]))`
        );

        return regex.test(text);
    });
}

/**
 * Extracts the first sentence from a given text string
 * @param {string} text - The text to truncate
 * @returns {string} The first sentence or first 100 characters
 */
function truncateToFirstSentence(text) {
    // Find first sentence-ending punctuation
    const match = text.match(/^[^.!?]+[.!?]/);
    if (match) {
        return match[0].trim();
    }
    // No sentence-ending punctuation found, take first 100 characters
    return text.substring(0, 100).trim();
}

/**
 * Summarizes text using TextRank algorithm
 * @param {string} text - The text to summarize
 * @returns {string} Summary of top 3 sentences
 */
function summarizeText(text) {
    // 1. Split into sentences (simple approximation)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    if (sentences.length <= 3) return sentences.join(' ');

    // 2. Tokenize sentences
    const tokenizedSentences = sentences.map(s => {
        return s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => !STOPWORDS.has(w) && w.length > 0);
    });

    // 3. Build Similarity Matrix (Graph)
    // We'll calculate score for each sentence based on overlaps with others
    const scores = new Array(sentences.length).fill(0);

    for (let i = 0; i < sentences.length; i++) {
        for (let j = 0; j < sentences.length; j++) {
            if (i === j) continue;

            const wordsI = new Set(tokenizedSentences[i]);
            const wordsJ = new Set(tokenizedSentences[j]);

            // Jaccard similarity or simple intersection
            // TextRank uses intersection / (log(|Si|) + log(|Sj|))
            let intersection = 0;
            for (let w of wordsI) {
                if (wordsJ.has(w)) intersection++;
            }

            if (intersection > 0) {
                const norm = Math.log(wordsI.size || 1) + Math.log(wordsJ.size || 1);
                // Prevent div by zero if empty
                if (norm > 0) {
                    scores[i] += intersection / norm;
                }
            }
        }
    }

    // 4. Sort and Pick Top 3
    // We want to keep original order for readability, so we'll pick indices
    const indicesWithScores = scores.map((score, i) => ({ index: i, score }));
    indicesWithScores.sort((a, b) => b.score - a.score);

    const topIndices = indicesWithScores.slice(0, 3).map(item => item.index).sort((a, b) => a - b);

    return topIndices.map(i => sentences[i].trim()).join(' ');
}

/**
 * Handles image file selection from input
 * @param {Event} e - The change event
 */
function handleImageInput(e) {
    const file = e.target.files[0];
    if (!file) return;

    pendingFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('preview-img').src = event.target.result;
        document.getElementById('preview-container').classList.remove('hidden');
        textInput.focus();
    };
    reader.readAsDataURL(file);

    // Reset file input so same file can be selected again
    imageUpload.value = '';
}

/**
 * Removes the selected image and hides preview
 */
function removeImage() {
    pendingFile = null;
    document.getElementById('preview-img').src = '';
    document.getElementById('preview-container').classList.add('hidden');
    imageUpload.value = '';
}

/**
 * Performs image classification and generates response
 * @param {HTMLImageElement} imgEl - The image element to classify
 * @param {string} userText - Optional user text for context
 */
async function performClassification(imgEl, userText = "") {
    try {
        const result = await classify(imgEl);
        const topMatch = result[0];
        const classIndex = CLASSES.indexOf(topMatch.className);
        const lowerText = userText.toLowerCase();
        const confidence = (topMatch.probability * 100).toFixed(1);
        const classDescription = `I'm ${confidence}% certain this is a ${topMatch.className}.`;

        if (checkStopResponse()) {
            removeTyping();
            return;
        }

        // Keep waiting dots visible for 10 seconds before class identification.
        const completedInitialWait = await waitWithStop(10000);
        if (!completedInitialWait) {
            removeTyping();
            return;
        }

        // Class 6: Unknown - Simple "don't know" message
        if (classIndex === 6) {
            removeTyping();
            addMessage("I'm sorry. I don't know what this is. I can only recognize computers and circuit boards.", "bot");
            return;
        }

        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            const typedClassLine = await animateHoldingSentence(typingElement, classDescription, 45);
            if (!typedClassLine) {
                removeTyping();
                return;
            }
        }

        removeTyping();

        if (checkStopResponse()) return;

        // Class 5: Printed Circuit Board - Show prediction + OCR
        if (classIndex === 5) {
            addMessage(classDescription, 'bot', null, { deferCompletion: true });

            const readingTextMessage = 'Reading text from the board...';
            const { bubble } = addMessage(readingTextMessage, 'bot', null, { deferCompletion: true });
            startResponse();

            const completedPause = await waitWithStop(5000);
            if (!completedPause) {
                endResponse();
                return;
            }

            // Perform OCR using the same approach as info-extractor
            try {
                console.log('Starting OCR for image');

                // Initialize Tesseract with progress tracking (same as info-extractor)
                const worker = await Tesseract.createWorker('eng', 1, {
                    logger: m => {
                        console.log('Tesseract log:', m);
                    }
                });

                // Perform OCR directly on the image element (same as info-extractor)
                console.log('Performing OCR recognition...');
                const result = await worker.recognize(imgEl);
                const data = result.data;

                console.log('OCR completed. Text length:', data.text?.length || 0);
                console.log('OCR text preview:', data.text?.substring(0, 200) || 'No text');

                // Clean up worker (same as info-extractor)
                await worker.terminate();

                if (checkStopResponse()) return;

                // Use the extracted text
                const rawText = data.text || '';
                let finalReply = `${readingTextMessage}`;

                if (!rawText || rawText.trim().length === 0) {
                    finalReply += `<br><br>I couldn't extract any text from the board.`;
                    finalReply += `<br><br>${getBoardIdentificationMessage('')}`;
                } else {
                    // Clean the text - preserve hyphens, underscores, dots for part numbers
                    const cleanText = rawText
                        .split(/\s+/)
                        .map(word => word.replace(/[^a-zA-Z0-9\-_.]/g, ''))
                        .filter(word => {
                            const alphanumeric = word.replace(/[\-_.]/g, '');
                            return alphanumeric.length >= 2;
                        })
                        .join(' ')
                        .trim();

                    // Validate: require at least 3 total alphanumeric characters
                    if (cleanText && cleanText.replace(/[^a-zA-Z0-9]/g, '').length >= 3) {
                        finalReply += `<br><br>There are details printed on the board.`;
                        finalReply += `<br><br>${getBoardIdentificationMessage(cleanText)}`;
                    } else {
                        finalReply += `<br><br>I couldn't extract any text from the board.`;
                        finalReply += `<br><br>${getBoardIdentificationMessage('')}`;
                    }
                }

                setBubbleContent(bubble, finalReply);
                scrollToBottom();

                if (isVoiceInput) {
                    speakText(bubble);
                    isVoiceInput = false;
                } else {
                    endResponse();
                }
            } catch (e) {
                console.error("OCR Failed", e);
                if (!checkStopResponse()) {
                    const fallbackReply = `${readingTextMessage}<br><br>I couldn't extract any text from the board.<br><br>${getBoardIdentificationMessage('')}`;
                    setBubbleContent(bubble, fallbackReply);
                    scrollToBottom();

                    if (isVoiceInput) {
                        speakText(bubble);
                        isVoiceInput = false;
                    } else {
                        endResponse();
                    }
                }
            }
            return;
        }

        // Class 4: Computer - show delayed uncertainty message after a waiting indicator
        if (classIndex === 4) {
            let classPredictionMessage = `${classDescription}`;

            if (result[1] && result[1].probability > 0.1) {
                classPredictionMessage += `<br><small>Second guess: ${result[1].className} (${(result[1].probability * 100).toFixed(1)}%)</small>`;
            }

            addMessage(classPredictionMessage, 'bot', null, { deferCompletion: true });

            const { bubble } = addMessage('', 'bot', null, { deferCompletion: true });
            bubble.innerHTML = getTypingIndicatorMarkup('Assistant is thinking');
            scrollToBottom();
            startResponse();

            const completedUnknownDelay = await waitWithStop(5000);
            if (!completedUnknownDelay) {
                endResponse();
                return;
            }

            const unknownComputerMessage = "Unfortunately, I'm not sure what kind of computer this is.";
            setBubbleContent(bubble, unknownComputerMessage);
            scrollToBottom();

            if (isVoiceInput) {
                speakText(bubble);
                isVoiceInput = false;
            } else {
                endResponse();
            }

            return;
        }

        // Standard prediction message for remaining classes
        let reply = `${classDescription}`;

        // Add secondary guess if close
        if (result[1] && result[1].probability > 0.1) {
            reply += `<br><small>Second guess: ${result[1].className} (${(result[1].probability * 100).toFixed(1)}%)</small>`;
        }

        // Use the same search triggers as text-only searches.
        const isEbay = hasBoundaryKeyword(lowerText, SEARCH_EBAY_TRIGGERS);
        const isBing = hasBoundaryKeyword(lowerText, SEARCH_BING_TRIGGERS);

        // Classes 0, 1, 2, 3, 4: eBay search or information
        if ([0, 1, 2, 3, 4].includes(classIndex)) {
            if (isEbay) {
                // Search flow uses the same staged function as text-only searches.
                addMessage(reply, "bot");
                const url = `https://www.bing.com/shop/topics?q=${topMatch.className.replace(/ /g, '+')}`;
                await runSearchFlow(topMatch.className, url);
                return;
            }

            if (isBing) {
                addMessage(reply, "bot");
                const url = `https://www.bing.com/search?q=${topMatch.className.replace(/ /g, '+')}`;
                await runSearchFlow(topMatch.className, url);
                return;
            } else {
                // AI-generated info for classes 0, 1, 2, 3
                if ([0, 1, 2, 3].includes(classIndex)) {
                    addMessage(classDescription, 'bot', null, { deferCompletion: true });

                    const completedInfoDelay = await waitWithStop(5000);
                    if (!completedInfoDelay) {
                        endResponse();
                        return;
                    }

                    const findingInfoMessage = `I'm finding some information about the ${topMatch.className}...`;
                    const { bubble } = addMessage(findingInfoMessage, 'bot', null, { deferCompletion: true });
                    bubble.innerHTML = `<p>${escapeHtml(findingInfoMessage)}</p><div style="margin-top: 8px;">${getTypingIndicatorMarkup('Assistant is thinking')}</div>`;
                    scrollToBottom();
                    startResponse();

                    try {
                        const historyUserPrompt = `Tell me about the ${topMatch.className} computer`;
                        const classContext = CLASS_INFO[classIndex] || null;
                        const summary = await generateComputingInfo(historyUserPrompt, classContext);
                        if (checkStopResponse()) {
                            return;
                        }
                        if (summary) {
                            setBubbleContent(bubble, `${findingInfoMessage}<br><br>${summary}`);
                            scrollToBottom();
                            conversationHistory.push({
                                user: historyUserPrompt,
                                assistant: truncateToFirstSentence(summary)
                            });
                            if (conversationHistory.length > 2) {
                                conversationHistory.shift();
                            }
                        } else {
                            setBubbleContent(bubble, `${findingInfoMessage}<br><br>I'm sorry. I don't know about that topic.`);
                            scrollToBottom();
                        }
                    } catch (e) {
                        console.warn("Info generation failed", e);
                        setBubbleContent(bubble, `${findingInfoMessage}<br><br>Sorry, I had trouble searching via text.`);
                        scrollToBottom();
                    }

                    if (isVoiceInput) {
                        speakText(bubble);
                        isVoiceInput = false;
                    } else {
                        endResponse();
                    }

                    return;
                }

                // Class 4 handled above with delayed uncertainty flow.
            }
        }

        addMessage(reply, "bot");

    } catch (err) {
        removeTyping();
        addMessage("Oops, I had trouble analyzing that image. " + err.message, "bot");
        console.error(err);
    }
}

/**
 * Generates computing-related information using Wllama LLM
 * @param {string} query - The query to generate information about
 * @returns {Promise<string|null>} Generated text or null if unavailable
 */
async function generateComputingInfo(query, context = null) {
    // If wllama is not ready, return a fallback message
    if (!wllamaReady || !wllama) {
        console.warn("Wllama not ready, skipping generation");
        return null;
    }

    try {
        const introCompleted = await playPreResponseSequence();
        if (!introCompleted) {
            return null;
        }

        // Build a plain instruct-style prompt for Phi-2 (non-ChatML)
        const promptSections = [];
        promptSections.push('System: You are a knowledgeable assistant about computing history. Respond in one concise factual paragraph. If you don\'t know, say you don\'t know.');

        // Include conversation history for context (last 2 exchanges)
        if (conversationHistory.length > 0) {
            conversationHistory.forEach(exchange => {
                const previousUser = truncateToFirstSentence(exchange.user || '');
                const previousAssistant = truncateToFirstSentence(exchange.assistant || '');

                if (previousUser) {
                    promptSections.push(`Previous user (first sentence): ${previousUser}`);
                }
                if (previousAssistant) {
                    promptSections.push(`Previous assistant (first sentence): ${previousAssistant}`);
                }
            });
        }

        // Add current user query (full text)
        promptSections.push(`Current user prompt: ${query}`);

        // Add optional context block
        if (context) {
            const maxContextLength = 512;
            const truncatedContext = context.length > maxContextLength
                ? context.substring(0, maxContextLength) + '...'
                : context;
            promptSections.push(
                'Respond by summarizing the following information in a single, short, paragraph:\n---\n' +
                truncatedContext +
                '\n---'
            );
        }

        const promptText = `Instruct: ${promptSections.join('\n\n')}\nOutput:`;

        console.log('Generating info for:', query);

        // Generate response
        let responseText = '';
        const completion = await wllama.createCompletion(promptText, {
            nPredict: 250,  // Allow for more complete responses
            sampling: {
                temp: 0.3,  // Lower temperature for more factual, less creative responses
                top_k: 40,
                top_p: 0.9,
                penalty_repeat: 1.1
            },
            stopTokens: ['\nInstruct:', '\nSystem:', '\nCurrent user prompt:'],
            stream: true
        });

        for await (const chunk of completion) {
            if (chunk.currentText) {
                responseText = chunk.currentText;
            }
        }

        // Clear KV cache after generation to free memory
        // Suppress munmap warnings - these are harmless WASM memory management messages
        try {
            await wllama.kvClear();
        } catch (error) {
            // Silently ignore - kvClear can throw harmless warnings
        }

        // Clean up the response
        responseText = responseText.trim();

        // Remove incomplete last sentence (doesn't end with . ? !)
        if (responseText && !responseText.match(/[.!?]$/)) {
            // Find the last complete sentence
            const lastCompleteMatch = responseText.match(/(.*[.!?])/);
            if (lastCompleteMatch) {
                responseText = lastCompleteMatch[1].trim();
            }
        }

        // If response is too short or empty, return null
        if (!responseText || responseText.length < 10) {
            return null;
        }

        return responseText;

    } catch (error) {
        console.error('Error generating info:', error);
        // Clear cache on error (suppress warnings)
        try {
            await wllama.kvClear();
        } catch (e) {
            // Silently ignore kvClear errors
        }
        return null;
    }
}

/**
 * Classifies an image using TensorFlow.js models
 * @param {HTMLImageElement} imgElement - The image to classify
 * @returns {Promise<Array>} Array of classification results sorted by probability
 */
async function classify(imgElement) {
    if (!model || !featureExtractor) throw new Error("Model not loaded");

    // Use async data extraction for better reliability
    const predictions = tf.tidy(() => {
        // Preprocessing must match Training!
        // Usually MobileNet expects: 224x224, float32, normalized to [-1, 1]
        let tensor = tf.browser.fromPixels(imgElement)
            .resizeNearestNeighbor([224, 224]) // MobileNet default
            .toFloat();

        // Normalize: (x / 127.5) - 1
        const offset = tf.scalar(127.5);
        const normalized = tensor.sub(offset).div(offset).expandDims();

        // 1. Extract features
        const features = featureExtractor.predict(normalized);

        // 2. Classify - return predictions tensor (it won't be disposed by tidy)
        return model.predict(features);
    });

    // Extract values asynchronously after tidy, then dispose the predictions tensor
    const values = await predictions.data();
    predictions.dispose();

    // Process results
    const results = Array.from(values).map((p, i) => ({
        className: CLASSES[i] || `Class ${i}`,
        probability: p
    }));

    // Sort descending
    return results.sort((a, b) => b.probability - a.probability);
}

// Event Listeners
sendBtn.addEventListener('click', () => {
    if (sendBtn.classList.contains('stop-mode')) {
        handleStopResponse();
    } else {
        handleSend();
    }
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// Auto-resize textarea
textInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

uploadBtn.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', handleImageInput);
document.getElementById('remove-img-btn').addEventListener('click', removeImage);

// Modal and UI buttons
const aboutBtn = document.getElementById('aboutBtn');
if (aboutBtn) {
    aboutBtn.addEventListener('click', showAbout);
}

const viewDetailsBtn = document.getElementById('viewDetailsBtn');
if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener('click', showAppDetails);
}

const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
    restartBtn.addEventListener('click', restartConversation);
}

const closeAppDetailsBtn = document.getElementById('closeAppDetailsBtn');
if (closeAppDetailsBtn) {
    closeAppDetailsBtn.addEventListener('click', closeAppDetails);
}

const closeAboutBtn = document.getElementById('closeAboutBtn');
if (closeAboutBtn) {
    closeAboutBtn.addEventListener('click', closeAbout);
}

// Voice Input (Speech-to-Text)
micBtn.addEventListener('click', handleVoiceInput);

/**
 * Handles voice input using Web Speech API
 */
function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        addMessage("Sorry! Speech input is not currently available.", "bot");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.classList.add('listening');

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textInput.value = transcript;
        isVoiceInput = true;
        handleSend();
    };

    recognition.onerror = (event) => {
        micBtn.classList.remove('listening');
        addMessage("Sorry! Speech input is not currently available.", "bot");
        console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
        micBtn.classList.remove('listening');
    };
}

/**
 * Converts text to speech using Web Speech Synthesis API
 * @param {HTMLElement} element - The element containing text to speak
 */
function speakText(element) {
    if (!('speechSynthesis' in window)) {
        endResponse();
        return;
    }

    // Extract text content from DOM element (safe, no HTML parsing needed)
    const cleanText = (element.textContent || '').replace(/\s+/g, ' ').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Use default voice
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        utterance.voice = voices[0];
    }

    // Keep stop button enabled (already set by startResponse)
    sendBtn.classList.add('stop-mode');
    sendBtn.textContent = '⬜';
    sendBtn.title = 'Stop';

    utterance.onend = () => {
        endResponse();
    };

    utterance.onerror = () => {
        endResponse();
    };

    speechSynthesis.speak(utterance);
}

/**
 * Stops any ongoing bot response (text generation or speech)
 */
function handleStopResponse() {
    // Set flag to stop any ongoing text generation
    shouldStopResponse = true;

    // Stop speech if playing
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    // Remove typing indicator
    removeTyping();

    // Reset button state
    endResponse();
}

/**
 * Restarts the conversation by clearing chat history and state
 */
async function restartConversation() {
    if (confirm('Are you sure you want to clear the conversation history?')) {
        // Stop any ongoing response
        handleStopResponse();

        // Clear the chat UI
        chatContainer.innerHTML = '<div class="welcome-message">Let\'s chat about computing history...</div>';

        // Remove any selected image
        removeImage();

        // Reset voice input flag
        isVoiceInput = false;

        // Clear conversation history (browser-side cache)
        conversationHistory = [];

        // Clear model's KV cache to completely reset context
        if (wllama && wllamaReady) {
            try {
                await wllama.kvClear();
                console.log('Model KV cache cleared');
            } catch (error) {
                // Silently ignore - kvClear can throw harmless warnings
                console.debug('KV cache clear warning (harmless):', error);
            }
        }
    }
}

/**
 * Shows the app details modal with focus management
 */
function showAbout() {
    const modal = document.getElementById('aboutModal');
    const closeBtn = document.getElementById('closeAboutBtn');
    modal.style.display = 'flex';
    if (closeBtn) {
        closeBtn.focus();
    }
}

function closeAbout() {
    const modal = document.getElementById('aboutModal');
    const aboutBtn = document.getElementById('aboutBtn');
    modal.style.display = 'none';
    if (aboutBtn) {
        aboutBtn.focus();
    }
}

function showAppDetails() {
    const modal = document.getElementById('appDetailsModal');
    const closeBtn = document.getElementById('closeAppDetailsBtn');

    modal.style.display = 'flex';

    // Focus the close button for keyboard accessibility
    if (closeBtn) {
        closeBtn.focus();
    }
}

/**
 * Closes the app details modal
 */
function closeAppDetails() {
    const modal = document.getElementById('appDetailsModal');
    const viewDetailsBtn = document.getElementById('viewDetailsBtn');

    modal.style.display = 'none';

    // Return focus to the button that opened the modal
    if (viewDetailsBtn) {
        viewDetailsBtn.focus();
    }
}

// Close modal when clicking outside of it
document.addEventListener('click', function (event) {
    const modal = document.getElementById('appDetailsModal');
    if (event.target === modal) {
        closeAppDetails();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const aboutModal = document.getElementById('aboutModal');
        if (aboutModal && aboutModal.style.display === 'flex') {
            closeAbout();
            return;
        }
        const modal = document.getElementById('appDetailsModal');
        if (modal.style.display === 'flex') {
            closeAppDetails();
        }
    }
});

// Start
init();
