// =============================================================================
// Typed API client for Flask backend
// All requests go through Next.js rewrite proxy (/api/* -> Flask :5000)
// =============================================================================

import type {
  IntakeResponse,
  DocumentResponse,
  PrecedentResponse,
  RelatedClausesResponse,
  AnalysisResponse,
  AnalysisProgressResponse,
  ReviseRequest,
  ReviseResponse,
  AcceptRequest,
  AcceptResponse,
  RejectRequest,
  RejectResponse,
  ReanalyzeRequest,
  ReanalyzeResponse,
  FlagRequest,
  FlagResponse,
  UnflagRequest,
  UnflagResponse,
  FinalizeRequest,
  FinalizeResponse,
  FinalizePreviewRequest,
  FinalizePreviewResponse,
  TransmittalResponse,
  SessionsResponse,
  SavedSessionsResponse,
  SaveSessionResponse,
  DiscardSessionResponse,
  LoadSessionResponse,
  SessionInfoResponse,
  TestSessionResponse,
  SuggestionsResponse,
  ImplementRequest,
  ImplementResponse,
  VersionResponse,
  HealthResponse,
  ApiError,
  Representation,
  Approach,
  Aggressiveness,
} from './types';

class ApiClientError extends Error {
  status: number;
  data: ApiError;

  constructor(status: number, data: ApiError) {
    super(data.error || `API error ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiClientError(res.status, data);
  }
  return res.json();
}

async function requestText(url: string, options?: RequestInit): Promise<string> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiClientError(res.status, data);
  }
  return res.text();
}

async function requestBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiClientError(res.status, { error: `Download failed: HTTP ${res.status}` });
  }
  return res.blob();
}

// =============================================================================
// Session Management
// =============================================================================

export async function listSessions(): Promise<SessionsResponse> {
  return request('/api/sessions');
}

export async function listSavedSessions(): Promise<SavedSessionsResponse> {
  return request('/api/sessions/saved');
}

export async function saveSession(sessionId: string): Promise<SaveSessionResponse> {
  return request(`/api/session/${sessionId}/save`, { method: 'POST' });
}

export async function discardSession(sessionId: string): Promise<DiscardSessionResponse> {
  return request(`/api/session/${sessionId}`, { method: 'DELETE' });
}

export async function loadSession(sessionId: string): Promise<LoadSessionResponse> {
  return request(`/api/session/${sessionId}/load`, { method: 'POST' });
}

export async function getSessionInfo(sessionId: string): Promise<SessionInfoResponse> {
  return request(`/api/session/${sessionId}/info`);
}

// =============================================================================
// Intake
// =============================================================================

export async function intake(params: {
  targetFile: File;
  precedentFile?: File;
  representation: Representation;
  dealContext: string;
  approach: Approach;
  aggressiveness: Aggressiveness;
  includeExhibits: boolean;
}): Promise<IntakeResponse> {
  const formData = new FormData();
  formData.append('target_file', params.targetFile);
  if (params.precedentFile) {
    formData.append('precedent_file', params.precedentFile);
  }
  formData.append('representation', params.representation);
  formData.append('deal_context', params.dealContext);
  formData.append('approach', params.approach);
  formData.append('aggressiveness', String(params.aggressiveness));
  formData.append('include_exhibits', String(params.includeExhibits));

  return request('/api/intake', {
    method: 'POST',
    body: formData,
  });
}

export async function loadTestSession(): Promise<TestSessionResponse> {
  return request('/api/load-test-session', { method: 'POST' });
}

// =============================================================================
// Document
// =============================================================================

export async function getDocument(sessionId: string): Promise<DocumentResponse> {
  return request(`/api/document/${sessionId}`);
}

export async function getDocumentHtml(sessionId: string): Promise<string> {
  return requestText(`/api/document/${sessionId}/html`);
}

export async function getPrecedent(sessionId: string): Promise<PrecedentResponse> {
  return request(`/api/precedent/${sessionId}`);
}

export async function getPrecedentHtml(sessionId: string): Promise<string> {
  return requestText(`/api/precedent/${sessionId}/html`);
}

export async function getRelatedClauses(
  sessionId: string,
  paraId: string
): Promise<RelatedClausesResponse> {
  return request(`/api/precedent/${sessionId}/related/${paraId}`);
}

// =============================================================================
// Analysis
// =============================================================================

export async function getAnalysis(sessionId: string): Promise<AnalysisResponse> {
  return request(`/api/analysis/${sessionId}`);
}

export async function getAnalysisProgress(
  sessionId: string,
  options?: { includeRisks?: boolean; lastApiCallId?: number }
): Promise<AnalysisProgressResponse> {
  const params = new URLSearchParams();
  if (options?.includeRisks) params.set('include_risks', 'true');
  if (options?.lastApiCallId) params.set('last_api_call_id', String(options.lastApiCallId));
  const qs = params.toString();
  return request(`/api/analysis/${sessionId}/progress${qs ? `?${qs}` : ''}`);
}

// =============================================================================
// Revision
// =============================================================================

export async function revise(data: ReviseRequest): Promise<ReviseResponse> {
  return request('/api/revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function acceptRevision(data: AcceptRequest): Promise<AcceptResponse> {
  return request('/api/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function rejectRevision(data: RejectRequest): Promise<RejectResponse> {
  return request('/api/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function reanalyze(data: ReanalyzeRequest): Promise<ReanalyzeResponse> {
  return request('/api/reanalyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Flagging
// =============================================================================

export async function flagItem(data: FlagRequest): Promise<FlagResponse> {
  return request('/api/flag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function unflagItem(data: UnflagRequest): Promise<UnflagResponse> {
  return request('/api/unflag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Finalization
// =============================================================================

export async function finalize(data: FinalizeRequest): Promise<FinalizeResponse> {
  return request('/api/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function finalizePreview(
  data: FinalizePreviewRequest
): Promise<FinalizePreviewResponse> {
  return request('/api/finalize/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getTransmittal(sessionId: string): Promise<TransmittalResponse> {
  return request(`/api/transmittal/${sessionId}`);
}

export async function downloadFile(
  sessionId: string,
  fileType: 'docx' | 'track_changes' | 'clean' | 'transmittal' | 'manifest'
): Promise<Blob> {
  return requestBlob(`/api/download/${sessionId}/${fileType}`);
}

// =============================================================================
// Suggestions
// =============================================================================

export async function getSuggestions(sessionId: string): Promise<SuggestionsResponse> {
  return request(`/api/suggestions/${sessionId}`);
}

export async function implementSuggestion(data: ImplementRequest): Promise<ImplementResponse> {
  return request('/api/implement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Utilities
// =============================================================================

export async function getVersion(): Promise<VersionResponse> {
  return request('/api/version');
}

export async function healthCheck(): Promise<HealthResponse> {
  return request('/health');
}

// Re-export error class for consumers
export { ApiClientError };
