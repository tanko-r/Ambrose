"""
TF-IDF Based Clause Matching Service

Uses scikit-learn TF-IDF vectorization with cosine similarity for
improved concept-based clause matching between target and precedent documents.

Addresses UAT #5: Clause matching quality is "iffy" - keyword overlap misses
conceptually similar clauses with different wording.
"""

import re
from typing import List, Dict, Any, Optional, Tuple

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ClauseMatcher:
    """
    TF-IDF based clause matcher for finding related clauses between documents.

    Uses TfidfVectorizer to convert clause text into vectors and cosine_similarity
    to find semantically related clauses, even when wording differs.
    """

    # Legal stop words to filter out common contract language
    LEGAL_STOP_WORDS = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
        'that', 'these', 'those', 'it', 'its', 'any', 'all', 'such', 'other',
        'each', 'no', 'not', 'only', 'same', 'than', 'into', 'upon', 'under',
        'between', 'through', 'during', 'before', 'after', 'above', 'below',
        'hereby', 'herein', 'hereof', 'hereto', 'hereunder', 'therein',
        'thereof', 'thereto', 'thereunder', 'whereas', 'therefore',
        'provided', 'however', 'notwithstanding', 'pursuant', 'subject',
        'respect', 'accordance', 'including', 'without', 'limitation'
    }

    def __init__(self, min_score: float = 0.1, max_results: int = 10):
        """
        Initialize the clause matcher.

        Args:
            min_score: Minimum similarity score (0-1) to include a match
            max_results: Maximum number of matches to return
        """
        self.min_score = min_score
        self.max_results = max_results
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.precedent_vectors = None
        self.precedent_clauses: List[Dict[str, Any]] = []

        if not SKLEARN_AVAILABLE:
            raise ImportError(
                "scikit-learn is required for TF-IDF matching. "
                "Install with: pip install scikit-learn"
            )

    def _preprocess_text(self, text: str) -> str:
        """
        Preprocess clause text for TF-IDF vectorization.

        - Lowercase
        - Remove punctuation except hyphens in compound words
        - Remove section numbers and references
        - Normalize whitespace
        """
        if not text:
            return ""

        text = text.lower()

        # Remove section references like "Section 1.2" or "(a)(i)"
        text = re.sub(r'section\s+\d+(\.\d+)*', '', text)
        text = re.sub(r'\([a-z]\)(\([ivxlcdm]+\))?', '', text)
        text = re.sub(r'\d+(\.\d+)+', '', text)

        # Remove punctuation but keep hyphens in compound words
        text = re.sub(r'[^\w\s-]', ' ', text)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def fit(self, precedent_clauses: List[Dict[str, Any]]) -> 'ClauseMatcher':
        """
        Fit the TF-IDF vectorizer on precedent document clauses.

        Args:
            precedent_clauses: List of clause dicts with 'id', 'text', etc.

        Returns:
            self for chaining
        """
        self.precedent_clauses = precedent_clauses

        # Extract and preprocess texts
        texts = [self._preprocess_text(c.get('text', '')) for c in precedent_clauses]

        # Filter empty texts
        valid_indices = [i for i, t in enumerate(texts) if t.strip()]
        valid_texts = [texts[i] for i in valid_indices]
        self.precedent_clauses = [precedent_clauses[i] for i in valid_indices]

        if not valid_texts:
            return self

        # Create and fit TF-IDF vectorizer
        self.vectorizer = TfidfVectorizer(
            stop_words=list(self.LEGAL_STOP_WORDS),
            ngram_range=(1, 2),  # Unigrams and bigrams
            max_df=0.9,  # Ignore terms in >90% of documents
            min_df=1,    # Include terms appearing at least once
            max_features=5000
        )

        self.precedent_vectors = self.vectorizer.fit_transform(valid_texts)

        return self

    def find_matches(
        self,
        target_clause: Dict[str, Any],
        boost_section_match: float = 0.2,
        boost_hierarchy_match: float = 0.15,
        boost_term_match: float = 0.1
    ) -> List[Dict[str, Any]]:
        """
        Find matching clauses in precedent for a target clause.

        Args:
            target_clause: Dict with 'text', 'section_ref', 'section_hierarchy', etc.
            boost_section_match: Score boost for matching section numbers
            boost_hierarchy_match: Score boost for matching section hierarchy captions
            boost_term_match: Score boost per matching defined term

        Returns:
            List of matching clauses with 'id', 'text', 'score', etc.
        """
        if not self.vectorizer or self.precedent_vectors is None:
            return []

        target_text = self._preprocess_text(target_clause.get('text', ''))
        if not target_text.strip():
            return []

        # Vectorize target text
        target_vector = self.vectorizer.transform([target_text])

        # Calculate cosine similarities
        similarities = cosine_similarity(target_vector, self.precedent_vectors)[0]

        # Get target metadata for boosting
        target_section_ref = target_clause.get('section_ref', '')
        target_hierarchy = target_clause.get('section_hierarchy', [])
        target_terms = set(re.findall(r'"([A-Z][^"]+)"', target_clause.get('text', '')))

        # Build results with boosted scores
        matches = []
        for i, base_score in enumerate(similarities):
            if base_score < self.min_score * 0.5:  # Skip very low scores early
                continue

            prec_clause = self.precedent_clauses[i]
            boosted_score = float(base_score)

            # Boost for section reference match
            prec_section_ref = prec_clause.get('section_ref', '')
            if target_section_ref and prec_section_ref:
                if target_section_ref == prec_section_ref:
                    boosted_score += boost_section_match
                elif (target_section_ref.split('.')[0] ==
                      prec_section_ref.split('.')[0]):
                    boosted_score += boost_section_match * 0.5

            # Boost for hierarchy caption match
            prec_hierarchy = prec_clause.get('section_hierarchy', [])
            if target_hierarchy and prec_hierarchy:
                target_captions = {
                    h.get('caption', '').lower()
                    for h in target_hierarchy if h.get('caption')
                }
                prec_captions = {
                    h.get('caption', '').lower()
                    for h in prec_hierarchy if h.get('caption')
                }
                common_captions = target_captions & prec_captions
                if common_captions:
                    boosted_score += boost_hierarchy_match * len(common_captions)

            # Boost for defined term match
            prec_terms = set(re.findall(r'"([A-Z][^"]+)"', prec_clause.get('text', '')))
            common_terms = target_terms & prec_terms
            if common_terms:
                boosted_score += boost_term_match * len(common_terms)

            # Cap score at 1.0
            boosted_score = min(boosted_score, 1.0)

            if boosted_score >= self.min_score:
                matches.append({
                    'id': prec_clause.get('id'),
                    'text': prec_clause.get('text', ''),
                    'section_ref': prec_section_ref,
                    'caption': prec_clause.get('caption'),
                    'hierarchy': prec_hierarchy,
                    'score': round(boosted_score, 3),
                    'base_score': round(float(base_score), 3)
                })

        # Sort by score descending and limit results
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches[:self.max_results]


