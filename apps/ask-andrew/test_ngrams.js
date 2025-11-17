// Test script to verify N-gram detection logic
const technicalTerms = {
  multiWordTerms: [
    "large language model",
    "language model", 
    "neural network",
    "convolutional neural network",
    "machine learning"
  ]
};

// Sort by word count descending
technicalTerms.multiWordTerms.sort((a, b) => {
  const aWords = a.split(/\s+/).length;
  const bWords = b.split(/\s+/).length;
  return bWords - aWords;
});

function detectPhrases(userQuestion) {
  const lowerQuestion = userQuestion.toLowerCase();
  const detectedPhrases = [];
  const coveredPositions = new Set();
  
  for (const phrase of technicalTerms.multiWordTerms) {
    let searchPos = 0;
    while (true) {
      const pos = lowerQuestion.indexOf(phrase, searchPos);
      if (pos === -1) break;
      
      const phraseEnd = pos + phrase.length;
      let overlaps = false;
      for (let i = pos; i < phraseEnd; i++) {
        if (coveredPositions.has(i)) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        for (let i = pos; i < phraseEnd; i++) {
          coveredPositions.add(i);
        }
        detectedPhrases.push(phrase);
      }
      
      searchPos = pos + 1;
    }
  }
  
  return detectedPhrases;
}

// Test cases
console.log('Test 1: "How does a large language model work?"');
console.log('Detected:', detectPhrases("How does a large language model work?"));
console.log('Expected: ["large language model"] (not "language model")');
console.log();

console.log('Test 2: "What is a convolutional neural network?"');
console.log('Detected:', detectPhrases("What is a convolutional neural network?"));
console.log('Expected: ["convolutional neural network"] (not "neural network")');
console.log();

console.log('Test 3: "Difference between language model and neural network?"');
console.log('Detected:', detectPhrases("Difference between language model and neural network?"));
console.log('Expected: ["language model", "neural network"]');
console.log();

console.log('Test 4: "What is machine learning?"');
console.log('Detected:', detectPhrases("What is machine learning?"));
console.log('Expected: ["machine learning"]');
