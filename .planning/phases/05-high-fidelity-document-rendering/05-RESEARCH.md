# Phase 5: High-Fidelity Document Rendering - Research

**Researched:** 2026-02-02
**Domain:** DOCX to HTML/PDF rendering, browser document preview
**Confidence:** HIGH

## Summary

Rendering Word documents with high fidelity in a web browser is a well-understood challenge with established solutions. The core tension is between client-side JavaScript libraries (faster, no server round-trip) and server-side conversion (more accurate, handles complex formatting). For legal documents requiring pixel-perfect automatic numbering and indentation, the **recommended approach is a hybrid architecture**: use **LibreOffice headless server-side conversion to PDF** for the primary rendering, with **PDF.js** for browser display. As a fallback for simpler documents or when PDF isn't suitable, **docx-preview.js** provides the best client-side rendering quality.

The critical requirement - automatic numbering - is the Achilles heel of pure JavaScript rendering libraries. Mammoth.js explicitly ignores visual formatting. Docx-preview.js handles numbering better but can still have edge cases with complex legal numbering schemes (1.1(a)(i)). LibreOffice conversion to PDF preserves numbering with near-perfect fidelity because it uses Word's actual rendering engine equivalent.

**Primary recommendation:** Use LibreOffice headless to convert DOCX to PDF on upload/first-access, cache the PDF, and serve via PDF.js or iframe embedding. Keep paragraph position mapping in the original parsed JSON for click-to-select functionality.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LibreOffice | 7.6+ | Server-side DOCX to PDF conversion | Most accurate DOCX rendering engine outside MS Word itself |
| PDF.js | 4.0+ | Browser PDF rendering | Mozilla's official PDF viewer, widely deployed, battle-tested |
| docx-preview | 0.3.7 | Client-side DOCX to HTML fallback | Best formatting preservation of JS-only solutions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| subprocess (Python stdlib) | - | Execute LibreOffice headless | Required for server-side conversion |
| python-docx | 0.8.11+ | Parse DOCX for paragraph mapping | Already in stack; provides paragraph IDs |
| Flask send_from_directory | - | Serve cached PDF files | Efficient static file serving |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LibreOffice | Aspose/ConvertAPI commercial APIs | Better accuracy but costs money, network dependency |
| PDF.js | iframe embed | Simpler but less control over UI/interaction |
| docx-preview | mammoth.js | Mammoth loses all visual formatting (font sizes, colors, alignment) |

**Installation:**
```bash
# Server-side (LibreOffice - Windows)
winget install LibreOffice.LibreOffice
# Or download from https://www.libreoffice.org/download/download/

# Python dependencies (already have most)
pip install python-docx

# Client-side (CDN or npm)
# PDF.js: https://mozilla.github.io/pdf.js/
# docx-preview: npm install docx-preview
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── services/
│   ├── document_service.py      # Existing - add PDF conversion methods
│   └── pdf_service.py           # NEW - LibreOffice conversion logic
├── api/
│   └── routes.py                # Add /pdf/<session_id> endpoint
├── data/
│   └── uploads/<session_id>/
│       ├── original.docx        # Uploaded file
│       └── rendered.pdf         # Cached PDF conversion
└── static/
    └── js/
        └── document-viewer.js   # PDF.js/docx-preview integration
```

### Pattern 1: Lazy PDF Generation with Caching
**What:** Convert DOCX to PDF on first view request, cache result
**When to use:** Always for main document panel
**Example:**
```python
# Source: LibreOffice documentation + Flask patterns
import subprocess
from pathlib import Path

def get_or_create_pdf(session_id: str, docx_path: str) -> str:
    """Convert DOCX to PDF if not already cached."""
    pdf_path = Path(docx_path).with_suffix('.pdf')

    if pdf_path.exists():
        return str(pdf_path)

    # LibreOffice headless conversion
    result = subprocess.run([
        'soffice',  # 'libreoffice' on Linux
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', str(Path(docx_path).parent),
        docx_path
    ], capture_output=True, timeout=30)

    # LibreOffice returns 0 even on failure, check file exists
    if not pdf_path.exists():
        raise RuntimeError(f"PDF conversion failed: {result.stderr.decode()}")

    return str(pdf_path)
```

