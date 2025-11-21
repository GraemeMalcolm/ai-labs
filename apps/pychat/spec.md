This is a spec for an app named PyChat in which a user can edit and run Python code to build a chat application.

The app should consist purely of an HTML age with a JavaScript file for the app functionality and CSS file for formatting. Additionally, he app can include Python code files as necessary to implement custom Python modules.

The app should use WebLLM to load a Microsoft Phi 3 model. The user should then be able to enter, edit, and run Python code that uses a custom module that implement the same Python interfaces as the openai package, but which actually acts as a wrapper around JavaScript interop code to chat with the WebLLM model. The user must be able to write code that submits messages to the model and process the responses using the same syntax they would use for openai, including iteratively appending messages to create conversation history in a loop.

Visually, the app should have a text area at the top of the page that provides the code editing interface, and a PyScript terminal underneath that provides a console to display the code output and accept user input. Users should be able to:

- Create new Python scripts and "save" them in a virtual folder in the app.
- Edit their Python scripts in the top pane.
- Run the scripts in the terminal pane at the bottom of the page by entering "python {filename.py}.
