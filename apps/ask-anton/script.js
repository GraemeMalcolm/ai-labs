import { Wllama } from 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/index.js';

class AskAnton {
    constructor() {
        this.wllama = null;      // CPU-only wllama engine
        this.conversationHistory = [];
        this.isGenerating = false;
        this.indexData = null;
        this.stopRequested = false;
        this.currentStream = null;
        this.currentAbortController = null;
        this.currentModal = null;
        this.lastFocusedElement = null;
        this.modalFocusTrapHandler = null;
        this.usedVoiceInput = false;
        this.cpuCores = navigator.hardwareConcurrency || 2;
        this.optimalThreads = Math.max(1, Math.min(4, this.cpuCores - 1));

        // Preset tuning profiles for CPU local inference.
        this.inferenceProfiles = {
            fast: {
                n_ctx: 512,
                maxContextLength: 220,
                nPredict: 80,
                sampling: {
                    temp: 0.5,
                    top_k: 20,
                    top_p: 0.9,
                    penalty_repeat: 1.05
                }
            },
            balanced: {
                n_ctx: 768,
                maxContextLength: 320,
                nPredict: 110,
                sampling: {
                    temp: 0.6,
                    top_k: 30,
                    top_p: 0.9,
                    penalty_repeat: 1.1
                }
            }
        };
        this.activeInferenceProfile = 'fast';

        this.elements = {
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            chatContainer: document.getElementById('chat-container'),
            chatMessages: document.getElementById('chat-messages'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            micBtn: document.getElementById('mic-btn'),
            restartBtn: document.getElementById('restart-btn'),
            searchStatus: document.getElementById('search-status'),
            aboutBtn: document.getElementById('about-btn'),
            aboutModal: document.getElementById('about-modal'),
            aboutModalClose: document.getElementById('about-modal-close'),
            aboutModalOk: document.getElementById('about-modal-ok'),
        };

        this.systemPrompt = `You are Anton, a knowledgeable and friendly AI learning assistant who helps students understand AI concepts.

IMPORTANT: Follow these guidelines when responding:
- Do not engage in conversation on topics other than artificial intelligence and computing.
- Explain concepts clearly and concisely in a single paragraph based only on the provided context.
- Keep responses short and focused on the question, with no headings.
- Use examples and analogies when helpful.
- Use simple language suitable for learners in a conversational, friendly tone.
- Provide a general descriptions and overviews, but do NOT provide explicit steps or instructions for developing AI solutions.
- If the context includes "Sorry, I couldn't find any specific information on that topic. Please try rephrasing your question or explore other AI concepts.", use that exact phrasing and no additional information.
- Do not start responses with "A:" or "Q:".
- Keep your responses concise and to the point.
- Do NOT provide links for more information (these will be added automatically later).`;

        // Prohibited words for content moderation (whole words only)
        this.prohibitedWords = [];

        this.initialize();
    }

    getProfileSettings() {
        return this.inferenceProfiles[this.activeInferenceProfile] || this.inferenceProfiles.balanced;
    }

    setPerformanceProfile(profileName) {
        if (!this.inferenceProfiles[profileName]) {
            console.warn(`Unknown performance profile: ${profileName}. Available profiles: fast, balanced.`);
            return false;
        }

        this.activeInferenceProfile = profileName;
        console.log(`Performance profile set to: ${profileName}`);

        if (this.elements && this.elements.chatMessages) {
            this.addSystemMessage(`Performance profile set to ${profileName}.`);
        }

        return true;
    }

    async initialize() {
        try {
            // Load prohibited words used by content moderation
            await this.loadProhibitedWords();

            // Load the index
            await this.loadIndex();

            // Initialize CPU-only local model
            await this.initializeWllama();

            console.log('Available performance profiles: fast, balanced');
            console.log('Use window.askAnton.setPerformanceProfile("fast") for lower latency or "balanced" for quality.');

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize. Please refresh the page.');
        }
    }

    reverseWord(text) {
        return text.split('').reverse().join('');
    }

    async loadProhibitedWords() {
        try {
            const response = await fetch('moderation/mod.txt');
            if (!response.ok) throw new Error('Failed to load prohibited words');

            const reversedWordsText = await response.text();
            this.prohibitedWords = reversedWordsText
                .split(/\r?\n/)
                .map(word => word.trim())
                .filter(word => word.length > 0)
                .map(word => this.reverseWord(word.toLowerCase()));

            console.log('Loaded prohibited words:', this.prohibitedWords.length);
        } catch (error) {
            console.error('Error loading prohibited words:', error);
            throw error;
        }
    }

    async loadIndex() {
        try {
            this.updateProgress(5, 'Loading knowledge base...');
            const response = await fetch('index.json');
            if (!response.ok) throw new Error('Failed to load index');
            this.indexData = await response.json();
            console.log('Loaded index with', this.indexData.length, 'categories');

            // Build a flat lookup map: keyword -> {document, category, link}
            this.keywordMap = new Map();
            this.indexData.forEach(category => {
                category.documents.forEach(doc => {
                    doc.keywords.forEach(keyword => {
                        const normalizedKeyword = keyword.toLowerCase().trim();
                        if (normalizedKeyword) {
                            this.keywordMap.set(normalizedKeyword, {
                                document: doc,
                                category: category.category,
                                link: category.link
                            });
                        }
                    });
                });
            });
            console.log('Built keyword map with', this.keywordMap.size, 'keywords');
        } catch (error) {
            console.error('Error loading index:', error);
            throw error;
        }
    }

    async initializeWllama() {
        try {
            // Check if already initialized
            if (this.wllama) {
                console.log('Wllama already initialized');
                return;
            }

            this.updateProgress(15, 'Loading AI model (CPU mode)...');

            // Configure WASM paths for CDN
            const CONFIG_PATHS = {
                'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/single-thread/wllama.wasm',
                'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/multi-thread/wllama.wasm',
            };

            // Initialize wllama with CDN-hosted WASM files
            this.wllama = new Wllama(CONFIG_PATHS);
            const profile = this.getProfileSettings();

            // Load a smaller Phi-3 Mini GGUF quantization for browser CPU compatibility.
            await this.wllama.loadModelFromHF(
                'bartowski/Phi-3-mini-4k-instruct-GGUF',
                'Phi-3-mini-4k-instruct-Q2_K.gguf',
                {
                    n_ctx: profile.n_ctx,
                    n_threads: this.optimalThreads,
                    progressCallback: ({ loaded, total }) => {
                        const percentage = Math.max(15, Math.round((loaded / total) * 85) + 15);
                        this.updateProgress(
                            percentage,
                            `Loading model: ${Math.round((loaded / total) * 100)}%`
                        );
                    }
                }
            );

            this.updateProgress(100, 'Ready to chat! (CPU mode)');
            console.log(`Wllama initialized successfully with Phi-3-mini-4k-instruct-Q2_K using ${this.optimalThreads} CPU thread(s), profile: ${this.activeInferenceProfile}`);

            setTimeout(() => {
                this.showChatInterface();
            }, 500);

        } catch (error) {
            console.error('Failed to initialize wllama:', error);
            this.showError('Failed to load AI model. Please refresh the page.');
            throw error;
        }
    }

    updateProgress(percentage, text) {
        this.elements.progressFill.style.width = `${percentage}%`;
        this.elements.progressText.textContent = text;

        // Update progress bar ARIA attributes
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.setAttribute('aria-valuenow', percentage);
            progressBar.setAttribute('aria-label', text);
        }
    }

