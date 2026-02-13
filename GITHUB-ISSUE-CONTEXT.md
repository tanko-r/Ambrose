# GitHub Issue: Font Rendering in Bottom Sheet

**Issue Title:** Fix font rendering in bottom sheet so that font (or at least font category) is inherited from the displayed document

**User Description:** "fix font rendering in bottom sheet so that font (or at least font category) is inherited from the displayed document. possibly use separate superdoc instances to handle this? or prosemirror? also, need to inherit basic text formatting."

---

## Current Implementation

### Bottom Sheet Component Stack

The revision bottom sheet is implemented with three interconnected components:

1. **RevisionSheet** (`frontend/src/components/review/revision-sheet.tsx`, 175 lines)
   - Fixed-position panel that slides up from bottom
   - Uses CSS animations (slide-up transition)
   - Snap heights: 25vh, 50vh, 100vh
   - Non-modal drawer (`modal={false}`)
   - Header displays section reference + paragraph excerpt
   - Integrates TrackChangesEditor with ref-based HTML management
   - Displays rationale in violet gradient blockquote

2. **TrackChangesEditor** (`frontend/src/components/review/track-changes-editor.tsx`, 172 lines)
   - Imperative contentEditable wrapper (React does NOT reconcile inner HTML)
   - Manages track changes via custom spans: `.user-addition` (blue underline) and `.user-deletion` (red strikethrough)
   - Undo/redo via innerHTML snapshots (50-entry stack)
   - Event handlers: `beforeinput`, `keydown` for insertions, deletions, undo/redo
   - All HTML management via refs, zero use of `dangerouslySetInnerHTML`

3. **RevisionActions** (`frontend/src/components/review/revision-actions.tsx`, 65 lines)
   - Button bar for accept/reject/reset/reopen
   - State-driven rendering (accepted vs. pending)

### Current Font Styling

**In RevisionSheet container:**
- `.revision-diff` class applies hardcoded font (line 253-255 in `globals.css`):
  ```css
  .revision-diff {
    font-family: 'Calibri', 'Carlito', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.5;
  }
  ```

**In DocumentViewer:**
- `.document-container` class applies font (line 177-179 in `globals.css`):
  ```css
  .document-container {
    font-family: var(--font-geist-sans), system-ui, sans-serif;
    line-height: 1.6;
  }
  ```
- Actual document HTML comes from `html_renderer.py` which uses `docx-parser-converter` to convert DOCX to high-fidelity HTML
- Rendered HTML preserves inline styles from the original Word document (font, size, weight, etc.)

### Document Rendering Infrastructure

**Backend: `app/services/html_renderer.py`**
- `render_document_html()`: Converts DOCX → HTML via `docx_parser_converter.docx_to_html()`
- `render_precedent_html()`: Same process for precedent document
- `inject_paragraph_ids()`: Adds `data-para-id` attributes to `<p>` tags for click handling
- `add_preview_wrapper()`: Wraps HTML content in div with `.document-preview` class
- Uses cache files: `.rendered.html` and `.precedent.html`

**Frontend: `frontend/src/components/review/document-viewer.tsx`**
- Renders DocumentViewer with two modes:
  1. **High-fidelity HTML mode** (preferred): `dangerouslySetInnerHTML={{ __html: documentHtml }}`
  2. **Fallback plain-text mode**: Renders paragraphs as divs if HTML unavailable
- Attaches click handlers and visual state management (selection, risk indicators, revision status)
- Does NOT currently preserve or inherit font information from document HTML

### What's Missing

**Current Behavior:**
- Bottom sheet revision editor uses hardcoded Calibri font
- Document viewer displays original document with its fonts intact
- Revision editor has NO connection to the source document's font styling

**Problems:**
1. **Inconsistent visual context**: User sees original text in one font (e.g., Arial 12pt), but proposed revision in different font (Calibri 11pt)
2. **Loss of formatting fidelity**: If document uses styled paragraphs (e.g., indented, bold section headers), revision editor strips this context
3. **No basic text formatting inheritance**: User can't see if they're editing bold text, italic text, indented paragraphs, etc.

---

## Technical Constraints & Considerations

### Current Architecture

| Component | Technology | State | Notes |
|-----------|-----------|-------|-------|
| Document Viewer | Vanilla HTML + Click handlers | Renders full `documentHtml` from backend | Uses `docx-parser-converter` for faithful DOCX→HTML |
| Revision Editor | contentEditable div + custom spans | Imperative DOM management | No HTML sanitization or structured format |
| Style Application | CSS classes + inline styles | Hardcoded per component | No dynamic font inheritance |
| Track Changes | Custom `<ins>`/`<del>` spans | Hardcoded CSS colors | Blue underline = addition, Red strikethrough = deletion |

