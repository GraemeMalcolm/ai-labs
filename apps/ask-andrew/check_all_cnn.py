import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Check all entries with 'cnn' in keywords or heading
print("All entries with 'cnn' in keywords or heading:\n")
for entry in data:
    keywords = entry.get('keywords', [])
    if 'cnn' in keywords or 'cnn' in entry['heading'].lower():
        print(f"{entry['category']} - {entry['file']}")
        print(f"  Heading: {entry['heading']}")
        print(f"  Keywords (first 10): {keywords[:10]}")
        print(f"  'cnn' position in keywords: {keywords.index('cnn') if 'cnn' in keywords else 'N/A'}")
        print()
