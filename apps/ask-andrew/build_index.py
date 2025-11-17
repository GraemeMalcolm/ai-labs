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

def extract_keywords(heading, content):
    """
    Extract keywords intelligently from heading and content.
    Prioritizes: heading terms, multi-word phrases, acronyms, then frequent terms.
    """
    keywords = []
    
    # 1. Extract all words from heading - these are the most important
    heading_lower = heading.lower()
    heading_words = re.findall(r'\b[a-z]{4,}\b', heading_lower)
    
    # 2. Extract acronyms from content (2-5 uppercase letters) - critical identifiers
    acronyms = re.findall(r'\b[A-Z]{2,5}\b', content)
    acronyms_lower = [a.lower() for a in set(acronyms)]
    
    # 3. Extract important multi-word technical phrases
    text_lower = (heading + ' ' + content).lower()
    technical_phrases = [
        'machine-learning', 'deep-learning', 'neural-network', 'neural-networks',
        'computer-vision', 'natural-language', 'speech-recognition', 'speech-synthesis',
        'language-model', 'large-language-model', 'object-detection', 'image-classification',
        'sentiment-analysis', 'named-entity', 'information-extraction', 'generative-ai',
        'text-to-speech', 'speech-to-text', 'convolutional-network', 'recurrent-network'
    ]
    found_phrases = [phrase for phrase in technical_phrases if phrase.replace('-', ' ') in text_lower]
    
    # 4. Extract frequent content words (clean approach)
    content_lower = content.lower()
    content_lower = re.sub(r'[^a-z0-9\s]', ' ', content_lower)
    words = content_lower.split()
    
    # Stop words - very common, non-technical terms
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
        'by', 'from', 'as', 'into', 'through', 'this', 'that', 'these', 'those',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'can', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'there', 'their', 'them', 'they', 'what', 'which', 'when', 'where', 'who',
        'how', 'why', 'some', 'any', 'each', 'more', 'most', 'such', 'than', 'then',
        'also', 'using', 'used', 'include', 'includes', 'example', 'like'
    }
    
    # Filter and count words
    filtered_words = [w for w in words if len(w) > 3 and w not in stop_words]
    word_freq = Counter(filtered_words)
    
    # 5. Build final keyword list with priorities
    # Priority 1: Heading words (appear as-is)
    keywords.extend(heading_words)
    
    # Priority 2: Acronyms (heavily weighted)
    keywords.extend(acronyms_lower)
    
    # Priority 3: Technical phrases found in content
    keywords.extend(found_phrases)
    
    # Priority 4: Top frequent words from content (limit to top 10)
    top_content_words = [word for word, count in word_freq.most_common(10)]
    keywords.extend(top_content_words)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            unique_keywords.append(kw)
    
    # Limit to top 15 keywords to keep focused
    return unique_keywords[:15]

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
            # Extract keywords from heading and content using new intelligent extraction
            keywords = extract_keywords(section['heading'], section['content'])
            
            # Keywords are already prioritized and limited to 15
            final_keywords = keywords
            
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
