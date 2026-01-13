---
lab:
    title: 'Get started with computer vision in Microsoft Foundry'
    description: 'Use generative AI models to interpret and generate visual data.'
---

# Get started with computer vision in Microsoft Foundry

In this exercise, you'll use generative AI models in Microsoft Foundry to work with visual data.

This exercise should take approximately **30** minutes to complete.

## Create a Microsoft Foundry project

Microsoft Foundry uses *projects* to organize models, resources, data, and other assets used to develop an AI solution.

1. In a web browser, open [Microsoft Foundry](https://ai.azure.com){:target="_blank"} at `https://ai.azure.com` and sign in using your Azure credentials. Close any tips or quick start panes that are opened the first time you sign in, and if necessary use the **Foundry** logo at the top left to navigate to the home page.
1. If it is not already enabled, in the tool bar the top of the page, enable the **New Foundry** option. Then, if prompted, create a new project with a unique name of your choice, using the default options. After creating or selecting a project in the new Foundry portal, it should open in a page similar to the following image:

    ![Screenshot of the AI Foundry project home page.](./media/foundry-project.png)

## Use a generative AI model to analyze images

Computer vision models enable AI systems to interpret image-based data, such as photographs, videos, and other visual elements. In this exercise, you'll explore how the developer of an AI agent to help aspiring chefs could use a vision-enabled model to interpret images of ingredients and suggest relevant recipes.

1. In a new browser tab, download **[images.zip](https://raw.githubusercontent.com/GraemeMalcolm/ai-labs/refs/heads/main/data/images.zip){:target="_blank"}** to your local computer.
1. Extract the downloaded archive in a local folder to see the files it contains. These files are the images you will use AI to analyze.
1. Return to the browser tab containing your Microsoft Foundry project. Then, in the **Start building** menu, select **Browse models** to view the Microsoft Foundry model catalog.
1. Search for and deploy the `gpt-4.1-mini` model using the default settings. Deployment may take a minute or so.
1. When the model has been deployed, view the model playground page that is opened, in which you can chat with the model.

    ![Screenshot of the model playground.](./media/model-playground.png)

1. Use the button at the bottom of the left navigation pane to hide it and give yourself more room to work with.
1. In the pane on the left, set the **Instructions** to `You are an AI cooking assistant who helps chefs with recipes.`
1. In the chat pane, use the **Upload image** button to select one of the images you extracted on your computer. The image is added to the prompt area.

    You can select the image you have added to view it.

   ![Screenshot of a chat with an image in a prompt.](./media/image-input.png)

1. Enter prompt text like `What recipes can I use this in?`and submit the prompt, which contains both the uploaded image and the text.
1. Review the response, which should include relevant recipe suggestions for the image you uploaded.

   ![Screenshot of the chat app with the response to an image-based prompt.](./media/image-analysis.png)

1. Submit prompts that include the other images, such as `How should I cook this?` or `What desserts could I make with this?`

### View code

## Use a generative AI model to create new images

So far you've explored the ability of a generative AI model to process visual input. Now let's suppose we want some appropriate images on a web site to support the AI chef agent. Let's see how a model can generate visual output.

1. Use the "back" arrow next to the **gpt-4.1-mini** header (or select the **Models** page in the navigation pane) to view the model deployments in your project.
1. Select **Deploy a base model** to open the model catalog.
1. In the **Collections** drop-down list, select **Direct from Azure**, and in the **Inference tasks** drop-down list, select **Text to image**. Then view the available models for image generation.

   ![Screenshot of image-generation models in the model catalog.](./media/image-generation-models.png)

    > **Note**: The available models in your subscription may vary. Additionally, the ability to deploy models depends on regional availabilty and quota.

1. Select the **FLUX-1-Kontext-pro** model and deploy it.

    *If you are unable to deploy the model in your subscription, try one of the other image-generation models.*

1. When the model has been deployed, it opens in the image playground.
1. Enter a prompt describing a desired image; for example `A chef preparing a meal.` Then review the generated image.

   ![Screenshot of the image playground with a generated image.](./media/generated-image.png)

### View code

## Use a generative AI model to create video

In addition to static images, you may want to include video content on the AI Chef agent web site.

1. Use the "back" arrow next to the image-generation model header (or select the **Models** page in the navigation pane) to view the model deployments in your project.
1. Select **Deploy a base model** to open the model catalog.
1. In the **Collections** drop-down list, select **Direct from Azure**, and in the **Inference tasks** drop-down list, select **TVideo generation**. Then view the available models for video generation.

   ![Screenshot of video-generation models in the model catalog.](./media/video-generation-models.png)

    > **Note**: The available models in your subscription may vary. Additionally, the ability to deploy models depends on regional availabilty and quota.

1. Select the **Sora** model and deploy it.

    *If you are unable to deploy the model in your subscription, try one of the other image-generation models.*

1. When the model has been deployed, it opens in the video playground.
1. Enter a prompt describing a desired video; for example `A chef in a busy kitchen.` Then review the generated image.

   ![Screenshot of the video playground with a generated video.](./media/generated-video.png)

### View code

## Summary

in this exercise, you explored the use of vision-enabled models in Microsoft Foundry, including models that can accept vision data as input, models that can generate static images based on text descriptions, and models that can generate video.
