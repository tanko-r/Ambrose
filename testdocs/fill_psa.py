#!/usr/bin/env python
import sys
sys.path.insert(0, r'C:\Users\david\.lawvable\skills\docx-processing-anthropic')

from scripts.document import Document

unpacked_path = r'C:\Users\david\AppData\Local\Temp\seller_psa_unpacked'
doc = Document(unpacked_path)

replacements = [
    ('dated for reference purposes only as of ________________, 20___',
     'dated for reference purposes only as of January 15, 2026'),
    ('___________________________ Title Insurance Company',
     'Fidelity National Title Company'),
]

count = 0
for old, new in replacements:
    try:
        node = doc["word/document.xml"].get_node(tag="w:r", contains=old)
        if node:
            rpr_tags = node.getElementsByTagName("w:rPr")
            rpr = rpr_tags[0].toxml() if rpr_tags else ""
            replacement = f'<w:r>{rpr}<w:t>{new}</w:t></w:r>'
            doc["word/document.xml"].replace_node(node, replacement)
            count += 1
    except:
        pass

doc.save(validate=False)
print(f"Saved with {count} replacements")
