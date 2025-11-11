// Global State
let currentApp = null;
let miniSearchIndex = null;
let dataGraph = {
    emails: [],
    events: [],
    documents: [],
    contacts: []
};

// Current document/spreadsheet/email state
let currentWordDoc = { filename: 'Untitled.docx', content: '' };
let currentSpreadsheet = { filename: 'Untitled.xlsx', cells: {} };
let currentEmail = null;
let selectedCell = 'A1';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadDataFromJSON();
    initializeEventListeners();
    initializeSearch();
    renderFiles();
});

// Load data from JSON file and adjust dates to be relative
async function loadDataFromJSON() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        const now = new Date();

        // Load contacts (no date adjustment needed)
        dataGraph.contacts = data.contacts;

        // Load documents (no date adjustment needed)
        dataGraph.documents = data.documents;

        // Load emails and adjust dates
        dataGraph.emails = data.emails.map(email => {
            const emailDate = new Date(now);
            emailDate.setDate(emailDate.getDate() + email.relativeDays);
            emailDate.setHours(email.hours, email.minutes, 0, 0);
            
            return {
                id: email.id,
                from: email.from,
                fromEmail: email.fromEmail,
                subject: email.subject,
                body: email.body,
                date: emailDate
            };
        });

        // Load events and adjust dates
        dataGraph.events = data.events.map(event => {
            const eventDate = new Date(now);
            eventDate.setDate(eventDate.getDate() + event.relativeDays);
            eventDate.setHours(0, 0, 0, 0);
            
            return {
                id: event.id,
                title: event.title,
                attendees: event.attendees,
                description: event.description,
                date: eventDate,
                time: event.time
            };
        });

    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to empty data if JSON fails to load
        initializeFallbackData();
    }
}

// Fallback data initialization if JSON loading fails
function initializeFallbackData() {
    console.warn('Using fallback data - JSON file could not be loaded');
    
    // Minimal fallback data
    dataGraph.contacts = [
        { id: 1, name: 'Bob Smith', email: 'bob.smith@example.com', phone: '555-0101' },
        { id: 2, name: 'Mary Johnson', email: 'mary.johnson@example.com', phone: '555-0102' }
    ];

    dataGraph.documents = [
        { id: 1, name: 'Sample Document.docx', type: 'document', content: '<h2>Sample Document</h2><p>This is a fallback document.</p>' }
    ];

    const now = new Date();
    const todayMorning = new Date(now);
    todayMorning.setHours(9, 0, 0, 0);
    
    dataGraph.emails = [
        { id: 1, from: 'Bob Smith', fromEmail: 'bob.smith@example.com', subject: 'Test Email', body: 'This is a test email.', date: todayMorning }
    ];

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    dataGraph.events = [
        { id: 1, title: 'Sample Meeting', attendees: ['Bob Smith'], description: 'Sample meeting description.', date: today, time: '10:00 AM' }
    ];
}

// Initialize MiniSearch index
function initializeSearch() {
    miniSearchIndex = new MiniSearch({
        fields: ['content', 'subject', 'title', 'body', 'name', 'description', 'from'],
        storeFields: ['type', 'id', 'content', 'subject', 'title', 'body', 'name', 'from', 'date', 'description', 'attendees'],
        searchOptions: {
            boost: { subject: 2, title: 2, name: 2 },
            fuzzy: 0.2
        }
    });

    // Index all data with unique IDs by prefixing with type
    const documentsForIndex = dataGraph.documents.map(doc => ({ ...doc, id: `doc_${doc.id}`, type: 'document' }));
    const emailsForIndex = dataGraph.emails.map(email => ({ ...email, id: `email_${email.id}`, type: 'email', content: email.body }));
    const eventsForIndex = dataGraph.events.map(event => ({ ...event, id: `event_${event.id}`, type: 'event', content: event.description }));
    const contactsForIndex = dataGraph.contacts.map(contact => ({ ...contact, id: `contact_${contact.id}`, type: 'contact', content: contact.name + ' ' + contact.email }));

    miniSearchIndex.addAll([...documentsForIndex, ...emailsForIndex, ...eventsForIndex, ...contactsForIndex]);
}

// Initialize event listeners
function initializeEventListeners() {
    // Start button and menu
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = startMenu.style.display === 'block';
        startMenu.style.display = isVisible ? 'none' : 'block';
        startButton.setAttribute('aria-expanded', !isVisible);
    });

    // Close start menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== startButton) {
            startMenu.style.display = 'none';
            startButton.setAttribute('aria-expanded', 'false');
        }
    });

    // Start menu items
    document.querySelectorAll('.start-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const app = item.getAttribute('data-app');
            openApp(app);
            startMenu.style.display = 'none';
            startButton.setAttribute('aria-expanded', 'false');
        });
    });

    // Taskbar icons
    document.querySelectorAll('.taskbar-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const app = icon.getAttribute('data-app');
            openApp(app);
        });
    });

    // AI Assistant chat
    if (document.getElementById('ai-chat-input')) {
        setupChatInterface('ai', 'ai-assistant');
    }
    
    // Word Processor
    if (document.getElementById('word-new')) {
        setupWordProcessor();
    }
    
    // Spreadsheet
    if (document.getElementById('sheet-new')) {
        setupSpreadsheet();
    }
    
    // Email and Calendar
    if (document.getElementById('email-tab')) {
        setupEmailCalendar();
    }

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
}

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
    // ESC to close current app
    if (e.key === 'Escape' && currentApp) {
        closeApp(currentApp);
    }
}

// Open application
function openApp(appName) {
    // Close all apps
    document.querySelectorAll('.app-window').forEach(win => {
        win.style.display = 'none';
    });

    // Remove active state from all taskbar icons
    document.querySelectorAll('.taskbar-icon').forEach(icon => {
        icon.classList.remove('active');
    });

    // Open selected app
    const window = document.getElementById(`${appName}-window`);
    if (window) {
        window.style.display = 'flex';
        currentApp = appName;

        // Add active state to taskbar icon
        const icon = document.querySelector(`.taskbar-icon[data-app="${appName}"]`);
        if (icon) {
            icon.classList.add('active');
        }

        // Initialize app-specific content
        if (appName === 'email') {
            renderEmailList();
        }
        if (appName === 'files') {
            renderFiles();
        }
    }
}

// Close application
function closeApp(appName) {
    const window = document.getElementById(`${appName}-window`);
    if (window) {
        window.style.display = 'none';
        window.classList.remove('maximized');
    }

    // Remove active state from taskbar icon
    const icon = document.querySelector(`.taskbar-icon[data-app="${appName}"]`);
    if (icon) {
        icon.classList.remove('active');
    }

    if (currentApp === appName) {
        currentApp = null;
    }
}

// Toggle maximize/restore window
function toggleMaximize(appName) {
    const window = document.getElementById(`${appName}-window`);
    if (!window) return;
    
    const isMaximized = window.classList.contains('maximized');
    
    if (isMaximized) {
        // Restore window
        window.classList.remove('maximized');
        const maximizeBtn = window.querySelector('.window-maximize');
        if (maximizeBtn) {
            maximizeBtn.textContent = '□';
            maximizeBtn.setAttribute('aria-label', `Maximize ${appName}`);
        }
    } else {
        // Maximize window
        window.classList.add('maximized');
        const maximizeBtn = window.querySelector('.window-maximize');
        if (maximizeBtn) {
            maximizeBtn.textContent = '❐';
            maximizeBtn.setAttribute('aria-label', `Restore ${appName}`);
        }
    }
}

