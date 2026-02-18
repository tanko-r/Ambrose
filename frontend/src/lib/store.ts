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
  PrecedentSnippet,
  NavigatorPosition,
  RelatedClause,
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
type SidebarTab = 'risks' | 'related' | 'definitions' | 'flags';

interface UIState {
  view: View;
  navPanelOpen: boolean;
  sidebarOpen: boolean;
  bottomSheetOpen: boolean;
  precedentPanelOpen: boolean;

  compactMode: boolean;
  showRisks: boolean;
  showRevisions: boolean;
  showFlags: boolean;
  hoveredRiskId: string | null;
  focusedRiskId: string | null;
  focusedFlagId: string | null;
  generatingRevision: boolean;
  defaultSidebarTab: SidebarTab;
  navPanelVisibleDefault: boolean;
  navPanelWidth: number;
  sidebarWidth: number;
}

// --- Precedent State ---

interface PrecedentState {
  lockedParaId: string | null;
  lockedRelatedClauses: RelatedClause[] | null;
  precedentSnippets: PrecedentSnippet[];
  navigatorPosition: NavigatorPosition;
  precedentFilename: string | null;
  precedentParagraphs: Paragraph[];
  precedentSections: Section[];
  precedentScrollTarget: string | null;
}

// --- Focus History State ---

interface HistoryState {
  focusHistory: string[];       // Circular buffer of para IDs, max 20
  focusHistoryIndex: number;    // Current position (-1 = at head)
}

// --- Combined Store ---

interface AppStore extends SessionState, DocumentState, AnalysisState, ReviewState, UIState, PrecedentState, HistoryState {
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
  updateFlag: (flag: Flag) => void;
  removeFlag: (flagId: string) => void;
  setFlags: (flags: Flag[]) => void;
  setSavedSessions: (sessions: SavedSessionListItem[]) => void;

  // UI actions
  setView: (view: View) => void;
  toggleNavPanel: () => void;
  toggleSidebar: () => void;
  toggleBottomSheet: () => void;
  togglePrecedentPanel: () => void;

  setNavPanelWidth: (w: number) => void;
  setSidebarWidth: (w: number) => void;
  toggleCompactMode: () => void;
  toggleShowRisks: () => void;
  toggleShowRevisions: () => void;
  toggleShowFlags: () => void;
  setHoveredRiskId: (riskId: string | null) => void;
  setFocusedRiskId: (riskId: string | null) => void;
  setFocusedFlagId: (flagId: string | null) => void;
  setGeneratingRevision: (v: boolean) => void;
  setRevisionSheetParaId: (paraId: string | null) => void;

  // History actions
  goBackInHistory: () => void;
  goForwardInHistory: () => void;
  goToHistoryIndex: (index: number) => void;

  // Precedent actions
  setLockedParaId: (paraId: string | null) => void;
  setLockedRelatedClauses: (clauses: RelatedClause[] | null) => void;
  addPrecedentSnippet: (snippet: PrecedentSnippet) => void;
  removePrecedentSnippet: (snippetId: string) => void;
  clearPrecedentSnippets: (targetParaId?: string) => void;
  setNavigatorPosition: (position: NavigatorPosition) => void;
  setPrecedentData: (data: { filename: string; paragraphs: Paragraph[]; sections: Section[] }) => void;
  setPrecedentScrollTarget: (paraId: string | null) => void;
  openPrecedentPanel: () => void;
  closePrecedentPanel: () => void;
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

  compactMode: false,
  showRisks: true,
  showRevisions: true,
  showFlags: true,
  hoveredRiskId: null,
  focusedRiskId: null,
  focusedFlagId: null,
  generatingRevision: false,
  defaultSidebarTab: 'risks',
  navPanelVisibleDefault: true,
  navPanelWidth: 260,
  sidebarWidth: 380,
};

const initialHistoryState: HistoryState = {
  focusHistory: [],
  focusHistoryIndex: -1,
};

