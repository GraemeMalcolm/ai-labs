import json
from pathlib import Path

index_path = Path(__file__).parent / 'index.json'
with open(index_path, encoding='utf-8') as f:
    data = json.load(f)

# Simulate search for "explain how a cnn works"
search_terms = ['explain', 'how', 'cnn', 'works']
print("Searching for terms: explain, how, cnn, works\n")

# Find entries that match these terms
matches = []
for entry in data:
    score = 0
    matched_keywords = []
    keywords_lower = [k.lower() for k in entry.get('keywords', [])]
    content_lower = entry['content'].lower()
    heading_lower = entry['heading'].lower()
    
    # Check each search term
    for term in search_terms:
        if term in keywords_lower:
            score += 2
            matched_keywords.append(f"{term} (keyword)")
        elif term in content_lower:
            score += 1
            matched_keywords.append(f"{term} (content)")
        elif term in heading_lower:
            score += 1.5
            matched_keywords.append(f"{term} (heading)")
    
    if score > 0:
        matches.append((entry, score, matched_keywords))

# Sort by score
matches.sort(key=lambda x: x[1], reverse=True)

# Show top 10 matches
print(f"Top 10 matches:\n")
for i, (entry, score, matched) in enumerate(matches[:10], 1):
    print(f"{i}. [{score:.1f}] {entry['category']} - {entry['file']}")
    print(f"   Heading: {entry['heading']}")
    print(f"   Matched: {', '.join(matched)}")
    print()