### Pattern 2: Paragraph Position Overlay
**What:** Overlay clickable regions on PDF using parsed paragraph positions
**When to use:** When users need to click paragraphs to view risk analysis
**Example:**
```javascript
// Source: Common pattern for PDF annotation systems
// After PDF renders, overlay invisible clickable divs positioned
// based on paragraph boundaries from parsed document JSON

async function renderDocumentWithOverlay(pdfUrl, parsedDoc) {
    const container = document.getElementById('document-container');

    // Render PDF
    const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
    // ... render pages ...

    // Create overlay layer
    const overlay = document.createElement('div');
    overlay.className = 'paragraph-overlay';

    // Position clickable regions based on paragraph data
    // This requires mapping paragraph positions to PDF coordinates
    // which is the main architectural challenge
}
```

### Pattern 3: Dual-Mode Rendering
**What:** Use PDF for display, keep parsed JSON for interactivity
**When to use:** When you need both visual fidelity and structured data access
**Example:**
```javascript
// Document state maintains both representations
const DocumentState = {
    pdf: null,           // PDF.js document object
    parsed: null,        // Parsed JSON with paragraph structure
    selectedParaId: null
};

// Click on PDF triggers lookup in parsed structure
function handlePdfClick(pageNum, x, y) {
    // Map click coordinates to paragraph
    const para = findParagraphAtPosition(DocumentState.parsed, pageNum, x, y);
    if (para) {
        selectParagraph(para.id);
    }
}
```

### Anti-Patterns to Avoid
- **Re-rendering on every selection:** Convert once on upload/first-access, cache the PDF
- **Using mammoth.js for legal docs:** It explicitly strips formatting; automatic numbering will be lost
- **Parsing PDF to extract structure:** PDF is designed for rendering, not structure; keep DOCX parsing for structure
- **Synchronous LibreOffice calls:** Always use async/timeout; LibreOffice can hang

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOCX to HTML conversion | Custom OOXML parser | docx-preview.js | OOXML spec is 6,000+ pages; numbering alone is horrifically complex |
| PDF rendering in browser | Canvas-based custom renderer | PDF.js | Mozilla maintains this; handles fonts, CJK, RTL, annotations |
| DOCX to PDF conversion | python-docx + reportlab | LibreOffice headless | Word numbering resolution requires full Word rendering engine |
| Automatic numbering display | CSS counters matching Word logic | Let LibreOffice handle it | Word's numbering.xml has 20+ numbering types, restart rules, level inheritance |

**Key insight:** OOXML (the format behind .docx) is one of the most complex document formats ever created. The numbering specification alone involves abstract numbering definitions, concrete numbering instances, paragraph style inheritance, and level overrides. No JavaScript library fully implements this. LibreOffice has person-decades of development to handle it correctly.

## Common Pitfalls

### Pitfall 1: Assuming LibreOffice Exit Code Means Success
**What goes wrong:** LibreOffice returns exit code 0 even when conversion fails
**Why it happens:** LibreOffice's CLI error handling is quirky
**How to avoid:** Check that output file exists after conversion
**Warning signs:** Empty or missing PDF files despite no subprocess error

### Pitfall 2: Concurrent LibreOffice Requests Fail Silently
**What goes wrong:** Multiple simultaneous conversions produce corrupted or missing outputs
**Why it happens:** LibreOffice can't handle concurrent headless instances cleanly
**How to avoid:** Use a queue or lock; one conversion at a time
**Warning signs:** Intermittent conversion failures under load

### Pitfall 3: Click-to-Paragraph Mapping Drift
**What goes wrong:** Clicking on rendered PDF selects wrong paragraph
**Why it happens:** PDF page layout differs from source DOCX paragraph boundaries
**How to avoid:** Either (a) accept approximate mapping, or (b) render paragraphs separately with ID anchors
**Warning signs:** Off-by-one paragraph selections, especially around page breaks

### Pitfall 4: Font Substitution Changes Layout
**What goes wrong:** Document renders with different fonts, changing line breaks and pagination
**Why it happens:** Server doesn't have same fonts as original document
**How to avoid:** Install common legal fonts (Times New Roman, Arial, Calibri); embed fonts in conversion if possible
**Warning signs:** Text wrapping differs, automatic numbers appear on different lines

