from js import webllmChat
import json

class ChatCompletion:
    @staticmethod
    async def create(model, messages, **kwargs):
        # Convert messages to JSON string for JS
        messages_json = json.dumps(messages)
        
        # Call the exposed JS function
        response_json = await webllmChat(messages_json)
        
        # Parse the response back to a dict
        response_dict = json.loads(response_json)
        
        # Wrap in a simple object structure to mimic OpenAI response object
        return OpenAIResponse(response_dict)

class OpenAIResponse:
    def __init__(self, data):
        self.choices = [Choice(c) for c in data.get('choices', [])]

class Choice:
    def __init__(self, data):
        self.message = Message(data.get('message', {}))

class Message:
    def __init__(self, data):
        self.content = data.get('content', '')
        self.role = data.get('role', '')

# Export at module level
ChatCompletion = ChatCompletion
