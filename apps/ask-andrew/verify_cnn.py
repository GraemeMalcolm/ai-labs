import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Find the CNN entry
cnn_entry = [d for d in data if d['heading'] == 'Convolutional neural networks'][0]
print(f"CNN entry: {cnn_entry['file']} - {cnn_entry['heading']}")
print(f"\nAll keywords ({len(cnn_entry['keywords'])} total):")
print(cnn_entry['keywords'])
print(f"\nFirst 12 keywords (extracted): {cnn_entry['keywords'][:12]}")
print(f"\nHas 'cnn' in first 12: {'cnn' in cnn_entry['keywords'][:12]}")
print(f"Position of 'cnn': {cnn_entry['keywords'].index('cnn') if 'cnn' in cnn_entry['keywords'] else 'Not found'}")
