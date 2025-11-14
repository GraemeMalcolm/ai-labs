import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Check the CNN entry
cnn_entry = [d for d in data if 'Convolutional neural networks' in d['heading']][0]
print("Computer Vision CNN entry:")
print(f"  Heading: {cnn_entry['heading']}")
print(f"  'works' in heading: {'works' in cnn_entry['heading'].lower()}")
print(f"  'how' in heading: {'how' in cnn_entry['heading'].lower()}")
print(f"  'cnn' in heading: {'cnn' in cnn_entry['heading'].lower()}")
print(f"  First 5 keywords: {cnn_entry['keywords'][:5]}")
print()

# Check Speech entries with "how" in heading
speech_entries = [d for d in data if d['category'] == 'Speech' and 'how' in d['heading'].lower()]
print(f"Speech entries with 'how' in heading:")
for entry in speech_entries:
    print(f"  {entry['heading']}")
    print(f"    Keywords: {entry['keywords'][:8]}")
