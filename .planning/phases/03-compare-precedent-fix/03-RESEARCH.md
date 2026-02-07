# Phase 3: Compare Precedent Fix - Research

**Researched:** 2026-02-02
**Domain:** Split-pane layouts, semantic clause matching, dual-document navigation
**Confidence:** MEDIUM

## Summary

This research addresses UX issues with the existing Compare Precedent feature: overlay behavior, missing precedent navigator, no auto-jump to first match, clause matching quality, and lack of user-editable correlations.

The standard approach for split-pane layouts in vanilla JavaScript is **Split.js**, a mature, zero-dependency library used in production by JSFiddle and Babylon.js Playground. For semantic clause matching beyond simple text similarity, the options range from lightweight TF-IDF with scikit-learn to transformer-based sentence embeddings. For visual correlation editing, **LeaderLine** enables drawing connection lines between matched elements.

**Primary recommendation:** Use Split.js for the resizable split layout, implement tiered matching (TF-IDF for speed, sentence-transformers for accuracy), and add LeaderLine for visual correlation editing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Split.js | 1.6.5 | Resizable split panes | Zero dependencies, 2kb gzipped, pure CSS resizing, battle-tested (JSFiddle, Babylon.js) |
| scikit-learn | 1.4+ | TF-IDF vectorization & cosine similarity | Standard ML library, fast, no external API calls |
| sentence-transformers | 3.x | Semantic embeddings for clause matching | State-of-art semantic similarity, domain-adaptable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| LeaderLine | 1.0.7 | Draw SVG lines between elements | User-editable correlation visualization |
| syncscroll | 0.0.3 | Synchronized scrolling | If proportional scroll sync needed between panels |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Split.js | CSS resize property | Less control, no callbacks, poor browser support |
| Split.js | Custom mouse events | More code, edge cases around touch, accessibility |
| sentence-transformers | spaCy similarity | Faster but less accurate for semantic matching |
| LeaderLine | Canvas drawing | More flexible but more code, harder positioning |

**Installation:**
```bash
# Frontend (CDN or npm)
npm install split.js leader-line

# Backend (Python)
pip install scikit-learn sentence-transformers
```

## Architecture Patterns

### Recommended Project Structure
```
static/
  js/
    compare/
      split-pane.js       # Split.js initialization
      navigator.js        # Dual navigator with sync
      correlations.js     # LeaderLine for visual links
      match-api.js        # Backend API calls for matching
templates/
  compare.html            # Split layout structure
backend/
  matching/
    tfidf_matcher.py      # Fast initial matching
    semantic_matcher.py   # Deep semantic matching
    correlation_store.py  # User override persistence
```

### Pattern 1: Split Layout with Content Push
**What:** Replace overlay with true split layout that pushes main content
**When to use:** Any side-by-side comparison UI
**Example:**
```javascript
// Source: https://github.com/nathancahill/split/tree/master/packages/splitjs
import Split from 'split.js';

// Initialize split with persistence
const savedSizes = JSON.parse(localStorage.getItem('compare-split-sizes')) || [60, 40];

const splitInstance = Split(['#main-document', '#precedent-panel'], {
    sizes: savedSizes,
    minSize: [300, 250],
    gutterSize: 8,
    direction: 'horizontal',
    cursor: 'col-resize',
    onDragEnd: (sizes) => {
        localStorage.setItem('compare-split-sizes', JSON.stringify(sizes));
    }
});

// CSS requirements for split layout
// .split { display: flex; flex-direction: row; }
// .gutter { background: #eee; cursor: col-resize; }
```

### Pattern 2: Dual Navigator with Active Section Highlighting
**What:** Hierarchical section navigators on both panels with matched highlighting
**When to use:** Document comparison with section-level correlation
**Example:**
```javascript
// Source: Based on IntersectionObserver patterns from CSS-Tricks
function createNavigator(containerId, sections) {
    const nav = document.getElementById(containerId);

    // Build hierarchical nav from sections
    sections.forEach(section => {
        const item = document.createElement('div');
        item.className = `nav-item level-${section.level}`;
        item.dataset.sectionId = section.id;
        item.textContent = section.heading;

        // Click to scroll
        item.addEventListener('click', () => {
            document.getElementById(section.id).scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });

        nav.appendChild(item);
    });

    // Highlight active section using IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const navItem = nav.querySelector(`[data-section-id="${entry.target.id}"]`);
            if (entry.isIntersecting) {
                navItem.classList.add('active');
            } else {
                navItem.classList.remove('active');
            }
        });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(s => observer.observe(document.getElementById(s.id)));
}
```

