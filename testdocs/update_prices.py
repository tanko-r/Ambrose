import re

xml_path = r'C:\Users\david\AppData\Local\Temp\seller_psa_v3\word\document.xml'

with open(xml_path, 'r', encoding='utf-8') as f:
    xml = f.read()

# Replace old prices with new ones
xml = xml.replace('$1,250,000', '$16,500,000')
xml = xml.replace('$62,500', '$825,000')
xml = xml.replace('$1,125,000', '$14,850,000')

with open(xml_path, 'w', encoding='utf-8') as f:
    f.write(xml)

print("Updated: $1,250,000 -> $16,500,000")
print("Updated: $62,500 -> $825,000")
print("Updated: $1,125,000 -> $14,850,000")
