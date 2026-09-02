import type { AuditIssue, LibraryIndex, RGB } from '../shared/types';
import {
  ISSUE_SEVERITY_MAP, ISSUE_CATEGORY_MAP, COLOR_DISTANCE_THRESHOLD,
  A11Y_CONTRAST_TEXT, A11Y_CONTRAST_LARGE, A11Y_CONTRAST_UI,
  A11Y_TOUCH_MIN, A11Y_FONT_MIN, A11Y_FONT_MIN_COMPACT,
  A11Y_LINE_HEIGHT_MIN, A11Y_GRID_UNIT, A11Y_PADDING_MIN,
} from '../shared/constants';
import {
  rgbToHex, findNearestColor, findNearestSpacing,
  calculateContrastRatio, getBackgroundColor, isInteractiveComponent,
} from './color-utils';

let issueCounter = 0;

/**
 * Checks if a TEXT node is likely an icon (icon font glyph).
 * Icons use icon fonts (e.g. Material Icons, Remix Icon) and should
 * be excluded from typography audits.
 */
function isIconTextNode(node: TextNode): boolean {
  const name = node.name.toLowerCase();
  const iconNamePatterns = ['icon', 'icone', 'ícone', 'glyph', 'ri-', 'material', 'fa-', 'feather', 'lucide'];
  if (iconNamePatterns.some(p => name.includes(p))) return true;

  // Check parent names (icons are often nested inside icon containers)
  let parent = node.parent;
  let depth = 0;
  while (parent && depth < 3) {
    if ('name' in parent) {
      const parentName = (parent.name as string).toLowerCase();
      if (iconNamePatterns.some(p => parentName.includes(p))) return true;
    }
    parent = parent.parent;
    depth++;
  }

  // Check font family for known icon fonts
  const fontName = node.fontName;
  if (typeof fontName !== 'symbol') {
    const family = fontName.family.toLowerCase();
    const iconFonts = ['icon', 'material', 'remix', 'fontawesome', 'feather', 'lucide', 'phosphor', 'tabler'];
    if (iconFonts.some(f => family.includes(f))) return true;
  }

  // Single-character text with very small content is likely an icon glyph
  const chars = node.characters;
  if (typeof chars === 'string' && chars.length <= 2) {
    // Check for non-printable / PUA (Private Use Area) Unicode characters used by icon fonts
    const code = chars.charCodeAt(0);
    if (code >= 0xE000 && code <= 0xF8FF) return true;  // BMP PUA
    if (code >= 0xF0000) return true;                      // Supplementary PUA
  }

  return false;
}

/**
 * Checks if a node is a vector/illustration that should be excluded from
 * color token checks. Vectors, shapes used as illustrations, and nodes
 * nested inside illustration containers use arbitrary colors by design.
 */
function isIllustrationOrVector(node: SceneNode): boolean {
  // Raw vector types — always exclude
  const vectorTypes = ['VECTOR', 'STAR', 'POLYGON', 'ELLIPSE', 'LINE', 'BOOLEAN_OPERATION'];
  if (vectorTypes.includes(node.type)) return true;

  // Name-based heuristics: illustration, icon, graphic, image, asset, decoration
  const name = node.name.toLowerCase();
  const illustrationPatterns = [
    'illustration', 'ilustra', 'vector', 'vetor', 'svg', 'graphic',
    'artwork', 'art', 'decoration', 'decorat', 'ornament', 'shape',
    'icon', 'icone', 'ícone', 'logo', 'badge', 'sticker', 'emoji',
    'image', 'imagem', 'foto', 'photo', 'banner', 'hero', 'cover',
  ];
  if (illustrationPatterns.some(p => name.includes(p))) return true;

  // Check if any ancestor up to 4 levels is an illustration container
  let parent = node.parent;
  let depth = 0;
  while (parent && depth < 4) {
    if ('name' in parent) {
      const parentName = (parent.name as string).toLowerCase();
      if (illustrationPatterns.some(p => parentName.includes(p))) return true;
    }
    parent = parent.parent;
    depth++;
  }

  return false;
}

export function resetIssueCounter(): void {
  issueCounter = 0;
}

function createIssueId(): string {
  return `issue-${++issueCounter}`;
}

