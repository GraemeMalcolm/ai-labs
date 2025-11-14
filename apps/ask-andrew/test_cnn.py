from build_index import extract_headings_and_content

sections = extract_headings_and_content('04-computer-vision/03-computer-vision-models.md')
print(f'Found {len(sections)} sections:')
for s in sections:
    print(f"  - {s['heading']}")
    print(f"    Content length: {len(s['content'])} chars")
    print(f"    First 100 chars: {s['content'][:100]}")
