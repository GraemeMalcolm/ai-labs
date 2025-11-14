import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Find all entries with 'cnn' keyword
cnn_entries = [d for d in data if 'cnn' in d.get('keywords', [])]
print(f"Found {len(cnn_entries)} entries with 'cnn' keyword:\n")

for entry in cnn_entries:
    print(f"{entry['category']} - {entry['file']}")
    print(f"  Heading: {entry['heading']}")
    print(f"  Content preview: {entry['content'][:150]}...")
    print(f"  CNN mentions in content: {'cnn' in entry['content'].lower()}")
    print(f"  'convolutional' mentions: {'convolutional' in entry['content'].lower()}")
    print()