### Pattern 3: Visual Correlation Lines
**What:** Draw lines between matched clauses that users can modify
**When to use:** Showing which clauses correspond between documents
**Example:**
```javascript
// Source: https://github.com/anseki/leader-line
// Note: LeaderLine repository archived April 2025 but still functional

function drawCorrelationLine(sourceEl, targetEl, confidence) {
    const color = confidence > 0.8 ? '#4CAF50' :
                  confidence > 0.5 ? '#FFC107' : '#F44336';

    const line = new LeaderLine(sourceEl, targetEl, {
        color: color,
        size: 2,
        path: 'fluid',
        startSocket: 'right',
        endSocket: 'left',
        dash: confidence < 0.5
    });

    return line;
}

// Update lines when scrolling (throttled)
function updateCorrelationLines(lines) {
    lines.forEach(line => line.position());
}
```

### Pattern 4: Tiered Semantic Matching
**What:** Fast TF-IDF for initial matches, deeper transformer matching on demand
**When to use:** Balance speed vs. accuracy in clause matching
**Example:**
```python
# Source: scikit-learn docs, sentence-transformers docs

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

class ClauseMatcher:
    def __init__(self):
        self.tfidf = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words='english',
            min_df=1
        )
        self.semantic_model = None  # Lazy load

    def quick_match(self, source_clauses, target_clauses, threshold=0.3):
        """Fast TF-IDF matching for initial correlation"""
        all_clauses = source_clauses + target_clauses
        tfidf_matrix = self.tfidf.fit_transform(all_clauses)

        n_source = len(source_clauses)
        source_vectors = tfidf_matrix[:n_source]
        target_vectors = tfidf_matrix[n_source:]

        similarities = cosine_similarity(source_vectors, target_vectors)

        matches = []
        for i, row in enumerate(similarities):
            best_j = row.argmax()
            if row[best_j] >= threshold:
                matches.append({
                    'source_idx': i,
                    'target_idx': best_j,
                    'confidence': float(row[best_j]),
                    'method': 'tfidf'
                })
        return matches

    def deep_match(self, source_clauses, target_clauses, threshold=0.5):
        """Semantic matching using sentence transformers"""
        if self.semantic_model is None:
            # all-MiniLM-L6-v2 is fast and good for general similarity
            self.semantic_model = SentenceTransformer('all-MiniLM-L6-v2')

        source_emb = self.semantic_model.encode(source_clauses)
        target_emb = self.semantic_model.encode(target_clauses)

        similarities = self.semantic_model.similarity(source_emb, target_emb)

        matches = []
        for i, row in enumerate(similarities):
            best_j = row.argmax().item()
            score = row[best_j].item()
            if score >= threshold:
                matches.append({
                    'source_idx': i,
                    'target_idx': best_j,
                    'confidence': score,
                    'method': 'semantic'
                })
        return matches
```

### Anti-Patterns to Avoid
- **Overlay panels for comparison:** Users cannot see both documents simultaneously; always use split layout
- **Fixed-width splits:** Users need control; always make resizable with persistence
- **Pure text matching:** Legal clauses with same meaning use different words; semantic matching required
- **Drawing lines on every scroll:** Performance killer; throttle/debounce position updates
- **Loading transformer models on page load:** Too slow; lazy-load when user triggers deep matching

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split panes | Mouse event handlers for dragging | Split.js | Touch support, min/max constraints, gutter alignment, callbacks |
| Drawing lines between elements | SVG path calculation | LeaderLine | Socket positioning, path types, automatic repositioning |
| Text vectorization | Custom word counting | TfidfVectorizer | N-grams, stop words, normalization, sparse matrices |
| Semantic similarity | Word overlap counting | sentence-transformers | Context-aware, handles synonyms, domain-adaptable |
| Synchronized scrolling | Matching scrollTop values | Proportional sync or syncscroll | Different content heights need ratio-based sync |

**Key insight:** Split-pane UX and semantic matching both have deceptively complex edge cases (touch events, resize observers, embedding normalization) that mature libraries handle correctly.

## Common Pitfalls

### Pitfall 1: Scroll Sync with Different Content Heights
**What goes wrong:** Setting scrollTop equal on both panels causes desync when content heights differ
**Why it happens:** Documents have different numbers of clauses/sections
**How to avoid:** Use proportional scrolling: `panel2.scrollTop = (panel1.scrollTop / panel1.scrollHeight) * panel2.scrollHeight`
**Warning signs:** Panels end at different times during scroll

