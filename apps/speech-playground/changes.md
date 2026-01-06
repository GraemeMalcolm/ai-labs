We're going to change the application from a general chat playground to a Speech playground in which the user can submit spoken prompts, which are sent to the Phi LLM or Wikipedia search API (depending on the app model configuration) to generate a spoken response.

Retain the current application functionality:
- Initialize by downloading the Phi 3 LLM model for use in WebLLM, and revert to Wikipedia mode if the model fails to load.
- Allow users to explicitly select the "None" mode to use Wikipedia mode.
- Allow the user to speak to the app and use the spoken input as a prompt.
- Vocalize the response using the text-to-speech with the selected voice.

Make the following changes:
- Remove the image classification functionality - so no need for the option to load the MOBILENET model or any of the code or UI elements used to configure or upload images.
- Remove the "Parameters" button and any code used to configure LLM parameters.
- Remove the Tools section from the navigation pane on the left, and any code used to support uploading a file or using it in the system prompt.
- Set the "Instructions" text in the UI to "You are a helpful AI assistant that answers spoken questions with vocalized responses." and set the system prompt in the code to be the Instructions text with " IMPORTANT: Make your responses brief and to the point."
- Enable text-to-speech and speech-to-text by default, and list the available voices in a drop-down list in the navigation pane, under the Model drop-down and Instructions text box.
- In the chat pane, replace the initial speech-bubble icon and "What do you want to chat about?" heading with a purple circle and the text "Let's talk".
- Remove the "Settings" button the chat pane and the associated modal. 
- At the bottom of the chat pane, remove the textbox for prompts and associated buttons, and replace them with a single purple "Start" button. When clicked, this should activate the microphone so the user can speak (like the current microphone button does) and use speech-to-text to provide the prompt. The "Start" button should change to display a microphone icon, and a new "X" button should be displayed to the right of the Start button so the user can cancel the speech interaction. When the user has finished speaking, the purple circle in the chat pane should pulse, and the "Let's talk" heading should change to "Processing..." while the response is retrieved from the model (or Wikipedia if the None model is selected). Then, when the entire response has been retrieved, the heading should change to "Speaking..." as the response is played using text-to-speech. When spoken response has completed, or if the user clicks the "X" button after the response has been retrieved but before the spoken output has finished, the Microphone button" should revert to saying "Start", the "X" button should disappear, and the text of the conversation prompt and response should be displayed in the chat pane.
- If an error occurs when using the speech-to-text functionality because the server can't be reached (which can happen when using Microsoft Edge on ARM-based devices), display a modal explaining the problem and allowing the user to type the prompt as an alternative.