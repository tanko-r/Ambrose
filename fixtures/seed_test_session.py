#!/usr/bin/env python3
"""
Seed a test session from fixture data.

Loads the pre-generated Gemini analysis from fixtures/sample-psa/ into the
Flask backend's data directories so you can test the UI without re-running
the expensive analysis (~$6, ~2.5 minutes).

Usage:
    python fixtures/seed_test_session.py

Creates:
    - app/data/uploads/test-sample-psa/target.docx        (for HTML rendering)
    - app/data/uploads/test-sample-psa/target_parsed.json  (for document endpoint)
    - app/data/sessions/test-sample-psa.json               (full session state)

After running, start the Flask server and open:
    http://localhost:3000/review/test-sample-psa
"""

import json
import shutil
import sys
from pathlib import Path

# Paths
ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "fixtures" / "sample-psa"
UPLOADS_DIR = ROOT / "app" / "data" / "uploads"
SESSIONS_DIR = ROOT / "app" / "data" / "sessions"

SESSION_ID = "test-sample-psa"


def main():
    # Verify fixture files exist
    required = ["document.json", "analysis.json", "target.docx", "session.json"]
    for f in required:
        if not (FIXTURES_DIR / f).exists():
            print(f"ERROR: Missing fixture file: fixtures/sample-psa/{f}")
            sys.exit(1)

    # Create data directories
    upload_dir = UPLOADS_DIR / SESSION_ID
    upload_dir.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    # Copy DOCX (needed for HTML rendering endpoint)
    target_path = upload_dir / "target.docx"
    shutil.copy2(FIXTURES_DIR / "target.docx", target_path)
    print(f"  Copied target.docx -> {target_path.relative_to(ROOT)}")

    # Load fixture data
    with open(FIXTURES_DIR / "document.json", "r", encoding="utf-8") as f:
        document = json.load(f)

    with open(FIXTURES_DIR / "analysis.json", "r", encoding="utf-8") as f:
        analysis = json.load(f)

    with open(FIXTURES_DIR / "session.json", "r", encoding="utf-8") as f:
        session_meta = json.load(f)

    # Build parsed_doc structure from document API response
    parsed_doc = {
        "source_file": str(target_path),
        "metadata": document.get("metadata", {}),
        "content": document.get("content", []),
        "sections": document.get("sections", []),
        "exhibits": document.get("exhibits", []),
        "defined_terms": document.get("defined_terms", []),
    }

    # Save parsed doc to uploads (for disk-based loading)
    parsed_doc_path = upload_dir / "target_parsed.json"
    with open(parsed_doc_path, "w", encoding="utf-8") as f:
        json.dump(parsed_doc, f, indent=2, ensure_ascii=False)
    print(f"  Saved parsed doc -> {parsed_doc_path.relative_to(ROOT)}")

    # Build full session object
    session_data = {
        "session_id": SESSION_ID,
        "created_at": session_meta["created_at"],
        "status": "analyzed",
        "representation": session_meta["representation"],
        "contract_type": session_meta["contract_type"],
        "approach": session_meta.get("approach", "competitive-bid"),
        "aggressiveness": session_meta["aggressiveness"],
        "deal_context": session_meta.get("deal_context", ""),
        "include_exhibits": session_meta.get("include_exhibits", False),
        "target_filename": session_meta["target_filename"],
        "target_path": str(target_path),
        "precedent_path": None,
        "parsed_doc_path": str(parsed_doc_path),
        "analysis": analysis,
        "concept_map": analysis.get("concept_map", {}),
        "risk_map": analysis.get("risk_map", {}),
        "revisions": {},
        "flags": [],
        "is_test_session": True,
    }

    # Save session file
    session_path = SESSIONS_DIR / f"{SESSION_ID}.json"
    with open(session_path, "w", encoding="utf-8") as f:
        json.dump(session_data, f, indent=2, default=str)
    print(f"  Saved session -> {session_path.relative_to(ROOT)}")

    # Summary
    paragraphs = [c for c in parsed_doc["content"] if c.get("type") == "paragraph"]
    risks = analysis.get("risk_inventory", [])
    risk_by_para = analysis.get("risk_by_paragraph", {})
    summary = analysis.get("summary", {})

    print()
    print(f"Test session seeded: {SESSION_ID}")
    print(f"  Paragraphs: {len(paragraphs)}")
    print(f"  Risks: {len(risks)}")
    print(f"  Paragraphs with risks: {len(risk_by_para)}")
    print(f"  Severity: {summary.get('high_severity', '?')} high, "
          f"{summary.get('medium_severity', '?')} medium, "
          f"{summary.get('info_items', '?')} info")
    print(f"  Representation: {session_meta['representation']}")
    print(f"  Aggressiveness: {session_meta['aggressiveness']}")
    print()
    print("Start the Flask server, then open:")
    print(f"  http://localhost:3000/review/{SESSION_ID}")


if __name__ == "__main__":
    main()
