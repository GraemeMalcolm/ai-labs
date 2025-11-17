import os
import json
import re
import math
from pathlib import Path
from collections import Counter

def extract_headings_and_content(markdown_file):
    """Extract headings and their associated content from markdown files."""
    with open(markdown_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove zone pivots and video sections (not useful for text search)
    content = re.sub(r'::: zone pivot="video".*?::: zone-end', '', content, flags=re.DOTALL)
    content = re.sub(r'::: zone pivot="text"', '', content)
    content = re.sub(r'::: zone-end', '', content)
    content = re.sub(r'>\[!VIDEO.*?\]', '', content)
    content = re.sub(r'> \[!NOTE\].*?(?=\n\n|\n#|$)', '', content, flags=re.DOTALL)
    content = re.sub(r'> \[!TIP\].*?(?=\n\n|\n#|$)', '', content, flags=re.DOTALL)
    
    # Remove markdown image tags (e.g., ![alt text](image.png))
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
    
    # Extract sections with headings
    sections = []
    lines = content.split('\n')
    current_section = None
    current_content = []
    
    for line in lines:
        # Check for markdown headings
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            # Save previous section if it exists
            if current_section:
                sections.append({
                    'heading': current_section,
                    'content': '\n'.join(current_content).strip()
                })
            # Start new section
            level = len(heading_match.group(1))
            current_section = heading_match.group(2).strip()
            current_content = []
        else:
            if current_section:
                current_content.append(line)
    
    # Add the last section
    if current_section:
        sections.append({
            'heading': current_section,
            'content': '\n'.join(current_content).strip()
        })
    
    return sections

def extract_keywords(text, is_technical_content=True):
    """Extract important keywords from text using improved filtering with strong technical term boosting."""
    # Extract acronyms (2-5 uppercase letters) before lowercasing - these are VERY important
    acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
    acronyms = [a.lower() for a in acronyms]
    
    # Extract important AI/ML terms that should be boosted (case-insensitive)
    ai_terms = []
    important_phrases = [
        'computer vision', 'machine learning', 'deep learning', 'neural network',
        'natural language', 'speech recognition', 'image classification', 
        'object detection', 'regression', 'classification', 'clustering',
        'convolutional', 'recurrent', 'transformer', 'generative ai',
        'large language model', 'information extraction', 'text analysis'
    ]
    text_lower = text.lower()
    for phrase in important_phrases:
        if phrase in text_lower:
            # Convert to hyphenated keyword
            ai_terms.append(phrase.replace(' ', '-'))
    
    # Remove special characters and convert to lowercase
    text = re.sub(r'[^a-zA-Z0-9\s-]', ' ', text.lower())
    # Split into words
    words = text.split()
    
    # Comprehensive stop words list - very generic, non-technical terms
    stop_words = {
        # Articles, pronouns, prepositions
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'from', 'as', 'into', 'through', 'after', 'before', 'between', 'over', 'under',
        
        # Common verbs
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
        'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'said',
        
        # Demonstratives and determiners
        'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they',
        'their', 'them', 'there', 'here', 'where', 'when', 'what', 'which', 'who', 'whom',
        'whose', 'how', 'why', 'some', 'any', 'each', 'every', 'all', 'both', 'few', 'more',
        'most', 'other', 'such', 'only', 'own', 'same', 'than', 'then', 'too', 'very',
        
        # Common transition/filler words
        'also', 'however', 'because', 'since', 'while', 'during', 'within', 'without',
        'about', 'above', 'across', 'against', 'along', 'among', 'around', 'behind', 'below',
        'beside', 'besides', 'beyond', 'down', 'during', 'except', 'inside', 'near', 'off',
        'outside', 'since', 'toward', 'upon', 'within', 'without', 'whether', 'like', 'just',
        
        # Common verbs (expanded)
        'make', 'makes', 'made', 'making', 'take', 'takes', 'took', 'taken', 'taking', 'get',
        'gets', 'got', 'gotten', 'getting', 'use', 'uses', 'used', 'using', 'work', 'works',
        'worked', 'working', 'include', 'includes', 'included', 'including', 'provide',
        'provides', 'provided', 'providing', 'need', 'needs', 'needed', 'needing', 'want',
        'wants', 'wanted', 'wanting', 'know', 'knows', 'knew', 'known', 'knowing',
        
        # Common adjectives/adverbs
        'first', 'second', 'third', 'last', 'next', 'new', 'old', 'good', 'great', 'small',
        'large', 'many', 'much', 'often', 'sometimes', 'always', 'never', 'again', 'once',
        'well', 'back', 'even', 'still', 'now', 'way', 'ways'
    }
    
    # Filter words: must be longer than 3 chars and not in stop words
    keywords = [w for w in words if len(w) > 3 and w not in stop_words]
    
    # Add acronyms and AI terms
    keywords.extend(acronyms)
    keywords.extend(ai_terms)
    
    # Count word frequency
    word_freq = {}
    for word in keywords:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    # STRONG BOOSTS for technical terms
    # Acronyms get 10x boost - they're critical identifiers (was 3x)
    for acronym in set(acronyms):
        if acronym in word_freq:
            word_freq[acronym] *= 10
    
    # AI/ML terms get 8x boost - these are domain-specific (new)
    for term in set(ai_terms):
        if term in word_freq:
            word_freq[term] *= 8
    
    # Sort by frequency (descending) and return top keywords
    sorted_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    
    # Limit to top 20 keywords to avoid keyword inflation
    # This ensures only the most relevant terms are included
    return [word for word, freq in sorted_keywords[:20]]

def generate_semantic_keywords(category, heading, content):
    """Generate additional semantic/contextual keywords based on topic area."""
    semantic_keywords = []
    
    # Combine heading and content for topic detection
    text = (heading + ' ' + content).lower()
    
    # Only add "ai" and "artificial-intelligence" if they appear in the text
    # BUT give strong preference to AI Overview category for these terms
    if 'artificial intelligence' in text or ' ai ' in text or text.startswith('ai ') or text.endswith(' ai'):
        if category == 'AI Overview':
            # For AI Overview, add these with extra emphasis
            semantic_keywords.extend(['ai', 'artificial-intelligence', 'ai-fundamentals', 'ai-basics'])
        else:
            # For other categories, only add if specifically mentioned
            semantic_keywords.extend(['ai', 'artificial-intelligence'])
    
    # Topic-specific semantic keywords based on STRONG content matches
    # Only add if the primary topic term appears prominently (in heading or multiple times in content)
    topic_mappings = {
        # AI Overview topics
        'responsible ai': ['ethics', 'fairness', 'transparency', 'accountability', 'bias'],
        'ethics': ['responsible-ai', 'fairness', 'transparency', 'accountability', 'bias'],
        
        # Text Analysis topics
        'sentiment analysis': ['opinion', 'emotion', 'polarity', 'positive', 'negative'],
        'sentiment': ['opinion', 'emotion', 'polarity'],
        'named entity': ['ner', 'entity-extraction', 'entity-recognition'],
        'entity recognition': ['ner', 'entity-extraction', 'named-entity'],
        'tokenization': ['tokens', 'word-splitting', 'text-parsing'],
        'embeddings': ['vectors', 'word2vec', 'semantic-similarity'],
        'embedding': ['vectors', 'word2vec', 'semantic-similarity'],
        'bag of words': ['bow', 'word-frequency', 'term-frequency'],
        
        # Speech topics
        'speech recognition': ['stt', 'speech-to-text', 'transcription', 'dictation', 'voice-input'],
        'transcription': ['stt', 'speech-to-text', 'speech-recognition'],
        'speech synthesis': ['tts', 'text-to-speech', 'voice-generation', 'reading-aloud', 'narration'],
        'text-to-speech': ['tts', 'speech-synthesis', 'voice-generation'],
        'phoneme': ['pronunciation', 'sounds', 'speech-units', 'acoustic'],
        'mfcc': ['audio-features', 'sound-analysis', 'signal-processing'],
        
        # Computer Vision topics
        'ocr': ['text-extraction', 'character-recognition', 'document-scanning', 'reading-text'],
        'optical character': ['ocr', 'text-extraction', 'character-recognition'],
        'object detection': ['localization', 'bounding-box', 'finding-objects', 'item-detection'],
        'image classification': ['categorization', 'labeling', 'tagging', 'image-recognition'],
        'image segmentation': ['masking', 'pixel-classification', 'region-detection'],
        'convolutional neural network': ['cnn', 'cnns', 'convolution', 'filter', 'feature-map', 'image-processing'],
        
        # ML topics - be specific about clustering vs segmentation
        'regression': ['prediction', 'continuous', 'forecasting', 'estimation'],
        'binary classification': ['categorization', 'labeling', 'sorting'],
        'multiclass classification': ['categorization', 'labeling', 'sorting'],
        'clustering algorithm': ['grouping', 'unsupervised', 'patterns'],
        'k-means': ['clustering', 'grouping', 'unsupervised'],
        'neural network': ['deep-learning', 'neurons', 'layers', 'backpropagation'],
        'deep learning': ['neural-networks', 'rnn', 'transformer'],
        
        # Generative AI topics
        'large language model': ['llm', 'llms', 'large-language-model', 'foundation-model'],
        'prompt': ['instruction', 'query', 'input', 'request'],
        'agent': ['autonomous', 'tool-use', 'function-calling', 'planning'],
        'retrieval augmented': ['rag', 'retrieval', 'context', 'grounding', 'search'],
        'token': ['word', 'embedding', 'vocabulary', 'tokenization'],
        
        # Information Extraction topics
        'invoice': ['billing', 'payment', 'receipt', 'financial-document'],
        'form': ['template', 'field', 'structured-data', 'extraction'],
        'field extraction': ['data-extraction', 'parsing', 'structured-output'],
        'document processing': ['automation', 'digitization', 'workflow']
    }
    
    # Check for topic keywords in heading (primary indicator)
    heading_lower = heading.lower()
    for topic, keywords in topic_mappings.items():
        if topic in heading_lower:
            semantic_keywords.extend(keywords)
    
    # Check for topic keywords in content, but require multiple mentions (2+) or strong context
    for topic, keywords in topic_mappings.items():
        # Count occurrences of the topic in content
        topic_count = text.count(topic)
        # Only add if topic appears multiple times or is in heading
        if topic_count >= 2 or (topic_count >= 1 and topic in heading_lower):
            semantic_keywords.extend(keywords)
    
    # Remove duplicates and return
    return list(set(semantic_keywords))

def calculate_tfidf_scores(all_documents):
    """Calculate TF-IDF scores for keywords across all documents to boost unique terms."""
    # Count documents containing each term
    doc_freq = Counter()
    total_docs = len(all_documents)
    
    # Build document frequency map
    for doc in all_documents:
        unique_keywords = set(doc['keywords'])
        for keyword in unique_keywords:
            doc_freq[keyword] += 1
    
    # Calculate IDF (inverse document frequency) for each term
    # IDF = log(total_docs / doc_freq)
    idf_scores = {}
    for term, freq in doc_freq.items():
        idf_scores[term] = math.log(total_docs / freq) if freq > 0 else 0
    
    # Update each document with TF-IDF weighted keywords
    for doc in all_documents:
        keyword_scores = []
        keyword_freq = Counter(doc['keywords'])
        
        for keyword in doc['keywords']:
            # TF = term frequency in this document
            tf = keyword_freq[keyword] / len(doc['keywords']) if doc['keywords'] else 0
            # TF-IDF = TF * IDF
            tfidf = tf * idf_scores.get(keyword, 0)
            keyword_scores.append((keyword, tfidf))
        
        # Sort keywords by TF-IDF score and update document
        keyword_scores.sort(key=lambda x: x[1], reverse=True)
        doc['keywords'] = [kw for kw, score in keyword_scores]
        doc['tfidf_top_terms'] = [kw for kw, score in keyword_scores[:5]]  # Top 5 most unique terms
    
    return all_documents

def create_index_for_folder(folder_path, category, start_id=1):
    """Create a searchable index for all markdown files in a folder."""
    index = []
    doc_id = start_id
    
    # Get all markdown files in the folder
    md_files = sorted(Path(folder_path).glob('*.md'))
    
    for md_file in md_files:
        # Extract sections from the file
        sections = extract_headings_and_content(md_file)
        
        for section in sections:
            # Create a searchable document for each section
            combined_text = f"{section['heading']} {section['content']}"
            keywords = extract_keywords(combined_text)
            
            # Generate semantic/contextual keywords
            semantic_keywords = generate_semantic_keywords(category, section['heading'], section['content'])
            
            # Combine extracted keywords with semantic keywords
            all_keywords = keywords[:12] + semantic_keywords
            # Remove duplicates while preserving order (extracted keywords first)
            seen = set()
            final_keywords = []
            for kw in all_keywords:
                if kw not in seen:
                    seen.add(kw)
                    final_keywords.append(kw)
            
            # Create summary (first 200 chars of content)
            summary = section['content'][:200].strip()
            if len(section['content']) > 200:
                summary += '...'
            
            doc = {
                'id': doc_id,
                'category': category,
                'file': md_file.name,
                'heading': section['heading'],
                'content': section['content'][:500],  # Limit content length
                'summary': summary,
                'keywords': final_keywords  # Includes both extracted and semantic keywords
            }
            index.append(doc)
            doc_id += 1
    
    return index

def main():
    """Generate JSON indexes for all ask-andrew content folders with TF-IDF scoring."""
    base_path = Path(__file__).parent
    
    # Updated to include ALL 7 categories
    folders = {
        '00-ai-overview': 'AI Overview',
        '01-generative-ai': 'Generative AI',
        '02-machine-learning': 'Machine Learning',
        '03a-text-analysis': 'Text Analysis',
        '03b-speech': 'Speech',
        '04-computer-vision': 'Computer Vision',
        '05-information-extraction': 'Information Extraction'
    }
    
    all_docs = []
    current_id = 1
    
    # First pass: collect all documents
    for folder, category in folders.items():
        folder_path = base_path / folder
        if folder_path.exists():
            print(f"Processing {category}...")
            index = create_index_for_folder(folder_path, category, start_id=current_id)
            print(f"  Added {len(index)} entries")
            
            all_docs.extend(index)
            current_id += len(index)  # Increment ID counter for next folder
        else:
            print(f"Warning: Folder {folder} not found, skipping...")
    
    # Second pass: Apply TF-IDF scoring across all documents
    print(f"\nApplying TF-IDF scoring across {len(all_docs)} documents...")
    all_docs = calculate_tfidf_scores(all_docs)
    
    # Create master index
    master_index_file = base_path / "index.json"
    with open(master_index_file, 'w', encoding='utf-8') as f:
        json.dump(all_docs, f, indent=2, ensure_ascii=False)
    print(f"Created master index.json with {len(all_docs)} total entries")
    
    # Create a metadata file with category information
    metadata = {
        'categories': list(folders.values()),
        'totalDocuments': len(all_docs),
        'folders': folders
    }
    metadata_file = base_path / "index-metadata.json"
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print(f"Created {metadata_file.name}")
    
    # Create separate category links file
    category_links = {
        'categoryLinks': {
            'AI Overview': 'https://aka.ms/mslearn-ai-concepts',
            'Generative AI': 'https://aka.ms/mslearn-intro-gen-ai',
            'Machine Learning': 'https://aka.ms/mslearn-ml-concepts',
            'Text Analysis': 'https://aka.ms/mslearn-nlp',
            'Speech': 'https://aka.ms/mslearn-ai-speech',
            'Computer Vision': 'https://aka.ms/mslearn-vision',
            'Information Extraction': 'https://aka.ms/mslearn-ai-info'
        },
        'fallbackLink': {
            'name': 'Introduction to AI',
            'url': 'https://aka.ms/mslearn-ai-introduction',
            'description': 'General introduction to AI concepts - shown when no specific results are found'
        }
    }
    links_file = base_path / "category-links.json"
    with open(links_file, 'w', encoding='utf-8') as f:
        json.dump(category_links, f, indent=2)
    print(f"Created {links_file.name}")

if __name__ == '__main__':
    main()
