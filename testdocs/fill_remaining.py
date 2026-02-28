#!/usr/bin/env python
import sys
import re
sys.path.insert(0, r'C:\Users\david\.lawvable\skills\docx-processing-anthropic')

from scripts.document import Document

unpacked_path = r'C:\Users\david\AppData\Local\Temp\seller_psa_unpacked'
doc = Document(unpacked_path)

# Get the XML
xml_doc = doc["word/document.xml"].dom.documentElement.toxml()

# Simple string replacements for blanks and brackets
simple_replacements = [
    ('________________________________', 'Cascade Properties LLC, a Washington limited liability company'),
    ('____________________________ (', 'Northern Pine Investments, Inc., a Delaware corporation ('),
    ('$_____________________', '$1,250,000'),
    ('$___________________', '$1,250,000'),
    ('$__________________', '$1,250,000'),
    ('_________________ (the', '2847 Alki Avenue West, Seattle, WA 98116 (the'),
    ('[Initial Deposit amount TBD]', '$62,500'),
    ('[Additional Deposit amount TBD]', '$62,500'),
    ('[Closing Payment amount TBD]', '$1,125,000'),
    ('[Property Address]', '2847 Alki Avenue West, Seattle, WA 98116'),
    ('[Interest bearing account optional]', ''),
    ('[Upon receipt optional language]', ''),
]

for old, new in simple_replacements:
    if old in xml_doc:
        xml_doc = xml_doc.replace(old, new)
        print(f"Replaced: {old}")

# Write back
doc["word/document.xml"].dom.documentElement.toxml = lambda: xml_doc
doc.save(validate=False)
print("Saved successfully")
