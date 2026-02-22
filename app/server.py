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

    # CORS origins from env var (comma-separated), defaults to Next.js dev server
    cors_origins_raw = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
    cors_origins = [o.strip() for o in cors_origins_raw.split(',') if o.strip()]
    CORS(app, origins=cors_origins)

    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload

    # DATA_DIR: env var controls all data storage; falls back to app/data/ in dev
    data_dir_env = os.environ.get('DATA_DIR')
    if data_dir_env:
        data_dir = Path(data_dir_env)
    else:
        data_dir = Path(__file__).parent / 'data'

    app.config['DATA_DIR']       = data_dir
    app.config['UPLOAD_FOLDER']  = data_dir / 'users'    # user-scoped subdirs: users/{user_id}/{session_id}/
    app.config['SESSION_FOLDER'] = data_dir / 'sessions' # flat session JSON files
    app.config['TRASH_FOLDER']   = data_dir / 'trash'

    # Ensure all data directories exist
    for folder in [data_dir, app.config['UPLOAD_FOLDER'],
                   app.config['SESSION_FOLDER'], app.config['TRASH_FOLDER']]:
        folder.mkdir(parents=True, exist_ok=True)

    # Database — SQLite in dev, PostgreSQL on Railway (via DATABASE_URL env var)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'sqlite:///dev.db'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    from app.models import db, migrate
    db.init_app(app)
    migrate.init_app(app, db)

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
