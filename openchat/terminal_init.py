# Terminal initialization - includes all necessary code for OpenChat
print("=== OpenChat Terminal Starting ===")

try:
    import sys
    import re
    from typing import List, Dict
    print("✓ Imports successful")
except Exception as e:
    print(f"✗ Import error: {e}")
    raise

print("Initializing WikEd Model...")

# ===== WikEd Model =====
INTENT_PATTERNS = {
    'greeting': [r'\b(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))\b'],
    'goodbye': [r'\b(bye|goodbye|see you|farewell|take care)\b'],
    'thanks': [r'\b(thanks|thank you|thx|appreciate)\b'],
    'name_question': [r'\b(what|who)\s+(is|are)\s+your\s+name\b', r'\bwhat\s+do\s+i\s+call\s+you\b'],
    'capability_question': [r'\bwhat\s+can\s+you\s+do\b', r'\bhow\s+do\s+you\s+work\b', r'\bwhat\s+are\s+you\b'],
    'definition': [r'\b(what|define|explain|describe)\s+(is|are|was|were)\s+', r'\btell\s+me\s+about\b', r'\bwho\s+(is|was|were)\s+']
}

GENERIC_RESPONSES = {
    'greeting': "Hello! How can I help you today?",
    'goodbye': "Goodbye! Have a great day!",
    'thanks': "You're welcome! Is there anything else I can help you with?",
    'name_question': "I'm WikEd, a simple language model. I can help answer questions about various topics using Wikipedia knowledge.",
    'capability_question': "I'm a simple language model that can answer questions about various topics using Wikipedia. Try asking me questions like 'What is artificial intelligence?' or 'Who was Ada Lovelace?'",
    'default': "I'm not sure I understand. Try asking me questions about topics I can look up on Wikipedia."
}

# Removed hardcoded knowledge - using Wikipedia only
FALLBACK_KNOWLEDGE = {}

def predict_intent(text):
    text_lower = text.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return intent
    return 'unknown'

def extract_topic(text):
    stop_words = ['what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 
                  'was', 'were', 'the', 'a', 'an', 'tell', 'me', 'about', 
                  'define', 'explain', 'describe']
    text_lower = text.lower()
    words = re.findall(r'\b\w+\b', text_lower)
    topic_words = [w for w in words if w not in stop_words and len(w) > 2]
    return ' '.join(topic_words)

# ===== OpenAI Shim =====
class Message:
    def __init__(self, role, content):
        self.role = role
        self.content = content
    def __repr__(self):
        return f"Message(role='{self.role}', content='{self.content}')"

class Choice:
    def __init__(self, message, index=0, finish_reason="stop"):
        self.message = message
        self.index = index
        self.finish_reason = finish_reason
    def __repr__(self):
        return f"Choice(index={self.index}, message={self.message}, finish_reason='{self.finish_reason}')"

class ChatCompletion:
    def __init__(self, choices, model="wiked"):
        self.choices = choices
        self.model = model
        self.object = "chat.completion"
        self.created = 0
        self.id = "wiked-" + str(hash(str(choices)))
    def __repr__(self):
        return f"ChatCompletion(id='{self.id}', choices={self.choices})"