function getNodePath(node: SceneNode): string[] {
  const path: string[] = [node.name];
  let parent = node.parent;
  while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    if ('name' in parent) path.unshift(parent.name);
    parent = parent.parent;
  }
  return path;
}

export function detectComponentIssues(
  node: SceneNode,
  index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const nodePath = getNodePath(node);

  if (node.type === 'INSTANCE') {
    if (!node.mainComponent) {
      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'detached-component',
        category: ISSUE_CATEGORY_MAP['detached-component'],
        severity: ISSUE_SEVERITY_MAP['detached-component'],
        description: `Instância sem componente principal — possivelmente corrompida ou desanexada.`,
        currentValue: node.name,
        expectedValue: 'Componente da biblioteca',
        status: 'pending',
      });
    } else if (!node.mainComponent.remote) {
      const hasMatch = index.componentNames.has(node.name) ||
        (node.mainComponent.parent?.type === 'COMPONENT_SET' &&
          index.componentNames.has(node.mainComponent.parent.name));

      if (!hasMatch) {
        issues.push({
          id: createIssueId(),
          nodeId: node.id,
          nodeName: node.name,
          nodePath,
          issueType: 'missing-component',
          category: ISSUE_CATEGORY_MAP['missing-component'],
          severity: ISSUE_SEVERITY_MAP['missing-component'],
          description: `Componente local — não está vinculado à biblioteca do Design System.`,
          currentValue: 'Componente local',
          expectedValue: 'Componente da biblioteca (remoto)',
          status: 'pending',
        });
      }
    }
  }

  if (
    node.type === 'FRAME' &&
    index.componentNames.has(node.name)
  ) {
    issues.push({
      id: createIssueId(),
      nodeId: node.id,
      nodeName: node.name,
      nodePath,
      issueType: 'detached-component',
      category: ISSUE_CATEGORY_MAP['detached-component'],
      severity: ISSUE_SEVERITY_MAP['detached-component'],
      description: `Frame "${node.name}" tem o mesmo nome de um componente da biblioteca — provavelmente foi desanexado (detached).`,
      currentValue: 'Frame (detached)',
      expectedValue: `Instância do componente "${node.name}"`,
      fixData: { type: 'manual', nodeId: node.id },
      status: 'pending',
    });
  }

  return issues;
}

