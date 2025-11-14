import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";
import MiniSearch from 'https://cdn.jsdelivr.net/npm/minisearch@6.3.0/+esm';
import nlp from 'https://cdn.jsdelivr.net/npm/compromise@14.10.0/+esm';

class AskAndrew {
    constructor() {
        this.engine = null;
        this.miniSearch = null;
        this.conversationHistory = [];
        this.isGenerating = false;
        this.indexData = null;
        this.metadata = null;
        this.stopRequested = false;
        this.currentStream = null;
        this.webGPUAvailable = false;
        this.simpleMode = false;
        
        this.elements = {
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            chatContainer: document.getElementById('chat-container'),
            chatMessages: document.getElementById('chat-messages'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            restartBtn: document.getElementById('restart-btn'),
            searchStatus: document.getElementById('search-status'),
            modeToggle: document.getElementById('mode-toggle'),
            aiModeModal: document.getElementById('ai-mode-modal'),
            modalClose: document.getElementById('modal-close'),
            modalOk: document.getElementById('modal-ok')
        };
        
        this.systemPrompt = `You are Andrew, a knowledgeable and friendly AI learning assistant who helps students understand concepts in AI, Machine Learning, Speech, Computer Vision, and Information Extraction.

Your role:
- Explain concepts clearly and concisely
- Use examples and analogies when helpful
- Break down complex topics into understandable parts
- Be encouraging and supportive
- Reference the provided context when answering questions

Guidelines:
- Keep responses focused and relevant
- Use simple language suitable for learners
- Refer to the user as "AI explorer", "Intrepid learner", or something similar
- If the question is outside the provided context, acknowledge this politely
- Use a conversational, friendly tone
- Format responses with paragraphs for readability
- When explaining technical concepts, start simple then add detail`;

        this.initialize();
    }

    async initialize() {
        try {
            // Load the index and metadata
            await this.loadIndex();
            await this.loadMetadata();
            
            // Initialize MiniSearch
            this.initializeMiniSearch();
            
            // Initialize WebLLM
            await this.initializeWebLLM();
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize. Please refresh the page.');
        }
    }

    async loadIndex() {
        try {
            this.updateProgress(5, 'Loading knowledge base...');
            const response = await fetch('index.json');
            if (!response.ok) throw new Error('Failed to load index');
            this.indexData = await response.json();
            console.log(`Loaded ${this.indexData.length} documents`);
        } catch (error) {
            console.error('Error loading index:', error);
            throw error;
        }
    }

    async loadMetadata() {
        try {
            const response = await fetch('index-metadata.json');
            if (!response.ok) throw new Error('Failed to load metadata');
            this.metadata = await response.json();
            console.log('Loaded metadata with links:', this.metadata.links);
        } catch (error) {
            console.error('Error loading metadata:', error);
            throw error;
        }
    }

    initializeMiniSearch() {
        this.updateProgress(10, 'Indexing knowledge base...');
        
        // Create MiniSearch instance
        this.miniSearch = new MiniSearch({
            fields: ['heading', 'content', 'keywords', 'category'],
            storeFields: ['id', 'category', 'file', 'heading', 'content', 'summary'],
            searchOptions: {
                boost: { heading: 3, keywords: 2, category: 1.5, content: 1 },
                fuzzy: 0.2,
                prefix: true
            }
        });
        
        // Add documents to MiniSearch
        this.miniSearch.addAll(this.indexData);
        console.log('MiniSearch initialized with', this.indexData.length, 'documents');
    }

    async initializeWebLLM() {
        try {
            this.updateProgress(15, 'Loading AI model...');
            
            const targetModelId = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
            
            this.engine = await webllm.CreateMLCEngine(
                targetModelId,
                {
                    initProgressCallback: (progress) => {
                        const percentage = Math.max(15, Math.round(progress.progress * 85) + 15);
                        this.updateProgress(
                            percentage, 
                            `Loading model: ${Math.round(progress.progress * 100)}%`
                        );
                    }
                }
            );
            
            this.updateProgress(100, 'Ready to chat!');
            console.log('WebLLM engine initialized successfully');
            this.webGPUAvailable = true;
            
            setTimeout(() => {
                this.showChatInterface();
            }, 500);
            
        } catch (error) {
            console.error('Failed to initialize WebLLM:', error);
            console.log('Falling back to simple mode');
            this.webGPUAvailable = false;
            this.simpleMode = true;
            this.updateProgress(100, 'Ready to chat! (Simple mode)');
            
            setTimeout(() => {
                this.showChatInterface();
            }, 500);
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
        this.updateModeToggle();
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
        
        // Restart button
        this.elements.restartBtn.addEventListener('click', () => {
            this.restartConversation();
        });
        
        // Mode toggle button
        this.elements.modeToggle.addEventListener('click', () => {
            this.toggleMode();
        });
        
        // Modal handlers
        this.elements.modalClose.addEventListener('click', () => {
            this.hideAiModeModal();
        });
        
        this.elements.modalOk.addEventListener('click', () => {
            this.hideAiModeModal();
        });
        
        // Close modal on overlay click
        this.elements.aiModeModal.addEventListener('click', (e) => {
            if (e.target === this.elements.aiModeModal || e.target.classList.contains('modal-overlay')) {
                this.hideAiModeModal();
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.aiModeModal.style.display === 'flex') {
                this.hideAiModeModal();
            }
        });
    }

    autoResizeTextarea() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }

    extractKeywords(text) {
        // Use Compromise.js to extract important keywords
        const doc = nlp(text);
        
        // Extract nouns, adjectives, and important terms
        const nouns = doc.nouns().out('array');
        const adjectives = doc.adjectives().out('array');
        const topics = doc.topics().out('array');
        
        // Combine and deduplicate
        const keywords = [...new Set([...nouns, ...adjectives, ...topics])]
            .map(k => k.toLowerCase())
            .filter(k => k.length > 2); // Filter short words
        
        console.log('Extracted keywords:', keywords);
        return keywords;
    }

    searchContext(userQuestion) {
        // Extract keywords from the question
        const keywords = this.extractKeywords(userQuestion);
        
        // Search using MiniSearch
        const searchResults = this.miniSearch.search(userQuestion, {
            boost: { heading: 3, keywords: 2 },
            fuzzy: 0.2,
            prefix: true
        });
        
        console.log(`Found ${searchResults.length} search results`);
        
        // Get top 2 most relevant results (reduced from 3)
        const topResults = searchResults.slice(0, 2);
        
        if (topResults.length === 0) {
            this.elements.searchStatus.textContent = '🔍 No specific context found';
            return { context: null, categories: [] };
        }
        
        // Build concise context from results using summaries
        const contextParts = topResults.map((result, index) => {
            // Use summary instead of full content for more concise context
            return `[${result.category} - ${result.heading}]\n${result.summary}`;
        });
        
        const categories = [...new Set(topResults.map(r => r.category))];
        this.elements.searchStatus.textContent = `🔍 Found context in: ${categories.join(', ')}`;
        
        return { 
            context: contextParts.join('\n\n'),
            categories: categories
        };
    }

    async sendMessage() {
        const userMessage = this.elements.userInput.value.trim();
        
        if (!userMessage || this.isGenerating) return;
        
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
                const greetingResponse = "Hello, I'm Andrew. I'm here to help you learn about AI concepts. What would you like to know?";
                this.addMessage('assistant', this.formatResponse(greetingResponse));
                return;
            }
        }
        
