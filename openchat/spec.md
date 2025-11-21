This is a spec for an app named OpenChat in which a user can edit and run Python code to build a chat application based on openai syntax and a simple model named WikEd.

The goal of the app is to provide an environment where aspiring AI developers can learn to use the openai Python SDK syntax to build a simple chatbot, including submitting system, user, and assistant messages (including conversation history) and processing the responses.

The app should consist purely of an HTML age with a JavaScript file for the core web page functionality and CSS file for formatting. Additionally, he app can include Python code files as necessary to implement custom Python modules. The Python programming interface for the user should be run in PyScript, with a user interface that consists of a code editor in the top half of the page, and the PyScript terminal in the bottom half of the page. The terminal must be used to run the user's Python code, which must include output via "print" statements as well as input via "input" statements.

The Python implementation should include a module that behaves like a generative AI model, but which is actually implemented using Python libraries like SpaCy, IntentClassifier, and Wikipedia to respond appropriately to use input. The model should analyze the input in the latest user prompt to predict the intent. In the case of simple intents like greetings, goodbyes, thankyous, or questions about the model itself (such as "what is your name?"), the model should return an appropriate generic response (such as "Hello, how can I help?", "Goodbye!", "You're welcome!", or "I'm a simple language model. Try asking me simple questions like 'What is Artificial Intelligence?' or 'Who was Ada Lovelace?'"). For more complex intents, like asking the model to define or explain something, the code should extract entities from the prompt and then use Wikipedia to find a relevant response based articles that match the most keywords

Users should be able to:

- Create new Python scripts and "save" them in a virtual folder in the app.
- Edit their Python scripts in the top pane.
- Write Python code that uses a custom module that implements the same Python interfaces as the openai package, but which actually submits prompts to the WikEd model and returns the response.
- Run the scripts in the terminal pane at the bottom of the page.

Visually, the app should be clean and simple, and resemble the Monaco code editor interface with a dark theme.