### Pitfall 5: docx-preview Numbering Edge Cases
**What goes wrong:** Complex legal numbering (1.1(a)(i)(A)) renders incorrectly or not at all
**Why it happens:** docx-preview doesn't implement all OOXML numbering features
**How to avoid:** For documents with complex numbering, use PDF rendering path
**Warning signs:** Numbers like "(i)" rendered as "1" or missing entirely

## Code Examples

Verified patterns from official sources:

### LibreOffice Headless Conversion (Python)
```python
# Source: https://michalzalecki.com/converting-docx-to-pdf-using-python/
import subprocess
import sys
from pathlib import Path

def libreoffice_exec():
    """Return LibreOffice executable path based on platform."""
    if sys.platform == 'win32':
        return r'C:\Program Files\LibreOffice\program\soffice.exe'
    elif sys.platform == 'darwin':
        return '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    else:
        return 'libreoffice'

def convert_docx_to_pdf(docx_path: str, output_dir: str = None) -> str:
    """
    Convert DOCX to PDF using LibreOffice headless.
    Returns path to generated PDF.
    """
    docx_path = Path(docx_path)
    output_dir = Path(output_dir or docx_path.parent)

    result = subprocess.run(
        [
            libreoffice_exec(),
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', str(output_dir),
            str(docx_path)
        ],
        capture_output=True,
        timeout=60  # Generous timeout for large documents
    )

    expected_pdf = output_dir / f"{docx_path.stem}.pdf"

    if not expected_pdf.exists():
        stderr = result.stderr.decode('utf-8', errors='ignore')
        raise RuntimeError(f"Conversion failed: {stderr}")

    return str(expected_pdf)
```

### Flask PDF Serving Endpoint
```python
# Source: Flask documentation patterns
from flask import Blueprint, send_file, abort
from pathlib import Path

pdf_bp = Blueprint('pdf', __name__)

@pdf_bp.route('/document/<session_id>/pdf')
def serve_document_pdf(session_id):
    """Serve PDF version of document, generating if needed."""
    session_dir = Path(f'app/data/uploads/{session_id}')
    docx_files = list(session_dir.glob('*.docx'))

    if not docx_files:
        abort(404, 'No document found')

    docx_path = docx_files[0]
    pdf_path = docx_path.with_suffix('.pdf')

    # Generate PDF if not cached
    if not pdf_path.exists():
        try:
            convert_docx_to_pdf(str(docx_path), str(session_dir))
        except Exception as e:
            abort(500, f'PDF conversion failed: {e}')

    return send_file(
        pdf_path,
        mimetype='application/pdf',
        as_attachment=False
    )
```

### PDF.js Basic Integration (Frontend)
```html
<!-- Source: https://mozilla.github.io/pdf.js/ -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';

async function renderPdf(url, container) {
    const pdf = await pdfjsLib.getDocument(url).promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        container.appendChild(canvas);
    }
}
</script>
```

