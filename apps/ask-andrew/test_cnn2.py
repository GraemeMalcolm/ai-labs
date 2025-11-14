from pathlib import Path
from build_index import extract_headings_and_content, extract_keywords, generate_semantic_keywords

folder_path = Path('04-computer-vision')
category = 'Computer Vision'

# Get all markdown files
md_files = sorted(folder_path.glob('*.md'))
print(f"Found {len(md_files)} files in {folder_path}:")
for f in md_files:
    print(f"  - {f.name}")

# Check the CNN file specifically
cnn_file = folder_path / '03-computer-vision-models.md'
print(f"\nProcessing {cnn_file.name}...")
sections = extract_headings_and_content(cnn_file)
print(f"  Found {len(sections)} sections:")
for section in sections:
    print(f"    - {section['heading']}")
    combined_text = f"{section['heading']} {section['content']}"
    keywords = extract_keywords(combined_text)
    print(f"      Extracted keywords: {keywords[:5]}")
    semantic_keywords = generate_semantic_keywords(category, section['heading'], section['content'])
    print(f"      Semantic keywords: {semantic_keywords[:5]}")