        // Search for relevant context
        const searchResult = this.searchContext(userMessage);
        
        // Generate response
        await this.generateResponse(userMessage, searchResult);
        
        // Clear search status after a delay
        setTimeout(() => {
            this.elements.searchStatus.textContent = '';
        }, 3000);
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
        this.stopRequested = true;
        console.log('Stop requested');
    }

    toggleMode() {
        if (!this.webGPUAvailable) {
            alert('WebGPU mode is not available in this browser. Simple mode is the only option.');
            return;
        }
        
        this.simpleMode = !this.simpleMode;
        this.updateModeToggle();
        
        const mode = this.simpleMode ? 'Simple' : 'AI';
        console.log(`Switched to ${mode} mode`);
        
        // Add a system message to indicate mode change
        this.addSystemMessage(`Switched to ${mode} mode`);
    }

    updateModeToggle() {
        // Show current mode state, not the mode to switch to
        const modeText = this.simpleMode ? '📝 Simple Mode: ON' : '🤖 AI Mode: ON';
        const modeTitle = this.simpleMode ? 
            'Currently in Simple mode (search only). Click to switch to AI mode.' : 
            'Currently in AI mode (uses WebGPU). Click to switch to Simple mode.';
        const ariaLabel = this.simpleMode ?
            'Toggle chat mode. Currently in Simple mode. Click to switch to AI mode.' :
            'Toggle chat mode. Currently in AI mode. Click to switch to Simple mode.';
        
        this.elements.modeToggle.textContent = modeText;
        this.elements.modeToggle.title = modeTitle;
        this.elements.modeToggle.setAttribute('aria-label', ariaLabel);
        this.elements.modeToggle.setAttribute('aria-pressed', 'true');
        
        // Disable toggle if WebGPU not available
        if (!this.webGPUAvailable) {
            this.elements.modeToggle.textContent = '📝 Simple Mode: ON';
            this.elements.modeToggle.disabled = true;
            this.elements.modeToggle.title = 'WebGPU not available - Simple mode only';
            this.elements.modeToggle.setAttribute('aria-label', 'Chat mode set to Simple mode only. WebGPU not available.');
            this.elements.modeToggle.setAttribute('aria-disabled', 'true');
        }
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.setAttribute('role', 'status');
        messageDiv.setAttribute('aria-live', 'polite');
        messageDiv.innerHTML = `<p>${message}</p>`;
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addMessage(role, content, isTyping = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('aria-label', `Message from ${role === 'assistant' ? 'Andrew' : 'You'}`);
        
        if (role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="avatar andrew-avatar" aria-hidden="true">
                    <img src="images/andrew-icon.png" alt="Andrew the AI assistant avatar" class="avatar-image">
                </div>
                <div class="message-content">
                    <p class="message-author" aria-label="From Andrew">Andrew</p>
                    <div class="message-text" ${isTyping ? 'aria-live="polite" aria-busy="true"' : ''}>${isTyping ? '<span class="typing-indicator" aria-label="Andrew is typing">●●●</span>' : content}</div>
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

    async generateResponse(userMessage, searchResult) {
        // Use simple mode if explicitly enabled or if WebGPU not available
        if (this.simpleMode || !this.webGPUAvailable) {
            this.generateSimpleResponse(userMessage, searchResult);
            return;
        }
        
        const { context, categories } = searchResult;
        
        this.isGenerating = true;
        this.stopRequested = false;
        this.updateSendButton(true);
        
        // Add empty message that we'll stream into
        const responseMessage = this.addMessage('assistant', '', false);
        const messageTextDiv = responseMessage.querySelector('.message-text');
        messageTextDiv.innerHTML = '<span class="typing-indicator">●●●</span>';
        
        try {
            // Build a concise prompt with context
            let userPrompt = userMessage;
            if (context) {
                userPrompt = `${context}\n\nQ: ${userMessage}`;
            }
            
            // Keep only last 3 conversation turns to stay within context limits
            const recentHistory = this.conversationHistory.slice(-6); // 3 turns = 6 messages
            
            // Add to conversation history
            recentHistory.push({
                role: 'user',
                content: userPrompt
            });
            
            // Generate response with streaming
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...recentHistory
            ];
            
            const completion = await this.engine.chat.completions.create({
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
                stream: true // Enable streaming
            });
            
            this.currentStream = completion;
            let assistantMessage = '';
            
            // Stream the response
            for await (const chunk of completion) {
                if (this.stopRequested) {
                    console.log('Generation stopped by user');
                    break;
                }
                
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    assistantMessage += delta;
                    // Update the message as we receive chunks
                    messageTextDiv.innerHTML = this.formatResponse(assistantMessage);
                    this.scrollToBottom();
                }
            }
            
            // Add learn more links
            if (categories && categories.length > 0) {
                const learnMoreText = this.buildLearnMoreLinks(categories);
                assistantMessage += '\n\n' + learnMoreText;
                messageTextDiv.innerHTML = this.formatResponse(assistantMessage);
            }
            
            // Add to full conversation history (keep complete history)
            this.conversationHistory.push({
                role: 'user',
                content: userMessage // Store original question, not the one with context
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });
            
        } catch (error) {
            console.error('Error generating response:', error);
            responseMessage.remove();
            this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        } finally {
            this.isGenerating = false;
            this.stopRequested = false;
            this.currentStream = null;
            this.updateSendButton(false);
        }
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
            
            // Add learn more section with actual HTML links (don't escape this part)
            const learnMoreFormatted = learnMoreSection
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/---\s*\n\n/g, '<hr style="margin: 15px 0; border: none; border-top: 1px solid #e0e0e0;">\n\n');
            
            // Format note section - preserve HTML links, convert markdown italics
            const noteFormatted = noteSection
                .replace(/\*([^*<>]+?)\*/g, '<em>$1</em>') // Only convert italics that don't contain HTML
                .replace(/\n\n/g, '\n<p style="font-style: italic; color: #666; font-size: 0.9em;">') 
                .replace(/^\n/, '<p style="font-style: italic; color: #666; font-size: 0.9em; margin-top: 10px;">') + '</p>';
            
            return formatted + learnMoreFormatted + (noteSection ? noteFormatted : '');
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

    generateSimpleResponse(userMessage, searchResult) {
        const { context, categories } = searchResult || { context: null, categories: [] };
        
        // Search for relevant results
        const searchResults = this.miniSearch.search(userMessage, {
            boost: { heading: 3, keywords: 2 },
            fuzzy: 0.2,
            prefix: true
        });
        
        const topResults = searchResults.slice(0, 3);
        
        if (topResults.length === 0) {
            this.addMessage('assistant', "I couldn't find any relevant information in my knowledge base for that question. Please try rephrasing or ask about AI, Machine Learning, Speech, Computer Vision, or Information Extraction topics.");
            return;
        }
        
        // Build response from summaries
        let response = "Here's what I found:\n\n";
        
        topResults.forEach((result, index) => {
            response += `**${index + 1}. ${result.heading}** (${result.category})\n`;
            response += `${result.summary}\n\n`;
        });
        
        // Get unique categories from results
        const resultCategories = [...new Set(topResults.map(r => r.category))];
        
        // Add learn more links
        const learnMoreText = this.buildLearnMoreLinks(resultCategories);
        response += learnMoreText + '\n\n';
        
        response += "*Note: You're using Simple mode. Switch to <a href='#' class='ai-mode-link' onclick='window.askAndrew.showAiModeModal(); return false;'>AI mode</a> for more detailed explanations.*";
        
        this.addMessage('assistant', this.formatResponse(response));
        
        // Update search status
        this.elements.searchStatus.textContent = `🔍 Found in: ${resultCategories.join(', ')}`;
        
        setTimeout(() => {
            this.elements.searchStatus.textContent = '';
        }, 3000);
    }

    buildLearnMoreLinks(categories) {
        if (!categories || categories.length === 0 || !this.metadata || !this.metadata.links) {
            return '';
        }
        
        const links = categories.map(category => {
            const link = this.metadata.links[category];
            if (link) {
                return `<a href="${link}" target="_blank" rel="noopener noreferrer">${category}</a>`;
            }
            return null;
        }).filter(link => link !== null);
        
        if (links.length === 0) return '';
        
        return `---\n\n**Learn more:** ${links.join(' • ')}`;
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
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
    
    showAiModeModal() {
        this.elements.aiModeModal.style.display = 'flex';
        this.elements.modalClose.focus();
    }
    
    hideAiModeModal() {
        this.elements.aiModeModal.style.display = 'none';
        this.elements.userInput.focus();
    }
}

// Make instance globally accessible for onclick handler
window.askAndrew = null;

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.askAndrew = new AskAndrew();
    });
} else {
    window.askAndrew = new AskAndrew();
}
