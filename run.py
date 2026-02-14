#!/usr/bin/env python3
"""
Quick start script for the Contract Review API Server.

Usage:
    python run.py          # Start API server only
    npm run dev            # Start both API + frontend (recommended)

API server runs at http://localhost:5000
Frontend runs at http://localhost:3000 (via Next.js)
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def check_dependencies():
    """Check and report missing dependencies."""
    missing = []

    try:
        import flask
    except ImportError:
        missing.append('flask')

    try:
        import docx
    except ImportError:
        missing.append('python-docx')

    try:
        from dotenv import load_dotenv
    except ImportError:
        missing.append('python-dotenv')

    try:
        from google import genai
    except ImportError:
        missing.append('google-genai')

    try:
        import diff_match_patch
    except ImportError:
        missing.append('diff-match-patch')

    if missing:
        print("Missing dependencies detected:")
        for dep in missing:
            print(f"  - {dep}")
        print(f"\nInstall with: pip install {' '.join(missing)}")
        print("Or: pip install -r requirements.txt")
        return False

    return True


def check_api_key():
    """Check if Gemini API key is configured."""
    import os
    from dotenv import load_dotenv

    load_dotenv()

    key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if key:
        return True

    # Check api.txt
    api_txt = project_root / 'api.txt'
    if api_txt.exists():
        return True

    print("\nWarning: No Gemini API key found.")
    print("The app will run but revisions will not work.")
    print("Set GEMINI_API_KEY environment variable or create api.txt with your key.")
    return False


def main():
    print("=" * 60)
    print("  Collaborative Contract Review Application")
    print("=" * 60)

    # Check dependencies
    print("\nChecking dependencies...")
    if not check_dependencies():
        sys.exit(1)
    print("All dependencies found.")

    # Check API key
    check_api_key()

    # Start server
    from app.server import main as run_server
    run_server()


if __name__ == '__main__':
    main()