// Open email from AI Assistant link
function openEmailFromAI(emailId) {
    const email = dataGraph.emails.find(e => e.id === emailId);
    if (email) {
        openApp('email');
        // Wait for app to render
        setTimeout(() => {
            renderEmailList();
            showEmailDetail(email);
            // Highlight the email in the list
            document.querySelectorAll('.email-item').forEach((item, index) => {
                const sortedEmails = [...dataGraph.emails].sort((a, b) => b.date - a.date);
                if (sortedEmails[index].id === emailId) {
                    item.classList.add('selected');
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }, 100);
    }
}

// Open document from AI Assistant link
function openDocumentFromAI(docId) {
    const doc = dataGraph.documents.find(d => d.id === docId);
    if (doc) {
        if (doc.type === 'word' || doc.type === 'document') {
            openApp('word');
            setTimeout(() => {
                openSelectedDocument(docId);
            }, 100);
        } else if (doc.type === 'spreadsheet') {
            openApp('spreadsheet');
            // Spreadsheet opening logic could be added here
        }
    }
}

// Open event from AI Assistant link
function openEventFromAI(eventId) {
    const event = dataGraph.events.find(e => e.id === eventId);
    if (event) {
        openApp('email');
        // Switch to calendar tab
        setTimeout(() => {
            const calendarTab = document.getElementById('calendar-tab');
            const emailTab = document.getElementById('email-tab');
            const calendarContainer = document.getElementById('calendar-container');
            const emailListContainer = document.getElementById('email-list-container');
            
            if (calendarTab && emailTab && calendarContainer && emailListContainer) {
                calendarTab.classList.add('active');
                emailTab.classList.remove('active');
                calendarContainer.style.display = 'block';
                emailListContainer.style.display = 'none';
                
                // Set the calendar to the event's date
                selectedCalendarDate = new Date(event.date);
                currentCalendarDate = new Date(event.date);
                renderCalendar();
            }
        }, 100);
    }
}

// Setup chat interface
function setupChatInterface(prefix, context) {
    const input = document.getElementById(`${prefix}-chat-input`);
    const sendBtn = document.getElementById(`${prefix}-chat-send`);
    const messagesDiv = document.getElementById(`${prefix}-chat-messages`);

    const sendMessage = () => {
        const message = input.value.trim();
        if (!message) return;

        // Add user message
        addChatMessage(messagesDiv, message, 'user');
        input.value = '';

        // Process and respond
        setTimeout(() => {
            const response = processAIQuery(message, context);
            addChatMessage(messagesDiv, response, 'assistant');
        }, 500);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Suggested prompts - handle both button and card clicks
    const container = messagesDiv.parentElement.parentElement;
    container.querySelectorAll('.prompt-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.getAttribute('data-prompt');
            input.focus();
        });
    });
    
    // Also make the entire prompt card clickable
    container.querySelectorAll('.prompt-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('prompt-card') || e.target.classList.contains('prompt-icon')) {
                const btn = card.querySelector('.prompt-suggestion');
                if (btn) {
                    input.value = btn.getAttribute('data-prompt');
                    input.focus();
                }
            }
        });
    });
}

