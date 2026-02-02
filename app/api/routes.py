#!/usr/bin/env python3
"""
API Routes for Collaborative Contract Review

Endpoints:
- POST /api/intake - Initialize session with document + context
- GET /api/document - Get parsed document with structure
- GET /api/analysis - Get full risk/opportunity analysis
- POST /api/revise - Generate redline for specific clause
- POST /api/flag - Flag item for client review
- POST /api/finalize - Generate final Word doc + transmittal email
- GET /api/suggestions - Get app improvement suggestions
- POST /api/implement - Implement approved improvement
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app, send_file

api_bp = Blueprint('api', __name__)

# Session storage (in-memory for now, could use Redis/DB for production)
sessions = {}


def get_session(session_id):
    """Get session data or return error."""
    if session_id not in sessions:
        return None
    return sessions[session_id]


def save_session(session_id, data):
    """Save session data."""
    sessions[session_id] = data
    # Also persist to disk
    session_path = current_app.config['SESSION_FOLDER'] / f'{session_id}.json'
    with open(session_path, 'w', encoding='utf-8') as f:
        # Convert non-serializable objects
        serializable = {k: v for k, v in data.items() if k != 'parsed_doc'}
        if 'parsed_doc' in data:
            serializable['parsed_doc_path'] = str(data.get('parsed_doc_path', ''))
        json.dump(serializable, f, indent=2, default=str)


@api_bp.route('/load-test-session', methods=['POST'])
def load_test_session():
    """
    Load a saved analysis for testing without re-running the expensive LLM analysis.

    Looks for saved_document.json and saved_analysis.json in the output folder.
    """
    output_dir = Path(__file__).parent.parent.parent / 'output'
    doc_path = output_dir / 'saved_document.json'
    analysis_path = output_dir / 'saved_analysis.json'

    if not doc_path.exists() or not analysis_path.exists():
        return jsonify({'error': 'No saved test data found. Run a full analysis first.'}), 404

    # Load saved data
    with open(doc_path, 'r', encoding='utf-8') as f:
        document = json.load(f)

    with open(analysis_path, 'r', encoding='utf-8') as f:
        analysis = json.load(f)

    # Create a test session
    session_id = 'test-' + str(uuid.uuid4())[:8]

    session = {
        'session_id': session_id,
        'created_at': datetime.now().isoformat(),
        'status': 'analyzed',
        'representation': analysis.get('representation', 'seller'),
        'contract_type': analysis.get('contract_type', 'psa'),
        'aggressiveness': analysis.get('aggressiveness', 3),
        'deal_context': '',
        'parsed_doc': document,
        'analysis': analysis,
        'revisions': {},
        'flags': [],
        'is_test_session': True
    }

    sessions[session_id] = session

    return jsonify({
        'session_id': session_id,
        'message': 'Test session loaded successfully',
        'risks_count': analysis.get('summary', {}).get('total_risks', 0),
        'paragraphs_count': len(document.get('content', []))
    })


@api_bp.route('/intake', methods=['POST'])
def intake():
    """
    Initialize a review session.

    Expects multipart form data:
    - target_file: The contract document to review (.docx)
    - precedent_file: Optional preferred form/precedent (.docx)
    - representation: Which party user represents (seller, buyer, etc.)
    - deal_context: Free text context about the deal
    - approach: Review approach (quick-sale, competitive-bid, relationship, adversarial)
    - aggressiveness: 1-5 scale
    - include_exhibits: Whether to include exhibits in review
    """
    from app.services.document_service import parse_document

    # Generate session ID
    session_id = str(uuid.uuid4())

    # Get form data
    representation = request.form.get('representation', 'seller')
    deal_context = request.form.get('deal_context', '')
    approach = request.form.get('approach', 'competitive-bid')
    aggressiveness = int(request.form.get('aggressiveness', 3))
    include_exhibits = request.form.get('include_exhibits', 'false').lower() == 'true'

    # Handle file uploads
    upload_folder = current_app.config['UPLOAD_FOLDER'] / session_id
    upload_folder.mkdir(parents=True, exist_ok=True)

    target_file = request.files.get('target_file')
    if not target_file:
        return jsonify({'error': 'No target file provided'}), 400

    target_path = upload_folder / 'target.docx'
    target_file.save(str(target_path))

    precedent_path = None
    if 'precedent_file' in request.files:
        precedent_file = request.files['precedent_file']
        if precedent_file.filename:
            precedent_path = upload_folder / 'precedent.docx'
            precedent_file.save(str(precedent_path))

    # Parse target document
    try:
        parsed_doc = parse_document(target_path)
    except Exception as e:
        return jsonify({'error': f'Failed to parse document: {str(e)}'}), 500

    # Parse precedent if provided
    parsed_precedent = None
    if precedent_path:
        try:
            parsed_precedent = parse_document(precedent_path)
        except Exception as e:
            # Non-fatal, continue without precedent
            parsed_precedent = None

    # Detect contract type
    contract_type = detect_contract_type(parsed_doc)

    # Store session data
    session_data = {
        'session_id': session_id,
        'created_at': datetime.now().isoformat(),
        'representation': representation,
        'deal_context': deal_context,
        'approach': approach,
        'aggressiveness': aggressiveness,
        'include_exhibits': include_exhibits,
        'contract_type': contract_type,
        'target_filename': target_file.filename,  # Store original filename
        'target_path': str(target_path),
        'precedent_path': str(precedent_path) if precedent_path else None,
        'parsed_doc': parsed_doc,
        'parsed_precedent': parsed_precedent,
        'parsed_doc_path': str(upload_folder / 'target_parsed.json'),
        'analysis': None,
        'revisions': {},
        'flags': [],
        'status': 'initialized'
    }

    # Save parsed doc to disk
    with open(session_data['parsed_doc_path'], 'w', encoding='utf-8') as f:
        json.dump(parsed_doc, f, indent=2, ensure_ascii=False)

    if parsed_precedent:
        precedent_parsed_path = upload_folder / 'precedent_parsed.json'
        with open(precedent_parsed_path, 'w', encoding='utf-8') as f:
            json.dump(parsed_precedent, f, indent=2, ensure_ascii=False)

    save_session(session_id, session_data)

    return jsonify({
        'session_id': session_id,
        'contract_type': contract_type,
        'paragraph_count': len([c for c in parsed_doc['content'] if c['type'] == 'paragraph']),
        'section_count': len(parsed_doc.get('sections', [])),
        'exhibit_count': len(parsed_doc.get('exhibits', [])),
        'has_precedent': precedent_path is not None,
        'status': 'initialized'
    })


def detect_contract_type(parsed_doc):
    """Detect the type of contract from parsed content."""
    text_sample = ' '.join([
        c.get('text', '')[:500]
        for c in parsed_doc.get('content', [])[:30]
        if c.get('type') == 'paragraph'
    ]).lower()

    if 'purchase' in text_sample and 'sale' in text_sample:
        return 'psa'
    elif 'lease' in text_sample and ('landlord' in text_sample or 'tenant' in text_sample):
        return 'lease'
    elif 'easement' in text_sample:
        return 'easement'
    elif 'development' in text_sample and 'agreement' in text_sample:
        return 'development'
    elif 'loan' in text_sample and ('lender' in text_sample or 'borrower' in text_sample):
        return 'loan'
    else:
        return 'general'


@api_bp.route('/document/<session_id>', methods=['GET'])
def get_document(session_id):
    """
    Get the parsed document with structure.

    Returns the full document content with section hierarchy,
    ready for rendering in the UI.
    """
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    parsed_doc = session.get('parsed_doc')
    if not parsed_doc:
        # Try loading from disk
        parsed_path = session.get('parsed_doc_path')
        if parsed_path and Path(parsed_path).exists():
            with open(parsed_path, 'r', encoding='utf-8') as f:
                parsed_doc = json.load(f)
        else:
            return jsonify({'error': 'Document not found'}), 404

    # Get filename from session or metadata
    filename = session.get('target_filename') or parsed_doc.get('metadata', {}).get('filename') or 'Contract Document'

    return jsonify({
        'session_id': session_id,
        'filename': filename,
        'content': parsed_doc.get('content', []),
        'sections': parsed_doc.get('sections', []),
        'exhibits': parsed_doc.get('exhibits', []),
        'defined_terms': parsed_doc.get('defined_terms', []),
        'metadata': parsed_doc.get('metadata', {})
    })


@api_bp.route('/analysis/<session_id>', methods=['GET'])
def get_analysis(session_id):
    """
    Get full risk/opportunity analysis.

    If analysis hasn't been performed yet, triggers analysis.
    Uses Claude Opus 4.5 for deep legal analysis.
    Returns comprehensive risk map with per-clause breakdown.

    After analysis, builds and stores ConceptMap and RiskMap objects
    in the session for use during revision generation.
    """
    from app.models import ConceptMap, RiskMap

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Check if analysis already exists
    if session.get('analysis'):
        # Include stored maps in response if they exist
        response = dict(session['analysis'])
        if session.get('concept_map'):
            response['concept_map'] = session['concept_map']
        if session.get('risk_map'):
            response['risk_map'] = session['risk_map']
        return jsonify(response)

    # Perform LLM-based analysis using Claude
    try:
        from app.services.claude_service import analyze_document_with_llm, clear_progress

        analysis = analyze_document_with_llm(
            parsed_doc=session.get('parsed_doc'),
            contract_type=session.get('contract_type', 'general'),
            representation=session.get('representation', 'seller'),
            aggressiveness=session.get('aggressiveness', 3),
            batch_size=5,  # Analyze 5 clauses per API call
            session_id=session_id  # Pass session_id for progress tracking
        )

        # Clear progress tracking
        clear_progress(session_id)

        # Build ConceptMap from analysis
        concept_map = ConceptMap()
        if 'concept_map' in analysis:
            for category, provisions in analysis['concept_map'].items():
                if isinstance(provisions, dict):
                    for key, details in provisions.items():
                        if isinstance(details, dict):
                            concept_map.add_provision(
                                category=category,
                                key=key,
                                value=details.get('value', ''),
                                section=details.get('section', ''),
                                **{k: v for k, v in details.items() if k not in ('value', 'section')}
                            )
                        else:
                            # Handle case where details is a simple value
                            concept_map.add_provision(
                                category=category,
                                key=key,
                                value=str(details),
                                section=''
                            )

        # Build RiskMap from analysis
        risk_map = RiskMap()
        for risk in analysis.get('risk_inventory', []):
            rm_risk = risk_map.add_risk(
                risk_id=risk.get('risk_id', ''),
                clause=risk.get('section_ref', risk.get('para_id', '')),
                para_id=risk.get('para_id', ''),
                title=risk.get('title', ''),
                description=risk.get('description', ''),
                base_severity=risk.get('severity', 'medium')
            )
            # Add relationships
            for m in risk.get('mitigated_by', []):
                if isinstance(m, dict):
                    rm_risk.add_mitigator(m.get('ref', ''), m.get('effect', ''))
            for a in risk.get('amplified_by', []):
                if isinstance(a, dict):
                    rm_risk.add_amplifier(a.get('ref', ''), a.get('effect', ''))
            for t in risk.get('triggers', []):
                rm_risk.add_trigger(t)

        # Recalculate effective severities based on relationships
        risk_map.recalculate_all_severities()

        # Store analysis and maps in session
        session['analysis'] = analysis
        session['concept_map'] = concept_map.to_dict()
        session['risk_map'] = risk_map.to_dict()
        session['status'] = 'analyzed'
        save_session(session_id, session)

        # Include maps in response
        response = dict(analysis)
        response['concept_map'] = concept_map.to_dict()
        response['risk_map'] = risk_map.to_dict()

        return jsonify(response)
    except Exception as e:
        from app.services.claude_service import clear_progress
        clear_progress(session_id)

        # Fall back to regex-based analysis if Claude fails
        try:
            from app.services.analysis_service import analyze_document
            analysis = analyze_document(
                parsed_doc=session.get('parsed_doc'),
                parsed_precedent=session.get('parsed_precedent'),
                contract_type=session.get('contract_type', 'general'),
                representation=session.get('representation', 'seller'),
                aggressiveness=session.get('aggressiveness', 3)
            )
            analysis['analysis_method'] = 'regex_fallback'
            analysis['fallback_reason'] = str(e)

            session['analysis'] = analysis
            session['status'] = 'analyzed'
            save_session(session_id, session)

            return jsonify(analysis)
        except Exception as fallback_error:
            return jsonify({'error': f'Analysis failed: {str(e)}. Fallback also failed: {str(fallback_error)}'}), 500


@api_bp.route('/analysis/<session_id>/progress', methods=['GET'])
def get_analysis_progress(session_id):
    """
    Get current progress of analysis.

    Returns real-time progress data for the analysis overlay.
    """
    from app.services.claude_service import get_progress

    progress = get_progress(session_id)
    if not progress:
        # No active analysis - check if already complete
        session = get_session(session_id)
        if session and session.get('analysis'):
            return jsonify({
                'status': 'complete',
                'percent': 100
            })
        return jsonify({
            'status': 'not_started',
            'percent': 0
        })

    return jsonify(progress)


@api_bp.route('/revise', methods=['POST'])
def revise():
    """
    Generate redline for a specific clause.

    Expects JSON:
    {
        "session_id": "...",
        "para_id": "p_123",
        "risk_id": "R1",  // optional - single risk to address
        "risk_ids": ["R1", "R2"],  // optional - multiple risks to address
        "include_related_ids": ["p_5", "p_10"],  // optional - related clauses to include for context
        "custom_instruction": "..."  // optional - user guidance
    }

    Returns revised text with track-changes style diff.
    """
    from app.services.gemini_service import generate_revision

    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')
    risk_id = data.get('risk_id')
    risk_ids = data.get('risk_ids', [])
    include_related_ids = data.get('include_related_ids', [])
    custom_instruction = data.get('custom_instruction', '')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Find the paragraph
    parsed_doc = session.get('parsed_doc')
    paragraph = None
    for item in parsed_doc.get('content', []):
        if item.get('type') == 'paragraph' and item.get('id') == para_id:
            paragraph = item
            break

    if not paragraph:
        return jsonify({'error': 'Paragraph not found'}), 404

    # Get analysis context for this paragraph
    analysis = session.get('analysis', {})
    clause_risks = [r for r in analysis.get('risk_inventory', []) if r.get('para_id') == para_id]

    # Filter to specific risks if provided
    if risk_ids:
        # Multiple risk IDs provided
        clause_risks = [r for r in clause_risks if r.get('risk_id') in risk_ids]
    elif risk_id:
        # Single risk ID provided (backwards compatibility)
        clause_risks = [r for r in clause_risks if r.get('risk_id') == risk_id]

    # Build related clauses context if requested
    related_clauses_context = []
    if include_related_ids:
        for rel_id in include_related_ids:
            for item in parsed_doc.get('content', []):
                if item.get('type') == 'paragraph' and item.get('id') == rel_id:
                    # Check if this clause has been revised
                    revision_data = session.get('revisions', {}).get(rel_id)
                    related_clauses_context.append({
                        'id': rel_id,
                        'section_ref': item.get('section_ref', ''),
                        'text': item.get('text', ''),
                        'revised_text': revision_data.get('revised') if revision_data and revision_data.get('accepted') else None
                    })
                    break

    try:
        revision = generate_revision(
            original_text=paragraph.get('text', ''),
            section_ref=paragraph.get('section_ref', ''),
            section_hierarchy=paragraph.get('section_hierarchy', []),
            risks=clause_risks,
            representation=session.get('representation', 'seller'),
            aggressiveness=session.get('aggressiveness', 3),
            deal_context=session.get('deal_context', ''),
            precedent_doc=session.get('parsed_precedent'),
            custom_instruction=custom_instruction,
            related_clauses=related_clauses_context,
            concept_map=session.get('concept_map'),
            risk_map=session.get('risk_map')
        )

        # Store revision in session (including diff_html for persistence)
        if 'revisions' not in session:
            session['revisions'] = {}
        session['revisions'][para_id] = {
            'original': paragraph.get('text', ''),
            'revised': revision.get('revised_text'),
            'rationale': revision.get('rationale'),
            'thinking': revision.get('thinking'),
            'diff_html': revision.get('diff_html'),
            'related_revisions': revision.get('related_revisions', []),
            'accepted': False,
            'timestamp': datetime.now().isoformat()
        }
        save_session(session_id, session)

        return jsonify({
            'para_id': para_id,
            'original': paragraph.get('text', ''),
            'revised': revision.get('revised_text'),
            'rationale': revision.get('rationale'),
            'thinking': revision.get('thinking'),
            'diff_html': revision.get('diff_html'),
            'related_revisions': revision.get('related_revisions', [])
        })
    except Exception as e:
        return jsonify({'error': f'Revision failed: {str(e)}'}), 500


@api_bp.route('/accept', methods=['POST'])
def accept_revision():
    """
    Accept a proposed revision.

    Detects concept changes in the revision and updates the concept map
    and risk map accordingly. Returns affected paragraph IDs that may
    need re-analysis due to changed relationships.
    """
    from app.services.map_updater import detect_concept_changes, update_maps_on_revision

    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    revision = session.get('revisions', {}).get(para_id)
    if not revision:
        return jsonify({'error': 'Revision not found'}), 404

    # Detect and apply concept changes
    original = revision.get('original', '')
    revised = revision.get('revised', '')

    changes = detect_concept_changes(original, revised)

    affected_para_ids = []
    if changes and session.get('concept_map') and session.get('risk_map'):
        # Get paragraph info for section reference
        parsed_doc = session.get('parsed_doc', {})
        para = next((p for p in parsed_doc.get('content', []) if p.get('id') == para_id), None)
        section_ref = para.get('section_ref', '') if para else ''

        updated_cm, updated_rm, affected_para_ids = update_maps_on_revision(
            session['concept_map'],
            session['risk_map'],
            changes,
            para_id,
            section_ref
        )

        session['concept_map'] = updated_cm
        session['risk_map'] = updated_rm

    # Mark as accepted
    revision['accepted'] = True
    save_session(session_id, session)

    return jsonify({
        'status': 'accepted',
        'para_id': para_id,
        'concept_changes': changes,
        'affected_para_ids': affected_para_ids
    })


@api_bp.route('/reject', methods=['POST'])
def reject_revision():
    """Reject a proposed revision."""
    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    if para_id in session.get('revisions', {}):
        del session['revisions'][para_id]
        save_session(session_id, session)
        return jsonify({'status': 'rejected', 'para_id': para_id})

    return jsonify({'error': 'Revision not found'}), 404


@api_bp.route('/reanalyze', methods=['POST'])
def reanalyze_clause():
    """
    Re-analyze a clause based on updated context from revised related clauses.

    Expects JSON:
    {
        "session_id": "...",
        "para_id": "p_123"
    }
    """
    from app.services.claude_service import analyze_single_paragraph

    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    parsed_doc = session.get('parsed_doc')
    if not parsed_doc:
        return jsonify({'error': 'Document not found'}), 404

    # Find the paragraph
    paragraph = None
    for item in parsed_doc.get('content', []):
        if item.get('type') == 'paragraph' and item.get('id') == para_id:
            paragraph = item
            break

    if not paragraph:
        return jsonify({'error': 'Paragraph not found'}), 404

    try:
        # Get analysis context
        analysis = session.get('analysis', {})
        existing_risks = analysis.get('risk_by_paragraph', {}).get(para_id, [])

        # Find related paragraphs that have been revised
        related_ids = []
        for risk in existing_risks:
            if risk.get('related_para_ids'):
                related_ids.extend(risk['related_para_ids'].split(','))

        related_ids = list(set(id.strip() for id in related_ids if id.strip()))

        # Build context with revised related clauses
        revised_context = []
        for rel_id in related_ids:
            revision = session.get('revisions', {}).get(rel_id)
            if revision and revision.get('accepted'):
                rel_para = next((p for p in parsed_doc['content']
                                if p.get('id') == rel_id), None)
                if rel_para:
                    revised_context.append({
                        'id': rel_id,
                        'section_ref': rel_para.get('section_ref', ''),
                        'original': rel_para.get('text', ''),
                        'revised': revision.get('revised', '')
                    })

        # Re-analyze the paragraph with updated context
        new_risks = analyze_single_paragraph(
            paragraph=paragraph,
            document_map=analysis.get('document_map', {}),
            representation=session.get('context', {}).get('representation', 'buyer'),
            approach=session.get('context', {}).get('approach', 'competitive-bid'),
            aggressiveness=session.get('context', {}).get('aggressiveness', 3),
            revised_related=revised_context
        )

        # Update the analysis
        if 'risk_by_paragraph' not in analysis:
            analysis['risk_by_paragraph'] = {}
        analysis['risk_by_paragraph'][para_id] = new_risks

        session['analysis'] = analysis
        save_session(session_id, session)

        return jsonify({
            'para_id': para_id,
            'risks': new_risks,
            'revised_context_count': len(revised_context)
        })

    except Exception as e:
        return jsonify({'error': f'Re-analysis failed: {str(e)}'}), 500


@api_bp.route('/flag', methods=['POST'])
def flag_item():
    """
    Flag an item for review.

    Expects JSON:
    {
        "session_id": "...",
        "para_id": "p_123",
        "note": "Review note...",
        "flag_type": "client" or "attorney"
    }
    """
    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')
    note = data.get('note', '')
    flag_type = data.get('flag_type', 'client')  # 'client' or 'attorney'

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Find paragraph for context
    parsed_doc = session.get('parsed_doc')
    paragraph = None
    for item in parsed_doc.get('content', []):
        if item.get('type') == 'paragraph' and item.get('id') == para_id:
            paragraph = item
            break

    flag_entry = {
        'para_id': para_id,
        'section_ref': paragraph.get('section_ref', '') if paragraph else '',
        'text_excerpt': paragraph.get('text', '')[:200] if paragraph else '',
        'note': note,
        'flag_type': flag_type,  # 'client' = included in transmittal, 'attorney' = internal review
        'timestamp': datetime.now().isoformat()
    }

    if 'flags' not in session:
        session['flags'] = []
    session['flags'].append(flag_entry)
    save_session(session_id, session)

    return jsonify({'status': 'flagged', 'flag': flag_entry})


@api_bp.route('/unflag', methods=['POST'])
def unflag_item():
    """Remove a flag from an item."""
    data = request.get_json()
    session_id = data.get('session_id')
    para_id = data.get('para_id')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    session['flags'] = [f for f in session.get('flags', []) if f.get('para_id') != para_id]
    save_session(session_id, session)

    return jsonify({'status': 'unflagged', 'para_id': para_id})


@api_bp.route('/finalize', methods=['POST'])
def finalize():
    """
    Generate final outputs.

    Expects JSON:
    {
        "session_id": "..."
    }

    Returns paths to:
    - Word document with track changes
    - Transmittal email text
    - Change manifest
    """
    from app.services.document_service import generate_final_output

    data = request.get_json()
    session_id = data.get('session_id')

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    try:
        output = generate_final_output(
            session_id=session_id,
            original_path=session.get('target_path'),
            parsed_doc=session.get('parsed_doc'),
            revisions=session.get('revisions', {}),
            flags=session.get('flags', []),
            representation=session.get('representation'),
            deal_context=session.get('deal_context', '')
        )

        session['status'] = 'finalized'
        session['output'] = output
        save_session(session_id, session)

        return jsonify(output)
    except Exception as e:
        return jsonify({'error': f'Finalization failed: {str(e)}'}), 500


@api_bp.route('/download/<session_id>/<file_type>', methods=['GET'])
def download(session_id, file_type):
    """Download generated files."""
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    output = session.get('output', {})

    if file_type == 'docx':
        path = output.get('docx_path')
    elif file_type == 'transmittal':
        path = output.get('transmittal_path')
    elif file_type == 'manifest':
        path = output.get('manifest_path')
    else:
        return jsonify({'error': 'Unknown file type'}), 400

    if path and Path(path).exists():
        return send_file(path, as_attachment=True)

    return jsonify({'error': 'File not found'}), 404


@api_bp.route('/suggestions/<session_id>', methods=['GET'])
def get_suggestions(session_id):
    """
    Get improvement suggestions based on session patterns.

    Analyzes user corrections and patterns to suggest improvements
    to the redlining engine.
    """
    from app.services.analysis_service import generate_suggestions

    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    try:
        suggestions = generate_suggestions(
            revisions=session.get('revisions', {}),
            flags=session.get('flags', []),
            contract_type=session.get('contract_type', 'general')
        )
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': f'Suggestions failed: {str(e)}'}), 500


@api_bp.route('/implement', methods=['POST'])
def implement_suggestion():
    """
    Implement an approved improvement suggestion.

    Expects JSON:
    {
        "suggestion_id": "...",
        "approved": true
    }
    """
    from app.services.analysis_service import implement_improvement

    data = request.get_json()
    suggestion_id = data.get('suggestion_id')
    approved = data.get('approved', False)

    if not approved:
        return jsonify({'status': 'skipped'})

    try:
        result = implement_improvement(suggestion_id)
        return jsonify({'status': 'implemented', 'result': result})
    except Exception as e:
        return jsonify({'error': f'Implementation failed: {str(e)}'}), 500


@api_bp.route('/transmittal/<session_id>', methods=['GET'])
def get_transmittal(session_id):
    """
    Generate transmittal email content summarizing the review.

    Returns formatted email subject and body with:
    - High-level summary of key revisions made
    - List of all client-flagged paragraphs with notes

    TRANS-01: User can generate transmittal email summarizing the review
    TRANS-02: Transmittal includes high-level summary of key revisions made
    TRANS-03: Transmittal includes all paragraphs flagged for client review with notes
    """
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Get contract name from session
    contract_name = session.get('target_filename', 'Contract Document')
    if contract_name.endswith('.docx'):
        contract_name = contract_name[:-5]

    # Collect accepted revisions with their section references
    revisions = session.get('revisions', {})
    parsed_doc = session.get('parsed_doc', {})
    content = parsed_doc.get('content', [])

    # Build a map of para_id to section_ref for quick lookup
    para_to_section = {}
    for item in content:
        if item.get('type') == 'paragraph':
            para_to_section[item.get('id')] = item.get('section_ref', '')

    # Collect key revisions (accepted ones)
    key_revisions = []
    for para_id, revision_data in revisions.items():
        if revision_data.get('accepted'):
            section_ref = para_to_section.get(para_id, '')
            rationale = revision_data.get('rationale', 'Revised for client protection')
            # Create a brief description from the rationale
            # Truncate long rationales to first sentence or 100 chars
            brief = rationale.split('.')[0] if '.' in rationale else rationale
            if len(brief) > 100:
                brief = brief[:97] + '...'
            key_revisions.append({
                'section_ref': section_ref or 'N/A',
                'description': brief
            })

    # Collect client flags (flag_type == 'client')
    flags = session.get('flags', [])
    client_flags = [f for f in flags if f.get('flag_type') == 'client']

    # Sort flags by section reference for logical ordering
    client_flags.sort(key=lambda f: f.get('section_ref', ''))

    # Build the email body
    email_lines = []
    email_lines.append("Dear [Client],")
    email_lines.append("")
    email_lines.append(f"I have completed my review of {contract_name}. Below is a summary of the key revisions made and items flagged for your review.")
    email_lines.append("")

    # Key Revisions section
    email_lines.append("## Key Revisions")
    if key_revisions:
        for rev in key_revisions:
            section = rev['section_ref'] if rev['section_ref'] else 'General'
            email_lines.append(f"- [{section}]: {rev['description']}")
    else:
        email_lines.append("- No revisions were made during this review.")
    email_lines.append("")

    # Items for Your Review section
    email_lines.append("## Items for Your Review")
    if client_flags:
        for i, flag in enumerate(client_flags, 1):
            section = flag.get('section_ref', 'N/A')
            note = flag.get('note', 'Flagged for review')
            email_lines.append(f"{i}. [{section}]: {note}")
    else:
        email_lines.append("No items were flagged for your specific review.")
    email_lines.append("")

    email_lines.append("Please let me know if you have any questions.")
    email_lines.append("")
    email_lines.append("Best regards,")
    email_lines.append("[Attorney]")

    email_body = "\n".join(email_lines)
    email_subject = f"Redline Review: {contract_name}"

    return jsonify({
        'subject': email_subject,
        'body': email_body,
        'revision_count': len(key_revisions),
        'flag_count': len(client_flags)
    })


@api_bp.route('/sessions', methods=['GET'])
def list_sessions():
    """List all active sessions (in-memory only)."""
    session_list = []
    for sid, data in sessions.items():
        session_list.append({
            'session_id': sid,
            'created_at': data.get('created_at'),
            'status': data.get('status'),
            'contract_type': data.get('contract_type'),
            'representation': data.get('representation')
        })
    return jsonify({'sessions': session_list})


@api_bp.route('/sessions/saved', methods=['GET'])
def list_saved_sessions():
    """
    List all saved sessions from disk (NEW-04).

    Returns sessions sorted by last modified date (most recent first).
    """
    session_folder = current_app.config['SESSION_FOLDER']
    saved_sessions = []

    if session_folder.exists():
        for session_file in session_folder.glob('*.json'):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Get file modification time
                    mtime = session_file.stat().st_mtime
                    saved_sessions.append({
                        'session_id': data.get('session_id', session_file.stem),
                        'created_at': data.get('created_at'),
                        'last_modified': datetime.fromtimestamp(mtime).isoformat(),
                        'status': data.get('status'),
                        'contract_type': data.get('contract_type'),
                        'representation': data.get('representation'),
                        'target_filename': data.get('target_filename', 'Unknown'),
                        'revisions_count': len(data.get('revisions', {})),
                        'flags_count': len(data.get('flags', []))
                    })
            except (json.JSONDecodeError, IOError):
                # Skip corrupted files
                continue

    # Sort by last modified (most recent first)
    saved_sessions.sort(key=lambda x: x.get('last_modified', ''), reverse=True)

    return jsonify({'sessions': saved_sessions})


@api_bp.route('/session/<session_id>/save', methods=['POST'])
def save_session_endpoint(session_id):
    """
    Save current session state to disk (NEW-02).

    This persists the full session including document, analysis,
    revisions, and flags for later retrieval.
    """
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    try:
        # Ensure session is fully saved to disk
        save_session(session_id, session)

        return jsonify({
            'status': 'saved',
            'session_id': session_id,
            'message': 'Session saved successfully'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to save session: {str(e)}'}), 500


@api_bp.route('/session/<session_id>', methods=['DELETE'])
def discard_session(session_id):
    """
    Discard a session without saving (NEW-01).

    Removes session from memory. If it was never saved to disk,
    all progress is lost.
    """
    if session_id in sessions:
        del sessions[session_id]
        return jsonify({
            'status': 'discarded',
            'session_id': session_id,
            'message': 'Session discarded'
        })

    return jsonify({'error': 'Session not found'}), 404


@api_bp.route('/session/<session_id>/load', methods=['POST'])
def load_saved_session(session_id):
    """
    Load a previously saved session from disk (NEW-04).

    Restores session to memory for continued work.
    """
    session_folder = current_app.config['SESSION_FOLDER']
    session_path = session_folder / f'{session_id}.json'

    if not session_path.exists():
        return jsonify({'error': 'Saved session not found'}), 404

    try:
        with open(session_path, 'r', encoding='utf-8') as f:
            session_data = json.load(f)

        # Restore parsed document if path exists
        parsed_doc_path = session_data.get('parsed_doc_path')
        if parsed_doc_path and Path(parsed_doc_path).exists():
            with open(parsed_doc_path, 'r', encoding='utf-8') as f:
                session_data['parsed_doc'] = json.load(f)

        # Store in memory
        sessions[session_id] = session_data

        return jsonify({
            'status': 'loaded',
            'session_id': session_id,
            'target_filename': session_data.get('target_filename', 'Unknown'),
            'session_status': session_data.get('status'),
            'revisions_count': len(session_data.get('revisions', {})),
            'flags_count': len(session_data.get('flags', []))
        })
    except Exception as e:
        return jsonify({'error': f'Failed to load session: {str(e)}'}), 500


@api_bp.route('/session/<session_id>/info', methods=['GET'])
def get_session_info(session_id):
    """
    Get basic session info for display in confirmation dialogs.

    Returns summary info without full document/analysis data.
    """
    session = get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    # Count accepted revisions
    revisions = session.get('revisions', {})
    accepted_count = sum(1 for r in revisions.values() if r.get('accepted'))
    pending_count = len(revisions) - accepted_count

    # Count flags by type
    flags = session.get('flags', [])
    client_flags = sum(1 for f in flags if f.get('flag_type') == 'client')
    attorney_flags = len(flags) - client_flags

    return jsonify({
        'session_id': session_id,
        'target_filename': session.get('target_filename', 'Unknown Document'),
        'created_at': session.get('created_at'),
        'status': session.get('status'),
        'contract_type': session.get('contract_type'),
        'representation': session.get('representation'),
        'stats': {
            'accepted_revisions': accepted_count,
            'pending_revisions': pending_count,
            'total_revisions': len(revisions),
            'client_flags': client_flags,
            'attorney_flags': attorney_flags,
            'total_flags': len(flags)
        }
    })


@api_bp.route('/version', methods=['GET'])
def get_version():
    """Get git branch and commit info for display in header."""
    import subprocess

    try:
        # Get current branch
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            cwd=Path(__file__).parent.parent.parent,
            stderr=subprocess.DEVNULL
        ).decode().strip()

        # Get short commit hash
        commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            cwd=Path(__file__).parent.parent.parent,
            stderr=subprocess.DEVNULL
        ).decode().strip()

        return jsonify({
            'branch': branch,
            'commit': commit
        })
    except Exception:
        return jsonify({
            'branch': 'unknown',
            'commit': 'unknown'
        })