### Data Available to Bottom Sheet

From Zustand store (`frontend/src/lib/store.ts`):
```typescript
interface Paragraph {
  id: string;
  type: 'paragraph' | 'heading' | 'table' | 'image';
  text: string;              // Plain text, no formatting
  section_ref: string;       // e.g., "1.3"
  section_hierarchy: SectionHierarchyItem[];
  style?: string;            // OPTIONAL: style name from Word (e.g., "Normal", "Heading 1")
  indent_level?: number;
  numbering?: string;
}
```

**Critical Gap**: The `Paragraph` type has an optional `style` field, but:
1. The field is not currently populated from parsed documents
2. The backend doesn't extract font details from DOCX (only layout/structure)
3. No font metadata is available in the parsed document structure

### Revision Data Structure

```typescript
interface Revision {
  original: string;          // Plain text
  revised: string;           // Plain text
  rationale: string;
  diff_html: string;         // HTML with <ins>/<del> tags
  related_revisions: RelatedRevision[];
  accepted: boolean;
  timestamp: string;
  editedHtml?: string;       // User-edited HTML from contentEditable
}
```

**Note**: `diff_html` is generated by Gemini API and contains HTML markup, but no font information.

---

## Possible Solutions

### Option 1: Extract Font Metadata from DOCX (Backend-First)

**Approach:**
- Modify document parser to extract font/formatting details from each paragraph
- Store in Paragraph metadata: `font_name`, `font_size`, `bold`, `italic`, `indent`, etc.
- Pass to frontend in API response
- Apply extracted styles to `.revision-diff` container via inline styles or CSS classes

**Pros:**
- Single source of truth (font info from original DOCX)
- Works with all document types
- Minimal frontend changes

**Cons:**
- Requires Python DOCX parsing library work (python-docx offers this)
- Backend API response grows with new fields
- May not capture all Word formatting edge cases (complex styles, themes, etc.)

**Implementation Effort:** High (document parser enhancement)

---

### Option 2: Extract Inline Styles from Rendered HTML (Frontend-First)

**Approach:**
- When rendering bottom sheet for a paragraph, find the corresponding HTML element in DocumentViewer
- Extract computed styles (font, size, color, weight) from that element
- Apply via `style` attribute or CSS variables to RevisionSheet
- Use `window.getComputedStyle()` for the source paragraph element

**Pros:**
- No backend changes required
- Works with fonts as rendered (after CSS cascade)
- Can extract complex computed styles

**Cons:**
- DOM-dependent (fragile if structure changes)
- Requires finding the correct source element
- May capture unintended styles from parent containers

**Implementation Effort:** Medium (frontend CSS variable/style injection)

---

### Option 3: Use Separate superdoc/ProseMirror Instance

**Approach:**
- Create separate document rendering instance in bottom sheet using superdoc or ProseMirror
- Render the source paragraph + revision side-by-side
- ProseMirror provides structured document model with full formatting support
- superdoc offers lightweight DOCX preview capability

**Pros:**
- Full formatting fidelity (bold, italic, underline, colors, spacing)
- Professional legal document rendering
- Structured format allows rich track changes
- Better UX for complex documents

**Cons:**
- Large dependencies (ProseMirror ~100KB, superdoc unknown size)
- Significant refactoring of RevisionSheet and TrackChangesEditor
- Need to adapt track-changes logic to work with structured document model
- Learning curve (ProseMirror is complex)

**Implementation Effort:** Very High (architectural change, new dependencies)

---

### Option 4: Hybrid Approach (Font Categories Only)

**Approach:**
- Classify paragraphs into categories: Normal, Heading, Bold, Indented, Italicized, etc.
- Map to CSS classes: `.para-normal`, `.para-heading`, `.para-bold`, etc.
- Apply category class to `.revision-diff` based on source paragraph style
- Extract category from `Paragraph.style` field or computed styles

**Pros:**
- Minimal implementation effort
- Covers ~80% of common cases
- No new dependencies
- Works with current contentEditable architecture

**Cons:**
- Doesn't handle fine-grained formatting (specific colors, precise font sizes)
- May look generic compared to original
- Still requires metadata extraction or style analysis

**Implementation Effort:** Low to Medium (CSS class mapping)

---

## Affected Files

