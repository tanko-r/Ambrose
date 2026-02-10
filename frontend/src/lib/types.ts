// =============================================================================
// TypeScript interfaces for all API request/response shapes
// Derived from app/api/routes.py
// =============================================================================

// --- Common Types ---

export type ContractType = 'psa' | 'lease' | 'easement' | 'development' | 'loan' | 'general';
export type Representation = 'seller' | 'buyer' | 'landlord' | 'tenant' | 'lender' | 'borrower' | 'developer' | 'grantor' | 'grantee' | 'other';
export type Approach = 'quick-sale' | 'competitive-bid' | 'relationship' | 'adversarial';
export type Aggressiveness = 1 | 2 | 3 | 4 | 5;
export type SessionStatus = 'initialized' | 'analyzing' | 'analyzed' | 'finalized';
export type FlagType = 'client' | 'attorney';
export type FlagCategory = 'business-decision' | 'risk-alert' | 'for-discussion' | 'fyi';

export const FLAG_CATEGORY_LABELS: Record<FlagCategory, string> = {
  'business-decision': 'Business Decision',
  'risk-alert': 'Risk Alert',
  'for-discussion': 'For Discussion',
  'fyi': 'FYI',
} as const;

export const FLAG_CATEGORY_COLORS: Record<FlagCategory, string> = {
  'business-decision': 'blue',
  'risk-alert': 'orange',
  'for-discussion': 'purple',
  'fyi': 'gray',
} as const;
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AnalysisStage = 'initial_analysis' | 'parallel_batches' | 'complete';
export type AnalysisStatus = 'not_started' | 'analyzing' | 'complete';

// --- Document Structures ---

export interface SectionHierarchyItem {
  number: string;
  caption: string;
  level: number;
}

export interface Paragraph {
  id: string;
  type: 'paragraph' | 'heading' | 'table' | 'image';
  text: string;
  section_ref: string;
  section_hierarchy: SectionHierarchyItem[];
  style?: string;
  indent_level?: number;
  numbering?: string;
}

export interface Section {
  id: string;
  number: string;
  caption: string;
  level: number;
  parent_id?: string;
  children?: string[];
  paragraph_ids: string[];
}

export interface Exhibit {
  id: string;
  title: string;
  start_paragraph_id: string;
}

export interface DefinedTerm {
  term: string;
  definition: string;
  section_ref: string;
  para_id: string;
}

export interface DocumentMetadata {
  filename?: string;
  page_count?: number;
  word_count?: number;
  [key: string]: unknown;
}

// --- Risk & Analysis ---

export interface RiskRelationship {
  ref: string;
  effect: string;
}

export interface Risk {
  risk_id: string;
  para_id: string;
  section_ref: string;
  title: string;
  description: string;
  severity: Severity;
  type: 'risk' | 'opportunity';
  category?: string;
  highlight_text?: string;
  related_para_ids?: string;
  mitigated_by?: RiskRelationship[];
  amplified_by?: RiskRelationship[];
  triggers?: string[];
}

export interface ConceptMapProvision {
  value: string;
  section: string;
  [key: string]: unknown;
}

export interface ConceptMap {
  [category: string]: {
    [key: string]: ConceptMapProvision | string;
  };
}

export interface RiskMapEntry {
  risk_id: string;
  clause: string;
  para_id: string;
  title: string;
  description: string;
  base_severity: Severity;
  effective_severity?: Severity;
  mitigated_by?: RiskRelationship[];
  amplified_by?: RiskRelationship[];
  triggers?: string[];
}

export interface RiskMap {
  [para_id: string]: RiskMapEntry[];
}

export interface AnalysisSummary {
  total_risks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  [key: string]: number;
}

// --- Revision ---

export interface Revision {
  original: string;
  revised: string;
  rationale: string;
  thinking?: string;
  diff_html: string;
  related_revisions: RelatedRevision[];
  accepted: boolean;
  timestamp: string;
  editedHtml?: string;
  prompts?: unknown;
}

export interface RelatedRevision {
  para_id: string;
  original: string;
  revised: string;
  rationale: string;
}

// --- Flag ---

export interface Flag {
  para_id: string;
  section_ref: string;
  text_excerpt: string;
  note: string;
  flag_type: FlagType;
  category: FlagCategory;
  timestamp: string;
}

// --- API Call Tracking ---

export interface ApiCall {
  id: number;
  model: string;
  endpoint: string;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  timestamp: string;
}

// =============================================================================
// API Request Types
// =============================================================================

export interface IntakeRequest {
  target_file: File;
  precedent_file?: File;
  representation: Representation;
  deal_context: string;
  approach: Approach;
  aggressiveness: Aggressiveness;
  include_exhibits: boolean;
}

export interface ReviseRequest {
  session_id: string;
  para_id: string;
  risk_id?: string;
  risk_ids?: string[];
  include_related_ids?: string[];
  custom_instruction?: string;
}

export interface AcceptRequest {
  session_id: string;
  para_id: string;
}

export interface RejectRequest {
  session_id: string;
  para_id: string;
}

export interface ReanalyzeRequest {
  session_id: string;
  para_id: string;
}

export interface FlagRequest {
  session_id: string;
  para_id: string;
  note: string;
  flag_type: FlagType;
  category: FlagCategory;
}

export interface UnflagRequest {
  session_id: string;
  para_id: string;
}