// Add chat message
function addChatMessage(container, text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.innerHTML = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Process AI query using MiniSearch and Compromise
function processAIQuery(query, context) {
    try {
        const doc = window.nlp ? nlp(query) : null;
        const lowerQuery = query.toLowerCase();
        
        // Parse the query to extract entities and intent
        const queryParsed = parseQuery(lowerQuery, doc);
        
        // Determine the primary action
        const action = determineAction(queryParsed, context, lowerQuery);
        
        // Execute the action
        return executeAction(action, queryParsed, context);
        
    } catch (error) {
        console.error('Error processing query:', error);
        return 'Sorry, I encountered an error processing your request. ' + error.message;
    }
}

// Parse query to extract key information
function parseQuery(lowerQuery, doc) {
    const parsed = {
        original: lowerQuery,
        entities: {
            people: [],
            dates: [],
            keywords: [],
            topics: []
        },
        target: null,      // meetings, emails, documents, events
        action: null,      // find, search, show, summarize, list
        timeframe: null,   // today, tomorrow, next week, specific date, etc.
        filters: []
    };
    
    // Extract people using Compromise.js
    if (doc) {
        const people = doc.people().out('array');
        parsed.entities.people = people;
        
        // Extract dates
        const dates = doc.dates().out('array');
        parsed.entities.dates = dates;
        
        // Extract topics
        const topics = doc.topics().out('array');
        parsed.entities.topics = topics;
    }
    
    // Fallback: manually check for known people names in query
    const knownPeople = ['Bob', 'Mary', 'John', 'Sarah', 'Bob Smith', 'Mary Johnson', 'John Davis', 'Sarah Wilson'];
    knownPeople.forEach(person => {
        if (lowerQuery.includes(person.toLowerCase()) && !parsed.entities.people.includes(person)) {
            // Extract just first name if full name is in query
            const firstName = person.split(' ')[0];
            if (!parsed.entities.people.includes(firstName)) {
                parsed.entities.people.push(firstName);
            }
        }
    });
    
    // Determine target (what they're looking for)
    if (lowerQuery.match(/\b(meeting|meetings|appointment|appointments)\b/)) {
        parsed.target = 'meetings';
    } else if (lowerQuery.match(/\b(email|emails|mail|message|messages)\b/)) {
        parsed.target = 'emails';
    } else if (lowerQuery.match(/\b(document|documents|file|files)\b/)) {
        parsed.target = 'documents';
    } else if (lowerQuery.match(/\b(event|events|calendar)\b/)) {
        parsed.target = 'events';
    } else if (lowerQuery.match(/\b(contact|contacts|phone|number|phone number|email address|contact details|contact info|contact information)\b/)) {
        parsed.target = 'contacts';
    }
    
    // Determine action
    if (lowerQuery.match(/\b(summarize|summary|brief|overview)\b/)) {
        parsed.action = 'summarize';
    } else if (lowerQuery.match(/\b(find|search|look for|locate|show|get|list)\b/)) {
        parsed.action = 'find';
    } else if (lowerQuery.match(/\b(what is|what's|what are|tell me about|explain|describe)\b/)) {
        parsed.action = 'explain';
    } else if (lowerQuery.match(/\b(do I have|have I|are there)\b/)) {
        parsed.action = 'check';
    } else {
        parsed.action = 'find'; // default
    }
    
    // Parse timeframe
    parsed.timeframe = parseTimeframe(lowerQuery);
    
    // Extract keywords (for filtering)
    // Look for "what is/are X" patterns
    const whatIsMatch = lowerQuery.match(/\b(?:what is|what's|what are|tell me about|explain|describe)\s+(.+?)(?:[?.!]|$)/);
    if (whatIsMatch) {
        const keyword = whatIsMatch[1].replace(/['"]/g, '').replace(/[?.!,;]+$/, '').trim();
        if (keyword && keyword.length > 1) {
            parsed.entities.keywords.push(keyword);
        }
    }
    
    // Look for explicit mention patterns: "mention X", "about X", etc.
    const mentionMatch = lowerQuery.match(/\b(?:mention|mentioning|about|regarding|concerning)\s+(.+?)(?:\s+in\b|\s+from\b|\s+to\b|\s+with\b|\s+and\b|[?.!]|$)/);
    if (mentionMatch) {
        const keyword = mentionMatch[1].replace(/['"]/g, '').replace(/[?.!,;]+$/, '').trim();
        // Remove trailing common words
        const cleanedKeyword = keyword.replace(/\s+(documents|emails|meetings|events|files)$/i, '').trim();
        if (cleanedKeyword && cleanedKeyword.length > 2) {
            parsed.entities.keywords.push(cleanedKeyword);
        }
    }
    
    // Look for quoted terms (higher priority, more explicit)
    const quotedTerms = lowerQuery.match(/['"]([^'"]+)['"]/g);
    if (quotedTerms) {
        quotedTerms.forEach(term => {
            const cleanTerm = term.replace(/['"]/g, '');
            if (!parsed.entities.keywords.includes(cleanTerm)) {
                parsed.entities.keywords.push(cleanTerm);
            }
        });
    }
    
    // Extract filters (from, to, with, etc.)
    if (lowerQuery.match(/\b(from|by|sent by)\b/)) {
        parsed.filters.push('from_person');
    }
    if (lowerQuery.match(/\b(with|including|attended by)\b/)) {
        parsed.filters.push('with_person');
    }
    if (lowerQuery.match(/\b(to|sent to|for)\b/)) {
        parsed.filters.push('to_person');
    }
    
    return parsed;
}

// Parse timeframe from query
function parseTimeframe(lowerQuery) {
    // Specific days
    if (lowerQuery.match(/\btoday\b/)) return { type: 'specific', value: 'today' };
    if (lowerQuery.match(/\btomorrow\b/)) return { type: 'specific', value: 'tomorrow' };
    if (lowerQuery.match(/\byesterday\b/)) return { type: 'specific', value: 'yesterday' };
    
    // Days of week
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of daysOfWeek) {
        if (lowerQuery.includes(day)) {
            return { type: 'day_of_week', value: day };
        }
    }
    
    // Relative weeks
    if (lowerQuery.match(/\b(next week|coming week|following week)\b/)) {
        return { type: 'range', value: 'next_week' };
    }
    if (lowerQuery.match(/\b(this week|current week)\b/)) {
        return { type: 'range', value: 'this_week' };
    }
    if (lowerQuery.match(/\b(last week|past week|previous week)\b/)) {
        return { type: 'range', value: 'last_week' };
    }
    
    // Relative months
    if (lowerQuery.match(/\b(this month|current month)\b/)) {
        return { type: 'range', value: 'this_month' };
    }
    if (lowerQuery.match(/\b(next month|following month)\b/)) {
        return { type: 'range', value: 'next_month' };
    }
    if (lowerQuery.match(/\b(last month|past month|previous month)\b/)) {
        return { type: 'range', value: 'last_month' };
    }
    
    // Next/upcoming
    if (lowerQuery.match(/\b(next|upcoming)\b/)) {
        return { type: 'next', value: 'next' };
    }
    
    return null;
}

// Determine action based on parsed query
function determineAction(parsed, context, lowerQuery) {
    const action = {
        type: null,
        params: {}
    };
    
    // Context-specific actions (take priority)
    if (context === 'word' && parsed.action === 'summarize') {
        action.type = 'summarize_current_document';
        return action;
    }
    
    if (context === 'word' && lowerQuery.match(/\b(add|write|insert|create|generate)\b/)) {
        action.type = 'generate_content';
        action.params.keywords = parsed.entities.keywords;
        return action;
    }
    
    if (context === 'spreadsheet' && lowerQuery.match(/\b(chart|graph|plot|visualize)\b/)) {
        action.type = 'create_chart';
        return action;
    }
    
    if (context === 'email' && parsed.action === 'summarize') {
        action.type = 'summarize_current_email';
        return action;
    }
    
    if (context === 'email' && lowerQuery.match(/\brelevant\b.*\bdocument/)) {
        action.type = 'find_relevant_documents';
        return action;
    }
    
    // General query actions
    if (parsed.target === 'meetings' || parsed.target === 'events') {
        if (parsed.action === 'summarize') {
            action.type = 'summarize_meetings';
        } else {
            action.type = 'find_meetings';
        }
        action.params.timeframe = parsed.timeframe;
        action.params.people = parsed.entities.people;
        action.params.keywords = parsed.entities.keywords;
        return action;
    }
    
    if (parsed.target === 'emails') {
        if (parsed.action === 'summarize') {
            action.type = 'summarize_emails';
        } else {
            action.type = 'find_emails';
        }
        action.params.timeframe = parsed.timeframe;
        action.params.people = parsed.entities.people;
        action.params.keywords = parsed.entities.keywords;
        action.params.filters = parsed.filters;
        return action;
    }
    
    if (parsed.target === 'documents') {
        if (parsed.action === 'summarize') {
            action.type = 'summarize_documents';
        } else {
            action.type = 'find_documents';
        }
        action.params.keywords = parsed.entities.keywords.concat(parsed.entities.topics);
        return action;
    }
    
    if (parsed.target === 'contacts') {
        action.type = 'find_contact';
        action.params.people = parsed.entities.people;
        return action;
    }
    
    // If no specific target, use action to determine
    if (parsed.action === 'explain') {
        action.type = 'explain_topic';
        action.params.keywords = parsed.entities.keywords.concat(parsed.entities.topics);
        return action;
    }
    
    // Default: general search
    action.type = 'general_search';
    action.params.query = parsed.original;
    return action;
}

// Execute the determined action
function executeAction(action, parsed, context) {
    switch (action.type) {
        case 'find_meetings':
            return findMeetings(action.params);
        
        case 'find_emails':
            return findEmails(action.params);
        
        case 'find_documents':
            return findDocuments(action.params);
        
        case 'find_contact':
            return findContact(action.params);
        
        case 'explain_topic':
            return explainTopic(action.params);
        
        case 'summarize_meetings':
            return summarizeMeetings(action.params);
        
        case 'summarize_emails':
            return summarizeEmails(action.params);
        
        case 'summarize_current_document':
            return summarizeCurrentDocument();
        
        case 'summarize_current_email':
            return summarizeCurrentEmail();
        
        case 'generate_content':
            return generateContent(action.params);
        
        case 'create_chart':
            return createChartFromSpreadsheet();
        
        case 'find_relevant_documents':
            return findRelevantDocuments();
        
        case 'general_search':
            const results = miniSearchIndex.search(action.params.query, { limit: 3 });
            if (results.length > 0) {
                return formatSearchResults(results);
            }
            return 'I\'m not sure how to help with that. Try asking about your meetings, emails, or documents.';
        
        default:
            return 'I\'m not sure how to help with that. Try asking about your meetings, emails, or documents.';
    }
}

// Extract search terms from query
function extractSearchTerms(query) {
    const doc = window.nlp ? nlp(query) : null;
    // Remove common words and extract key terms
    if (doc) {
        const terms = doc.topics().out('array');
        if (terms.length > 0) return terms.join(' ');
    }
    
    // Fallback: look for quoted terms
    const quoted = query.match(/'([^']+)'/);
    if (quoted) return quoted[1];
    
    return query;
}

// Find meetings based on parameters
function findMeetings(params) {
    let meetings = [...dataGraph.events];
    
    // Apply timeframe filter
    if (params.timeframe) {
        const dateRange = getDateRange(params.timeframe);
        if (dateRange) {
            meetings = meetings.filter(m => m.date >= dateRange.start && m.date <= dateRange.end);
        }
    }
    
    // Apply people filter
    if (params.people && params.people.length > 0) {
        meetings = meetings.filter(m => 
            m.attendees.some(attendee => 
                params.people.some(person => 
                    attendee.toLowerCase().includes(person.toLowerCase())
                )
            )
        );
    }
    
    // Apply keyword filter
    if (params.keywords && params.keywords.length > 0) {
        meetings = meetings.filter(m => {
            const searchText = `${m.title} ${m.description}`.toLowerCase();
            return params.keywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
            );
        });
    }
    
    if (meetings.length === 0) {
        return buildNoResultsMessage('meetings', params);
    }
    
    meetings.sort((a, b) => a.date - b.date);
    
    return buildMeetingsResponse(meetings, params);
}

// Find emails based on parameters
function findEmails(params) {
    let emails = [...dataGraph.emails];
    
    // Apply timeframe filter
    if (params.timeframe) {
        const dateRange = getDateRange(params.timeframe);
        if (dateRange) {
            emails = emails.filter(e => e.date >= dateRange.start && e.date <= dateRange.end);
        }
    }
    
    // Apply people filter
    if (params.people && params.people.length > 0) {
        if (params.filters.includes('from_person')) {
            emails = emails.filter(e => 
                params.people.some(person => 
                    e.from.toLowerCase().includes(person.toLowerCase())
                )
            );
        } else {
            // Search in all person-related fields
            emails = emails.filter(e => {
                const searchText = `${e.from} ${e.body}`.toLowerCase();
                return params.people.some(person => 
                    searchText.includes(person.toLowerCase())
                );
            });
        }
    }
    
    // Apply keyword filter
    if (params.keywords && params.keywords.length > 0) {
        emails = emails.filter(e => {
            const searchText = `${e.subject} ${e.body}`.toLowerCase();
            return params.keywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
            );
        });
    }
    
    if (emails.length === 0) {
        return buildNoResultsMessage('emails', params);
    }
    
    emails.sort((a, b) => b.date - a.date);
    
    return buildEmailsResponse(emails, params);
}

// Find documents based on parameters
function findDocuments(params) {
    let docs = [...dataGraph.documents];
    
    // Apply keyword filter
    if (params.keywords && params.keywords.length > 0) {
        docs = docs.filter(d => {
            const searchText = `${d.name} ${d.content}`.toLowerCase();
            return params.keywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
            );
        });
    }
    
    if (docs.length === 0) {
        return `No documents found${params.keywords && params.keywords.length > 0 ? ' matching "' + params.keywords.join(', ') + '"' : ''}.`;
    }
    
    const docLinks = docs.map(d => 
        `- <a href="#" onclick="openDocumentFromAI(${d.id}); return false;" style="color: #0066cc; text-decoration: none;">${d.name}</a>`
    ).join('<br>');
    
    return `Found ${docs.length} document(s):<br>` + docLinks;
}

// Find contact information
function findContact(params) {
    if (!params.people || params.people.length === 0) {
        return 'Please specify whose contact information you\'re looking for.';
    }
    
    // Find matching contacts
    const contacts = dataGraph.contacts.filter(contact => 
        params.people.some(person => 
            contact.name.toLowerCase().includes(person.toLowerCase())
        )
    );
    
    if (contacts.length === 0) {
        return `No contact found for ${params.people.join(', ')}.`;
    }
    
    if (contacts.length === 1) {
        const contact = contacts[0];
        return `<strong>${contact.name}</strong><br>📧 ${contact.email}<br>📞 ${contact.phone}`;
    }
    
    // Multiple contacts found
    const contactInfo = contacts.map(c => 
        `<strong>${c.name}</strong><br>📧 ${c.email}<br>📞 ${c.phone}`
    ).join('<br><br>');
    
    return `Found ${contacts.length} contacts:<br><br>${contactInfo}`;
}

// Explain a topic by searching and summarizing
function explainTopic(params) {
    if (!params.keywords || params.keywords.length === 0) {
        return `I don't have information about that topic.`;
    }
    
    // Deduplicate keywords by converting to Set and back
    const uniqueKeywords = [...new Set(params.keywords.map(k => k.toLowerCase()))];
    const keywords = uniqueKeywords.join(' ');
    
    const results = miniSearchIndex.search(keywords, {
        filter: (result) => result.type === 'document',
        limit: 1,
        fuzzy: 0.2
    });
    
    if (results.length === 0) {
        return `I don't have information about "${uniqueKeywords.join(', ')}".`;
    }
    
    const doc = results[0];
    const summary = summarizeText(doc.content);
    
    return `Based on the document "${doc.name}":<br><br>${summary}`;
}

// Summarize meetings
function summarizeMeetings(params) {
    const meetings = findMeetings(params);
    // In a real app, this would use AI to summarize
    return meetings;
}

// Summarize emails
function summarizeEmails(params) {
    const emails = findEmails(params);
    // In a real app, this would use AI to summarize
    return emails;
}

// Generate content for Word
function generateContent(params) {
    const keywords = params.keywords.join(' ');
    return explainTopic(params);
}

// Get date range based on timeframe
function getDateRange(timeframe) {
    if (!timeframe) return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeframe.type) {
        case 'specific':
            if (timeframe.value === 'today') {
                const endOfToday = new Date(today);
                endOfToday.setHours(23, 59, 59, 999);
                return {
                    start: new Date(today),
                    end: endOfToday
                };
            }
            if (timeframe.value === 'tomorrow') {
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                const endOfTomorrow = new Date(tomorrow);
                endOfTomorrow.setHours(23, 59, 59, 999);
                return {
                    start: tomorrow,
                    end: endOfTomorrow
                };
            }
            if (timeframe.value === 'yesterday') {
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                const endOfYesterday = new Date(yesterday);
                endOfYesterday.setHours(23, 59, 59, 999);
                return {
                    start: yesterday,
                    end: endOfYesterday
                };
            }
            break;
        
        case 'day_of_week':
            // Find next occurrence of this day
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = dayNames.indexOf(timeframe.value);
            const currentDay = now.getDay();
            let daysUntil = targetDay - currentDay;
            if (daysUntil < 0) daysUntil += 7;
            if (daysUntil === 0 && now.getHours() > 18) daysUntil = 7; // If it's late, assume they mean next week
            
            const targetDate = new Date(today.getTime() + daysUntil * 24 * 60 * 60 * 1000);
            const endOfTargetDate = new Date(targetDate);
            endOfTargetDate.setHours(23, 59, 59, 999);
            return {
                start: targetDate,
                end: endOfTargetDate
            };
        
        case 'range':
            if (timeframe.value === 'this_week' || timeframe.value === 'next_week') {
                const start = timeframe.value === 'next_week' 
                    ? new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                    : today;
                return {
                    start: start,
                    end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
                };
            }
            if (timeframe.value === 'last_week') {
                return {
                    start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
                    end: today
                };
            }
            if (timeframe.value === 'this_month') {
                return {
                    start: today,
                    end: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                };
            }
            break;
        
        case 'next':
            // Next means upcoming (future)
            return {
                start: now,
                end: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // Far future
            };
    }
    
    return null;
}

// Build response message for meetings
function buildMeetingsResponse(meetings, params) {
    let header = 'Meetings';
    
    if (params.timeframe) {
        if (params.timeframe.type === 'specific') {
            header = `Meetings ${params.timeframe.value}`;
        } else if (params.timeframe.type === 'day_of_week') {
            header = `Meetings on ${params.timeframe.value}`;
        } else if (params.timeframe.type === 'range') {
            header = `Meetings ${params.timeframe.value.replace('_', ' ')}`;
        } else if (params.timeframe.type === 'next') {
            header = 'Upcoming meetings';
        }
    }
    
    if (params.people && params.people.length > 0) {
        header += ` with ${params.people.join(', ')}`;
    }
    
    if (params.keywords && params.keywords.length > 0) {
        header += ` about ${params.keywords.join(', ')}`;
    }
    
    if (meetings.length === 0) {
        return `No ${header.toLowerCase()} found.`;
    }
    
    if (meetings.length === 1 && params.timeframe && params.timeframe.type === 'next') {
        const m = meetings[0];
        return `Your next meeting is <a href="#" onclick="openEventFromAI(${m.id}); return false;" style="color: #0066cc; text-decoration: none;">${m.title}</a> on ${m.date.toLocaleDateString()} at ${m.time} with ${m.attendees.join(', ')}.`;
    }
    
    const meetingLinks = meetings.slice(0, 10).map(m => 
        `- <a href="#" onclick="openEventFromAI(${m.id}); return false;" style="color: #0066cc; text-decoration: none;">${m.title}</a> on ${m.date.toLocaleDateString()} at ${m.time} with ${m.attendees.join(', ')}`
    ).join('<br>');
    
    return `${header} (${meetings.length} total):<br>` + meetingLinks + 
           (meetings.length > 10 ? `<br>... and ${meetings.length - 10} more` : '');
}

// Build response message for emails
function buildEmailsResponse(emails, params) {
    let header = 'Emails';
    
    if (params.timeframe) {
        if (params.timeframe.type === 'specific') {
            header = `Emails ${params.timeframe.value}`;
        } else if (params.timeframe.type === 'range') {
            header = `Emails ${params.timeframe.value.replace('_', ' ')}`;
        }
    }
    
    if (params.people && params.people.length > 0) {
        if (params.filters.includes('from_person')) {
            header += ` from ${params.people.join(', ')}`;
        } else {
            header += ` mentioning ${params.people.join(', ')}`;
        }
    }
    
    if (params.keywords && params.keywords.length > 0) {
        header += ` about ${params.keywords.join(', ')}`;
    }
    
    const emailLinks = emails.slice(0, 5).map(e => 
        `- <a href="#" onclick="openEmailFromAI(${e.id}); return false;" style="color: #0066cc; text-decoration: none;">${e.subject}</a> from ${e.from} (${e.date.toLocaleDateString()})`
    ).join('<br>');
    
    return `${header} (${emails.length} total):<br>` + emailLinks + 
           (emails.length > 5 ? `<br>... and ${emails.length - 5} more` : '');
}

// Build "no results" message
function buildNoResultsMessage(type, params) {
    let msg = `No ${type} found`;
    
    if (params.timeframe) {
        if (params.timeframe.type === 'specific') {
            msg += ` ${params.timeframe.value}`;
        } else if (params.timeframe.type === 'day_of_week') {
            msg += ` on ${params.timeframe.value}`;
        } else if (params.timeframe.type === 'range') {
            msg += ` ${params.timeframe.value.replace('_', ' ')}`;
        }
    }
    
    if (params.people && params.people.length > 0) {
        msg += ` with ${params.people.join(', ')}`;
    }
    
    if (params.keywords && params.keywords.length > 0) {
        msg += ` about ${params.keywords.join(', ')}`;
    }
    
    return msg + '.';
}

// Get today's meetings
function getMeetingsToday() {
    const today = new Date();
    const todayMeetings = dataGraph.events.filter(event => {
        return event.date.toDateString() === today.toDateString();
    });

    if (todayMeetings.length === 0) {
        return 'You have no meetings scheduled for today.';
    }

    return 'Today\'s meetings:\n' + todayMeetings.map(m => 
        `- ${m.title} at ${m.time} with ${m.attendees.join(', ')}`
    ).join('\n');
}

// Get tomorrow's meetings
function getMeetingsTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowMeetings = dataGraph.events.filter(event => {
        return event.date.toDateString() === tomorrow.toDateString();
    });

    if (tomorrowMeetings.length === 0) {
        return 'You have no meetings scheduled for tomorrow.';
    }

    return 'Tomorrow\'s meetings:\n' + tomorrowMeetings.map(m => 
        `- ${m.title} at ${m.time} with ${m.attendees.join(', ')}`
    ).join('\n');
}

// Get next upcoming meeting (optionally with a specific person)
function getNextMeeting(person = null) {
    const now = new Date();
    let upcomingMeetings = dataGraph.events.filter(event => event.date >= now);
    
    if (person) {
        upcomingMeetings = upcomingMeetings.filter(event => 
            event.attendees.some(attendee => 
                attendee.toLowerCase().includes(person.toLowerCase())
            )
        );
    }
    
    if (upcomingMeetings.length === 0) {
        return person 
            ? `No upcoming meetings found with ${person}.`
            : 'No upcoming meetings scheduled.';
    }
    
    upcomingMeetings.sort((a, b) => a.date - b.date);
    const next = upcomingMeetings[0];
    
    return `Your next meeting${person ? ' with ' + person : ''} is "${next.title}" on ${next.date.toLocaleDateString()} at ${next.time} with ${next.attendees.join(', ')}.`;
}

// Get meetings in a date range
function getMeetingsInDateRange(dateRange) {
    const now = new Date();
    let startDate, endDate, rangeLabel;
    
    switch (dateRange) {
        case 'next_week':
            startDate = new Date(now);
            endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            rangeLabel = 'in the next week';
            break;
        case 'this_week':
            startDate = new Date(now);
            endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            rangeLabel = 'this week';
            break;
        case 'last_week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            rangeLabel = 'in the last week';
            break;
        case 'this_month':
            startDate = new Date(now);
            endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            rangeLabel = 'this month';
            break;
        case 'next_month':
            startDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            rangeLabel = 'next month';
            break;
        default:
            startDate = new Date(now);
            endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            rangeLabel = 'in the coming days';
    }
    
    const meetings = dataGraph.events.filter(event => {
        return event.date >= startDate && event.date <= endDate;
    });
    
    if (meetings.length === 0) {
        return `You have no meetings ${rangeLabel}.`;
    }
    
    meetings.sort((a, b) => a.date - b.date);
    
    return `Meetings ${rangeLabel}:\n` + meetings.map(m => 
        `- ${m.title} on ${m.date.toLocaleDateString()} at ${m.time} with ${m.attendees.join(', ')}`
    ).join('\n');
}

// Get emails in a date range
function getEmailsInDateRange(dateRange) {
    const now = new Date();
    let startDate, endDate, rangeLabel;
    
    switch (dateRange) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
            rangeLabel = 'today';
            break;
        case 'yesterday':
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            startDate = new Date(yesterday.setHours(0, 0, 0, 0));
            endDate = new Date(yesterday.setHours(23, 59, 59, 999));
            rangeLabel = 'yesterday';
            break;
        case 'this_week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            rangeLabel = 'this week';
            break;
        case 'last_week':
            startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            endDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            rangeLabel = 'last week';
            break;
        default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            rangeLabel = 'recently';
    }
    
    const emails = dataGraph.emails.filter(email => {
        return email.date >= startDate && email.date <= endDate;
    });
    
    if (emails.length === 0) {
        return `You received no emails ${rangeLabel}.`;
    }
    
    emails.sort((a, b) => b.date - a.date);
    
    return `Emails received ${rangeLabel} (${emails.length} total):\n` + emails.slice(0, 5).map(e => 
        `- ${e.subject} from ${e.from} (${e.date.toLocaleDateString()})`
    ).join('\n') + (emails.length > 5 ? `\n... and ${emails.length - 5} more` : '');
}

// Get meetings with specific person
function getMeetingsWithPerson(person) {
    const meetings = dataGraph.events.filter(event => {
        return event.attendees.some(attendee => 
            attendee.toLowerCase().includes(person.toLowerCase())
        );
    });

    if (meetings.length === 0) {
        return `No meetings found with ${person}.`;
    }

    meetings.sort((a, b) => a.date - b.date);
    const nextMeeting = meetings.find(m => m.date >= new Date());

    if (nextMeeting) {
        return `Your next meeting with ${person} is "${nextMeeting.title}" on ${nextMeeting.date.toLocaleDateString()} at ${nextMeeting.time}.`;
    }

    return `You have had ${meetings.length} meeting(s) with ${person}, but no upcoming meetings scheduled.`;
}

// Get emails from person
function getEmailsFromPerson(person) {
    const emails = dataGraph.emails.filter(email => 
        email.from.toLowerCase().includes(person.toLowerCase())
    );

    if (emails.length === 0) {
        return `No emails found from ${person}.`;
    }

    return `Found ${emails.length} email(s) from ${person}:\n` + 
        emails.map(e => `- ${e.subject} (${e.date.toLocaleDateString()})`).join('\n');
}

// Search emails
function searchEmails(terms) {
    const results = miniSearchIndex.search(terms, { 
        filter: (result) => result.type === 'email',
        limit: 5 
    });

    if (results.length === 0) {
        return `No emails found mentioning "${terms}".`;
    }

    return `Found ${results.length} email(s) mentioning "${terms}":\n` +
        results.map(r => `- ${r.subject} from ${r.from}`).join('\n');
}

// Search documents
function searchDocuments(terms) {
    const results = miniSearchIndex.search(terms, {
        filter: (result) => result.type === 'document',
        limit: 3
    });

    if (results.length === 0) {
        return `No information found about "${terms}".`;
    }

    const topResult = results[0];
    return summarizeText(topResult.content);
}

// Search and summarize
function searchAndSummarize(terms) {
    const results = miniSearchIndex.search(terms, { limit: 1 });
    
    if (results.length === 0) {
        return `No information found about "${terms}".`;
    }

    return summarizeText(results[0].content);
}

// Summarize text using TextRank
function summarizeText(text) {
    if (!text || text.length < 50) {
        return text || 'No content to summarize.';
    }

    // Simple sentence extraction
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    
    // Return first 2-3 sentences as summary
    const summaryLength = Math.min(2, sentences.length);
    return sentences.slice(0, summaryLength).join(' ').trim();
}

// Summarize current Word document
function summarizeCurrentDocument() {
    if (!currentWordDoc.content || currentWordDoc.content.trim().length === 0) {
        return 'The document is currently empty.';
    }
    
    // Strip HTML tags to get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentWordDoc.content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    if (plainText.trim().length < 50) {
        return 'The document is too short to summarize.';
    }
    
    return summarizeText(plainText);
}

// Summarize current email
function summarizeCurrentEmail() {
    if (!currentEmail) {
        return 'No email is currently selected. Please select an email to summarize.';
    }
    
    const summary = summarizeText(currentEmail.body);
    return `Email from ${currentEmail.from} about "${currentEmail.subject}": ${summary}`;
}

// Create chart from spreadsheet data
function createChartFromSpreadsheet() {
    // Check if there's any data in the spreadsheet
    const cellCount = Object.keys(currentSpreadsheet.cells || {}).length;
    
    if (cellCount === 0) {
        return 'The spreadsheet is empty. Please add data before creating a chart.';
    }
    
    // Get all cell values
    const cells = currentSpreadsheet.cells;
    const numericValues = Object.values(cells).filter(v => !isNaN(parseFloat(v))).length;
    
    if (numericValues === 0) {
        return 'No numeric data found in the spreadsheet. Charts require numeric values.';
    }
    
    return `Analyzing ${cellCount} cells with ${numericValues} numeric values. A chart visualization would be created here showing the data distribution and trends from your spreadsheet.`;
}

// Find relevant documents based on current email
function findRelevantDocuments() {
    if (!currentEmail) {
        return 'No email is currently selected. Please select an email to find relevant documents.';
    }
    
    // Extract keywords from email subject and body
    const searchText = `${currentEmail.subject} ${currentEmail.body}`;
    
    // Search for documents matching email content
    const results = miniSearchIndex.search(searchText, {
        filter: (result) => result.type === 'document',
        limit: 5,
        fuzzy: 0.2
    });
    
    if (results.length === 0) {
        return `No documents found related to "${currentEmail.subject}".`;
    }
    
    const docLinks = results.map(r => {
        const numericId = typeof r.id === 'string' && r.id.includes('_')
            ? parseInt(r.id.split('_')[1])
            : r.id;
        return `- <a href="#" onclick="openDocumentFromAI(${numericId}); return false;" style="color: #0066cc; text-decoration: none;">${r.name}</a>`;
    }).join('<br>');
    
    return `Based on this email, found ${results.length} relevant document(s):<br>${docLinks}`;
}

// Format search results
function formatSearchResults(results) {
    const formatted = results.slice(0, 3).map(r => {
        if (r.type === 'email') {
            return `📧 ${r.subject} from ${r.from}`;
        } else if (r.type === 'document') {
            return `📄 ${r.name}`;
        } else if (r.type === 'event') {
            return `📅 ${r.title} on ${new Date(r.date).toLocaleDateString()}`;
        }
        return r.title || r.name || 'Result';
    });

    return 'Found the following:\n' + formatted.join('\n');
}

// Setup Files App
function renderFiles() {
    const container = document.getElementById('files-container');
    container.innerHTML = '';

    dataGraph.documents.forEach(doc => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.tabIndex = 0;
        fileDiv.setAttribute('role', 'listitem');
        fileDiv.setAttribute('aria-label', doc.name);

        const iconEmoji = getFileIconEmoji(doc.type);
        const fileType = getFileTypeLabel(doc.type);
        
        fileDiv.innerHTML = `
            <div class="file-item-icon">${iconEmoji}</div>
            <div class="file-item-details">
                <div class="file-item-name">${doc.name}</div>
                <div class="file-item-type">${fileType}</div>
            </div>
        `;

        fileDiv.addEventListener('dblclick', () => openDocument(doc));
        fileDiv.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') openDocument(doc);
        });

        container.appendChild(fileDiv);
    });
}

