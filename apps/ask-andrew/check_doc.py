import json

with open('c:/Git/ai-labs/apps/ask-andrew/index.json', encoding='utf-8') as f:
    data = json.load(f)

# Find documents with mfcc in keywords or content
print("\n=== Documents with MFCC in keywords ===")
mfcc_keyword_docs = [d for d in data if any('mfcc' in k.lower() for k in d['keywords'])]
for d in mfcc_keyword_docs[:10]:
    print(f"\nDoc {d['id']}: {d['heading']}")
    print(f"  Category: {d['category']}")
    print(f"  Keywords: {', '.join(d['keywords'][:10])}")

print("\n\n=== Documents with MFCC in heading or content (but not keywords) ===")
mfcc_content_docs = [d for d in data if 'mfcc' in d['heading'].lower() or 'mfcc' in d['content'].lower()]
for d in mfcc_content_docs[:5]:
    has_keyword = any('mfcc' in k.lower() for k in d['keywords'])
    if not has_keyword:
        print(f"\nDoc {d['id']}: {d['heading']}")
        print(f"  Category: {d['category']}")
        print(f"  Keywords: {', '.join(d['keywords'][:10])}")
