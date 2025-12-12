This is a spec for an app named OpenChat in which a user can edit and run Python code to build a chat application. The goal of the app is to provide an environment where aspiring AI developers can learn to use the openai Python SDK syntax to build a simple chatbot, including submitting system, user, and assistant messages (including conversation history) and processing the responses.

The app should consist purely of an HTML age with a JavaScript file for the app functionality and CSS file for formatting. Additionally, he app can include Python code files as necessary to implement custom Python modules.

The app must run in the broeser when hosted in a GitHub Pages site.

The app should use WebLLM to load a Microsoft Phi 2 model (Phi-2-q4f16_1-MLC). The user should then be able to enter, edit, and run Python code that uses a custom module that implement the same Python interfaces as the openai package, but which actually acts as a wrapper around JavaScript interop code to chat with the WebLLM model. The user must be able to write code that submits messages to the model and process the responses using the same syntax they would use for openai, including iteratively appending messages to create conversation history in a loop.

Visually, the app should have a text area at the top of the page that provides the code editing interface, and a PyScript terminal underneath that provides a terminal to display the code output and accept user input. Visually, the app should be clean and simple, and resemble the Monaco code editor interface with a dark theme.

Users should be able to:

- Create new Python scripts and "save" them in a virtual folder in the app.
- Edit their Python scripts in the top pane.
- Run the scripts in the terminal pane at the bottom of the page by entering "python {filename.py} (just like in a real Python terminal).
- Interact with the running python script in the terminal pane (for example, to enter text for an input() call)

Here's an example of Python code that the user should be able to enter and run the app:

```
# Import the openai module (a shim that behaves like the openai SDK)
import openai

# Create a simple chat
messages = [
    {"role": "system", "content": "You are a helpful assistant."}
]

while True:
    # Get input text
    print("Enter the prompt (or type 'quit' to exit)")
    input_text = input("> ")
    if input_text.lower() == "quit":
        break
    if len(input_text) == 0:
        print("Please enter a prompt.")
        continue
            
    # Get a chat completion
    messages.append({"role": "user", "content": input_text})

    response = openai.chat.completions.create(
        model="wiked",
        messages=messages
    )

    completion = response.choices[0].message.content
    print("\n" + completion + "\n")
    messages.append({"role": "assistant", "content": completion})

```
