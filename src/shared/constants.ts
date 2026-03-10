import type { IssueCategory, IssueSeverity, IssueType } from './types';

export const SCORE_WEIGHTS: Record<IssueCategory, number> = {
  component: 0.40,
  color: 0.25,
  typography: 0.20,
  spacing: 0.15,
};

export const SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120, 160];

export const SCORE_RANGES = [
  { min: 90, max: 100, label: 'Excelente', color: '#22C55E' },
  { min: 70, max: 89, label: 'Bom', color: '#84CC16' },
  { min: 50, max: 69, label: 'Atenção', color: '#EAB308' },
  { min: 0, max: 49, label: 'Crítico', color: '#EF4444' },
];

export const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

export const ISSUE_SEVERITY_MAP: Record<IssueType, IssueSeverity> = {
  'detached-component': 'critical',
  'missing-component': 'medium',
  'off-token-fill': 'high',
  'off-token-stroke': 'high',
  'missing-text-style': 'high',
  'off-font-family': 'high',
  'off-font-size': 'medium',
  'off-line-height': 'low',
  'off-spacing': 'medium',
  'potential-new-component': 'low',
  // Accessibility & Design Critique
  'contrast-text': 'critical',
  'contrast-ui': 'high',
  'touch-target-small': 'high',
  'missing-variant-state': 'medium',
  'font-size-too-small': 'high',
  'line-height-invalid': 'medium',
  'hierarchy-break': 'low',
  'grid-misaligned': 'low',
  'rhythm-inconsistent': 'medium',
  'padding-insufficient': 'medium',
};

export const ISSUE_CATEGORY_MAP: Record<IssueType, IssueCategory> = {
  'detached-component': 'component',
  'missing-component': 'component',
  'potential-new-component': 'component',
  'off-token-fill': 'color',
  'off-token-stroke': 'color',
  'missing-text-style': 'typography',
  'off-font-family': 'typography',
  'off-font-size': 'typography',
  'off-line-height': 'typography',
  'off-spacing': 'spacing',
  // Accessibility & Design Critique
  'contrast-text': 'color',
  'contrast-ui': 'color',
  'touch-target-small': 'component',
  'missing-variant-state': 'component',
  'font-size-too-small': 'typography',
  'line-height-invalid': 'typography',
  'hierarchy-break': 'typography',
  'grid-misaligned': 'spacing',
  'rhythm-inconsistent': 'spacing',
  'padding-insufficient': 'spacing',
};

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  component: 'Componentes',
  color: 'Cores',
  typography: 'Tipografia',
  spacing: 'Espaçamento',
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const COLOR_DISTANCE_THRESHOLD = 5;

// Accessibility thresholds (WCAG 2.1 AA)
export const A11Y_CONTRAST_TEXT = 4.5;       // Normal text minimum
export const A11Y_CONTRAST_LARGE = 3.0;      // Large text (≥18px or ≥14px bold)
export const A11Y_CONTRAST_UI = 3.0;         // UI components & graphical objects
export const A11Y_TOUCH_MIN = 44;            // Minimum touch target (px)
export const A11Y_FONT_MIN = 12;             // Minimum body font size (px)
export const A11Y_FONT_MIN_COMPACT = 11;     // Minimum compact UI font size (px)
export const A11Y_LINE_HEIGHT_MIN = 1.2;     // Minimum line-height ratio
export const A11Y_GRID_UNIT = 4;             // Grid alignment unit (px)
export const A11Y_PADDING_MIN = 8;           // Minimum interactive padding (px)

// Issue types that are accessibility-specific (for UI filtering)
export const A11Y_ISSUE_TYPES = [
  'contrast-text',
  'contrast-ui',
  'touch-target-small',
  'missing-variant-state',
  'font-size-too-small',
  'line-height-invalid',
  'hierarchy-break',
  'grid-misaligned',
  'rhythm-inconsistent',
  'padding-insufficient',
] as const;

export const CACHE_KEY_LIBRARY = 'tomate-library-index';
export const CACHE_KEY_TOKEN = 'tomate-api-token';

export const PLUGIN_UI_WIDTH = 380;
export const PLUGIN_UI_HEIGHT = 580;

export const DS_FILE_KEY = 'YuYore4hgyjGuWHDtSeLrhxP';
export const FIGMA_API_BASE = 'https://api.figma.com/v1';