def find_related_clauses(
    target_clause: Dict[str, Any],
    precedent_content: List[Dict[str, Any]],
    min_score: float = 0.1,
    max_results: int = 10
) -> List[Dict[str, Any]]:
    """
    Convenience function to find related clauses using TF-IDF matching.

    Args:
        target_clause: The target paragraph dict
        precedent_content: List of paragraphs from precedent document
        min_score: Minimum similarity score (0-1)
        max_results: Maximum matches to return

    Returns:
        List of matching clause dicts with scores
    """
    if not SKLEARN_AVAILABLE:
        # Fallback to empty results if sklearn not available
        return []

    # Filter to paragraphs only
    precedent_paragraphs = [
        item for item in precedent_content
        if item.get('type') == 'paragraph' and item.get('text', '').strip()
    ]

    if not precedent_paragraphs:
        return []

    # Create matcher and find matches
    matcher = ClauseMatcher(min_score=min_score, max_results=max_results)
    matcher.fit(precedent_paragraphs)

    return matcher.find_matches(target_clause)


def match_sections(
    target_sections: List[Dict[str, Any]],
    precedent_sections: List[Dict[str, Any]],
    min_score: float = 0.15
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Match sections between target and precedent for navigator highlighting.

    Builds a mapping of target section IDs to their related precedent sections.

    Args:
        target_sections: List of section dicts from target document
        precedent_sections: List of section dicts from precedent document
        min_score: Minimum similarity score for a match

    Returns:
        Dict mapping target section IDs to lists of matching precedent sections
    """
    if not SKLEARN_AVAILABLE or not target_sections or not precedent_sections:
        return {}

    # Build section texts by combining title and first paragraph
    def get_section_text(section: Dict[str, Any]) -> str:
        title = section.get('title', '')
        number = section.get('number', '')
        return f"{number} {title}"

    # Prepare precedent sections
    prec_texts = []
    prec_data = []
    for sec in precedent_sections:
        text = get_section_text(sec)
        if text.strip():
            prec_texts.append(text.lower())
            prec_data.append({
                'id': sec.get('para_id'),
                'number': sec.get('number'),
                'title': sec.get('title')
            })

    if not prec_texts:
        return {}

    # Create vectorizer
    vectorizer = TfidfVectorizer(
        stop_words=list(ClauseMatcher.LEGAL_STOP_WORDS),
        ngram_range=(1, 2)
    )

    try:
        prec_vectors = vectorizer.fit_transform(prec_texts)
    except ValueError:
        return {}

    # Match each target section
    matches: Dict[str, List[Dict[str, Any]]] = {}

    for target_sec in target_sections:
        target_text = get_section_text(target_sec).lower()
        if not target_text.strip():
            continue

        try:
            target_vector = vectorizer.transform([target_text])
            similarities = cosine_similarity(target_vector, prec_vectors)[0]

            section_matches = []
            for i, score in enumerate(similarities):
                if score >= min_score:
                    section_matches.append({
                        **prec_data[i],
                        'score': round(float(score), 3)
                    })

            if section_matches:
                section_matches.sort(key=lambda x: x['score'], reverse=True)
                target_id = target_sec.get('para_id', '')
                matches[target_id] = section_matches[:5]

        except ValueError:
            continue

    return matches
