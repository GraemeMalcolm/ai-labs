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
    """Extract important keywords from text."""
    # Remove special characters and convert to lowercase
    text = re.sub(r'[^a-zA-Z0-9\s-]', ' ', text.lower())
    # Split into words
    words = text.split()
    # Filter out common stop words and short words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
                  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
                  'that', 'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our'}
    keywords = [w for w in words if len(w) > 3 and w not in stop_words]
    # Return unique keywords
    return list(set(keywords))

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
                'keywords': keywords[:20]  # Limit to top 20 keywords
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

if __name__ == '__main__':
    main()
