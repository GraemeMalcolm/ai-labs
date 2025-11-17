# From Bag of Words to Embeddings

## Bag-of-Words (BoW)

BoW is one of the earliest and simplest ways to represent text numerically. It treats each document as a multiset of its words, ignoring grammar and word order.

How It Works:

- Build a vocabulary of all unique words across the corpus.
- Represent each document as a vector of word counts (or binary presence).

Example:
- Corpus: ["The cat sat", "The dog barked"]
- Vocabulary: ["the", "cat", "sat", "dog", "barked"]
- Vectors:
    - Doc1: [1, 1, 1, 0, 0]
    - Doc2: [1, 0, 0, 1, 1]

Limitations:

- No context: “dog bites man” and “man bites dog” are identical.
- Sparse vectors: high-dimensional and inefficient.
- Doesn’t capture semantics or word relationships.

Use Cases:
- Simple classifiers (e.g., Naive Bayes, SVM)
- Baseline models for text classification

## N-grams

N-grams capture contiguous sequences of N words, adding some notion of word order and local context.

Types:

- Unigrams: single words
- Bigrams: two-word sequences (“New York”)
- Trigrams: three-word sequences (“I love pizza”)

How It Works:
1. Slide a window of size N across the text.
2. Count frequency of each N-gram.

Can be combined with BoW to form richer features.

Tradeoffs:

- Captures local syntax (e.g., “not good” vs. “good”).
- Still sparse and brittle—misses long-range dependencies.
- Explodes feature space with larger N.

Use Cases:

- Spam detection
- Simple language modeling (pre-neural era)
- Phrase-based search

## Static Word Embeddings (Word2Vec, GloVe)

Word embeddings map words to dense, low-dimensional vectors that capture semantic relationships. Unlike BoW, embeddings preserve meaning and similarity.

Word2Vec:

- Skip-gram: Predicts context words from a target word.
- CBOW: Predicts target word from surrounding context.
- Learns embeddings by maximizing co-occurrence prediction.

GloVe:

- Global Vectors for Word Representation.
- Uses matrix factorization of word co-occurrence statistics.
- Embeddings reflect global corpus structure.

Properties:

- Similar words have similar vectors.
- Supports vector arithmetic: “king” - “man” + “woman” ≈ “queen”
- Embeddings are static—same vector for “bank” in all contexts.

Use Cases:

- Semantic similarity
- Clustering and visualization
- Input to downstream models

## Limitations of Static Embeddings

- Context Insensitivity: “Apple” in “apple pie” vs. “Apple Inc.” = same vector.
- Cannot disambiguate polysemy or handle sarcasm, idioms, or negation.
- Corpus Dependence: Embeddings reflect biases in training data.
- Rare words may be poorly represented.
- No Sentence-Level Meaning
- Embeddings are word-level only.
- Cannot represent full sentence semantics or grammar.