const initialPrecedentState: PrecedentState = {
  lockedParaId: null,
  lockedRelatedClauses: null,
  precedentSnippets: [],
  navigatorPosition: 'right-sidebar',
  precedentFilename: null,
  precedentParagraphs: [],
  precedentSections: [],
  precedentScrollTarget: null,
};

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  ...initialSessionState,
  ...initialDocumentState,
  ...initialAnalysisState,
  ...initialReviewState,
  ...initialUIState,
  ...initialPrecedentState,
  ...initialHistoryState,

  // Session actions
  setSession: (session) => set((state) => ({ ...state, ...session })),
  resetSession: () =>
    set((state) => ({
      ...initialSessionState,
      ...initialDocumentState,
      ...initialAnalysisState,
      ...initialReviewState,
      ...initialPrecedentState,
      ...initialHistoryState,
      view: 'dashboard',
      // Preserve savedSessions across reset — they are project-level, not session-level
      savedSessions: state.savedSessions,
    })),

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
  selectParagraph: (paraId) =>
    set((state) => {
      if (!paraId || paraId === state.selectedParaId) return { selectedParaId: paraId };
      // Truncate future entries when navigating from a mid-history position
      const history = state.focusHistoryIndex >= 0
        ? state.focusHistory.slice(0, state.focusHistoryIndex + 1)
        : [...state.focusHistory];
      history.push(paraId);
      if (history.length > 20) history.shift();
      return {
        selectedParaId: paraId,
        focusHistory: history,
        focusHistoryIndex: -1,
      };
    }),
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
  updateFlag: (flag) =>
    set((state) => ({
      flags: state.flags.map((f) => (f.id === flag.id ? flag : f)),
    })),
  removeFlag: (flagId) =>
    set((state) => ({
      flags: state.flags.filter((f) => f.id !== flagId),
    })),
  setFlags: (flags) => set({ flags }),
  setSavedSessions: (sessions) => set({ savedSessions: sessions }),

  // UI actions
  setView: (view) => set({ view }),
  toggleNavPanel: () => set((state) => ({ navPanelOpen: !state.navPanelOpen })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setNavPanelWidth: (w) => set({ navPanelWidth: Math.max(180, Math.min(400, w)) }),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(280, Math.min(560, w)) }),
  toggleBottomSheet: () => set((state) => ({ bottomSheetOpen: !state.bottomSheetOpen })),
  togglePrecedentPanel: () =>
    set((state) => {
      const opening = !state.precedentPanelOpen;
      return {
        precedentPanelOpen: opening,
        // Clear lock state when closing
        ...(opening ? {} : { lockedParaId: null, lockedRelatedClauses: null }),
      };
    }),

  toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
  toggleShowRisks: () => set((state) => ({ showRisks: !state.showRisks })),
  toggleShowRevisions: () => set((state) => ({ showRevisions: !state.showRevisions })),
  toggleShowFlags: () => set((state) => ({ showFlags: !state.showFlags })),
  setHoveredRiskId: (riskId) => set({ hoveredRiskId: riskId }),
  setFocusedRiskId: (riskId) =>
    set((state) => ({
      focusedRiskId: state.focusedRiskId === riskId ? null : riskId,
    })),
  setFocusedFlagId: (flagId) => set({ focusedFlagId: flagId }),
  setGeneratingRevision: (v) => set({ generatingRevision: v }),
  setRevisionSheetParaId: (paraId) => set({ revisionSheetParaId: paraId }),

  // History actions
  goBackInHistory: () =>
    set((state) => {
      const { focusHistory, focusHistoryIndex } = state;
      if (focusHistory.length === 0) return {};
      const currentPos = focusHistoryIndex === -1 ? focusHistory.length - 1 : focusHistoryIndex;
      if (currentPos <= 0) return {};
      const newPos = currentPos - 1;
      return { selectedParaId: focusHistory[newPos], focusHistoryIndex: newPos };
    }),
  goForwardInHistory: () =>
    set((state) => {
      const { focusHistory, focusHistoryIndex } = state;
      if (focusHistoryIndex === -1 || focusHistoryIndex >= focusHistory.length - 1) return {};
      const newPos = focusHistoryIndex + 1;
      return {
        selectedParaId: focusHistory[newPos],
        focusHistoryIndex: newPos === focusHistory.length - 1 ? -1 : newPos,
      };
    }),
  goToHistoryIndex: (index) =>
    set((state) => {
      const { focusHistory } = state;
      if (index < 0 || index >= focusHistory.length) return {};
      return {
        selectedParaId: focusHistory[index],
        focusHistoryIndex: index === focusHistory.length - 1 ? -1 : index,
      };
    }),

  // Precedent actions
  setLockedParaId: (paraId) =>
    set((state) => ({
      lockedParaId: paraId,
      // Clear locked related clauses when unlocking
      lockedRelatedClauses: paraId === null ? null : state.lockedRelatedClauses,
    })),
  setLockedRelatedClauses: (clauses) => set({ lockedRelatedClauses: clauses }),
  addPrecedentSnippet: (snippet) =>
    set((state) => ({
      precedentSnippets: [...state.precedentSnippets, snippet],
    })),
  removePrecedentSnippet: (snippetId) =>
    set((state) => ({
      precedentSnippets: state.precedentSnippets.filter((s) => s.id !== snippetId),
    })),
  clearPrecedentSnippets: (targetParaId) =>
    set((state) => ({
      precedentSnippets: targetParaId
        ? state.precedentSnippets.filter((s) => s.targetParaId !== targetParaId)
        : [],
    })),
  setNavigatorPosition: (position) => set({ navigatorPosition: position }),
  setPrecedentData: (data) =>
    set({
      precedentFilename: data.filename,
      precedentParagraphs: data.paragraphs,
      precedentSections: data.sections,
    }),
  setPrecedentScrollTarget: (paraId) => set({ precedentScrollTarget: paraId }),
  openPrecedentPanel: () => set({ precedentPanelOpen: true }),
  closePrecedentPanel: () =>
    set({
      precedentPanelOpen: false,
      lockedParaId: null,
      lockedRelatedClauses: null,
      precedentScrollTarget: null,
      navPanelOpen: true,
      sidebarOpen: true,
    }),
}));
