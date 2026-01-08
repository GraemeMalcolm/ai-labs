This is a specification for a web application named **Text Analyzer**, in which the user can type or upload text and perform the following analysis tasks:

- **Analyze sentiment**: Scoring the text to classify it as *positive* or *negative*.
- **Extract key phrases**: Identify words and phrases in the text that are important to understanding its overall meaning.
- **Extract named entities**: Identify the names of people, places, organizations, and time-periods (such as dates, days, months, or years) in the text.
- **Summarize text**: Create a shorter version of the text that encapsulates the main points.

## Technical requirements

- The app should consist of a single HTML page with a single JavaScript file and a single CSS file.
- The app can import JavaScript packages, but cannot rely on any web-based services - all code must run locally in the browser.
- The user interface must include ARIA accessibility support be navigable using the keyboard with a logical tab order.
- The app must mitigate any cross-scripting or code injection risks - for example by escaping HTML input.

## Preferred approach

The app should use functionality from the following packages:

- Use the affin-165 word list (https://github.com/words/afinn-165) to implement sentiment analysis.
- Use the retext-keywords package (https://github.com/retextjs/retext-keywords) to extract key words and phrases.
- Use wink-nlp (https://www.npmjs.com/package/wink-nlp), compromise.js (https://www.npmjs.com/package/compromise), or nlpjs (https://www.npmjs.com/package/@nlpjs/basic) to implement named entity extraction.
- Use TextRank (https://www.jsdelivr.com/package/npm/textrank) to implement text summarization.
- 