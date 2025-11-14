import json

with open('index.json', encoding='utf-8') as f:
    data = json.load(f)

cv_files = [d for d in data if d['category'] == 'Computer Vision']
print(f'Computer Vision has {len(cv_files)} entries:')
for d in cv_files:
    print(f"  {d['file']} - {d['heading']}")
    if 'cnn' in d.get('keywords', []):
        print(f"    ^ Has 'cnn' keyword")