### docx-preview Fallback Integration
```html
<!-- Source: https://github.com/VolodymyrBaydalka/docxjs -->
<script src="https://unpkg.com/docx-preview@0.3.7/dist/docx-preview.min.js"></script>
<script>
async function renderDocxFallback(docxBlob, container) {
    await docx.renderAsync(docxBlob, container, null, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        experimental: false,
        debug: false
    });

    // Add click handlers to rendered paragraphs
    container.querySelectorAll('p').forEach((p, index) => {
        p.dataset.paraIndex = index;
        p.addEventListener('click', () => handleParagraphClick(index));
    });
}
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas-based DOCX viewers | HTML-based rendering (docx-preview) | 2022-2023 | Better text selection, accessibility |
| Server-side HTML generation | Client-side rendering + Server PDF | 2024 | Faster initial load, better fidelity |
| unoconv for LibreOffice calls | Direct subprocess to soffice | 2023 | unoconv deprecated, subprocess more reliable |
| Custom PDF rendering | PDF.js 4.x | 2024 | Better performance, smaller bundle |

**Deprecated/outdated:**
- **unoconv:** Officially deprecated, use direct LibreOffice subprocess or unoserver
- **mammoth.js for visual fidelity:** Never appropriate; it's designed for semantic HTML, not visual reproduction
- **Google Docs Viewer embed:** Requires public URLs, not suitable for private legal documents

## Open Questions

Things that couldn't be fully resolved:

1. **Paragraph-to-PDF-position mapping accuracy**
   - What we know: PDF.js provides text layer with positional data; DOCX parsing provides paragraph boundaries
   - What's unclear: How reliably can we map click positions to specific paragraphs across page breaks?
   - Recommendation: Prototype with test legal documents; may need to accept "nearest paragraph" selection

2. **LibreOffice on Windows performance**
   - What we know: LibreOffice headless works on Windows; ~2 second conversion time typical
   - What's unclear: Whether Windows Defender scans slow this down; whether any Windows-specific issues exist
   - Recommendation: Test on David's actual Windows environment; consider caching aggressively

3. **Font availability for legal documents**
   - What we know: Legal docs often use Times New Roman, Arial, Calibri - common fonts
   - What's unclear: Whether custom firm-specific fonts will cause layout issues
   - Recommendation: Install Microsoft core fonts on any Linux server; Windows should have them

## Sources

### Primary (HIGH confidence)
- [docx-preview GitHub](https://github.com/VolodymyrBaydalka/docxjs) - Features, API, version 0.3.7
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/) - Browser PDF rendering
- [LibreOffice Documentation](https://help.libreoffice.org/) - Command line conversion options

### Secondary (MEDIUM confidence)
- [LibreOffice to PDF Python Guide](https://michalzalecki.com/converting-docx-to-pdf-using-python/) - Verified subprocess patterns
- [docx-preview demo](https://jstool.gitlab.io/demo/docx-preview.js_word_to_html/) - Feature verification
- [OOXML Numbering Spec](http://officeopenxml.com/WPnumbering.php) - Numbering complexity reference

### Tertiary (LOW confidence)
- [Flask PDF Microservice patterns](https://omribeladev.medium.com/from-12-seconds-to-1-building-a-lightning-fast-docx-to-pdf-converter-with-flask-and-docker-8f9efb6edbb8) - Docker deployment patterns
- npm-compare comparisons - docx-preview vs mammoth.js feature comparison

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - LibreOffice and PDF.js are industry standards with extensive documentation
- Architecture: HIGH - Lazy PDF generation with caching is a proven pattern
- Pitfalls: MEDIUM - Based on GitHub issues and Stack Overflow; may miss Windows-specific issues

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, libraries update slowly)

---

## Implementation Recommendations for Planner

### Phase 5 should be split into sub-tasks:

1. **05-01: PDF Service Setup**
   - Install/verify LibreOffice on development machine
   - Create `pdf_service.py` with conversion function
   - Add Flask endpoint for serving cached PDFs
   - Test with sample legal documents

2. **05-02: Main Document Panel PDF Rendering**
   - Integrate PDF.js into main document panel
   - Replace current text-based rendering with PDF canvas rendering
   - Maintain paragraph selection via overlay or coordinate mapping

3. **05-03: Precedent Panel PDF Rendering**
   - Apply same PDF rendering to precedent panel
   - Ensure both panels use identical rendering engine
   - Handle panel resizing gracefully

4. **05-04: Fallback and Edge Cases**
   - Implement docx-preview.js as fallback when PDF conversion fails
   - Handle documents without automatic numbering (simpler path)
   - Add loading states during PDF generation

### Key Decision Required
The planner should decide: **How critical is click-to-select paragraph functionality?**
- If critical: Need to implement coordinate mapping between PDF and parsed JSON (complex)
- If nice-to-have: Can use scroll-to-section navigation instead (simpler)
- Current app uses click-to-select extensively; probably need coordinate mapping

### Integration with Existing Code
The current `document_service.py` already parses DOCX to JSON with paragraph IDs. The PDF rendering approach should:
1. Keep the existing parsing for risk analysis data
2. Add PDF rendering for visual display only
3. Bridge between them via paragraph ID <-> PDF position mapping