export interface FinalizeRequest {
  session_id: string;
  author_name?: string;
}

export interface FinalizePreviewRequest {
  session_id: string;
}

export interface ImplementRequest {
  suggestion_id: string;
  approved: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface IntakeResponse {
  session_id: string;
  contract_type: ContractType;
  paragraph_count: number;
  section_count: number;
  exhibit_count: number;
  has_precedent: boolean;
  status: SessionStatus;
}

export interface DocumentResponse {
  session_id: string;
  filename: string;
  has_precedent: boolean;
  content: Paragraph[];
  sections: Section[];
  exhibits: Exhibit[];
  defined_terms: DefinedTerm[];
  metadata: DocumentMetadata;
  flags: Flag[];
  revisions: Record<string, Revision>;
}

export interface PrecedentResponse {
  session_id: string;
  has_precedent: boolean;
  filename: string;
  content: Paragraph[];
  sections: Section[];
  defined_terms: DefinedTerm[];
  metadata: DocumentMetadata;
}

export interface RelatedClause {
  id: string;
  para_id: string;
  section_ref: string;
  text: string;
  score: number;
  similarity: number;
  caption?: string;
}

export interface RelatedClausesResponse {
  session_id: string;
  para_id: string;
  target_section_ref: string;
  related_clauses: RelatedClause[];
  total_matches: number;
}

export interface AnalysisResponse {
  risk_inventory: Risk[];
  concept_map: ConceptMap;
  risk_map: RiskMap;
  summary: AnalysisSummary;
  document_map?: Record<string, unknown>;
  analysis_method?: 'claude' | 'regex_fallback';
  fallback_reason?: string;
}

export interface AnalysisProgressResponse {
  status: AnalysisStatus;
  stage?: AnalysisStage;
  percent: number;
  stage_display?: string;
  stage_elapsed_display?: string;
  elapsed_display?: string;
  initial_analysis_duration_display?: string;
  current_batch?: number;
  total_batches?: number;
  incremental_risks?: Risk[];
  api_calls?: ApiCall[];
}

export interface ReviseResponse {
  para_id: string;
  original: string;
  revised: string;
  rationale: string;
  thinking?: string;
  diff_html: string;
  related_revisions: RelatedRevision[];
}

export interface AcceptResponse {
  status: 'accepted';
  para_id: string;
  concept_changes: ConceptChange[];
  affected_para_ids: string[];
}

export interface ConceptChange {
  type: string;
  description: string;
  [key: string]: unknown;
}

export interface RejectResponse {
  status: 'rejected';
  para_id: string;
}

export interface ReanalyzeResponse {
  para_id: string;
  risks: Risk[];
  revised_context_count: number;
}

export interface FlagResponse {
  status: 'flagged';
  flag: Flag;
}

export interface UnflagResponse {
  status: 'unflagged';
  para_id: string;
}

export interface FinalizeResponse {
  track_changes_path: string;
  clean_path: string;
  revision_count: number;
  revision_details: RevisionDetail[];
}

export interface RevisionDetail {
  para_id: string;
  section_ref: string;
  section_title: string;
  original: string;
  revised: string;
  rationale: string;
  diff_html: string;
}

export interface FinalizePreviewResponse {
  revision_count: number;
  revisions: RevisionDetail[];
}

export interface TransmittalResponse {
  subject: string;
  body: string;
  revision_count: number;
  flag_count: number;
  include_revisions?: boolean;
}

export interface SessionListItem {
  session_id: string;
  created_at: string;
  status: SessionStatus;
  contract_type: ContractType;
  representation: Representation;
}

export interface SavedSessionListItem extends SessionListItem {
  last_modified: string;
  target_filename: string;
  revisions_count: number;
  flags_count: number;
}

export interface SessionsResponse {
  sessions: SessionListItem[];
}

export interface SavedSessionsResponse {
  sessions: SavedSessionListItem[];
}

export interface SaveSessionResponse {
  status: 'saved';
  session_id: string;
  message: string;
}

export interface DiscardSessionResponse {
  status: 'discarded';
  session_id: string;
  message: string;
}

export interface LoadSessionResponse {
  status: 'loaded';
  session_id: string;
  target_filename: string;
  session_status: SessionStatus;
  revisions_count: number;
  flags_count: number;
}

export interface SessionInfoResponse {
  session_id: string;
  target_filename: string;
  created_at: string;
  status: SessionStatus;
  contract_type: ContractType;
  representation: Representation;
  stats: {
    accepted_revisions: number;
    pending_revisions: number;
    total_revisions: number;
    client_flags: number;
    attorney_flags: number;
    total_flags: number;
  };
}

export interface TestSessionResponse {
  session_id: string;
  message: string;
  risks_count: number;
  paragraphs_count: number;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
}

export interface Suggestion {
  id: string;
  description: string;
  [key: string]: unknown;
}

export interface ImplementResponse {
  status: 'implemented' | 'skipped';
  result?: Record<string, unknown>;
}

export interface VersionResponse {
  branch: string;
  commit: string;
}

export interface HealthResponse {
  status: 'ok';
}

export interface ApiError {
  error: string;
}

// --- Precedent Split View ---

export type NavigatorPosition = 'right-sidebar' | 'bottom-drawer' | 'ghost';

export interface PrecedentSnippet {
  id: string;
  text: string;
  sourceParagraphId: string;
  sourceSection: string;
  targetParaId: string;
  timestamp: string;
}
