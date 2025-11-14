import os
import json
import re
from pathlib import Path

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

def extract_keywords(text):
    """Extract important keywords from text using improved filtering."""
    # Remove special characters and convert to lowercase
    text = re.sub(r'[^a-zA-Z0-9\s-]', ' ', text.lower())
    # Split into words
    words = text.split()
    
    # Comprehensive stop words list
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
    
    # Count word frequency
    word_freq = {}
    for word in keywords:
        word_freq[word] = word_freq.get(word, 0) + 1
    
    # Sort by frequency (descending) and return top keywords
    sorted_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    # Return just the words (not frequencies), limited to top entries
    return [word for word, freq in sorted_keywords]

def generate_semantic_keywords(category, heading, content):
    """Generate additional semantic/contextual keywords based on topic area."""
    semantic_keywords = []
    
    # Combine heading and content for topic detection
    text = (heading + ' ' + content).lower()
    
    # Category-level semantic keywords
    category_keywords = {
        'Generative AI': ['llm', 'gpt', 'prompt', 'completion', 
                         'chat', 'assistant', 'copilot', 'chatbot'],
        'Machine Learning': ['ml', 'prediction', 'training',
                            'model', 'algorithm', 'data-science', 'analytics'],
        'Speech': ['audio', 'voice', 'sound', 'microphone', 'recording', 'listening',
                  'speaking', 'pronunciation', 'accent', 'dictation'],
        'Computer Vision': ['visual', 'picture', 'photo', 'camera', 'sight', 'seeing',
                           'recognition', 'detection', 'identification'],
        'Information Extraction': ['document', 'form', 'scan', 'digitization', 'automation',
                                   'parsing', 'reading', 'understanding']
    }
    
    # Add category-level keywords
    if category in category_keywords:
        semantic_keywords.extend(category_keywords[category])
    
    # Only add "ai" and "artificial-intelligence" if they appear in the text
    if 'artificial intelligence' in text or ' ai ' in text or text.startswith('ai ') or text.endswith(' ai'):
        semantic_keywords.extend(['ai', 'artificial-intelligence'])
    
    # Topic-specific semantic keywords based on content
    topic_mappings = {
        # Speech topics
        'speech recognition': ['stt', 'speech-to-text', 'transcription', 'dictation', 'voice-input'],
        'speech synthesis': ['tts', 'text-to-speech', 'voice-generation', 'reading-aloud', 'narration'],
        'phoneme': ['pronunciation', 'sounds', 'speech-units', 'acoustic'],
        'mfcc': ['audio-features', 'sound-analysis', 'signal-processing'],
        
        # Computer Vision topics
        'ocr': ['text-extraction', 'character-recognition', 'document-scanning', 'reading-text'],
        'object detection': ['localization', 'bounding-box', 'finding-objects', 'item-detection'],
        'image classification': ['categorization', 'labeling', 'tagging', 'image-recognition'],
        'segmentation': ['masking', 'pixel-classification', 'region-detection'],
        
        # ML topics
        'regression': ['prediction', 'continuous', 'forecasting', 'estimation'],
        'classification': ['categorization', 'labeling', 'prediction', 'sorting'],
        'clustering': ['grouping', 'segmentation', 'unsupervised', 'patterns'],
        'neural network': ['deep-learning', 'neurons', 'layers', 'backpropagation'],
        'deep learning': ['neural-networks', 'cnn', 'rnn', 'transformer'],
        
        # Generative AI topics
        'large language model': ['llm', 'llms', 'large-language-model', 'foundation-model'],
        'prompt': ['instruction', 'query', 'input', 'request'],
        'agent': ['autonomous', 'tool-use', 'function-calling', 'planning'],
        'rag': ['retrieval', 'context', 'grounding', 'search'],
        'token': ['word', 'embedding', 'vocabulary', 'tokenization'],
        
        # Information Extraction topics
        'invoice': ['billing', 'payment', 'receipt', 'financial-document'],
        'form': ['template', 'field', 'structured-data', 'extraction'],
        'field extraction': ['data-extraction', 'parsing', 'structured-output'],
        'document processing': ['automation', 'digitization', 'workflow']
    }
    
    # Check for topic keywords in text and add related semantic terms
    for topic, keywords in topic_mappings.items():
        if topic in text:
            semantic_keywords.extend(keywords)
    
    # Remove duplicates and return
    return list(set(semantic_keywords))

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
    """Generate JSON indexes for all ask-andrew content folders."""
    base_path = Path(__file__).parent
    
    folders = {
        '01-generative-ai': 'Generative AI',
        '02-machine-learning': 'Machine Learning',
        '03-speech': 'Speech',
        '04-computer-vision': 'Computer Vision',
        '05-information-extraction': 'Information Extraction'
    }
    
    all_docs = []
    current_id = 1
    
    for folder, category in folders.items():
        folder_path = base_path / folder
        if folder_path.exists():
            print(f"Processing {category}...")
            index = create_index_for_folder(folder_path, category, start_id=current_id)
            print(f"  Added {len(index)} entries")
            
            all_docs.extend(index)
            current_id += len(index)  # Increment ID counter for next folder
    
    # Create master index
    master_index_file = base_path / "index.json"
    with open(master_index_file, 'w', encoding='utf-8') as f:
        json.dump(all_docs, f, indent=2, ensure_ascii=False)
    print(f"\nCreated master index.json with {len(all_docs)} total entries")
    
    # Create a metadata file with category information and Microsoft Learn links
    metadata = {
        'categories': list(folders.values()),
        'totalDocuments': len(all_docs),
        'folders': folders,
        'links': {
            'Generative AI': 'https://aka.ms/mslearn-intro-gen-ai',
            'Machine Learning': 'https://aka.ms/mslearn-ml-concepts',
            'Speech': 'https://aka.ms/mslearn-ai-speech',
            'Computer Vision': 'https://aka.ms/mslearn-vision',
            'Information Extraction': 'https://aka.ms/mslearn-ai-info'
        }
    }
    metadata_file = base_path / "index-metadata.json"
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print(f"Created {metadata_file.name}")

if __name__ == '__main__':
    main()