export function detectColorIssues(
  node: SceneNode,
  index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const nodePath = getNodePath(node);

  // Vetores e ilustrações usam cores arbitrárias por design — ignorar
  if (isIllustrationOrVector(node)) return issues;

  if (!('fills' in node)) return issues;

  const fills = node.fills;
  if (fills && typeof fills !== 'symbol' && Array.isArray(fills)) {
    const hasFillStyle = 'fillStyleId' in node &&
      typeof node.fillStyleId === 'string' &&
      node.fillStyleId !== '';

    if (!hasFillStyle) {
      for (const paint of fills) {
        if (paint.type === 'SOLID' && paint.visible !== false) {
          const color: RGB = { r: paint.color.r, g: paint.color.g, b: paint.color.b };
          const hex = rgbToHex(color.r, color.g, color.b);

          if (index.colorTokens.length === 0) continue;

          const nearest = findNearestColor(color, index.colorTokens);
          if (nearest && nearest.distance > COLOR_DISTANCE_THRESHOLD) {
            const hasStyleKey = nearest.token.styleId && nearest.token.styleId.length > 0;
            issues.push({
              id: createIssueId(),
              nodeId: node.id,
              nodeName: node.name,
              nodePath,
              issueType: 'off-token-fill',
              category: ISSUE_CATEGORY_MAP['off-token-fill'],
              severity: ISSUE_SEVERITY_MAP['off-token-fill'],
              description: `Cor de preenchimento ${hex} não corresponde a nenhum token do Design System.`,
              currentValue: hex,
              expectedValue: `${nearest.token.hex} (${nearest.token.name})`,
              suggestion: hasStyleKey ? `Aplicar token "${nearest.token.name}"` : `Substituir por ${nearest.token.name} (${nearest.token.hex})`,
              fixData: hasStyleKey
                ? {
                    type: 'apply-fill-style',
                    nodeId: node.id,
                    styleKey: nearest.token.styleId!,
                    color: { r: nearest.token.r, g: nearest.token.g, b: nearest.token.b },
                  }
                : { type: 'manual', nodeId: node.id },
              status: 'pending',
            });
          }
        }
      }
    }
  }

  const strokes = ('strokes' in node) ? node.strokes : undefined;
  if (strokes && typeof strokes !== 'symbol' && Array.isArray(strokes)) {
    const hasStrokeStyle = 'strokeStyleId' in node &&
      typeof (node as any).strokeStyleId === 'string' &&
      (node as any).strokeStyleId !== '';

    if (!hasStrokeStyle) {
      for (const paint of strokes) {
        if (paint.type === 'SOLID' && paint.visible !== false) {
          const color: RGB = { r: paint.color.r, g: paint.color.g, b: paint.color.b };
          const hex = rgbToHex(color.r, color.g, color.b);

          if (index.colorTokens.length === 0) continue;

          const nearest = findNearestColor(color, index.colorTokens);
          if (nearest && nearest.distance > COLOR_DISTANCE_THRESHOLD) {
            const hasStyleKey = nearest.token.styleId && nearest.token.styleId.length > 0;
            issues.push({
              id: createIssueId(),
              nodeId: node.id,
              nodeName: node.name,
              nodePath,
              issueType: 'off-token-stroke',
              category: ISSUE_CATEGORY_MAP['off-token-stroke'],
              severity: ISSUE_SEVERITY_MAP['off-token-stroke'],
              description: `Cor de contorno ${hex} não corresponde a nenhum token do Design System.`,
              currentValue: hex,
              expectedValue: `${nearest.token.hex} (${nearest.token.name})`,
              suggestion: hasStyleKey ? `Aplicar token "${nearest.token.name}"` : `Substituir por ${nearest.token.name} (${nearest.token.hex})`,
              fixData: hasStyleKey
                ? {
                    type: 'apply-stroke-style',
                    nodeId: node.id,
                    styleKey: nearest.token.styleId!,
                    color: { r: nearest.token.r, g: nearest.token.g, b: nearest.token.b },
                  }
                : { type: 'manual', nodeId: node.id },
              status: 'pending',
            });
          }
        }
      }
    }
  }

  return issues;
}

export function detectTypographyIssues(
  node: SceneNode,
  index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (node.type !== 'TEXT') return issues;

  // Skip icon text nodes — icon fonts should not be audited for typography tokens
  if (isIconTextNode(node)) return issues;

  const nodePath = getNodePath(node);
  const textStyleId = node.textStyleId;

  if (typeof textStyleId === 'symbol') {
    issues.push({
      id: createIssueId(),
      nodeId: node.id,
      nodeName: node.name,
      nodePath,
      issueType: 'missing-text-style',
      category: ISSUE_CATEGORY_MAP['missing-text-style'],
      severity: ISSUE_SEVERITY_MAP['missing-text-style'],
      description: `Texto com estilos mistos — múltiplos text styles aplicados no mesmo elemento.`,
      currentValue: 'Estilos mistos',
      expectedValue: 'Text style único da biblioteca',
      fixData: { type: 'manual', nodeId: node.id },
      status: 'pending',
    });
    return issues;
  }

  if (!textStyleId || textStyleId === '') {
    const fontName = node.fontName;
    const fontSize = node.fontSize;

    if (typeof fontName === 'symbol' || typeof fontSize === 'symbol') {
      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'missing-text-style',
        category: ISSUE_CATEGORY_MAP['missing-text-style'],
        severity: ISSUE_SEVERITY_MAP['missing-text-style'],
        description: `Texto sem text style da biblioteca aplicado.`,
        currentValue: 'Sem text style',
        expectedValue: 'Text style da biblioteca',
        fixData: { type: 'manual', nodeId: node.id },
        status: 'pending',
      });
      return issues;
    }

    const currentFont = `${fontName.family} ${fontName.style} ${fontSize}px`;

    const exactMatch = index.textStyles.find(
      (ts) => ts.fontFamily === fontName.family && ts.fontSize === fontSize
    );

    const sizeMatch = !exactMatch
      ? index.textStyles.find((ts) => ts.fontSize === fontSize)
      : undefined;

    const bestMatch = exactMatch || sizeMatch;
    const suggestion = bestMatch
      ? (exactMatch
          ? `Aplicar text style "${bestMatch.name}"`
          : `Text style similar: "${bestMatch.name}" (${bestMatch.fontFamily} ${bestMatch.fontWeight} ${bestMatch.fontSize}px)`)
      : '';

    const hasAutoFix = bestMatch && bestMatch.styleId && bestMatch.styleId.length > 0;

    issues.push({
      id: createIssueId(),
      nodeId: node.id,
      nodeName: node.name,
      nodePath,
      issueType: 'missing-text-style',
      category: ISSUE_CATEGORY_MAP['missing-text-style'],
      severity: ISSUE_SEVERITY_MAP['missing-text-style'],
      description: `Texto sem text style da biblioteca aplicado.`,
      currentValue: currentFont,
      expectedValue: suggestion || 'Text style da biblioteca',
      suggestion: suggestion || undefined,
      fixData: hasAutoFix
        ? { type: 'apply-text-style', nodeId: node.id, styleKey: bestMatch!.styleId }
        : { type: 'manual', nodeId: node.id },
      status: 'pending',
    });
  }

  return issues;
}