    showChatInterface() {
        this.elements.progressSection.style.display = 'none';
        this.elements.chatContainer.style.display = 'flex';
        this.elements.userInput.focus();
    }

    showError(message) {
        this.elements.progressText.textContent = message;
        this.elements.progressFill.style.backgroundColor = '#dc3545';
    }

    setupEventListeners() {
        // Send button click
        this.elements.sendBtn.addEventListener('click', () => {
            if (this.isGenerating) {
                this.stopGeneration();
            } else {
                this.sendMessage();
            }
        });

        // Enter key to send (Shift+Enter for new line)
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isGenerating) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Keyboard navigation
        this.elements.userInput.addEventListener('keydown', (e) => {
            // Enter to send (without Shift)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.isGenerating) {
                    this.sendMessage();
                }
            }
            // Escape to stop generation
            if (e.key === 'Escape' && this.isGenerating) {
                this.stopGeneration();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.userInput.focus();
            }
            // Ctrl/Cmd + N for new chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.restartConversation();
            }
        });

        // Microphone button
        this.elements.micBtn.addEventListener('click', () => {
            this.handleMicClick();
        });

        // Restart button
        this.elements.restartBtn.addEventListener('click', () => {
            this.restartConversation();
        });

        // About button
        this.elements.aboutBtn.addEventListener('click', () => {
            this.lastFocusedElement = this.elements.aboutBtn;
            this.showAboutModal();
        });

        // About modal handlers
        this.elements.aboutModalClose.addEventListener('click', () => {
            this.hideAboutModal();
        });

        this.elements.aboutModalOk.addEventListener('click', () => {
            this.hideAboutModal();
        });

        // Close about modal on overlay click
        this.elements.aboutModal.addEventListener('click', (e) => {
            if (e.target === this.elements.aboutModal || e.target.classList.contains('modal-overlay')) {
                this.hideAboutModal();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.aboutModal.style.display === 'flex') {
                    this.hideAboutModal();
                }
            }
        });

        // Example question buttons
        const exampleBtns = document.querySelectorAll('.example-btn');
        exampleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                this.elements.userInput.value = question;
                this.elements.userInput.focus();
                this.autoResizeTextarea();
            });
        });

        // Keyboard activation for learn-more links rendered inside messages
        this.elements.chatMessages.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('ai-mode-link')) {
                e.preventDefault();
                e.target.click();
            }
        });
    }

    autoResizeTextarea() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }

    containsProhibitedWords(text) {
        // Convert to lowercase for case-insensitive matching
        const lowerText = text.toLowerCase();

        // Create word boundaries regex pattern for whole word matching
        for (const word of this.prohibitedWords) {
            // Use word boundary to match whole words only
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(lowerText)) {
                console.log(`Content moderation: blocked word "${word}" detected`);
                return true;
            }
        }

        return false;
    }

    performSearch(userQuestion) {
        const lowerQuestion = userQuestion.toLowerCase().trim();

        // Normalize the question: remove punctuation, extra spaces
        const normalizedQuestion = lowerQuestion.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = normalizedQuestion.split(' ');

        // Extract all n-grams (trigrams, bigrams, unigrams)
        const nGrams = [];

        // Trigrams (3-word phrases)
        for (let i = 0; i <= words.length - 3; i++) {
            nGrams.push({
                text: words.slice(i, i + 3).join(' '),
                length: 3
            });
        }

        // Bigrams (2-word phrases)
        for (let i = 0; i <= words.length - 2; i++) {
            nGrams.push({
                text: words.slice(i, i + 2).join(' '),
                length: 2
            });
        }

        // Unigrams (single words) - filter out very short words and common stop words
        const stopWords = ['what', 'is', 'are', 'the', 'a', 'an', 'how', 'does', 'do', 'can', 'about', 'tell', 'me', 'explain', 'describe', 'show', 'give', 'anton', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'why', 'which', 'whom', 'whose', 'why', 'all', 'any', 'this', 'that', 'these', 'those'];
        words.forEach(word => {
            if (word.length >= 2 && !stopWords.includes(word)) {
                nGrams.push({
                    text: word,
                    length: 1
                });
            }
        });

        console.log('Extracted n-grams:', nGrams.map(ng => `"${ng.text}" (${ng.length})`));

        // Match n-grams to keywords in the index
        const matchedKeywords = new Set();
        const documentMatches = new Map(); // doc id -> {doc, category, link, matchedKeywords[]}

        nGrams.forEach(ngram => {
            const match = this.keywordMap.get(ngram.text);
            if (match) {
                matchedKeywords.add(ngram.text);

                const docId = match.document.id;
                if (!documentMatches.has(docId)) {
                    documentMatches.set(docId, {
                        document: match.document,
                        category: match.category,
                        link: match.link,
                        matchedKeywords: []
                    });
                }
                documentMatches.get(docId).matchedKeywords.push(ngram.text);
            }
        });

        // Filter out keywords that are subsets of longer matched keywords
        // Example: if "large language model" is matched, remove "language model" and "language"
        const filteredKeywords = new Set();
        const sortedKeywords = Array.from(matchedKeywords).sort((a, b) => {
            const aWords = a.split(' ').length;
            const bWords = b.split(' ').length;
            return bWords - aWords; // Longer phrases first
        });

        sortedKeywords.forEach(keyword => {
            // Check if this keyword is a subset of any already-added keyword
            let isSubset = false;
            for (const existing of filteredKeywords) {
                if (existing !== keyword && existing.includes(keyword)) {
                    isSubset = true;
                    break;
                }
            }
            if (!isSubset) {
                filteredKeywords.add(keyword);
            }
        });

        console.log('Matched keywords (before filtering):', Array.from(matchedKeywords));
        console.log('Filtered keywords (after removing subsets):', Array.from(filteredKeywords));

        // Rebuild document matches using only filtered keywords
        const finalDocumentMatches = [];
        documentMatches.forEach((match, docId) => {
            // Only include if at least one of its keywords survived filtering
            const validKeywords = match.matchedKeywords.filter(kw => filteredKeywords.has(kw));
            if (validKeywords.length > 0) {
                finalDocumentMatches.push({
                    ...match,
                    matchedKeywords: validKeywords
                });
            }
        });

        console.log(`Found ${finalDocumentMatches.length} matching documents`);
        if (finalDocumentMatches.length > 0) {
            console.log('Matched documents:', finalDocumentMatches.map(m => ({
                id: m.document.id,
                title: m.document.title,
                category: m.category,
                keywords: m.matchedKeywords
            })));
        }

        return {
            matches: finalDocumentMatches,
            matchedKeywords: Array.from(filteredKeywords)
        };
    }

    searchContext(userQuestion) {
        const { matches, matchedKeywords } = this.performSearch(userQuestion);

        // If no matches, fall back to AI Concepts category
        if (matches.length === 0) {
            this.elements.searchStatus.textContent = '🔍 No specific context found';
            const aiConceptsCategory = this.indexData.find(cat => cat.category === 'AI Concepts');
            if (aiConceptsCategory && aiConceptsCategory.documents.length > 0) {
                const fallbackDoc = aiConceptsCategory.documents[0];
                return {
                    context: `[${aiConceptsCategory.category}]\n${fallbackDoc.content}`,
                    categories: [aiConceptsCategory.category],
                    links: [aiConceptsCategory.link],
                    documents: [fallbackDoc]
                };
            }
            return { context: null, categories: [], links: [], documents: [] };
        }

        // Build context from all matched documents - use full content, no summarization
        const contextParts = matches.map(match => {
            return `[${match.category} - ${match.document.title}]\n${match.document.content}`;
        });

        const categories = [...new Set(matches.map(m => m.category))];
        const links = [...new Set(matches.map(m => m.link))];
        const documents = matches.map(m => m.document);

        this.elements.searchStatus.textContent = `🔍 Found context in: ${categories.join(', ')}`;

        return {
            context: contextParts.join('\n\n'),
            categories: categories,
            links: links,
            documents: documents
        };
    }

    async sendMessage() {
        const userMessage = this.elements.userInput.value.trim();

        // Validate input
        if (!userMessage || this.isGenerating) return;

        // Limit message length to prevent abuse
        const MAX_MESSAGE_LENGTH = 1000;
        if (userMessage.length > MAX_MESSAGE_LENGTH) {
            this.addSystemMessage(`Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        // Store voice input flag before any processing
        const usedVoice = this.usedVoiceInput;
        this.usedVoiceInput = false;

        // Content moderation: check for prohibited words (whole words only)
        if (this.containsProhibitedWords(userMessage)) {
            // Clear input and reset height
            this.elements.userInput.value = '';
            this.elements.userInput.style.height = 'auto';

            // Add user message to chat
            this.addMessage('user', userMessage);

            // Play audio if voice input was used
            if (usedVoice) {
                this.playModerationAudio();
            }

            // Add moderation response
            this.addMessage('assistant', "I'm sorry. I can't help with that. Please ask me about AI-related topics.");
            return;
        }

        // Check if model is still loading
        if (!this.wllama) {
            this.addSystemMessage('Model is still loading. Please wait...');
            return;
        }

        // Clear input and reset height
        this.elements.userInput.value = '';
        this.elements.userInput.style.height = 'auto';

        // Add user message to chat
        this.addMessage('user', userMessage);

        // Check if this is an initial greeting (only if no messages yet)
        const messageCount = this.elements.chatMessages.querySelectorAll('.message').length;
        if (messageCount <= 1) { // Only user's message is in chat
            const greetingPattern = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[\s!?]*$/i;
            if (greetingPattern.test(userMessage)) {
                // Respond with greeting without searching
                const greetingResponse = "Hello, I'm Anton. I'm here to help you learn about AI concepts. What would you like to know?";
                this.addMessage('assistant', greetingResponse);
                return;
            }
        }

        // Search for relevant context
        const searchResult = this.searchContext(userMessage);

        // Generate response
        await this.generateResponse(userMessage, searchResult, usedVoice);
    }

    updateSendButton(isGenerating) {
        const sendIcon = this.elements.sendBtn.querySelector('.send-icon');
        if (isGenerating) {
            sendIcon.textContent = '■';
            this.elements.sendBtn.title = 'Stop generation';
            this.elements.sendBtn.setAttribute('aria-label', 'Stop generation');
        } else {
            sendIcon.textContent = '▶';
            this.elements.sendBtn.title = 'Send message';
            this.elements.sendBtn.setAttribute('aria-label', 'Send message');
        }
    }

    stopGeneration() {
        this.isGenerating = false;
        this.stopRequested = true;
        this.currentStream = null;

        // Abort the generation properly using AbortController
        if (this.currentAbortController) {
            console.log('Aborting generation via AbortController');
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }

        this.updateSendButton(false);
        console.log('Stop requested');
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.setAttribute('role', 'status');
        messageDiv.setAttribute('aria-live', 'polite');
        // Sanitize message to prevent XSS
        const p = document.createElement('p');
        p.textContent = message;
        messageDiv.appendChild(p);
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }

    addMessage(role, content, isTyping = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('aria-label', `Message from ${role === 'assistant' ? 'Anton' : 'You'}`);

        if (role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="avatar anton-avatar" aria-hidden="true">
                    <img src="images/anton-icon.png" alt="Anton the AI assistant avatar" class="avatar-image">
                </div>
                <div class="message-content">
                    <p class="message-author" aria-label="From Anton">Anton</p>
                    <div class="message-text" ${isTyping ? 'aria-live="polite" aria-busy="true"' : ''}>
                        ${isTyping
                    ? '<span class="typing-indicator" aria-label="Anton is typing">●●●</span>'
                    : this.escapeHtml(content)}
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p class="message-author" aria-label="From You">You</p>
                    <div class="message-text">${this.escapeHtml(content)}</div>
                </div>
                <div class="avatar user-avatar" aria-hidden="true">👤</div>
            `;
        }

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        return messageDiv;
    }

    async generateResponse(userMessage, searchResult, usedVoiceInput = false) {
        const { context, categories, links } = searchResult;

        this.isGenerating = true;
        this.stopRequested = false;
        this.updateSendButton(true);

        // Add empty message that we'll stream into
        const responseMessage = this.addMessage('assistant', '', false);
        const messageTextDiv = responseMessage.querySelector('.message-text');

        // Show thinking indicator with CPU mode notice
        messageTextDiv.innerHTML = '<span class="typing-indicator" aria-label="Anton is typing">●●●</span><p style="font-size: 0.85em; color: #666; margin-top: 8px; font-style: italic;">(Responses may be slow in CPU mode. Thanks for your patience!)</p>';

        try {
            let assistantMessage = await this.generateWithWllama(userMessage, context, messageTextDiv, usedVoiceInput);

            // Add learn more links
            if (links && links.length > 0 && categories && categories.length > 0) {
                // Store original message without learn more for conversation history
                const originalMessage = assistantMessage;

                // Add placeholder for learn more section for display only
                assistantMessage += '\n\n---\n\n**Learn more:** [[LEARN_MORE_LINKS]]';

                // Format the message
                let formattedMessage = this.formatResponse(assistantMessage);

                // Build HTML links with category names
                const linkHtml = links.map((link, index) => {
                    const categoryName = categories[Math.min(index, categories.length - 1)];
                    return `<a href="${link}" target="_blank" rel="noopener noreferrer">${categoryName}</a>`;
                }).join(' • ');
                formattedMessage = formattedMessage.replace(/\[\[LEARN_MORE_LINKS\]\]/g, linkHtml);

                messageTextDiv.innerHTML = formattedMessage;

                // Reset assistantMessage to original for conversation history
                assistantMessage = originalMessage;
            }

            // Only add to conversation history if not stopped (to prevent corruption)
            if (!this.stopRequested && assistantMessage.trim()) {
                this.conversationHistory.push({
                    role: 'user',
                    content: userMessage // Store original question, not the one with context
                });
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage
                });
            } else if (this.stopRequested) {
                console.log('Stopped response not added to conversation history to prevent corruption');
            }

        } catch (error) {
            console.error('Error generating response:', error);
            responseMessage.remove();
            this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        } finally {
            this.isGenerating = false;
            this.stopRequested = false;
            this.currentStream = null;
            this.updateSendButton(false);

            // Clear search status after response is complete
            setTimeout(() => {
                this.elements.searchStatus.textContent = '';
            }, 2000);
        }
    }

    // Helper function to extract first sentence or first 30 characters
    extractFirstSentence(text) {
        if (!text) return '';

        // Find the first occurrence of sentence-ending punctuation
        const match = text.match(/^[^.!?:]*[.!?:]/);
        if (match) {
            return match[0].trim();
        }

        // If no sentence-ending punctuation, use first 30 characters
        return text.substring(0, 30).trim();
    }

    async generateWithWllama(userMessage, context, messageTextDiv, usedVoiceInput = false) {
        // Ensure wllama is loaded
        if (!this.wllama) {
            throw new Error('Wllama is not initialized. Please wait for CPU mode to finish loading.');
        }

        // Build ChatML formatted prompt
        let chatMLPrompt = '<|im_start|>system\n';
        chatMLPrompt += 'You are Anton, an AI learning assistant. Answer questions using ONLY the information below.\n\n';
        chatMLPrompt += 'Rules:\n';
        chatMLPrompt += '- AI and computing topics only\n';
        chatMLPrompt += '- One clear paragraph, simple language\n';
        chatMLPrompt += '- No development steps or instructions\n\n';
        chatMLPrompt += 'Information:\n';

        // Add context from index.json if available (truncate to prevent context overflow)
        const profile = this.getProfileSettings();
        if (context) {
            const maxContextLength = profile.maxContextLength;
            const truncatedContext = context.length > maxContextLength
                ? context.substring(0, maxContextLength) + '...'
                : context;
            chatMLPrompt += truncatedContext + '\n';
        } else {
            chatMLPrompt += 'No specific information available.\n';
        }

        chatMLPrompt += '<|im_end|>\n\n';

        // Add truncated previous prompt and response if available
        if (this.conversationHistory.length >= 2) {
            // Get the last user message and assistant response
            const prevUser = this.conversationHistory[this.conversationHistory.length - 2];
            const prevAssistant = this.conversationHistory[this.conversationHistory.length - 1];

            if (prevUser.role === 'user' && prevAssistant.role === 'assistant') {
                const prevUserSentence = this.extractFirstSentence(prevUser.content);
                const prevAssistantSentence = this.extractFirstSentence(prevAssistant.content);

                chatMLPrompt += '<|im_start|>user\n';
                chatMLPrompt += prevUserSentence + '\n';
                chatMLPrompt += '<|im_end|>\n\n';
                chatMLPrompt += '<|im_start|>assistant\n';
                chatMLPrompt += prevAssistantSentence + '\n';
                chatMLPrompt += '<|im_end|>\n\n';
            }
        }

        // Add current user message
        chatMLPrompt += '<|im_start|>user\n';
        chatMLPrompt += userMessage + '\n';
        chatMLPrompt += '<|im_end|>\n\n';
        chatMLPrompt += '<|im_start|>assistant\n';

        console.log('Sending prompt to wllama (length:', chatMLPrompt.length, 'chars)');

        let assistantMessage = '';
        let audioPlayed = false;

        // Create AbortController for this generation
        const controller = new AbortController();
        this.currentAbortController = controller;

        // Clear KV cache before generation to ensure clean state
        try {
            await this.wllama.kvClear();
            console.log('KV cache cleared before generation');
        } catch (error) {
            console.log('KV cache clear failed:', error.message);
        }

        // Use streaming with proper abort support
        try {
            const completion = await this.wllama.createCompletion(chatMLPrompt, {
                nPredict: profile.nPredict,
                sampling: profile.sampling,
                stopTokens: ['<|im_end|>', '<|im_start|>'],
                abortSignal: controller.signal,
                stream: true
            });

            this.currentStream = completion;

            for await (const chunk of completion) {
                if (chunk.currentText) {
                    // Play audio on first chunk if voice input was used
                    if (!audioPlayed && usedVoiceInput) {
                        this.playRandomResponseAudio();
                        audioPlayed = true;
                    }

                    assistantMessage = chunk.currentText;
                    messageTextDiv.innerHTML = this.formatResponse(assistantMessage);
                    this.scrollToBottom();
                }
            }

            // Clear abort controller on successful completion
            this.currentAbortController = null;

        } catch (error) {
            // Check if this was an abort (expected when user clicks stop)
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                console.log('Generation aborted by user');
                // Clear the partial/corrupted state
                await this.wllama.kvClear();
                console.log('KV cache cleared after abort');
            } else {
                console.log('Wllama generation error:', error.message || 'unknown error');
                // Clear cache on error too
                try {
                    await this.wllama.kvClear();
                } catch (e) {
                    console.log('Failed to clear cache after error:', e.message);
                }
            }
            this.currentAbortController = null;
        }

        console.log('Wllama response complete, length:', assistantMessage.length);

        return assistantMessage;
    }

    formatResponse(text) {
        // Split out the learn more section and note if they exist
        const learnMoreMatch = text.match(/([\s\S]*?)(---\s*\n\n\*\*Learn more:\*\*.*?)(\n\n\*Note:.*)?$/);

        if (learnMoreMatch) {
            const mainContent = learnMoreMatch[1];
            const learnMoreSection = learnMoreMatch[2];
            const noteSection = learnMoreMatch[3] || '';

            // Format main content (escape HTML)
            let formatted = this.escapeHtml(mainContent);

            // Convert **bold** to <strong>
            formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

            // Convert *italic* to <em>
            formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

            // Convert line breaks to paragraphs
            formatted = formatted.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

            // Add learn more section - preserve placeholders and HTML structure
            const learnMoreFormatted = learnMoreSection
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/---\s*\n\n/g, '<hr style="margin: 15px 0; border: none; border-top: 1px solid #e0e0e0;">\n\n');

            // Format note section - preserve placeholders
            let noteFormatted = '';
            if (noteSection) {
                // Extract the note text (remove leading \n\n*Note: and trailing *)
                let noteText = noteSection.replace(/^\n\n\*Note:\s*/g, '').replace(/\*$/g, '');
                // Wrap in styled paragraph - placeholders will be replaced by caller
                noteFormatted = `<p style="font-style: italic; color: #666; font-size: 0.9em; margin-top: 10px;">Note: ${noteText}</p>`;
            }

            return formatted + learnMoreFormatted + noteFormatted;
        }

        // No learn more section, process normally
        let formatted = this.escapeHtml(text);

        // Convert **bold** to <strong>
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert *italic* to <em>
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Convert line breaks to paragraphs
        formatted = formatted.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async animateTyping(element, htmlContent, speed = 5) {
        // Parse HTML to extract text while preserving structure
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // For simple animation, just show the content progressively
        element.innerHTML = '';
        const words = htmlContent.split(' ');

        for (let i = 0; i < words.length; i++) {
            if (this.stopRequested) break;

            element.innerHTML = words.slice(0, i + 1).join(' ');
            this.scrollToBottom();

            // Small delay between words
            await new Promise(resolve => setTimeout(resolve, speed));
        }

        // Ensure final content is complete
        element.innerHTML = htmlContent;
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    playRandomResponseAudio() {
        // Randomly select one of the 7 audio files
        const audioNumber = Math.floor(Math.random() * 7) + 1;
        const audioPath = `audio/response_${audioNumber}.wav`;

        const audio = new Audio(audioPath);
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    }

    playModerationAudio() {
        const audio = new Audio('moderation/sorry.wav');
        audio.play().catch(error => {
            console.error('Error playing moderation audio:', error);
        });
    }

    handleMicClick() {
        // Check if Speech Recognition is available
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.addMessage('assistant', 'Speech input is not available in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        // Visual feedback - button appears active while listening
        this.elements.micBtn.style.opacity = '0.6';
        this.elements.micBtn.title = 'Listening...';
        this.elements.micBtn.setAttribute('aria-label', 'Listening to your voice input');

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.elements.userInput.value = transcript;
            this.autoResizeTextarea();
            this.usedVoiceInput = true;
            this.sendMessage();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.addMessage('assistant', 'Speech input is not available.');
            this.elements.micBtn.style.opacity = '1';
            this.elements.micBtn.title = 'Voice input';
            this.elements.micBtn.setAttribute('aria-label', 'Voice input');
        };

        recognition.onend = () => {
            this.elements.micBtn.style.opacity = '1';
            this.elements.micBtn.title = 'Voice input';
            this.elements.micBtn.setAttribute('aria-label', 'Voice input');
        };

        try {
            recognition.start();
            console.log('Speech recognition started');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.addMessage('assistant', 'Speech input is not available.');
            this.elements.micBtn.style.opacity = '1';
            this.elements.micBtn.title = 'Voice input';
            this.elements.micBtn.setAttribute('aria-label', 'Voice input');
        }
    }

    restartConversation() {
        if (confirm('Are you sure you want to start a new conversation? This will clear the chat history.')) {
            // Clear conversation history
            this.conversationHistory = [];

            // Clear chat messages (keep welcome message)
            const messages = this.elements.chatMessages.querySelectorAll('.message:not(.welcome-message)');
            messages.forEach(msg => msg.remove());

            // Clear search status
            this.elements.searchStatus.textContent = '';

            console.log('Conversation restarted');
        }
    }

    showAboutModal() {
        this.elements.aboutModal.style.display = 'flex';
        this.currentModal = this.elements.aboutModal;
        // Store the previously focused element
        this.lastFocusedElement = document.activeElement;
        // Announce modal to screen readers
        this.elements.aboutModal.setAttribute('aria-hidden', 'false');
        // Set focus to close button
        setTimeout(() => {
            this.elements.aboutModalClose.focus();
            this.setupModalFocusTrap(this.elements.aboutModal);
        }, 100);
    }

    hideAboutModal() {
        this.elements.aboutModal.style.display = 'none';
        this.elements.aboutModal.setAttribute('aria-hidden', 'true');
        this.removeModalFocusTrap();
        this.currentModal = null;
        // Restore focus to the element that opened the modal
        if (this.lastFocusedElement) {
            this.lastFocusedElement.focus();
        } else {
            this.elements.userInput.focus();
        }
    }

    setupModalFocusTrap(modalElement) {
        // Get all focusable elements within the modal
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Store the trap handler for cleanup
        this.modalFocusTrapHandler = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift+Tab - going backwards
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab - going forwards
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        modalElement.addEventListener('keydown', this.modalFocusTrapHandler);
    }

    removeModalFocusTrap() {
        if (this.currentModal && this.modalFocusTrapHandler) {
            this.currentModal.removeEventListener('keydown', this.modalFocusTrapHandler);
            this.modalFocusTrapHandler = null;
        }
    }
}

// Make instance globally accessible for onclick handler
window.askAnton = null;

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.askAnton = new AskAnton();
    });
} else {
    window.askAnton = new AskAnton();
}
