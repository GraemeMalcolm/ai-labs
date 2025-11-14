import re

text = """One of the most common machine learning model architectures for computer vision is a *convolutional neural network* (CNN), a type of deep learning architecture. CNNs use filters to extract numeric feature maps from images."""

# Extract acronyms (2-5 uppercase letters) before lowercasing
acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
print(f"Found acronyms: {acronyms}")
acronyms_lower = [a.lower() for a in acronyms]
print(f"Lowercased: {acronyms_lower}")

# Now process the full text
from build_index import extract_keywords
keywords = extract_keywords(text)
print(f"\nExtracted keywords (first 15): {keywords[:15]}")
print(f"'cnn' position: {keywords.index('cnn') if 'cnn' in keywords else 'Not found'}")
print(f"'cnns' position: {keywords.index('cnns') if 'cnns' in keywords else 'Not found'}")
