export interface ColorToken {
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  styleId?: string;
}

export interface TextStyleToken {
  name: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: number | null;
  letterSpacing: number;
  styleId: string;
}

export interface LibraryComponentInfo {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  componentSetName?: string;
}

export interface LibraryIndex {
  components: LibraryComponentInfo[];
  componentNames: Set<string>;
  colorTokens: ColorToken[];
  textStyles: TextStyleToken[];
  spacingScale: number[];
  lastBuilt: number;
  /** true quando o índice veio da API (iFDL/UI); necessário para aplicar tokens da biblioteca */
  fromApi?: boolean;
}

export interface SerializedLibraryIndex {
  components: LibraryComponentInfo[];
  componentNames: string[];
  colorTokens: ColorToken[];
  textStyles: TextStyleToken[];
  spacingScale: number[];
  lastBuilt: number;
  fromApi?: boolean;
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IssueCategory = 'component' | 'color' | 'typography' | 'spacing';

export type IssueType =
  | 'detached-component'
  | 'missing-component'
  | 'off-token-fill'
  | 'off-token-stroke'
  | 'missing-text-style'
  | 'off-font-family'
  | 'off-font-size'
  | 'off-line-height'
  | 'off-spacing'
  | 'potential-new-component'
  // Accessibility & Design Critique
  | 'contrast-text'
  | 'contrast-ui'
  | 'touch-target-small'
  | 'missing-variant-state'
  | 'font-size-too-small'
  | 'line-height-invalid'
  | 'hierarchy-break'
  | 'grid-misaligned'
  | 'rhythm-inconsistent'
  | 'padding-insufficient';

export interface AuditIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  nodePath: string[];
  issueType: IssueType;
  category: IssueCategory;
  severity: IssueSeverity;
  description: string;
  currentValue: string;
  expectedValue: string;
  suggestion?: string;
  fixData?: FixData;
  status: 'pending' | 'fixed' | 'skipped';
}

export type FixData =
  | { type: 'apply-fill'; nodeId: string; color: RGB }
  | { type: 'apply-fill-style'; nodeId: string; styleKey: string; color: RGB }
  | { type: 'apply-stroke'; nodeId: string; color: RGB }
  | { type: 'apply-stroke-style'; nodeId: string; styleKey: string; color: RGB }
  | { type: 'apply-text-style'; nodeId: string; styleKey: string }
  | { type: 'apply-spacing'; nodeId: string; property: string; value: number }
  | { type: 'apply-line-height'; nodeId: string; value: number }
  | { type: 'fix-alignment'; nodeId: string; x: number; y: number }
  | { type: 'reconnect-component'; nodeId: string; componentKey: string }
  | { type: 'manual'; nodeId: string };

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LAB {
  l: number;
  a: number;
  b: number;
}

export interface CategoryScore {
  category: IssueCategory;
  score: number;
  conformantCount: number;
  totalCount: number;
  issueCount: number;
  weight: number;
}

export interface AuditResult {
  totalScore: number;
  categoryScores: CategoryScore[];
  issues: AuditIssue[];
  totalNodesScanned: number;
  scanDurationMs: number;
  timestamp: number;
  scope: string;
}

export type PluginMessage =
  | { type: 'load-library' }
  | { type: 'save-token'; token: string }
  | { type: 'set-library-index'; index: SerializedLibraryIndex }
  | { type: 'start-scan'; scope: 'selection' | 'page' }
  | { type: 'fix-issue'; issueId: string }
  | { type: 'fix-all-issues' }
  | { type: 'skip-issue'; issueId: string }
  | { type: 'navigate-to-node'; nodeId: string }
  | { type: 'resize'; width: number; height: number };

export type UIMessage =
  | { type: 'library-status'; loaded: boolean; componentCount: number; colorCount: number; textStyleCount: number }
  | { type: 'token-loaded'; token: string | null }
  | { type: 'scan-progress'; progress: number; message: string }
  | { type: 'scan-complete'; result: AuditResult }
  | { type: 'issue-fixed'; issueId: string; success: boolean; newScore?: number }
  | { type: 'issue-skipped'; issueId: string; newScore?: number }
  | { type: 'score-updated'; result: AuditResult }
  | { type: 'fix-all-complete'; result: AuditResult; fixedCount: number }
  | { type: 'error'; message: string };