/**
 * Maps a spacing value to its DS token name (e.g. 8 → "scale-8", 16 → "scale-16").
 * Uses the iFDS naming convention: scale-{value}.
 */
function spacingTokenName(value: number): string {
  return `scale-${value}`;
}

export function detectSpacingIssues(
  node: SceneNode,
  index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!('layoutMode' in node) || node.type === 'INSTANCE') return issues;

  const frame = node as FrameNode;
  if (frame.layoutMode === 'NONE') return issues;

  const nodePath = getNodePath(node);
  const scale = index.spacingScale;

  const spacingChecks: Array<{ label: string; property: string; value: number }> = [
    { label: 'Item spacing', property: 'itemSpacing', value: frame.itemSpacing },
    { label: 'Padding top', property: 'paddingTop', value: frame.paddingTop },
    { label: 'Padding right', property: 'paddingRight', value: frame.paddingRight },
    { label: 'Padding bottom', property: 'paddingBottom', value: frame.paddingBottom },
    { label: 'Padding left', property: 'paddingLeft', value: frame.paddingLeft },
  ];

  for (const check of spacingChecks) {
    if (check.value === 0) continue;

    const { nearest, delta } = findNearestSpacing(check.value, scale);
    if (delta > 0 && !scale.includes(check.value)) {
      const tokenName = spacingTokenName(nearest);
      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'off-spacing',
        category: ISSUE_CATEGORY_MAP['off-spacing'],
        severity: ISSUE_SEVERITY_MAP['off-spacing'],
        description: `${check.label} de ${check.value}px não está na escala do DS. Token mais próximo: ${tokenName} (${nearest}px).`,
        currentValue: `${check.value}px`,
        expectedValue: `${tokenName} (${nearest}px)`,
        suggestion: `Usar token ${tokenName} → ${nearest}px`,
        fixData: {
          type: 'apply-spacing',
          nodeId: node.id,
          property: check.property,
          value: nearest,
        },
        status: 'pending',
      });
    }
  }

  return issues;
}

// ─── Accessibility & Design Critique Detectors ─────────────────

/**
 * Detects WCAG contrast ratio issues for text and UI components.
 * - contrast-text: text contrast < 4.5:1 (normal) or < 3:1 (large ≥18px or ≥14px bold)
 * - contrast-ui: UI component fill contrast < 3:1 against background
 */
