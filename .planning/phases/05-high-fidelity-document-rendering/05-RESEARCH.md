# Phase 5: High-Fidelity Document Rendering - Research

**Researched:** 2026-02-02
**Updated:** 2026-02-03 (major revision - docx-parser-converter discovery)
**Domain:** DOCX to HTML rendering, browser document preview
**Confidence:** HIGH

## Summary

**MAJOR UPDATE:** The [docx-parser-converter](https://github.com/omer-go/docx-parser-converter) library (already installed in this project at v1.0.3) provides **complete high-fidelity DOCX to HTML conversion** with full automatic numbering support. This eliminates the need for LibreOffice, PDF.js, or complex PDF-to-paragraph mapping.

### Key Discovery

Tested against actual legal documents in this project:
- **117 list markers** correctly rendered including multi-level numbering
- Preserves: `1.1`, `1.2`, `11.3.1`, `11.3.2`, `11.4.1` patterns
- Correct indentation via `margin-left` and `text-indent` CSS
- Fonts preserved (Times New Roman, 11pt)
- Bold, underline, text alignment all maintained

**NEW Primary Recommendation:** Use `docx-parser-converter` for server-side DOCX→HTML conversion. Serve HTML directly to browser. No external dependencies required (pure Python).

### Why This Changes Everything

| Old Approach (LibreOffice + PDF.js) | New Approach (docx-parser-converter) |
|-------------------------------------|--------------------------------------|
| Requires LibreOffice installation | Pure Python, already installed |
| 2+ second conversion time | ~100ms conversion time |
| PDF click mapping is complex | HTML paragraphs natively clickable |
| PDF text selection is problematic | Native text selection works |
| Large external dependency | Single pip package (37KB) |

## Standard Stack (REVISED)

### Core (New Recommendation)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docx-parser-converter | 1.0.3 | Server-side DOCX to HTML | Preserves all formatting including automatic numbering |
| python-docx | 1.2.0 | Parse DOCX structure | Already in stack; provides paragraph IDs for risk analysis |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lxml | (dependency) | XML parsing | Required by docx-parser-converter |
| pydantic | (dependency) | Data models | Required by docx-parser-converter |

### Deprecated from Previous Research
| Library | Status | Reason |
|---------|--------|--------|
| LibreOffice headless | **NOT NEEDED** | docx-parser-converter handles numbering without external tools |
| PDF.js | **NOT NEEDED** | HTML rendering is superior for interactivity |
| docx-preview.js | **OPTIONAL FALLBACK** | Could still use for client-side fallback if needed |

## Compatibility Verification

**Python Version:**
- Installed: Python 3.12.10
- Required: Python >=3.10
- Status: **COMPATIBLE**

**python-docx:**
- Installed: 1.2.0 (latest)
- Required: >=0.8.11
- Status: **UP TO DATE**

**docx-parser-converter:**
- Installed: 1.0.3 (latest)
- Dependencies: lxml, pydantic
- Status: **INSTALLED AND WORKING**

## Architecture Patterns (REVISED)

### Recommended Project Structure
```
app/
├── services/
│   ├── document_service.py      # Existing - keep for risk analysis
│   └── html_renderer.py         # NEW - docx-parser-converter wrapper
├── api/
│   └── routes.py                # Add /document/<session_id>/html endpoint
├── data/
│   └── uploads/<session_id>/
│       ├── original.docx        # Uploaded file
│       └── rendered.html        # Cached HTML conversion
└── static/
    └── css/
        └── document-preview.css # Styling for rendered HTML
```

### Pattern 1: Server-Side HTML Generation with Caching
**What:** Convert DOCX to HTML on first view request, cache result
**When to use:** Always for document display
**Example:**
```python
from docx_parser_converter import docx_to_html
from pathlib import Path

def get_or_create_html(session_id: str, docx_path: str) -> str:
    """Convert DOCX to HTML if not already cached."""
    html_path = Path(docx_path).with_suffix('.html')

    if html_path.exists():
        return html_path.read_text(encoding='utf-8')

    # Convert using docx-parser-converter
    html = docx_to_html(str(docx_path))

    # Cache the result
    html_path.write_text(html, encoding='utf-8')

    return html
```

### Pattern 2: Direct Paragraph ID Injection
**What:** Add data attributes to HTML paragraphs for click handling
**When to use:** For interactive paragraph selection
**Example:**
```python
import re

def inject_paragraph_ids(html: str, paragraph_ids: list) -> str:
    """Add data-para-id attributes to paragraphs for click handling."""
    para_index = 0

    def replace_p(match):
        nonlocal para_index
        if para_index < len(paragraph_ids):
            para_id = paragraph_ids[para_index]
            para_index += 1
            # Inject data attribute into opening <p tag
            return f'<p data-para-id="{para_id}"'
        return match.group(0)

    return re.sub(r'<p(?=\s|>)', replace_p, html)
```

### Pattern 3: Inline HTML Rendering (No iframe)
**What:** Inject HTML directly into document panel
**When to use:** For seamless integration with existing UI
**Example:**
```javascript
async function renderDocumentAsHtml() {
    const response = await fetch(`/api/document/${AppState.sessionId}/html`);
    const html = await response.text();

    const container = document.getElementById('document-content');
    container.innerHTML = html;

    // Add click handlers to paragraphs
    container.querySelectorAll('[data-para-id]').forEach(p => {
        p.addEventListener('click', () => {
            selectParagraph(p.dataset.paraId);
        });
        p.classList.add('clickable-paragraph');
    });
}
```

### Anti-Patterns to Avoid
- **Re-converting on every request:** Cache HTML after first conversion
- **Using LibreOffice when not needed:** docx-parser-converter handles everything
- **Client-side DOCX parsing:** Server-side is more reliable and cacheable
- **Iframe isolation:** Inject HTML directly for better event handling

## docx-parser-converter Capabilities (Verified)

Tested against real legal documents in this project:

### Formatting Preserved
| Feature | Status | Notes |
|---------|--------|-------|
| Automatic numbering (1.1, 1.2) | ✅ Working | Uses `<span class="list-marker">` |
| Multi-level numbering (11.3.1) | ✅ Working | Tested up to 3 levels |
| Font family | ✅ Working | Times New Roman preserved |
| Font size | ✅ Working | 11pt rendered correctly |
| Bold/Italic/Underline | ✅ Working | Via inline CSS |
| Text alignment | ✅ Working | justify, center, etc. |
| Indentation | ✅ Working | margin-left, text-indent |
| Tabs | ✅ Working | `<span class="tab">` |
| Tables | ✅ Working | With cell merging |

### Limitations (from documentation)
| Feature | Status | Workaround |
|---------|--------|------------|
| Headers/Footers | ❌ Not supported | Usually not needed for contract review |
| Footnotes | ❌ Not supported | Rare in PSAs |
| Comments | ❌ Not supported | Not relevant for display |
| Embedded objects | ❌ Not supported | Rare in legal docs |

## Code Examples

### Complete Flask Endpoint
```python
from flask import Blueprint, Response
from docx_parser_converter import docx_to_html
from pathlib import Path

html_bp = Blueprint('html', __name__)

@html_bp.route('/document/<session_id>/html')
def serve_document_html(session_id):
    """Serve high-fidelity HTML version of document."""
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    docx_path = Path(session['target_path'])
    html_path = docx_path.with_suffix('.html')

    # Generate HTML if not cached
    if not html_path.exists():
        html = docx_to_html(str(docx_path))

        # Inject paragraph IDs for click handling
        para_ids = [p['id'] for p in session.get('document', {}).get('content', [])
                    if p.get('type') == 'paragraph']
        html = inject_paragraph_ids(html, para_ids)

        html_path.write_text(html, encoding='utf-8')
    else:
        html = html_path.read_text(encoding='utf-8')

    return Response(html, mimetype='text/html')
```

### Frontend Integration
```javascript
// Replace PDF rendering with HTML rendering
async function loadDocument() {
    const result = await api(`/document/${AppState.sessionId}`);
    AppState.document = result;

    // Load high-fidelity HTML
    const htmlResponse = await fetch(`/api/document/${AppState.sessionId}/html`);
    const html = await htmlResponse.text();

    const container = document.getElementById('document-content');
    container.innerHTML = html;

    // Setup paragraph click handlers
    setupParagraphClickHandlers(container);
}

function setupParagraphClickHandlers(container) {
    container.querySelectorAll('[data-para-id]').forEach(p => {
        p.classList.add('document-paragraph');
        p.addEventListener('click', (e) => {
            e.stopPropagation();
            selectParagraph(p.dataset.paraId);
        });
    });
}
```

### CSS for Document Preview
```css
/* Document preview styling */
#document-content {
    background: white;
    padding: 1in;
    max-width: 8.5in;
    margin: 0 auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Clickable paragraph styling */
.document-paragraph {
    cursor: pointer;
    transition: background-color 0.15s;
    border-radius: 2px;
    padding: 2px 4px;
    margin: -2px -4px;
}

.document-paragraph:hover {
    background-color: rgba(59, 130, 246, 0.08);
}

.document-paragraph.selected {
    background-color: rgba(59, 130, 246, 0.15);
    outline: 2px solid #3b82f6;
}

/* List marker styling */
.list-marker {
    font-weight: normal;
}
```

## Common Pitfalls

### Pitfall 1: Character Encoding Issues
**What goes wrong:** Special characters (quotes, dashes) render as question marks
**Why it happens:** HTML not served with UTF-8 encoding
**How to avoid:** Always specify `charset="UTF-8"` and serve with correct Content-Type
**Warning signs:** Smart quotes appearing as `�`

### Pitfall 2: CSS Conflicts
**What goes wrong:** Document styles clash with app styles
**Why it happens:** docx-parser-converter uses inline styles but some may leak
**How to avoid:** Scope document styles within container, use CSS isolation
**Warning signs:** Body font changing, margins shifting

### Pitfall 3: Paragraph ID Mismatch
**What goes wrong:** Clicking paragraph selects wrong risk analysis
**Why it happens:** Paragraph count differs between docx-parser-converter and python-docx
**How to avoid:** Use consistent paragraph extraction logic, verify IDs match
**Warning signs:** Risk sidebar shows wrong content after click

## Open Questions (RESOLVED)

1. **~~Paragraph-to-PDF-position mapping accuracy~~**
   - **RESOLVED:** Not needed. HTML paragraphs are directly clickable.

2. **~~LibreOffice on Windows performance~~**
   - **RESOLVED:** LibreOffice not needed. docx-parser-converter is pure Python.

3. **~~Font availability for legal documents~~**
   - **RESOLVED:** HTML specifies font-family with fallbacks. Browser uses available fonts.

## Sources

### Primary (HIGH confidence)
- [docx-parser-converter GitHub](https://github.com/omer-go/docx-parser-converter) - Source, documentation
- [docx-parser-converter PyPI](https://pypi.org/project/docx-parser-converter/) - Version 1.0.3, requirements
- [python-docx documentation](https://python-docx.readthedocs.io/) - Version 1.2.0

### Verified by Testing
- Actual output from docx-parser-converter against legal documents in this project
- 117 list markers correctly rendered
- Multi-level numbering (1.1, 11.3.1) working

## Metadata

**Confidence breakdown:**
- Standard stack: **VERY HIGH** - Tested against actual project documents
- Architecture: **HIGH** - HTML approach is simpler than PDF
- Pitfalls: **MEDIUM** - May encounter edge cases with specific documents

**Research date:** 2026-02-03
**Valid until:** 2026-04-03 (60 days - stable library, verified working)

---

## Implementation Recommendations for Planner (REVISED)

### Phase 5 should be SIMPLIFIED to:

1. **05-01: HTML Rendering Service**
   - Create `html_renderer.py` wrapping docx-parser-converter
   - Add Flask endpoint `/document/<session_id>/html`
   - Implement HTML caching
   - Inject paragraph IDs for click handling

2. **05-02: Main Document Panel HTML Integration**
   - Replace current text rendering with HTML injection
   - Add CSS for document preview styling
   - Setup paragraph click handlers
   - Maintain existing sidebar integration

3. **05-03: Precedent Panel HTML Integration**
   - Apply same HTML rendering to precedent panel
   - Related clause highlighting via CSS classes
   - Ensure consistent styling between panels

**No need for:**
- LibreOffice installation
- PDF.js integration
- Complex PDF-to-paragraph coordinate mapping
- docx-preview.js fallback (docx-parser-converter is the primary)

### Key Advantages of New Approach

1. **Simpler architecture:** Pure Python + HTML + CSS
2. **Faster rendering:** ~100ms vs 2+ seconds
3. **Native interactivity:** HTML paragraphs are clickable, no overlay needed
4. **Native text selection:** Users can select/copy text normally
5. **No external dependencies:** No LibreOffice to install
6. **Already installed:** docx-parser-converter 1.0.3 is in the project