class ChatCompletions:
    def create(self, model, messages, temperature=1.0, max_tokens=None, **kwargs):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")
        for msg in messages:
            if not isinstance(msg, dict):
                raise ValueError("Each message must be a dictionary")
            if 'role' not in msg or 'content' not in msg:
                raise ValueError("Each message must have 'role' and 'content' keys")
        
        response_content = self._generate_sync(messages)
        message = Message(role="assistant", content=response_content)
        choice = Choice(message=message, index=0, finish_reason="stop")
        completion = ChatCompletion(choices=[choice], model=model)
        return completion
    
    def _generate_sync(self, messages):
        """Synchronous wrapper for generate_response"""
        user_messages = [msg for msg in messages if msg.get('role') == 'user']
        if not user_messages:
            return "I'm here to help! Ask me a question."
        
        latest_message = user_messages[-1].get('content', '')
        intent = predict_intent(latest_message)
        
        if intent in GENERIC_RESPONSES and intent != 'definition':
            return GENERIC_RESPONSES[intent]
        
        if intent == 'definition' or intent == 'unknown':
            topic = extract_topic(latest_message)
            if topic:
                return self._fetch_wiki_sync(topic)
            else:
                return GENERIC_RESPONSES['default']
        
        return GENERIC_RESPONSES['default']
    
    def _fetch_wiki_sync(self, topic):
        """Fetch from Wikipedia using search API first, then get content"""
        topic_lower = topic.lower().strip()
        
        try:
            from js import XMLHttpRequest
            import json
            
            # Step 1: Search for the topic to find matching pages
            search_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={topic}&limit=5&format=json&origin=*"
            
            xhr = XMLHttpRequest.new()
            xhr.open('GET', search_url, False)
            xhr.send()
            
            if xhr.status == 200:
                search_results = json.loads(xhr.responseText)
                # opensearch returns [query, [titles], [descriptions], [urls]]
                if len(search_results) >= 2 and len(search_results[1]) > 0:
                    # Get the first (best) match
                    best_match = search_results[1][0]
                    
                    # Step 2: Fetch the content for this page
                    content_url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={best_match}&origin=*"
                    
                    xhr2 = XMLHttpRequest.new()
                    xhr2.open('GET', content_url, False)
                    xhr2.send()
                    
                    if xhr2.status == 200:
                        data = json.loads(xhr2.responseText)
                        pages = data.get('query', {}).get('pages', {})
                        
                        for page_id, page_data in pages.items():
                            if page_id != '-1' and 'extract' in page_data:
                                extract = page_data['extract']
                                if extract and extract.strip():
                                    # Get first paragraph (or first 3 sentences if no clear paragraph break)
                                    paragraphs = extract.split('\n\n')
                                    first_para = paragraphs[0] if paragraphs else extract
                                    
                                    # If paragraph is too long, get first 3 sentences
                                    sentences = first_para.split('. ')
                                    sentences = [s.strip() for s in sentences if s.strip()]
                                    if sentences:
                                        result = '. '.join(sentences[:3])
                                        if not result.endswith('.'):
                                            result += '.'
                                        return result
        except Exception as e:
            pass
        
        return f"I don't have detailed information about '{topic}' at the moment. Try asking about different topics."

class Chat:
    def __init__(self):
        self.completions = ChatCompletions()

class OpenAI:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.chat = Chat()

# Create module-level interface
chat = Chat()

# Create a module-like object
class OpenAIModule:
    chat = chat
    OpenAI = OpenAI

# Register as openai module
openai_module = OpenAIModule()
try:
    sys.modules['openai'] = openai_module
    print("✓ openai module registered")
except Exception as e:
    print(f"✗ Module registration error: {e}")

print()
print("=" * 50)
print("OpenChat Terminal Ready!")
print("=" * 50)
print("Write your code in the editor above and click Run")
print()

# Enable the buttons now that PyScript is ready
from pyscript import document
try:
    document.getElementById("runBtn").disabled = False
    document.getElementById("saveBtn").disabled = False
    document.getElementById("newBtn").disabled = False
except:
    pass

# Listen for custom events to execute code
from pyscript import when

@when("click", "#runBtn")
async def handle_run(event):
    """Handle run button clicks - this runs in the worker"""
    event.preventDefault()
    event.stopPropagation()
    
    # Set focus to terminal for input
    try:
        terminal = document.querySelector(".xterm-helper-textarea")
        if terminal:
            terminal.focus()
    except:
        pass
    
    # Get the code from the editor
    editor = document.getElementById("codeEditor")
    if editor:
        code = editor.value
        if code and code.strip():
            print()
            print(">" * 50)
            try:
                # Execute the code directly
                exec(code, globals())
            except Exception as e:
                print(f"Error: {e}")
                import traceback
                traceback.print_exc()
            print(">" * 50)

