// =============================================================================
// Zustand store - replaces vanilla JS AppState global object
// =============================================================================

import { create } from 'zustand';
import type {
  SessionStatus,
  ContractType,
  Representation,
  Approach,
  Aggressiveness,
  Paragraph,
  Section,
  Exhibit,
  DefinedTerm,
  Risk,
  Revision,
  Flag,
  AnalysisStatus,
  AnalysisStage,
  ConceptMap,
  RiskMap,
  AnalysisSummary,
  SavedSessionListItem,
} from './types';

// --- Session State ---

interface SessionState {
  sessionId: string | null;
  status: SessionStatus | null;
  contractType: ContractType | null;
  representation: Representation;
  approach: Approach;
  aggressiveness: Aggressiveness;
  dealContext: string;
  includeExhibits: boolean;
  targetFilename: string | null;
  hasPrecedent: boolean;
}

// --- Document State ---

interface DocumentState {
  paragraphs: Paragraph[];
  sections: Section[];
  exhibits: Exhibit[];
  definedTerms: DefinedTerm[];
  documentHtml: string | null;
  precedentHtml: string | null;
}

// --- Analysis State ---

interface AnalysisState {
  risks: Risk[];
  conceptMap: ConceptMap | null;
  riskMap: RiskMap | null;
  summary: AnalysisSummary | null;
  analysisStatus: AnalysisStatus;
  analysisStage: AnalysisStage | null;
  analysisPercent: number;
  stageDisplay: string | null;
}

// --- Review State ---

interface ReviewState {
  selectedParaId: string | null;
  revisionSheetParaId: string | null;
  revisions: Record<string, Revision>;
  flags: Flag[];
  savedSessions: SavedSessionListItem[];
}

// --- UI State ---

type View = 'dashboard' | 'review';
type ReviewMode = 'linear' | 'by-risk' | 'by-category';

interface UIState {
  view: View;
  navPanelOpen: boolean;
  sidebarOpen: boolean;
  bottomSheetOpen: boolean;
  precedentPanelOpen: boolean;
  reviewMode: ReviewMode;
  compactMode: boolean;
  hoveredRiskId: string | null;
  focusedRiskId: string | null;
  generatingRevision: boolean;
}

// --- Combined Store ---

interface AppStore extends SessionState, DocumentState, AnalysisState, ReviewState, UIState {
  // Session actions
  setSession: (session: Partial<SessionState>) => void;
  resetSession: () => void;

  // Document actions
  setDocument: (doc: Partial<DocumentState>) => void;

  // Analysis actions
  setAnalysis: (analysis: Partial<AnalysisState>) => void;
  setAnalysisProgress: (progress: Pick<AnalysisState, 'analysisStatus' | 'analysisStage' | 'analysisPercent' | 'stageDisplay'>) => void;
  addIncrementalRisks: (risks: Risk[]) => void;

  // Review actions
  selectParagraph: (paraId: string | null) => void;
  setRevision: (paraId: string, revision: Revision) => void;
  removeRevision: (paraId: string) => void;
  setRevisions: (revisions: Record<string, Revision>) => void;
  addFlag: (flag: Flag) => void;
  removeFlag: (paraId: string) => void;
  setFlags: (flags: Flag[]) => void;
  setSavedSessions: (sessions: SavedSessionListItem[]) => void;

  // UI actions
  setView: (view: View) => void;
  toggleNavPanel: () => void;
  toggleSidebar: () => void;
  toggleBottomSheet: () => void;
  togglePrecedentPanel: () => void;
  setReviewMode: (mode: ReviewMode) => void;
  toggleCompactMode: () => void;
  setHoveredRiskId: (riskId: string | null) => void;
  setFocusedRiskId: (riskId: string | null) => void;
  setGeneratingRevision: (v: boolean) => void;
  setRevisionSheetParaId: (paraId: string | null) => void;
}

