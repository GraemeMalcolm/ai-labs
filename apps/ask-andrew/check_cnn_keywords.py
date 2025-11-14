import json

with open('index.json', encoding='utf-8') as f:
    data = json.load(f)

# Find the CNN entry
cnn_entry = [d for d in data if d['heading'] == 'Convolutional neural networks'][0]
print(f"CNN entry ({cnn_entry['category']} - {cnn_entry['file']}):")
print(f"Keywords: {cnn_entry['keywords']}")
print(f"\nCNN-related keywords: {[k for k in cnn_entry['keywords'] if 'cnn' in k or 'conv' in k or 'filter' in k or 'feature' in k]}")
