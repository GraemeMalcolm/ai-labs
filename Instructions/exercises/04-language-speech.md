---
lab:
    title: 'Explore AI natural language processing and speech'
    description: 'Use Ai to analyze text, and experience speech-to-text and text-to-speech capabilities with a generative AI model.'
---

# Explore AI speech

In this exercise, you'll use a chat playground to interact with a generative AI model using speech. You'll explore speech-to-text (STT) and text-to-speech (TTS) functionality.

This exercise should take approximately **15** minutes to complete.

## Chat with a model

Let's start by chatting with a generative AI model. In this exercise, we'll use the **Microsoft Phi 3 Mini model**; a small language model that is useful for general chat solutions in low bandwidth scenarios. The solution also uses Web Speech APIs for speech recognition and synthesis.

> **Note**: The model will run in your browser, on your local computer. Performance may vary depending on the available memory in your computer and your network bandwidth to download the model. 

1. In a web browser, open the **[Chat Playground](https://graememalcolm.github.io/ai-labs/apps/chat-playground/){:target="_blank"}**.
1. Wait for the model to download and initialize.

    > **Tip**: The first time you open the chat playground, it may take a few minutes for the model to download. Subsequent downloads will be faster.

1. When the model is ready, enter the following prompt:

    ```
    Summarize this hotel review as a single, short paragraph:
    
    ---
    Review Title: Good Hotel and staff
    Hotel: The Royal Hotel, London, UK
    Review Date: March 2nd 2025
    
    Clean rooms, good service, great location near Buckingham Palace and Westminster Abbey, and so on. We thoroughly enjoyed our stay. The courtyard is very peaceful and we went to a restaurant which is part of the same group and is Indian ( West coast so plenty of fish) with a Michelin Star. We had the taster menu which was fabulous. The rooms were very well appointed with a comfortable bedroom and enormous bathroom.

    The hotel staff were very friendly and helpful. In particular, George at the front desk had some great recommendations for activities and sights that made our visit even more enjoyable.

    Thoroughly recommended.
    ---
    
    ```

    The response should summarize the review text.

1. Submit the following prompt:

    ```
    List the named entities you detect in this review.
    ```

    The response should identify entities such as places, dates, and people mentioned in the review.

1. Submit the following prompt:

    ```
    Classify the sentiment of the review as "positive", "negative", or "neutral".
    ```

    The response should indicate the sentiment of the review.

## Use speech-to-text for voice recognition

Speech-to-text (STT) is an AI technique that transforms audible speech into text. A common use for this is to implement voice recognition solutions in which a user can interact with an AI application by talking to it.

1. At the top-right of the **Chat history** pane, use the **Settings** (**&#x2699;**) button to view the chat capabilities options.
1. In the **Speech** section, enable **Speech to text**. Then save the changes.

   ![Screenshot of the Speech to text option.](./media/speech-01.png)

    Under the chat interface, a **Voice input** (**🎙**) button is enabled.

1. Click the **Voice input** button, and if prompted, allow access to your computer's microphone. Then after the tone, say something like "*What should I consider when choosing a hotel in London?*".

    Your speech should be converted to text and entered as a prompt, to which the model responds.

## Use text-to-speech for voice synthesis

For a fully functional speech-capable AI agent, the conversation should flow in both directions. You can use text-to-speech (TTS) to have the agent vocalize its responses.

1. At the top-right of the **Chat history** pane, use the **Settings** (**&#x2699;**) button to re-open the chat capabilities options.
1. In the **Speech** section, enable **Text to speech**. Then explore the available voices, trying them out with the voice sample. When you have chosen a voice for your agent, save the changes.

   ![Screenshot of the Text to speech option.](./media/speech-02.png)

    The chat restarts after enabling text to speech.

1. Use the **Voice input** button to speak to the agent (try something like "*Suggest three tourist activities in London*")

    > **Note**: The agent may take longer to respond when text to speech is enabled.

## Summary

in this exercise, you explored the use of speech-to-text and text-to-speech with a generative AI model in a chat playground. 

Some models are *multimodal*, and natively support audio input; while others rely on speech-to-text and text-to-speech for spoken conversations. Azure AI Foundry supports multimodal models, and also provides Azure AI Speech; which includes a wide range of services you can use to build speech-based AI apps and agents.