const initialSessionState: SessionState = {
  sessionId: null,
  status: null,
  contractType: null,
  representation: 'seller',
  approach: 'competitive-bid',
  aggressiveness: 3,
  dealContext: '',
  includeExhibits: false,
  targetFilename: null,
  hasPrecedent: false,
};

const initialDocumentState: DocumentState = {
  paragraphs: [],
  sections: [],
  exhibits: [],
  definedTerms: [],
  documentHtml: null,
  precedentHtml: null,
};

const initialAnalysisState: AnalysisState = {
  risks: [],
  conceptMap: null,
  riskMap: null,
  summary: null,
  analysisStatus: 'not_started',
  analysisStage: null,
  analysisPercent: 0,
  stageDisplay: null,
};

const initialReviewState: ReviewState = {
  selectedParaId: null,
  revisionSheetParaId: null,
  revisions: {},
  flags: [],
  savedSessions: [],
};

const initialUIState: UIState = {
  view: 'dashboard',
  navPanelOpen: true,
  sidebarOpen: true,
  bottomSheetOpen: false,
  precedentPanelOpen: false,
  reviewMode: 'linear',
  compactMode: false,
  hoveredRiskId: null,
  focusedRiskId: null,
  generatingRevision: false,
};

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  ...initialSessionState,
  ...initialDocumentState,
  ...initialAnalysisState,
  ...initialReviewState,
  ...initialUIState,

  // Session actions
  setSession: (session) => set((state) => ({ ...state, ...session })),
  resetSession: () =>
    set({
      ...initialSessionState,
      ...initialDocumentState,
      ...initialAnalysisState,
      ...initialReviewState,
      view: 'dashboard',
    }),

  // Document actions
  setDocument: (doc) => set((state) => ({ ...state, ...doc })),

  // Analysis actions
  setAnalysis: (analysis) => set((state) => ({ ...state, ...analysis })),
  setAnalysisProgress: (progress) => set((state) => ({ ...state, ...progress })),
  addIncrementalRisks: (newRisks) =>
    set((state) => {
      const existingIds = new Set(state.risks.map((r) => r.risk_id));
      const unique = newRisks.filter((r) => !existingIds.has(r.risk_id));
      return { risks: [...state.risks, ...unique] };
    }),

  // Review actions
  selectParagraph: (paraId) => set({ selectedParaId: paraId }),
  setRevision: (paraId, revision) =>
    set((state) => ({
      revisions: { ...state.revisions, [paraId]: revision },
    })),
  removeRevision: (paraId) =>
    set((state) => {
      const { [paraId]: _, ...rest } = state.revisions;
      return { revisions: rest };
    }),
  setRevisions: (revisions) => set({ revisions }),
  addFlag: (flag) => set((state) => ({ flags: [...state.flags, flag] })),
  removeFlag: (paraId) =>
    set((state) => ({
      flags: state.flags.filter((f) => f.para_id !== paraId),
    })),
  setFlags: (flags) => set({ flags }),
  setSavedSessions: (sessions) => set({ savedSessions: sessions }),

  // UI actions
  setView: (view) => set({ view }),
  toggleNavPanel: () => set((state) => ({ navPanelOpen: !state.navPanelOpen })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleBottomSheet: () => set((state) => {
    console.log("[store] toggleBottomSheet:", state.bottomSheetOpen, "->", !state.bottomSheetOpen, new Error().stack?.split('\n').slice(1, 4).join(' | '));
    return { bottomSheetOpen: !state.bottomSheetOpen };
  }),
  togglePrecedentPanel: () =>
    set((state) => ({ precedentPanelOpen: !state.precedentPanelOpen })),
  setReviewMode: (mode) => set({ reviewMode: mode }),
  toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
  setHoveredRiskId: (riskId) => set({ hoveredRiskId: riskId }),
  setFocusedRiskId: (riskId) =>
    set((state) => ({
      focusedRiskId: state.focusedRiskId === riskId ? null : riskId,
    })),
  setGeneratingRevision: (v) => set({ generatingRevision: v }),
  setRevisionSheetParaId: (paraId) => set({ revisionSheetParaId: paraId }),
}));
