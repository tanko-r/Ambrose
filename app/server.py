#!/usr/bin/env python3
"""
Contract Review API Server

Flask-based backend providing REST API endpoints for the contract redlining webapp.
The frontend is served separately by Next.js.
"""

import os
import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from flask import Flask
from flask_cors import CORS
from app.api.routes import api_bp

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Allow cross-origin requests from Next.js dev server (any localhost port)
    CORS(app, origins=[r"http://localhost:\d+"])

    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload
    app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'data' / 'uploads'
    app.config['SESSION_FOLDER'] = Path(__file__).parent / 'data' / 'sessions'

    # Ensure data directories exist
    app.config['UPLOAD_FOLDER'].mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FOLDER'].mkdir(parents=True, exist_ok=True)

    # Register blueprints
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/health')
    def health():
        return {'status': 'ok'}

    return app


def main():
    """Run the development server."""
    app = create_app()

    # Get port from environment or default to 5000
    port = int(os.environ.get('PORT', 5000))

    print(f"""
+==================================================================+
|           Contract Review API Server                             |
+==================================================================+
|  API running at:  http://localhost:{port:<5}                        |
|  Frontend at:     http://localhost:3000                          |
|                                                                  |
|  Start both with: npm run dev (from project root)               |
|  Press Ctrl+C to stop the server.                               |
+==================================================================+
    """)

    app.run(host='0.0.0.0', port=port, debug=True)


if __name__ == '__main__':
    main()