function getFileIconEmoji(type) {
    const icons = {
        'word': '�',
        'spreadsheet': '📊',
        'pdf': '📄'
    };
    return icons[type] || '📄';
}

function getFileTypeLabel(type) {
    const labels = {
        'word': 'Word Document',
        'spreadsheet': 'Excel Spreadsheet',
        'pdf': 'PDF Document'
    };
    return labels[type] || 'Document';
}

function getFileIcon(type) {
    // Keep for backwards compatibility
    return getFileIconEmoji(type);
}

function openDocument(doc) {
    if (doc.type === 'document' || doc.type === 'word') {
        currentWordDoc = { filename: doc.name, content: doc.content };
        document.getElementById('word-editor').innerHTML = doc.content;
        openApp('word');
    } else if (doc.type === 'spreadsheet') {
        currentSpreadsheet = { filename: doc.name, cells: {} };
        openApp('spreadsheet');
    }
}

// Setup Word Processor
function setupWordProcessor() {
    const newBtn = document.getElementById('word-new');
    const openBtn = document.getElementById('word-open');
    const saveBtn = document.getElementById('word-save');
    const aiToggle = document.getElementById('word-ai-toggle');
    const aiPane = document.getElementById('word-ai-pane');
    const editor = document.getElementById('word-editor');

    // File operations
    newBtn.addEventListener('click', () => {
        currentWordDoc = { filename: 'Untitled.docx', content: '', isNew: true };
        editor.innerHTML = '';
        updateWordDocTitle();
    });

    openBtn.addEventListener('click', () => {
        showWordOpenDialog();
    });

    saveBtn.addEventListener('click', () => {
        saveWordDocument();
    });

    aiToggle.addEventListener('click', () => {
        const isVisible = aiPane.style.display === 'flex';
        aiPane.style.display = isVisible ? 'none' : 'flex';
    });

    // Close button
    document.getElementById('word-ai-close').addEventListener('click', () => {
        aiPane.style.display = 'none';
    });

    // Text formatting buttons
    document.getElementById('word-bold').addEventListener('click', () => {
        document.execCommand('bold', false, null);
        editor.focus();
    });

    document.getElementById('word-italic').addEventListener('click', () => {
        document.execCommand('italic', false, null);
        editor.focus();
    });

    document.getElementById('word-underline').addEventListener('click', () => {
        document.execCommand('underline', false, null);
        editor.focus();
    });

    document.getElementById('word-align-left').addEventListener('click', () => {
        document.execCommand('justifyLeft', false, null);
        editor.focus();
    });

    document.getElementById('word-align-center').addEventListener('click', () => {
        document.execCommand('justifyCenter', false, null);
        editor.focus();
    });

    document.getElementById('word-align-right').addEventListener('click', () => {
        document.execCommand('justifyRight', false, null);
        editor.focus();
    });

    document.getElementById('word-bullets').addEventListener('click', () => {
        document.execCommand('insertUnorderedList', false, null);
        editor.focus();
    });

    document.getElementById('word-numbering').addEventListener('click', () => {
        document.execCommand('insertOrderedList', false, null);
        editor.focus();
    });

    // Setup Word AI input
    const wordChatInput = document.getElementById('word-chat-input');
    const wordChatSend = document.getElementById('word-chat-send');
    const wordSummarizeBtn = document.getElementById('word-summarize-btn');
    const wordChatMessages = document.getElementById('word-chat-messages');
    
    const addWordChatMessage = (message, isUser = false) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
        messageDiv.textContent = message;
        wordChatMessages.appendChild(messageDiv);
        wordChatMessages.scrollTop = wordChatMessages.scrollHeight;
    };
    
    const handleWordAIQuery = () => {
        const query = wordChatInput.value.trim();
        if (!query) return;
        
        // Display user message
        addWordChatMessage(query, true);
        
        // Get the document text content (strip HTML tags)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = editor.innerHTML;
        const documentText = tempDiv.textContent || tempDiv.innerText || '';
        
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('summarize')) {
            // Generate summary of the document
            if (!documentText || documentText.length < 10) {
                addWordChatMessage('The document is empty or too short to summarize.');
                wordChatInput.value = '';
                return;
            }
            
            const summary = summarizeText(documentText);
            addWordChatMessage(summary);
        } else if (queryLower.match(/\b(write|add|create|generate|draft|compose)\b/)) {
            // Content creation intent - search graph for relevant content
            const keywords = query.replace(/\b(write|add|create|generate|draft|compose|a|an|the|about|on|for|paragraph|section|content)\b/gi, '').trim();
            
            if (!keywords) {
                addWordChatMessage('Please specify what you would like me to write about.');
                wordChatInput.value = '';
                return;
            }
            
            // Search the graph for relevant content
            const searchResults = miniSearchIndex.search(keywords, { 
                boost: { content: 2, subject: 1.5, title: 1.5, name: 1.5 },
                fuzzy: 0.2,
                prefix: true
            });
            
            // Filter out the current document from search results
            const filteredResults = searchResults.filter(result => {
                if (result.type === 'document' && currentWordDoc.docId) {
                    return result.id !== currentWordDoc.docId;
                }
                return true;
            });
            
            if (filteredResults.length === 0) {
                addWordChatMessage(`I couldn't find any information about "${keywords}" in your other documents, emails, or calendar.`);
                wordChatInput.value = '';
                return;
            }
            
            // Get the top result and extract its content
            const topResult = filteredResults[0];
            let contentToSummarize = '';
            
            // Extract numeric ID from prefixed ID (e.g., "doc_1" -> 1)
            const numericId = typeof topResult.id === 'string' && topResult.id.includes('_')
                ? parseInt(topResult.id.split('_')[1])
                : topResult.id;
            
            if (topResult.type === 'document') {
                const doc = dataGraph.documents.find(d => d.id === numericId);
                contentToSummarize = doc ? doc.content : '';
            } else if (topResult.type === 'email') {
                const email = dataGraph.emails.find(e => e.id === numericId);
                contentToSummarize = email ? email.body : '';
            } else if (topResult.type === 'event') {
                const event = dataGraph.events.find(e => e.id === numericId);
                contentToSummarize = event ? event.description : '';
            }
            
            if (contentToSummarize) {
                // Strip HTML tags if present
                const tempDiv2 = document.createElement('div');
                tempDiv2.innerHTML = contentToSummarize;
                const plainText = tempDiv2.textContent || tempDiv2.innerText || contentToSummarize;
                
                const summary = summarizeText(plainText);
                addWordChatMessage(summary);
            } else {
                addWordChatMessage(`I found a reference to "${keywords}" but couldn't extract the content.`);
            }
        } else {
            // Process other queries with the document content
            const result = processAIQuery(query, documentText);
            addWordChatMessage(result);
        }
        
        wordChatInput.value = '';
    };
    
    wordChatSend.addEventListener('click', handleWordAIQuery);
    wordChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleWordAIQuery();
        }
    });
    
    // Summarize button - copy prompt to input box
    wordSummarizeBtn.addEventListener('click', () => {
        wordChatInput.value = 'Summarize this document';
        wordChatInput.focus();
    });

    // Update content on edit
    editor.addEventListener('input', () => {
        currentWordDoc.content = editor.innerHTML;
    });
}