| File | Type | Purpose | Font Handling |
|------|------|---------|--------------|
| `frontend/src/components/review/revision-sheet.tsx` | Component | Bottom sheet container | Applies hardcoded `.revision-diff` CSS |
| `frontend/src/components/review/track-changes-editor.tsx` | Component | Editable content area | Inherits from parent `.revision-diff` |
| `frontend/src/components/review/document-viewer.tsx` | Component | Source document display | Renders `documentHtml` with inline styles |
| `frontend/src/app/globals.css` | Styles | Theme + component styles | Defines `.revision-diff` and `.document-container` fonts |
| `frontend/src/lib/store.ts` | Store | Paragraph data | `Paragraph.style` field unused |
| `frontend/src/lib/types.ts` | Types | Data structures | `Paragraph` interface; no font fields beyond `style` |
| `app/services/html_renderer.py` | Backend | DOCX → HTML conversion | Uses `docx-parser-converter`; preserves inline styles |
| `app/services/document_service.py` | Backend | Document parsing | Extracts paragraph structure; no font metadata |

---

## Research Notes

### Current Rendering Technology

- **DOCX Conversion**: `docx_parser_converter` Python library
  - Converts DOCX to high-fidelity HTML
  - Preserves formatting, numbering, indentation
  - Outputs inline styles (font-family, font-size, etc. in `<style>` tags and inline attributes)

- **HTML Display**: React + `dangerouslySetInnerHTML`
  - Paragraph click handlers attached via `data-para-id` attributes
  - Risk highlighting via TreeWalker and manual span insertion
  - Visual states managed via CSS classes

- **Track Changes**: Custom contentEditable implementation
  - No external rich-text editor library
  - HTML manipulation via refs and custom DOM methods
  - Undo/redo via innerHTML snapshots

### Rendering Libraries Mentioned

- **superdoc**: Lightweight DOCX/DOCM preview (not currently integrated)
- **ProseMirror**: Full-featured rich text editor with collaborative editing (not currently integrated)
- **Slate**: Another WYSIWYG editor option (not currently integrated)

None of these are currently in the project's dependencies.

---

## Recommendations for GitHub Issue

### Recommended Approach: **Option 4 (Hybrid) + Option 2 (Inline Styles)**

**Reasoning:**
1. Start with Option 2 (extract computed styles from rendered HTML) as quick fix
2. Implement Option 4 (font category classification) for better visual hierarchy
3. Reserve Options 1 & 3 for future enhancements if more fidelity needed

**Implementation Steps:**

1. **Extract Source Paragraph Styles** (Medium effort)
   - Modify `RevisionSheet` to find source paragraph HTML element
   - Get computed font properties: `font-family`, `font-size`, `font-weight`, `font-style`
   - Store in state/context for RevisionSheet child components

2. **Create Font Category System** (Low effort)
   - Define CSS classes for common formatting patterns
   - Map computed styles to categories
   - Apply category class to `.revision-diff`

3. **Inherit Text Formatting** (Medium effort)
   - Extract computed styles for: bold, italic, color, text-decoration
   - Apply via CSS custom properties or inline style object
   - Test with various document types

4. **Test & Iterate** (Ongoing)
   - Verify with real contracts (PSA, Lease, etc.)
   - Handle edge cases (complex nested styles, multiple fonts per paragraph)
   - Consider performance impact of repeated style extraction

---

## Related Issues/PRs

- **Commit:** `bcce70a` - feat(04-03): add RevisionSheet to page, auto-open, BottomBar visibility
- **Commit:** `39fe5da` - feat(04-02): create RevisionActions and RevisionSheet components
- **Commit:** `52c5b5a` - feat(04-02): create TrackChangesEditor component
- **Planning:** `.planning/phases/04-revision-bottom-sheet-track-changes/04-02-SUMMARY.md`
- **Summary:** `BOTTOM-SHEET-SUMMARY.md` - Complete Phase 04 implementation notes

---

## Success Criteria

Once fixed, bottom sheet should:
- [ ] Display same font family as source document paragraph (or reasonable fallback)
- [ ] Display approximately correct font size (or scale proportionally)
- [ ] Inherit basic text formatting (bold, italic, underline, color) from source
- [ ] Maintain visual consistency across document types
- [ ] Not impact performance when opening/switching paragraphs
- [ ] Handle edge cases: missing fonts, unsupported styles, etc.
- [ ] Preserve existing track-changes functionality (deletions/insertions still visible)

---

**Last Updated:** 2026-02-08
**Prepared For:** GitHub Issue Tracking