export function detectContrastIssues(
  node: SceneNode,
  _index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (node.type === 'TEXT') {
    // Skip icon text nodes — contrast check not meaningful for icon glyphs
    if (isIconTextNode(node)) return issues;

    const fills = node.fills;
    if (!fills || typeof fills === 'symbol' || !Array.isArray(fills)) return issues;

    const solidFill = fills.find((f: Paint) => f.type === 'SOLID' && f.visible !== false);
    if (!solidFill || solidFill.type !== 'SOLID') return issues;

    const fgColor: RGB = { r: solidFill.color.r, g: solidFill.color.g, b: solidFill.color.b };
    const bgColor = getBackgroundColor(node);
    const ratio = calculateContrastRatio(fgColor, bgColor);

    const fontSize = node.fontSize;
    const fontWeight = typeof node.fontName !== 'symbol' ? node.fontName.style : '';
    if (typeof fontSize === 'symbol') return issues;

    const isBold = fontWeight.toLowerCase().includes('bold') || fontWeight.includes('700') || fontWeight.includes('800') || fontWeight.includes('900');
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
    const threshold = isLargeText ? A11Y_CONTRAST_LARGE : A11Y_CONTRAST_TEXT;

    if (ratio < threshold) {
      const nodePath = getNodePath(node);
      const fgHex = rgbToHex(fgColor.r, fgColor.g, fgColor.b);
      const bgHex = rgbToHex(bgColor.r, bgColor.g, bgColor.b);

      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'contrast-text',
        category: ISSUE_CATEGORY_MAP['contrast-text'],
        severity: ISSUE_SEVERITY_MAP['contrast-text'],
        description: `Contraste de texto insuficiente (WCAG AA). ${isLargeText ? 'Large text' : 'Normal text'} requer ≥${threshold}:1.`,
        currentValue: `${ratio.toFixed(1)}:1 (${fgHex} sobre ${bgHex})`,
        expectedValue: `≥${threshold}:1`,
        suggestion: `Ajustar cor do texto ou background para atingir contraste de ${threshold}:1`,
        fixData: { type: 'manual', nodeId: node.id },
        status: 'pending',
      });
    }
  }

  // Check UI component contrast (non-text fills against background)
  if (node.type === 'INSTANCE' && isInteractiveComponent(node.name)) {
    if ('fills' in node) {
      const fills = node.fills;
      if (fills && typeof fills !== 'symbol' && Array.isArray(fills)) {
        const solidFill = fills.find((f: Paint) => f.type === 'SOLID' && f.visible !== false);
        if (solidFill && solidFill.type === 'SOLID') {
          const fgColor: RGB = { r: solidFill.color.r, g: solidFill.color.g, b: solidFill.color.b };
          const bgColor = getBackgroundColor(node);
          const ratio = calculateContrastRatio(fgColor, bgColor);

          if (ratio < A11Y_CONTRAST_UI) {
            const nodePath = getNodePath(node);
            const fgHex = rgbToHex(fgColor.r, fgColor.g, fgColor.b);
            const bgHex = rgbToHex(bgColor.r, bgColor.g, bgColor.b);

            issues.push({
              id: createIssueId(),
              nodeId: node.id,
              nodeName: node.name,
              nodePath,
              issueType: 'contrast-ui',
              category: ISSUE_CATEGORY_MAP['contrast-ui'],
              severity: ISSUE_SEVERITY_MAP['contrast-ui'],
              description: `Componente UI com contraste insuficiente (WCAG AA). Requer ≥${A11Y_CONTRAST_UI}:1.`,
              currentValue: `${ratio.toFixed(1)}:1 (${fgHex} sobre ${bgHex})`,
              expectedValue: `≥${A11Y_CONTRAST_UI}:1`,
              fixData: { type: 'manual', nodeId: node.id },
              status: 'pending',
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Detects accessibility issues in interactive components.
 * - touch-target-small: interactive element < 44×44px
 * - missing-variant-state: interactive component without hover/disabled variants
 */
export function detectA11yComponentIssues(
  node: SceneNode,
  _index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (node.type !== 'INSTANCE') return issues;
  if (!isInteractiveComponent(node.name)) return issues;

  const nodePath = getNodePath(node);

  // Touch target check
  if (node.width < A11Y_TOUCH_MIN || node.height < A11Y_TOUCH_MIN) {
    const tooSmallDim = node.width < A11Y_TOUCH_MIN && node.height < A11Y_TOUCH_MIN
      ? `${Math.round(node.width)}×${Math.round(node.height)}px`
      : node.width < A11Y_TOUCH_MIN
        ? `largura ${Math.round(node.width)}px`
        : `altura ${Math.round(node.height)}px`;

    issues.push({
      id: createIssueId(),
      nodeId: node.id,
      nodeName: node.name,
      nodePath,
      issueType: 'touch-target-small',
      category: ISSUE_CATEGORY_MAP['touch-target-small'],
      severity: ISSUE_SEVERITY_MAP['touch-target-small'],
      description: `Área de toque muito pequena (${tooSmallDim}). Mínimo recomendado: ${A11Y_TOUCH_MIN}×${A11Y_TOUCH_MIN}px (WCAG 2.5.5).`,
      currentValue: `${Math.round(node.width)}×${Math.round(node.height)}px`,
      expectedValue: `≥${A11Y_TOUCH_MIN}×${A11Y_TOUCH_MIN}px`,
      fixData: { type: 'manual', nodeId: node.id },
      status: 'pending',
    });
  }

  // Missing variant states check
  if (node.mainComponent && node.mainComponent.parent?.type === 'COMPONENT_SET') {
    const componentSet = node.mainComponent.parent;
    const variantNames = componentSet.children.map((c: SceneNode) => c.name.toLowerCase());
    const allVariants = variantNames.join(' ');

    const hasHover = allVariants.includes('hover');
    const hasDisabled = allVariants.includes('disabled');

    if (!hasHover && !hasDisabled) {
      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'missing-variant-state',
        category: ISSUE_CATEGORY_MAP['missing-variant-state'],
        severity: ISSUE_SEVERITY_MAP['missing-variant-state'],
        description: `Componente interativo sem variantes de estado (hover/disabled). Isso impacta feedback visual e acessibilidade.`,
        currentValue: `${componentSet.children.length} variante(s)`,
        expectedValue: 'Variantes com Hover e Disabled',
        fixData: { type: 'manual', nodeId: node.id },
        status: 'pending',
      });
    }
  }

  return issues;
}

/**
 * Detects accessibility typography issues.
 * - font-size-too-small: body text < 12px (or < 11px for compact UI)
 * - line-height-invalid: line-height ratio < 1.2× font-size
 */
export function detectA11yTypographyIssues(
  node: SceneNode,
  index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (node.type !== 'TEXT') return issues;

  // Skip icon text nodes — icon fonts should not be audited for a11y typography
  if (isIconTextNode(node)) return issues;

  const fontSize = node.fontSize;
  if (typeof fontSize === 'symbol') return issues;

  const nodePath = getNodePath(node);

  // Font size check
  const nodeLower = node.name.toLowerCase();
  const isCompact = nodeLower.includes('caption') || nodeLower.includes('helper') || nodeLower.includes('label') || nodeLower.includes('overline');
  const minSize = isCompact ? A11Y_FONT_MIN_COMPACT : A11Y_FONT_MIN;

  if (fontSize < minSize) {
    // Try to find a DS text style with a valid font size as suggestion
    const fontName = node.fontName;
    const family = typeof fontName !== 'symbol' ? fontName.family : null;

    // Find the smallest DS text style that meets the minimum size
    const candidates = index.textStyles
      .filter(ts => ts.fontSize >= minSize && (!family || ts.fontFamily === family))
      .sort((a, b) => a.fontSize - b.fontSize);
    const bestMatch = candidates[0] || index.textStyles.find(ts => ts.fontSize >= minSize);

    const hasAutoFix = bestMatch && bestMatch.styleId && bestMatch.styleId.length > 0;

    issues.push({
      id: createIssueId(),
      nodeId: node.id,
      nodeName: node.name,
      nodePath,
      issueType: 'font-size-too-small',
      category: ISSUE_CATEGORY_MAP['font-size-too-small'],
      severity: ISSUE_SEVERITY_MAP['font-size-too-small'],
      description: `Tamanho de fonte muito pequeno para legibilidade. Mínimo recomendado: ${minSize}px${isCompact ? ' (compact UI)' : ''}.`,
      currentValue: `${fontSize}px`,
      expectedValue: bestMatch
        ? `${bestMatch.name} (${bestMatch.fontSize}px)`
        : `≥${minSize}px`,
      suggestion: bestMatch
        ? `Aplicar text style "${bestMatch.name}" (${bestMatch.fontSize}px)`
        : undefined,
      fixData: hasAutoFix
        ? { type: 'apply-text-style', nodeId: node.id, styleKey: bestMatch!.styleId }
        : { type: 'manual', nodeId: node.id },
      status: 'pending',
    });
  }

  // Line height ratio check — try to fix via DS text style token
  const lineHeight = node.lineHeight;
  if (lineHeight && typeof lineHeight !== 'symbol' && typeof lineHeight === 'object') {
    const lh = lineHeight as { unit: string; value: number };
    let ratio = 0;

    if (lh.unit === 'PIXELS' && lh.value > 0) {
      ratio = lh.value / fontSize;
    } else if (lh.unit === 'PERCENT' && lh.value > 0) {
      ratio = lh.value / 100;
    }

    if (ratio > 0 && ratio < A11Y_LINE_HEIGHT_MIN) {
      // Find a DS text style that matches this font size and has a valid line-height
      const fontName = node.fontName;
      const family = typeof fontName !== 'symbol' ? fontName.family : null;

      const matchingStyles = index.textStyles.filter(ts =>
        ts.fontSize === fontSize &&
        (!family || ts.fontFamily === family) &&
        ts.lineHeight !== null &&
        ts.lineHeight / ts.fontSize >= A11Y_LINE_HEIGHT_MIN
      );

      const bestMatch = matchingStyles[0] ||
        index.textStyles.find(ts =>
          ts.fontSize === fontSize &&
          ts.lineHeight !== null &&
          ts.lineHeight / ts.fontSize >= A11Y_LINE_HEIGHT_MIN
        );

      const hasAutoFix = bestMatch && bestMatch.styleId && bestMatch.styleId.length > 0;

      const currentDisplay = lh.unit === 'PIXELS'
        ? `${lh.value}px (${ratio.toFixed(2)}×)`
        : `${lh.value}% (${ratio.toFixed(2)}×)`;

      issues.push({
        id: createIssueId(),
        nodeId: node.id,
        nodeName: node.name,
        nodePath,
        issueType: 'line-height-invalid',
        category: ISSUE_CATEGORY_MAP['line-height-invalid'],
        severity: ISSUE_SEVERITY_MAP['line-height-invalid'],
        description: `Line-height ratio muito baixo (${ratio.toFixed(2)}×). Mínimo recomendado: ${A11Y_LINE_HEIGHT_MIN}× para legibilidade.`,
        currentValue: currentDisplay,
        expectedValue: bestMatch && bestMatch.lineHeight !== null
          ? `${bestMatch.name} (LH ${bestMatch.lineHeight}px)`
          : `≥${Math.round(fontSize * A11Y_LINE_HEIGHT_MIN)}px (${A11Y_LINE_HEIGHT_MIN}×)`,
        suggestion: bestMatch
          ? `Aplicar text style "${bestMatch.name}" (${bestMatch.fontFamily} ${bestMatch.fontSize}px, LH ${bestMatch.lineHeight}px)`
          : undefined,
        fixData: hasAutoFix
          ? { type: 'apply-text-style', nodeId: node.id, styleKey: bestMatch!.styleId }
          : { type: 'manual', nodeId: node.id },
        status: 'pending',
      });
    }
  }

  return issues;
}

/**
 * Detects spacing and alignment issues for design critique.
 * - grid-misaligned: node x/y not aligned to 4px grid
 * - rhythm-inconsistent: itemSpacing differs from siblings
 * - padding-insufficient: interactive element with padding < 8px
 */
export function detectA11ySpacingIssues(
  node: SceneNode,
  _index: LibraryIndex
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Grid alignment check (for any positioned node, except TEXT and INSTANCE)
  if ('x' in node && 'y' in node && node.type !== 'TEXT' && node.type !== 'INSTANCE') {
    const rotation = ('rotation' in node) ? (node as any).rotation : 0;
    if (rotation === 0) {
      const xMod = Math.abs(node.x % A11Y_GRID_UNIT);
      const yMod = Math.abs(node.y % A11Y_GRID_UNIT);
      const xOff = Math.min(xMod, A11Y_GRID_UNIT - xMod);
      const yOff = Math.min(yMod, A11Y_GRID_UNIT - yMod);

      if (xOff > 0.5 || yOff > 0.5) {
        const nodePath = getNodePath(node);
        const snappedX = Math.round(node.x / A11Y_GRID_UNIT) * A11Y_GRID_UNIT;
        const snappedY = Math.round(node.y / A11Y_GRID_UNIT) * A11Y_GRID_UNIT;

        issues.push({
          id: createIssueId(),
          nodeId: node.id,
          nodeName: node.name,
          nodePath,
          issueType: 'grid-misaligned',
          category: ISSUE_CATEGORY_MAP['grid-misaligned'],
          severity: ISSUE_SEVERITY_MAP['grid-misaligned'],
          description: `Elemento não alinhado ao grid de ${A11Y_GRID_UNIT}px. Posição fracionária prejudica consistência visual.`,
          currentValue: `x:${node.x.toFixed(1)}, y:${node.y.toFixed(1)}`,
          expectedValue: `x:${snappedX}, y:${snappedY}`,
          suggestion: `Alinhar ao grid de ${A11Y_GRID_UNIT}px`,
          fixData: {
            type: 'fix-alignment',
            nodeId: node.id,
            x: snappedX,
            y: snappedY,
          },
          status: 'pending',
        });
      }
    }
  }

  // Spacing checks for FRAME nodes with auto-layout
  if (!('layoutMode' in node) || node.type === 'INSTANCE') return issues;

  const frame = node as FrameNode;
  if (frame.layoutMode === 'NONE') return issues;

  const nodePath = getNodePath(node);

  // Rhythm inconsistency: compare itemSpacing with siblings
  if (frame.parent && 'children' in frame.parent) {
    const siblings = (frame.parent.children as SceneNode[]).filter(
      (c) => c.type === 'FRAME' && 'layoutMode' in c && (c as FrameNode).layoutMode !== 'NONE' && c.id !== node.id
    ) as FrameNode[];

    if (siblings.length >= 2) {
      const siblingSpacings = siblings.map(s => s.itemSpacing);
      const allSpacings = [...siblingSpacings, frame.itemSpacing];
      const sorted = [...allSpacings].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      if (frame.itemSpacing !== median && Math.abs(frame.itemSpacing - median) > 2) {
        issues.push({
          id: createIssueId(),
          nodeId: node.id,
          nodeName: node.name,
          nodePath,
          issueType: 'rhythm-inconsistent',
          category: ISSUE_CATEGORY_MAP['rhythm-inconsistent'],
          severity: ISSUE_SEVERITY_MAP['rhythm-inconsistent'],
          description: `Item spacing inconsistente com elementos do mesmo nível. Mediana dos siblings: ${median}px.`,
          currentValue: `${frame.itemSpacing}px`,
          expectedValue: `${median}px`,
          suggestion: `Ajustar para ${median}px (mediana dos siblings)`,
          fixData: {
            type: 'apply-spacing',
            nodeId: node.id,
            property: 'itemSpacing',
            value: median,
          },
          status: 'pending',
        });
      }
    }
  }

  // Insufficient padding on interactive components
  if (isInteractiveComponent(frame.name)) {
    const paddings = [
      { label: 'Padding top', prop: 'paddingTop', val: frame.paddingTop },
      { label: 'Padding right', prop: 'paddingRight', val: frame.paddingRight },
      { label: 'Padding bottom', prop: 'paddingBottom', val: frame.paddingBottom },
      { label: 'Padding left', prop: 'paddingLeft', val: frame.paddingLeft },
    ];

    for (const p of paddings) {
      if (p.val > 0 && p.val < A11Y_PADDING_MIN) {
        issues.push({
          id: createIssueId(),
          nodeId: node.id,
          nodeName: node.name,
          nodePath,
          issueType: 'padding-insufficient',
          category: ISSUE_CATEGORY_MAP['padding-insufficient'],
          severity: ISSUE_SEVERITY_MAP['padding-insufficient'],
          description: `${p.label} de ${p.val}px é insuficiente para elemento interativo. Mínimo recomendado: ${A11Y_PADDING_MIN}px.`,
          currentValue: `${p.val}px`,
          expectedValue: `≥${A11Y_PADDING_MIN}px`,
          fixData: { type: 'manual', nodeId: node.id },
          status: 'pending',
        });
      }
    }
  }

  return issues;
}
