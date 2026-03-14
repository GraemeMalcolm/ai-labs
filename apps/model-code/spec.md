# Model Coder

This is a spec for a Web app named Model Coder. The app is designed as a hands-on learning environment in which students can learn common Python syntax for using the OpenAI library to chat with a model.

The app does not use the official openai Python library; but instead provides a set of Python "wrapper" classes that run in PyScript within the browser, and use JavaScript Interopt to call wllama interfaces and submit chatml-based prompts to a local SMOLLM2 model. The wrapper classes enable users to write Python code as if using the real openai classes.

Overall, the app must be a useful "sandbox" environment in which learners can run openai-compatible Python code against a local smollm2 model in wllama in the browser.

## Technical Requirements

The app must consists of:
 - A single HTML file for the app interface
 - A single CSS file for visual styles
 - An app.js JavaScript file for the app UI, and a separate llm.js file to handle chatml-based interactions with the smollm2 model running in wllama.
 - A single nopenai.py file containing the PyScript-supported Python classes that emulate the openai library and abstract the code in the llm.js file. 

 The app must run completely in-browser when hosted in a GitHub Pages site - with no server-side dependencies or additional client configuration.

 ## Interface and functionality

 The app must present users with a Python editor in th top half of the page. The editor should use the PyScript editor (https://docs.pyscript.net/2026.3.1/user-guide/editor/), but should be used ONLY for editing code.

 When the user clicks a button to run their code, the code should be saved "internally" and run in a PyScript terminal (https://docs.pyscript.net/2026.3.1/user-guide/terminal/) under the editor. This allows for interactive use of "print" and "input" statements within the terminal.

### Python functionality in PyScript

 The PyScript environment should include common Python packages like numpy, pandas, and so on; and also the locally implemented "openai" library, which is based on the classes in the nopenai.py file. These classes should support common openai syntax for chatting with a model through both the Responses API and the ChatCompletions API as described in the openai documentation examples at https://pypi.org/project/openai/. At a minimum, it must support the necessary classes and methods for students to use it to complete the coding tasks in the lab at https://microsoftlearning.github.io/mslearn-ai-studio/Instructions/Exercises/03-foundry-sdk.html.
 
 The constructor of the openai class requires that users provide the following parameters:
 - *base_url* (which must have the value "https://localmodel)
 - *api_key* (which can be any string)

 The ChatCompletions API supports a *chat.completions.create* method that includes:
 - a *model* parameter (which must have the value "localmodel") 
 - a *messages* parameter that can contain a JSON formatted collection of role-specific messages (for *developer*, *user*, and *assistant* roles)

 The Responses API supports a *responses.create* method that inckudes:
 - a *model* parameter (which must have the value "localmodel") 
 - an optional *insructions* parameter that can contain a string value for a system prompt
 - an *input* parameter that contain a string value for a user prompt, or a JSON fomatted collection of messages in the same format as the ChatCompletions API.
 - an optional *stream* parameter with a default value of *false*. When set to *true*, responses from the model should be streamed incrementally rather than the defauly behavior of waiting for the full response.
 - an optional *previous_response_id* parameter that can contain a unique identifier fo a previous response to be includes in the prompt.

 ### Wllama and smollm2 implementation

 The wllama package should be imported using cdn.

The smollm2 model should be downloaded and loaded on startup (with a "loading status" indicator) from ngxson/SmolLM2-360M-Instruct-Q8_0-GGUF.

The prompts to the model should be based on the Python openai code specified by the user, but translated to chatml format to optimize for the small model,

Use the existing code in the /apps/chat-playground app as a guide for how to get a working implementation of wllama and the smollm2 model.


## Initial sample code

When the app first loads, there should be no sample code loaded.

The first sample listed should be "Simple chat - Responses API", and it should include the following code:

```python
# import namespace
from openai import OpenAI


def main(): 

    try:
        # Configuration settings 
        endpoint = "https://localmodel"
        api_key = "key123"
        model = "localmodel"

        # Initialize the OpenAI client
        openai_client = OpenAI(
            base_url=endpoint,
            api_key=api_key
        )
        
        # Loop until the user wants to quit
        while True:
            input_text = input('\nEnter a prompt (or type "quit" to exit): ')
            if input_text.lower() == "quit":
                break
            if len(input_text) == 0:
                print("Please enter a prompt.")
                continue

            # Get a response
            response = openai_client.responses.create(
                        model=model_deployment,
                        instructions="You are a helpful AI assistant that answers questions and provides information.",
                        input=input_text
            )
            print(response.output_text)
            

    except Exception as ex:
        print(ex)

if __name__ == '__main__': 
    main()
```