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
        this.stopRequested = false;
        this.currentStream = null;
        
        this.elements = {
            progressSection: document.getElementById('progress-section'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            chatContainer: document.getElementById('chat-container'),
            chatMessages: document.getElementById('chat-messages'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            restartBtn: document.getElementById('restart-btn'),
            searchStatus: document.getElementById('search-status')
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
- If the question is outside the provided context, acknowledge this politely
- Use a conversational, friendly tone
- Format responses with paragraphs for readability
- When explaining technical concepts, start simple then add detail`;

        this.initialize();
    }

    async initialize() {
        try {
            // Load the index
            await this.loadIndex();
            
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
            
            setTimeout(() => {
                this.showChatInterface();
            }, 500);
            
        } catch (error) {
            console.error('Failed to initialize WebLLM:', error);
            throw error;
        }
    }

    updateProgress(percentage, text) {
        this.elements.progressFill.style.width = `${percentage}%`;
        this.elements.progressText.textContent = text;
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
        
        // Restart button
        this.elements.restartBtn.addEventListener('click', () => {
            this.restartConversation();
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
            return null;
        }
        
        // Build concise context from results using summaries
        const contextParts = topResults.map((result, index) => {
            // Use summary instead of full content for more concise context
            return `[${result.category} - ${result.heading}]\n${result.summary}`;
        });
        
        const categories = [...new Set(topResults.map(r => r.category))];
        this.elements.searchStatus.textContent = `🔍 Found context in: ${categories.join(', ')}`;
        
        return contextParts.join('\n\n');
    }

    async sendMessage() {
        const userMessage = this.elements.userInput.value.trim();
        
        if (!userMessage || this.isGenerating) return;
        
        // Clear input and reset height
        this.elements.userInput.value = '';
        this.elements.userInput.style.height = 'auto';
        
        // Add user message to chat
        this.addMessage('user', userMessage);
        
        // Search for relevant context
        const context = this.searchContext(userMessage);
        
        // Generate response
        await this.generateResponse(userMessage, context);
        
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

    addMessage(role, content, isTyping = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        if (role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="avatar andrew-avatar">
                    <img src="images/andrew-icon.png" alt="Andrew" class="avatar-image">
                </div>
                <div class="message-content">
                    <p class="message-author">Andrew</p>
                    <div class="message-text">${isTyping ? '<span class="typing-indicator">●●●</span>' : content}</div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p class="message-author">You</p>
                    <div class="message-text">${this.escapeHtml(content)}</div>
                </div>
                <div class="avatar user-avatar">👤</div>
            `;
        }
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    async generateResponse(userMessage, context) {
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
        // Convert markdown-like formatting to HTML
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
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new AskAndrew();
    });
} else {
    new AskAndrew();
}
