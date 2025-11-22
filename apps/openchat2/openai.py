# OpenAI Shim - Mimics the OpenAI Python SDK interface
# This module wraps WebLLM functionality to provide OpenAI-compatible API

import sys
import asyncio
import js
from pyodide.ffi import to_js

class Message:
    """Represents a chat message"""
    def __init__(self, role, content):
        self.role = role
        self.content = content

class Choice:
    """Represents a completion choice"""
    def __init__(self, message, index=0, finish_reason="stop"):
        self.message = message
        self.index = index
        self.finish_reason = finish_reason

class ChatCompletion:
    """Represents a chat completion response"""
    def __init__(self, choices, model):
        self.choices = choices
        self.model = model
        self.object = "chat.completion"

class ChatCompletions:
    """Handles chat completion requests"""
    
    async def create(self, model, messages, **kwargs):
        """Create a chat completion - now async"""
        # Call the JavaScript WebLLM function
        try:
            # Convert Python messages to JavaScript format
            js_messages = to_js(messages, dict_converter=js.Object.fromEntries)
            
            # Call the async JavaScript function directly with await
            response_text = await js.generateChatCompletion_js(js_messages)
            
            # Convert from JsProxy to Python string if needed
            from pyodide.ffi import JsProxy
            if isinstance(response_text, JsProxy):
                response_text = str(response_text)
            
        except Exception as e:
            # Fallback to simple response if WebLLM fails
            js.appendToTerminal_py(f"WebLLM Error: {str(e)}")
            
            # Try simple fallback
            user_messages = [msg for msg in messages if msg.get('role') == 'user']
            if user_messages:
                last_msg_content = user_messages[-1].get('content', '')
                last_message = str(last_msg_content).lower()
                
                if 'hello' in last_message or 'hi' in last_message:
                    response_text = "Hello! How can I assist you today?"
                elif 'artificial intelligence' in last_message:
                    response_text = "Artificial Intelligence (AI) is the simulation of human intelligence in machines that are programmed to think and learn."
                else:
                    response_text = "I understand your question. The WebLLM model is loading or unavailable, but I'm here to help!"
            else:
                response_text = "Hello! How can I help you today?"
        
        # Create response in OpenAI format
        message = Message(role="assistant", content=response_text)
        choice = Choice(message=message)
        completion = ChatCompletion(choices=[choice], model=model)
        
        return completion

class Chat:
    """Chat API wrapper"""
    def __init__(self):
        self.completions = ChatCompletions()

# Module-level chat instance
chat = Chat()

# Make it available as a module
sys.modules['openai'] = sys.modules[__name__]
