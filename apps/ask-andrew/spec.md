This is a spec for a chat application named "Ask Andrew" that answers user questions about the topics indexed in the JSON files.

The app should use WebLLM with the Microsoft Phi-3-mini-4k-instruct-q4f16_1-MLC model to enable language understanding and generation for the chat application.

The app should have a typical chat interface with a box for users to enter prompts. The conversation history should be shown as speech bubbles between "Andrew" (the AI agent) and the user.

Use the existing technique in the app in /chat-playground to initialize WebLLM and download the model; showing progress as it is downloaded.

Create an appropriate system prompt for the conversation, and retain conversation history to ensure follow-up questions have context. Give the user a way to restart the conversation to reset the chat history.

