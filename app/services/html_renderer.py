"""
HTML Renderer Service

Converts DOCX files to high-fidelity HTML using docx-parser-converter.
Preserves formatting, automatic numbering, indentation, and styles.
"""

import re
from pathlib import Path
from typing import List, Optional
from docx_parser_converter import docx_to_html


def inject_paragraph_ids(html: str, paragraph_ids: List[str]) -> str:
    """
    Add data-para-id attributes to paragraphs for click handling.

    Maps rendered HTML paragraphs to document paragraph IDs so clicking
    a paragraph in the preview triggers the correct risk sidebar.
    """
    para_index = 0

    def replace_p(match):
        nonlocal para_index
        if para_index < len(paragraph_ids):
            para_id = paragraph_ids[para_index]
            para_index += 1
            # Inject data attribute into opening <p tag
            return f'<p data-para-id="{para_id}"'
        return match.group(0)

    return re.sub(r'<p(?=[\s>])', replace_p, html)


def add_preview_wrapper(html: str) -> str:
    """
    Wrap the HTML body content for embedding in the app.

    Extracts just the <main> content and adds our preview class.
    """
    # Extract content between <main> tags if present
    main_match = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
    if main_match:
        content = main_match.group(1)
    else:
        # Extract body content
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
        content = body_match.group(1) if body_match else html

    # Extract styles from head and scope them to avoid leaking into the host page.
    # The library emits bare `body { ... }` rules that would affect the real <body>.
    style_match = re.search(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
    styles = style_match.group(1) if style_match else ''
    # Replace bare `body` selectors with `.document-preview` so they stay scoped
    styles = re.sub(r'\bbody\b', '.document-preview', styles)

    # Neutralize the library's body styles that leak into the page,
    # and remove the heavy padding so documents fill their panel width.
    return f'''<style>
.document-preview {{
    font-family: 'Calibri', 'Arial', sans-serif;
    line-height: 1.5;
    padding: 0.25in 0.4in;
    background: white;
}}
.document-preview p {{ margin: 0; }}
.document-preview .list-marker {{ font-weight: normal; }}
{styles}
/* Override library body styles that leak into the host page */
.document-preview body,
.document-preview main {{
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
}}
</style>
<div class="document-preview">{content}</div>'''


def render_document_html(docx_path: str, paragraph_ids: Optional[List[str]] = None,
                         use_cache: bool = True) -> str:
    """
    Convert DOCX to high-fidelity HTML.

    Args:
        docx_path: Path to the DOCX file
        paragraph_ids: List of paragraph IDs to inject for click handling
        use_cache: Whether to use/create cached HTML

    Returns:
        HTML string ready for browser display
    """
    docx_path = Path(docx_path)
    cache_path = docx_path.with_suffix('.rendered.html')

    # Check cache
    if use_cache and cache_path.exists():
        # Cache exists - but we need to re-inject IDs if provided
        html = cache_path.read_text(encoding='utf-8')
        if paragraph_ids:
            # Re-inject IDs (they may have changed)
            html = inject_paragraph_ids(html, paragraph_ids)
        return html

    # Convert DOCX to HTML using docx-parser-converter
    raw_html = docx_to_html(str(docx_path))

    # Wrap for preview display
    html = add_preview_wrapper(raw_html)

    # Inject paragraph IDs if provided
    if paragraph_ids:
        html = inject_paragraph_ids(html, paragraph_ids)

    # Cache the result (without IDs - they get injected on read)
    if use_cache:
        cache_path.write_text(add_preview_wrapper(raw_html), encoding='utf-8')

    return html


def render_precedent_html(docx_path: str, paragraph_ids: Optional[List[str]] = None,
                          use_cache: bool = True) -> str:
    """
    Convert precedent DOCX to high-fidelity HTML.

    Same as render_document_html but uses separate cache file.
    """
    docx_path = Path(docx_path)
    cache_path = docx_path.with_suffix('.precedent.html')

    # Check cache
    if use_cache and cache_path.exists():
        html = cache_path.read_text(encoding='utf-8')
        if paragraph_ids:
            html = inject_paragraph_ids(html, paragraph_ids)
        return html

    # Convert DOCX to HTML
    raw_html = docx_to_html(str(docx_path))

    # Wrap for preview display
    html = add_preview_wrapper(raw_html)

    # Inject paragraph IDs if provided
    if paragraph_ids:
        html = inject_paragraph_ids(html, paragraph_ids)

    # Cache the result
    if use_cache:
        cache_path.write_text(add_preview_wrapper(raw_html), encoding='utf-8')

    return html


def clear_html_cache(docx_path: str) -> None:
    """Clear cached HTML files for a document."""
    docx_path = Path(docx_path)
    for suffix in ['.rendered.html', '.precedent.html']:
        cache_path = docx_path.with_suffix(suffix)
        if cache_path.exists():
            cache_path.unlink()
