import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Find Speech entries
print("Speech entries mentioning 'neural' or with CNN-related keywords:\n")
speech_entries = [d for d in data if d['category'] == 'Speech']
for entry in speech_entries:
    keywords = entry.get('keywords', [])
    content_lower = entry['content'].lower()
    
    if 'neural' in ' '.join(keywords) or 'cnn' in keywords or 'neural' in content_lower:
        print(f"{entry['file']} - {entry['heading']}")
        print(f"  Keywords with 'neural': {[k for k in keywords if 'neural' in k]}")
        print(f"  Has 'cnn' keyword: {'cnn' in keywords}")
        print(f"  Content has 'neural network': {'neural network' in content_lower}")
        print()

print("\n" + "="*80)
print("Computer Vision CNN entry:\n")
cv_cnn = [d for d in data if d['category'] == 'Computer Vision' and 'Convolutional' in d['heading']][0]
print(f"{cv_cnn['file']} - {cv_cnn['heading']}")
print(f"  Keywords: {cv_cnn['keywords'][:20]}")
print(f"  Has 'cnn': {'cnn' in cv_cnn['keywords']}")
print(f"  Has 'neural-networks': {'neural-networks' in cv_cnn['keywords']}")