### Pitfall 2: LeaderLine Performance on Many Connections
**What goes wrong:** UI freezes when updating dozens of correlation lines during scroll
**Why it happens:** Each `line.position()` call triggers layout recalculation
**How to avoid:** Throttle updates to ~100ms; batch position updates; hide lines during active scroll
**Warning signs:** Jank/stutter when scrolling with lines visible

### Pitfall 3: Similarity Threshold Too High or Low
**What goes wrong:** Too high = misses valid matches; too low = false positives everywhere
**Why it happens:** No universal threshold; depends on corpus and embedding model
**How to avoid:** Use tiered confidence (high/medium/low visual indicators); let users adjust threshold; default to 0.3-0.5 for TF-IDF, 0.5-0.7 for embeddings
**Warning signs:** Users reporting "obvious" matches missing OR too many irrelevant matches

### Pitfall 4: Transformer Model Loading Time
**What goes wrong:** 2-5 second delay when user first requests semantic matching
**Why it happens:** Model weights need to download/load into memory
**How to avoid:** Lazy-load model only when user explicitly requests "deep match"; show loading indicator; consider preloading after initial page load
**Warning signs:** UI appears frozen on first semantic match request

### Pitfall 5: Split Layout Breaking on Window Resize
**What goes wrong:** Split percentages become invalid after window resize
**Why it happens:** Split.js uses percentages that may not recompute correctly
**How to avoid:** Listen to window resize and call `split.setSizes()` if needed; test thoroughly at different viewport sizes
**Warning signs:** Panels overlap or have gaps after resize

### Pitfall 6: IntersectionObserver Highlight Lag
**What goes wrong:** Active section in navigator doesn't update correctly while scrolling up
**Why it happens:** Observer triggers when element enters/leaves, but "between headings" state is ambiguous
**How to avoid:** Track last-known active section; use generous rootMargin; handle scroll direction
**Warning signs:** Wrong section highlighted when scrolling up past headers

## Code Examples

Verified patterns from official sources:

### Split.js Initialization with Flex Layout
```javascript
// Source: https://github.com/nathancahill/split/tree/master/packages/splitjs
Split(['#main-doc', '#precedent-doc'], {
    sizes: [60, 40],
    minSize: 200,
    gutterSize: 10,
    direction: 'horizontal',
    elementStyle: (dimension, size, gutterSize) => ({
        'flex-basis': `calc(${size}% - ${gutterSize}px)`,
    }),
    gutterStyle: (dimension, gutterSize) => ({
        'flex-basis': `${gutterSize}px`,
    }),
});
```

```css
/* Required CSS for flex-based split */
.split-container {
    display: flex;
    flex-direction: row;
    height: 100%;
}
.split-pane {
    overflow: auto;
}
.gutter {
    background-color: #f0f0f0;
    background-repeat: no-repeat;
    background-position: 50%;
    cursor: col-resize;
}
.gutter:hover {
    background-color: #ddd;
}
```

### TF-IDF Similarity Matrix
```python
# Source: https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def find_clause_matches(doc1_clauses, doc2_clauses, threshold=0.3):
    """Find matching clauses between two documents using TF-IDF"""
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        stop_words='english'
    )

    # Fit on all clauses, transform separately
    all_text = doc1_clauses + doc2_clauses
    vectorizer.fit(all_text)

    vec1 = vectorizer.transform(doc1_clauses)
    vec2 = vectorizer.transform(doc2_clauses)

    # Compute similarity matrix
    sim_matrix = cosine_similarity(vec1, vec2)

    # Find best matches above threshold
    matches = []
    for i in range(len(doc1_clauses)):
        best_j = np.argmax(sim_matrix[i])
        score = sim_matrix[i, best_j]
        if score >= threshold:
            matches.append({
                'source': i,
                'target': int(best_j),
                'score': float(score)
            })

    return matches
```

### Sentence Transformer Semantic Matching
```python
# Source: https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html
from sentence_transformers import SentenceTransformer

def semantic_clause_match(source_clauses, target_clauses, threshold=0.5):
    """Match clauses by semantic meaning using sentence embeddings"""
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # Encode all clauses
    source_embeddings = model.encode(source_clauses, convert_to_tensor=True)
    target_embeddings = model.encode(target_clauses, convert_to_tensor=True)

    # Compute cosine similarities
    similarities = model.similarity(source_embeddings, target_embeddings)

    matches = []
    for i in range(len(source_clauses)):
        scores = similarities[i].cpu().numpy()
        best_j = scores.argmax()
        if scores[best_j] >= threshold:
            matches.append({
                'source_idx': i,
                'target_idx': int(best_j),
                'confidence': float(scores[best_j])
            })

    return matches
```

