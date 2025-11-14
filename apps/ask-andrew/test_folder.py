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

# Test on the specific file
from build_index import create_index_for_folder

folder_path = Path('04-computer-vision')
index = create_index_for_folder(folder_path, 'Computer Vision', start_id=1)

print(f"Generated {len(index)} entries:")
for doc in index:
    print(f"  {doc['id']}: {doc['file']} - {doc['heading']}")
