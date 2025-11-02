
class ChatApp {
    constructor() {
        this.conversationHistory = [];
        this.isProcessing = false;
        
        this.initialize();
    }

    initialize() {
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Chat app initialized');
    }

    setupEventListeners() {
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');

        // Send message on button click
        sendBtn.addEventListener('click', () => this.handleSendMessage());

        // Send message on Enter, new line on Shift+Enter
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Auto-resize textarea
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
        });
    }

    async handleSendMessage() {
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();

        if (!message || this.isProcessing) {
            return;
        }

        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';

        // Remove welcome message if present
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add user message to chat
        this.addMessage(message, 'user');

        // Set processing state
        this.isProcessing = true;
        document.getElementById('send-btn').disabled = true;

        // Show typing indicator
        const typingId = this.showTypingIndicator();

        try {
            // Extract keywords from user input
            const keywords = await this.extractKeywords(message);
            console.log('Extracted keywords:', keywords);

            // Search Wikipedia with keywords
            const articleText = await this.searchWikipedia(keywords);

            // Summarize the article
            const summary = await this.summarizeText(articleText);

            // Remove typing indicator
            this.removeTypingIndicator(typingId);

            // Display response with word-by-word animation
            await this.addMessageWithAnimation(summary, 'assistant');

        } catch (error) {
            console.error('Error processing message:', error);
            this.removeTypingIndicator(typingId);
            this.addMessage('Sorry, I encountered an error while processing your request. Please try again.', 'assistant');
        }

        // Reset processing state
        this.isProcessing = false;
        document.getElementById('send-btn').disabled = false;
    }

    async extractKeywords(text) {
        console.log('Original prompt:', text);
        
        // Tokenize and extract important words
        const tokens = text.toLowerCase().split(/\s+/);
        console.log('Tokens:', tokens);
        
        // Remove common stop words only
        const stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
            'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
            'to', 'was', 'will', 'with', 'what', 'when', 'where', 'who', 'why',
            'how', 'can', 'could', 'should', 'would', 'i', 'you', 'me', 'my',
            'your', 'about', 'tell', 'give', 'show', 'find', 'get', 'do', 'does'
        ]);

        // Keep all words that aren't stop words
        const keywords = tokens.filter(word => 
            word.length > 0 && !stopWords.has(word)
        );
        
        console.log('Filtered keywords array:', keywords);

        // Return all keywords joined together
        const keywordString = keywords.join(' ') || text;
        console.log('Final keyword string for search:', keywordString);
        
        return keywordString;
    }

    async searchWikipedia(keywords) {
        try {
            // Search Wikipedia API
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keywords)}&format=json&origin=*`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
                return "I couldn't find any relevant information on Wikipedia for your query.";
            }

            // Get the first result's page ID
            const firstResult = searchData.query.search[0];
            const pageId = firstResult.pageid;

            // Fetch the full article content
            const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
            const contentResponse = await fetch(contentUrl);
            const contentData = await contentResponse.json();

            const pageContent = contentData.query.pages[pageId].extract;

            // Get first paragraph (up to first double newline or max 500 chars)
            const firstParagraph = pageContent.split('\n\n')[0] || pageContent.substring(0, 500);
            
            return firstParagraph;

        } catch (error) {
            console.error('Wikipedia search error:', error);
            return "I encountered an error while searching Wikipedia. Please try again.";
        }
    }

    async summarizeText(text) {
        // Simple extractive summarization
        // Split into sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        // If text is already short, return as is
        if (text.length < 200 || sentences.length <= 2) {
            return text;
        }

        // Return first 2-3 sentences as summary
        const summaryLength = Math.min(3, sentences.length);
        return sentences.slice(0, summaryLength).join(' ').trim();
    }

    addMessage(content, role) {
        const chatMessages = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';

        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${role}-avatar`;
        avatar.textContent = role === 'user' ? '👤' : '🤖';

        const roleLabel = document.createElement('span');
        roleLabel.className = 'message-role';
        roleLabel.textContent = role === 'user' ? 'You' : 'Assistant';

        messageHeader.appendChild(avatar);
        messageHeader.appendChild(roleLabel);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageContent);

        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Store in history
        this.conversationHistory.push({ role, content });
    }

    async addMessageWithAnimation(content, role) {
        const chatMessages = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';

        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${role}-avatar`;
        avatar.textContent = role === 'user' ? '👤' : '🤖';

        const roleLabel = document.createElement('span');
        roleLabel.className = 'message-role';
        roleLabel.textContent = role === 'user' ? 'You' : 'Assistant';

        messageHeader.appendChild(avatar);
        messageHeader.appendChild(roleLabel);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);

        // Animate word by word
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
            messageContent.textContent += (i > 0 ? ' ' : '') + words[i];
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Wait between words (adjust speed here)
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Store in history
        this.conversationHistory.push({ role, content });
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        messageDiv.id = 'typing-indicator';

        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar assistant-avatar';
        avatar.textContent = '🤖';

        const roleLabel = document.createElement('span');
        roleLabel.className = 'message-role';
        roleLabel.textContent = 'Assistant';

        messageHeader.appendChild(avatar);
        messageHeader.appendChild(roleLabel);

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        
        messageContent.appendChild(typingIndicator);
        messageDiv.appendChild(messageHeader);
        messageDiv.appendChild(messageContent);

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return 'typing-indicator';
    }

    removeTypingIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.remove();
        }
    }
}

// Global functions for HTML onclick handlers
window.toggleSetup = function() {
    const setupPanel = document.querySelector('.setup-panel');
    const hideBtn = document.querySelector('.hide-btn');
    const header = document.querySelector('.setup-header h3');
    
    setupPanel.classList.toggle('collapsed');
    setupPanel.classList.toggle('expanded');
    
    if (setupPanel.classList.contains('collapsed')) {
        hideBtn.textContent = '📦 Show';
    } else {
        hideBtn.textContent = '📦 Hide';
    }
};

window.clearChat = function() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <div class="chat-icon">💬</div>
            <h3>Start with a prompt</h3>
        </div>
    `;
    
    if (window.chatApp) {
        window.chatApp.conversationHistory = [];
    }
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