### Auto-Jump to First Match
```javascript
// Jump to first matched clause when precedent panel opens
function initPrecedentComparison(matches) {
    if (matches.length > 0) {
        const firstMatch = matches[0];

        // Highlight in both navigators
        highlightNavItem('main-nav', firstMatch.source_idx);
        highlightNavItem('precedent-nav', firstMatch.target_idx);

        // Scroll both panels to matched sections
        const sourceEl = document.querySelector(`[data-clause-idx="${firstMatch.source_idx}"]`);
        const targetEl = document.querySelector(`[data-clause-idx="${firstMatch.target_idx}"]`);

        sourceEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Draw correlation line after scroll completes
        setTimeout(() => {
            drawCorrelationLine(sourceEl, targetEl, firstMatch.confidence);
        }, 500);
    }
}
```

### User Editable Correlations
```javascript
// Allow users to drag and create/modify correlations
function enableCorrelationEditing(sourceNavItems, targetNavItems) {
    sourceNavItems.forEach(item => {
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('source-idx', item.dataset.clauseIdx);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    });

    targetNavItems.forEach(item => {
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drop-target');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drop-target');

            const sourceIdx = e.dataTransfer.getData('source-idx');
            const targetIdx = item.dataset.clauseIdx;

            // Save user correlation
            saveUserCorrelation(sourceIdx, targetIdx);

            // Update visual
            redrawCorrelations();
        });
    });
}

async function saveUserCorrelation(sourceIdx, targetIdx) {
    await fetch('/api/correlations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source_clause: sourceIdx,
            target_clause: targetIdx,
            user_override: true
        })
    });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keyword/exact text matching | TF-IDF with n-grams | 2010s | Better recall for paraphrased text |
| TF-IDF only | Sentence embeddings | 2019+ | Semantic understanding, synonym handling |
| Word2Vec averaging | Sentence-BERT models | 2019 | Context-aware clause embeddings |
| Generic embeddings | Legal-domain fine-tuned | 2020+ | Better for legal terminology |
| Fixed panel layouts | Resizable split panes | Standard UX | User control, preference persistence |

**Deprecated/outdated:**
- **Word overlap counting:** Misses semantic similarity entirely
- **Jaccard similarity on raw text:** Too sensitive to word choice
- **iframe-based panels:** Harder to coordinate, accessibility issues

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal similarity threshold for legal clauses**
   - What we know: General text similarity thresholds (0.3-0.5 TF-IDF, 0.5-0.7 embeddings) exist
   - What's unclear: Legal documents may need domain-specific calibration
   - Recommendation: Start with 0.4 for TF-IDF, 0.6 for semantic; add user-adjustable threshold slider

2. **Legal-domain sentence transformer model**
   - What we know: Legal-BERT and Blackstone exist for legal NLP
   - What's unclear: Whether general-purpose models (all-MiniLM-L6-v2) suffice for clause matching
   - Recommendation: Start with all-MiniLM-L6-v2 (fast, good quality); evaluate legal models if accuracy insufficient

3. **LeaderLine repository archived**
   - What we know: Repository archived April 2025, still MIT licensed and functional
   - What's unclear: Long-term maintenance/security updates
   - Recommendation: Use LeaderLine for now (stable, well-documented); monitor for forks if issues arise

4. **Correlation persistence format**
   - What we know: User overrides need to be saved
   - What's unclear: Whether to store as document-pair specific or clause-content-based
   - Recommendation: Store by clause content hash to enable reuse across similar documents

## Sources

### Primary (HIGH confidence)
- [Split.js GitHub README](https://github.com/nathancahill/split/tree/master/packages/splitjs) - Full API documentation
- [LeaderLine GitHub](https://github.com/anseki/leader-line) - Line drawing API
- [scikit-learn TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html) - TF-IDF documentation
- [Sentence Transformers docs](https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html) - Semantic similarity

### Secondary (MEDIUM confidence)
- [CSS-Tricks IntersectionObserver TOC](https://css-tricks.com/table-of-contents-with-intersectionobserver/) - Navigator pattern
- [MDN scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) - Scroll API
- [syncscroll GitHub](https://github.com/asvd/syncscroll) - Scroll synchronization

### Tertiary (LOW confidence)
- WebSearch results on similarity thresholds - Need empirical validation
- Legal NLP model comparisons - Domain-specific testing needed

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Libraries verified via official docs, but integration patterns need validation
- Architecture: MEDIUM - Patterns from multiple sources, need testing with existing codebase
- Pitfalls: MEDIUM - Common issues documented but some specific to legal domain

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable libraries, established patterns)