// Update Word document title
function updateWordDocTitle() {
    const titleElement = document.getElementById('word-doc-title');
    if (titleElement) {
        titleElement.textContent = currentWordDoc.filename;
    }
}

// Show Word file open dialog
function showWordOpenDialog() {
    const wordDocs = dataGraph.documents.filter(doc => doc.type === 'document' || doc.type === 'word');
    
    if (wordDocs.length === 0) {
        alert('No Word documents found.');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">Open Document</div>
            <div class="modal-body">
                <div class="file-open-list">
                    ${wordDocs.map(doc => `
                        <div class="file-open-item" data-doc-id="${doc.id}" tabindex="0">
                            <span class="file-open-icon">📄</span>
                            <span class="file-open-name">${doc.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" id="open-doc-btn" disabled>Open</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    let selectedDocId = null;
    
    // Handle file selection
    modal.querySelectorAll('.file-open-item').forEach(item => {
        item.addEventListener('click', () => {
            modal.querySelectorAll('.file-open-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedDocId = parseInt(item.getAttribute('data-doc-id'));
            document.getElementById('open-doc-btn').disabled = false;
        });
        
        item.addEventListener('dblclick', () => {
            selectedDocId = parseInt(item.getAttribute('data-doc-id'));
            openSelectedDocument(selectedDocId);
            modal.remove();
        });
    });
    
    // Handle Open button
    document.getElementById('open-doc-btn').addEventListener('click', () => {
        if (selectedDocId) {
            openSelectedDocument(selectedDocId);
            modal.remove();
        }
    });
}

// Open selected document
function openSelectedDocument(docId) {
    const doc = dataGraph.documents.find(d => d.id === docId);
    if (doc) {
        currentWordDoc = { 
            filename: doc.name, 
            content: doc.content, 
            isNew: false,
            docId: doc.id 
        };
        document.getElementById('word-editor').innerHTML = doc.content;
        updateWordDocTitle();
    }
}

// Save Word document
function saveWordDocument() {
    const editor = document.getElementById('word-editor');
    currentWordDoc.content = editor.innerHTML;
    
    if (currentWordDoc.isNew || !currentWordDoc.filename || currentWordDoc.filename === 'Untitled.docx') {
        // Prompt for filename
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">Save Document</div>
                <div class="modal-body">
                    <label for="doc-filename">Document name:</label>
                    <input type="text" id="doc-filename" value="${currentWordDoc.filename}" placeholder="Enter document name">
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-primary" id="save-doc-btn">Save</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const filenameInput = document.getElementById('doc-filename');
        filenameInput.select();
        
        document.getElementById('save-doc-btn').addEventListener('click', () => {
            let filename = filenameInput.value.trim();
            if (!filename) {
                alert('Please enter a document name.');
                return;
            }
            
            if (!filename.endsWith('.docx')) {
                filename += '.docx';
            }
            
            saveDocumentToGraph(filename);
            modal.remove();
        });
        
        filenameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('save-doc-btn').click();
            }
        });
    } else {
        // Update existing document
        saveDocumentToGraph(currentWordDoc.filename);
    }
}

// Save document to graph
function saveDocumentToGraph(filename) {
    currentWordDoc.filename = filename;
    currentWordDoc.isNew = false;
    
    // Find if document already exists
    const existingDocIndex = dataGraph.documents.findIndex(d => 
        d.name === filename || (currentWordDoc.docId && d.id === currentWordDoc.docId)
    );
    
    if (existingDocIndex >= 0) {
        // Update existing document
        dataGraph.documents[existingDocIndex].content = currentWordDoc.content;
        dataGraph.documents[existingDocIndex].name = filename;
        currentWordDoc.docId = dataGraph.documents[existingDocIndex].id;
        
        // Update in search index
        miniSearchIndex.discard(dataGraph.documents[existingDocIndex].id);
        miniSearchIndex.add({
            ...dataGraph.documents[existingDocIndex],
            type: 'document'
        });
    } else {
        // Add new document
        const newDoc = {
            id: dataGraph.documents.length + 1,
            name: filename,
            type: 'word',
            content: currentWordDoc.content
        };
        dataGraph.documents.push(newDoc);
        currentWordDoc.docId = newDoc.id;
        
        // Add to search index
        miniSearchIndex.add({ ...newDoc, type: 'document' });
    }
    
    updateWordDocTitle();
    
    // Refresh Files app if it's open
    if (document.getElementById('files-window').style.display !== 'none') {
        renderFiles();
    }
}

// Setup Spreadsheet
function setupSpreadsheet() {
    const newBtn = document.getElementById('sheet-new');
    const openBtn = document.getElementById('sheet-open');
    const saveBtn = document.getElementById('sheet-save');
    const aiToggle = document.getElementById('sheet-ai-toggle');
    const aiPane = document.getElementById('sheet-ai-pane');
    const cellInput = document.getElementById('cell-content-input');
    const cellLabel = document.getElementById('current-cell-label');

    newBtn.addEventListener('click', () => {
        currentSpreadsheet = { filename: 'Untitled.xlsx', cells: {} };
        renderSpreadsheet();
    });

    openBtn.addEventListener('click', () => {
        openApp('files');
    });

    saveBtn.addEventListener('click', () => {
        alert(`Spreadsheet saved as ${currentSpreadsheet.filename}`);
    });

    aiToggle.addEventListener('click', () => {
        const isVisible = aiPane.style.display === 'flex';
        aiPane.style.display = isVisible ? 'none' : 'flex';
    });

    // Setup spreadsheet AI chat
    setupChatInterface('sheet', 'spreadsheet');

    // Cell input handling
    cellInput.addEventListener('change', () => {
        const value = cellInput.value;
        currentSpreadsheet.cells[selectedCell] = value;
        updateCellDisplay(selectedCell);
    });

    // Initial render
    renderSpreadsheet();
}

function renderSpreadsheet() {
    const container = document.getElementById('spreadsheet-container');
    const table = document.createElement('table');
    table.className = 'spreadsheet-table';

    // Header row
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th')); // Empty corner cell
    for (let col = 0; col < 6; col++) {
        const th = document.createElement('th');
        th.textContent = String.fromCharCode(65 + col); // A, B, C, D, E, F
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // Data rows
    for (let row = 1; row <= 15; row++) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = row;
        tr.appendChild(th);

        for (let col = 0; col < 6; col++) {
            const td = document.createElement('td');
            const cellId = String.fromCharCode(65 + col) + row;
            td.setAttribute('data-cell', cellId);
            td.tabIndex = 0;

            const cellValue = currentSpreadsheet.cells[cellId] || '';
            td.textContent = evaluateCell(cellValue);

            td.addEventListener('click', () => selectCell(cellId));
            td.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    td.contentEditable = true;
                    td.focus();
                }
            });
            td.addEventListener('blur', () => {
                if (td.contentEditable === 'true') {
                    currentSpreadsheet.cells[cellId] = td.textContent;
                    td.contentEditable = false;
                    updateCellDisplay(cellId);
                }
            });

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
}

function selectCell(cellId) {
    // Remove previous selection
    document.querySelectorAll('.spreadsheet-table td').forEach(td => {
        td.classList.remove('selected');
    });

    // Add new selection
    const cell = document.querySelector(`td[data-cell="${cellId}"]`);
    if (cell) {
        cell.classList.add('selected');
        selectedCell = cellId;
        document.getElementById('current-cell-label').textContent = cellId;
        document.getElementById('cell-content-input').value = currentSpreadsheet.cells[cellId] || '';
    }
}

function updateCellDisplay(cellId) {
    const cell = document.querySelector(`td[data-cell="${cellId}"]`);
    if (cell) {
        const value = currentSpreadsheet.cells[cellId] || '';
        cell.textContent = evaluateCell(value);
    }
}

function evaluateCell(value) {
    if (!value || !value.startsWith('=')) {
        return value;
    }

    try {
        // Simple formula evaluation
        let formula = value.substring(1);
        
        // Replace cell references with their values
        formula = formula.replace(/([A-F])(\d+)/g, (match, col, row) => {
            const cellId = col + row;
            const cellValue = currentSpreadsheet.cells[cellId] || '0';
            return evaluateCell(cellValue);
        });

        // Evaluate the formula
        // eslint-disable-next-line no-eval
        const result = eval(formula);
        return result;
    } catch (e) {
        return '#ERROR';
    }
}

// Setup Email and Calendar
// Setup Email and Calendar
function setupEmailCalendar() {
    const emailTab = document.getElementById('email-tab');
    const calendarTab = document.getElementById('calendar-tab');
    const emailListContainer = document.getElementById('email-list-container');
    const calendarContainer = document.getElementById('calendar-container');
    const emailDetailView = document.getElementById('email-detail-view');
    const calendarEventsView = document.getElementById('calendar-events-view');

    // Tab switching
    emailTab.addEventListener('click', () => {
        emailTab.classList.add('active');
        calendarTab.classList.remove('active');
        emailListContainer.style.display = 'block';
        calendarContainer.style.display = 'none';
        emailDetailView.style.display = 'block';
        calendarEventsView.style.display = 'none';
        renderEmailList();
    });

    calendarTab.addEventListener('click', () => {
        calendarTab.classList.add('active');
        emailTab.classList.remove('active');
        emailListContainer.style.display = 'none';
        calendarContainer.style.display = 'block';
        emailDetailView.style.display = 'none';
        calendarEventsView.style.display = 'block';
        renderCalendar();
    });

    // Don't render on initial load - wait for app to open
}

// Render email list
function renderEmailList() {
    const container = document.getElementById('email-list');
    container.innerHTML = '';

    // Sort emails by date (newest first)
    const sortedEmails = [...dataGraph.emails].sort((a, b) => b.date - a.date);

    sortedEmails.forEach(email => {
        const emailDiv = document.createElement('div');
        emailDiv.className = 'email-item';
        emailDiv.tabIndex = 0;
        emailDiv.setAttribute('role', 'listitem');
        
        const preview = email.body.substring(0, 60) + (email.body.length > 60 ? '...' : '');
        
        emailDiv.innerHTML = `
            <div class="email-item-subject">${email.subject}</div>
            <div class="email-item-from">${email.from}</div>
            <div class="email-item-date">${email.date.toLocaleDateString()}</div>
            <div class="email-item-preview">${preview}</div>
        `;

        emailDiv.addEventListener('click', () => {
            document.querySelectorAll('.email-item').forEach(item => item.classList.remove('selected'));
            emailDiv.classList.add('selected');
            showEmailDetail(email);
        });
        
        emailDiv.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.querySelectorAll('.email-item').forEach(item => item.classList.remove('selected'));
                emailDiv.classList.add('selected');
                showEmailDetail(email);
            }
        });

        container.appendChild(emailDiv);
    });
}

// Show email detail
function showEmailDetail(email) {
    currentEmail = email; // Track current email for AI context
    const container = document.getElementById('email-detail-view');
    container.innerHTML = `
        <div class="email-detail-header">
            <div class="email-detail-subject">${email.subject}</div>
            <div class="email-detail-from">From: ${email.from} &lt;${email.fromEmail}&gt;</div>
            <div class="email-detail-date">${email.date.toLocaleString()}</div>
        </div>
        <div class="email-detail-body">${email.body}</div>
    `;
}

// Calendar state
let currentCalendarDate = new Date();
let selectedCalendarDate = new Date();

// Render calendar
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('calendar-month-year');
    
    if (!grid || !monthYear) {
        console.error('Calendar grid or month-year element not found');
        return;
    }
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthYear.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Clear grid
    grid.innerHTML = '';
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = daysInPrevMonth - i;
        grid.appendChild(day);
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        
        const dayDate = new Date(year, month, i);
        
        // Check if today
        if (dayDate.toDateString() === today.toDateString()) {
            day.classList.add('today');
        }
        
        // Check if selected
        if (dayDate.toDateString() === selectedCalendarDate.toDateString()) {
            day.classList.add('selected');
        }
        
        // Check if has events
        const hasEvents = dataGraph.events.some(event => 
            event.date.toDateString() === dayDate.toDateString()
        );
        if (hasEvents) {
            day.classList.add('has-events');
        }
        
        day.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedCalendarDate = new Date(dayDate);
            renderCalendar();
        });
        
        grid.appendChild(day);
    }
    
    // Next month days
    const totalCells = grid.children.length - 7; // Subtract day headers
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let i = 1; i <= remainingCells; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        grid.appendChild(day);
    }
    
    // Setup navigation
    const prevBtn = document.getElementById('calendar-prev-month');
    const nextBtn = document.getElementById('calendar-next-month');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        };
    }
    
    renderCalendarEvents();
}

// Render calendar events for selected date
function renderCalendarEvents() {
    const container = document.getElementById('calendar-events');
    const header = document.getElementById('selected-date-header');
    
    if (!container || !header) {
        console.error('Calendar events container or header not found');
        return;
    }
    
    if (!selectedCalendarDate) {
        console.error('No selected calendar date');
        return;
    }
    
    header.textContent = selectedCalendarDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const events = dataGraph.events.filter(event => 
        event.date.toDateString() === selectedCalendarDate.toDateString()
    );
    
    if (events.length === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 14px;">No events scheduled</div>';
        return;
    }
    
    container.innerHTML = events.map(event => `
        <div class="calendar-event-item">
            <div class="calendar-event-time">${event.time}</div>
            <div class="calendar-event-title">${event.title}</div>
            <div class="calendar-event-attendees">Attendees: ${event.attendees.join(', ')}</div>
        </div>
    `).join('');
}

// Modal functions (compose email, new event) can be added here if needed

function showComposeEmailModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">Compose Email</div>
            <div class="modal-body">
                <label for="email-to">To:</label>
                <input type="email" id="email-to" placeholder="recipient@example.com">
                
                <label for="email-subject">Subject:</label>
                <input type="text" id="email-subject" placeholder="Email subject">
                
                <label for="email-body">Body:</label>
                <textarea id="email-body" placeholder="Email body"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" onclick="sendEmail()">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function sendEmail() {
    const to = document.getElementById('email-to').value;
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').value;

    if (to && subject && body) {
        const newEmail = {
            id: dataGraph.emails.length + 1,
            from: 'Me',
            fromEmail: 'me@example.com',
            subject: subject,
            body: body,
            date: new Date()
        };
        dataGraph.emails.push(newEmail);
        
        // Re-index for search
        miniSearchIndex.add({ ...newEmail, type: 'email', content: body });
        
        renderEmailList();
        alert('Email sent!');
        document.querySelector('.modal').remove();
    } else {
        alert('Please fill in all fields.');
    }
}

function showNewEventModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">New Calendar Event</div>
            <div class="modal-body">
                <label for="event-title">Title:</label>
                <input type="text" id="event-title" placeholder="Event title">
                
                <label for="event-date">Date:</label>
                <input type="date" id="event-date">
                
                <label for="event-time">Time:</label>
                <input type="time" id="event-time">
                
                <label for="event-attendees">Attendees:</label>
                <input type="text" id="event-attendees" placeholder="Comma-separated names">
                
                <label for="event-description">Description:</label>
                <textarea id="event-description" placeholder="Event description"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" onclick="saveEvent()">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveEvent() {
    const title = document.getElementById('event-title').value;
    const dateStr = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const attendees = document.getElementById('event-attendees').value.split(',').map(a => a.trim());
    const description = document.getElementById('event-description').value;

    if (title && dateStr && time) {
        const newEvent = {
            id: dataGraph.events.length + 1,
            title: title,
            date: new Date(dateStr),
            time: time,
            attendees: attendees,
            description: description
        };
        dataGraph.events.push(newEvent);
        
        // Re-index for search
        miniSearchIndex.add({ ...newEvent, type: 'event', content: description });
        
        renderCalendarList();
        alert('Event created!');
        document.querySelector('.modal').remove();
    } else {
        alert('Please fill in required fields (title, date, time).');
    }
}
