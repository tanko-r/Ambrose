#!/usr/bin/env python
import re
import os

# Read document.xml
xml_path = r'C:\Users\david\AppData\Local\Temp\seller_psa_v2\word\document.xml'
with open(xml_path, 'r', encoding='utf-8') as f:
    xml = f.read()

# Replace all blank underscores with reasonable defaults
xml = re.sub(r'_+', '[See Schedule]', xml)  # Generic replacements for blanks

# More specific replacements
replacements = {
    '[but excluding the following items: [See Schedule]': 
        '[but excluding the following items: to be determined by Buyer and Seller]',
    
    r'20___': '2026',
    r'20__': '2026',
    r'20_': '2026',
}

for old, new in replacements.items():
    if old in xml:
        xml = xml.replace(old, new)

# Save back
with open(xml_path, 'w', encoding='utf-8') as f:
    f.write(xml)

print("Filled blanks comprehensively")
