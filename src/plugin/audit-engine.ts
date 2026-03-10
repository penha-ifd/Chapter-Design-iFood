import type { AuditIssue, AuditResult, CategoryScore, IssueCategory, LibraryIndex } from '../shared/types';
import { SCORE_WEIGHTS, SEVERITY_ORDER, A11Y_ISSUE_TYPES } from '../shared/constants';
import {
  detectComponentIssues,
  detectColorIssues,
  detectTypographyIssues,
  detectSpacingIssues,
  detectContrastIssues,
  detectA11yComponentIssues,
  detectA11yTypographyIssues,
  detectA11ySpacingIssues,
  resetIssueCounter,
} from './issue-detector';

export class AuditEngine {
  private index: LibraryIndex;
  private issues: AuditIssue[] = [];
  private nodesScanned = 0;
  private totalNodes = 0;
  private onProgress: (progress: number, message: string) => void;

  constructor(
    index: LibraryIndex,
    onProgress: (progress: number, message: string) => void
  ) {
    this.index = index;
    this.onProgress = onProgress;
  }

  async scan(nodes: readonly SceneNode[], scopeLabel: string): Promise<AuditResult> {
    const startTime = Date.now();
    this.issues = [];
    this.nodesScanned = 0;
    resetIssueCounter();

    this.totalNodes = this.countNodes(nodes);
    this.onProgress(0, 'Iniciando análise...');

    for (const node of nodes) {
      await this.traverseNode(node);
    }

    this.issues.sort((a, b) => {
      const sa = SEVERITY_ORDER.indexOf(a.severity);
      const sb = SEVERITY_ORDER.indexOf(b.severity);
      return sa - sb;
    });

    const result: AuditResult = {
      totalScore: 0,
      categoryScores: this.calculateCategoryScores(),
      issues: this.issues,
      totalNodesScanned: this.nodesScanned,
      scanDurationMs: Date.now() - startTime,
      timestamp: Date.now(),
      scope: scopeLabel,
    };

    result.totalScore = this.calculateTotalScore(result.categoryScores);

    this.onProgress(100, 'Análise completa!');
    return result;
  }

  private countNodes(nodes: readonly SceneNode[]): number {
    let count = 0;
    const walk = (node: SceneNode) => {
      count++;
      if ('children' in node) {
        for (const child of node.children) walk(child);
      }
    };
    for (const n of nodes) walk(n);
    return Math.max(count, 1);
  }

  private async traverseNode(node: SceneNode): Promise<void> {
    this.nodesScanned++;

    if (this.nodesScanned % 50 === 0 || this.nodesScanned === this.totalNodes) {
      const progress = Math.round((this.nodesScanned / this.totalNodes) * 100);
      this.onProgress(progress, `Analisando: ${node.name} (${this.nodesScanned}/${this.totalNodes})`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (!node.visible) return;

    const isInstance = node.type === 'INSTANCE';

    try {
      // ── DS Conformity Detectors ──
      if (!isInstance) {
        const componentIssues = detectComponentIssues(node, this.index);
        for (const issue of componentIssues) this.issues.push(issue);
      }

      const colorIssues = detectColorIssues(node, this.index);
      for (const issue of colorIssues) this.issues.push(issue);

      const typographyIssues = detectTypographyIssues(node, this.index);
      for (const issue of typographyIssues) this.issues.push(issue);

      if (!isInstance) {
        const spacingIssues = detectSpacingIssues(node, this.index);
        for (const issue of spacingIssues) this.issues.push(issue);
      }

      // ── Accessibility & Design Critique Detectors ──
      const contrastIssues = detectContrastIssues(node, this.index);
      for (const issue of contrastIssues) this.issues.push(issue);

      const a11yCompIssues = detectA11yComponentIssues(node, this.index);
      for (const issue of a11yCompIssues) this.issues.push(issue);

      const a11yTypoIssues = detectA11yTypographyIssues(node, this.index);
      for (const issue of a11yTypoIssues) this.issues.push(issue);

      if (!isInstance) {
        const a11ySpaceIssues = detectA11ySpacingIssues(node, this.index);
        for (const issue of a11ySpaceIssues) this.issues.push(issue);
      }
    } catch (_) {
      // Skip nodes that throw errors during analysis
    }

    if ('children' in node) {
      for (const child of node.children) {
        await this.traverseNode(child);
      }
    }
  }

  private calculateCategoryScores(): CategoryScore[] {
    const categories: IssueCategory[] = ['component', 'color', 'typography', 'spacing'];
    const scores: CategoryScore[] = [];

    for (const category of categories) {
      const categoryIssues = this.issues.filter(
        (i) => i.category === category && i.status !== 'skipped' && !(A11Y_ISSUE_TYPES as readonly string[]).includes(i.issueType)
      );

      const totalAnalyzed = this.getAnalyzedCountForCategory(category);
      const issueCount = categoryIssues.length;
      const conformantCount = Math.max(0, totalAnalyzed - issueCount);

      const score = totalAnalyzed > 0
        ? Math.round((conformantCount / totalAnalyzed) * 100)
        : 100;

      scores.push({
        category,
        score,
        conformantCount,
        totalCount: totalAnalyzed,
        issueCount,
        weight: SCORE_WEIGHTS[category],
      });
    }

    return scores;
  }

  private getAnalyzedCountForCategory(category: IssueCategory): number {
    const issueNodes = new Set(
      this.issues.filter((i) => i.category === category && !(A11Y_ISSUE_TYPES as readonly string[]).includes(i.issueType)).map((i) => i.nodeId)
    );

    switch (category) {
      case 'component':
        return Math.max(issueNodes.size, this.estimateComponentNodes());
      case 'color':
        return Math.max(issueNodes.size, this.estimateColorNodes());
      case 'typography':
        return Math.max(issueNodes.size, this.estimateTextNodes());
      case 'spacing':
        return Math.max(issueNodes.size, this.estimateLayoutNodes());
      default:
        return Math.max(issueNodes.size, 1);
    }
  }

  private estimateComponentNodes(): number {
    return Math.max(Math.round(this.nodesScanned * 0.3), 1);
  }

  private estimateColorNodes(): number {
    return Math.max(Math.round(this.nodesScanned * 0.6), 1);
  }

  private estimateTextNodes(): number {
    return Math.max(Math.round(this.nodesScanned * 0.2), 1);
  }

  private estimateLayoutNodes(): number {
    return Math.max(Math.round(this.nodesScanned * 0.15), 1);
  }

  private calculateTotalScore(categoryScores: CategoryScore[]): number {
    let totalScore = 0;
    for (const cs of categoryScores) {
      totalScore += cs.score * cs.weight;
    }
    return Math.round(totalScore);
  }

  static recalculateScore(result: AuditResult): AuditResult {
    const categories: IssueCategory[] = ['component', 'color', 'typography', 'spacing'];
    const newCategoryScores: CategoryScore[] = [];

    for (const category of categories) {
      const existing = result.categoryScores.find((cs) => cs.category === category);
      if (!existing) continue;

      const activeIssues = result.issues.filter(
        (i) => i.category === category && i.status === 'pending' && !(A11Y_ISSUE_TYPES as readonly string[]).includes(i.issueType)
      );
      const skippedIssues = result.issues.filter(
        (i) => i.category === category && i.status === 'skipped' && !(A11Y_ISSUE_TYPES as readonly string[]).includes(i.issueType)
      );

      const totalCount = existing.totalCount - skippedIssues.length;
      const conformantCount = Math.max(0, totalCount - activeIssues.length);
      const score = totalCount > 0 ? Math.round((conformantCount / totalCount) * 100) : 100;

      newCategoryScores.push({
        category: existing.category,
        weight: existing.weight,
        score,
        conformantCount,
        totalCount,
        issueCount: activeIssues.length,
      });
    }

    let totalScore = 0;
    for (const cs of newCategoryScores) {
      totalScore += cs.score * cs.weight;
    }

    return {
      totalScore: Math.round(totalScore),
      categoryScores: newCategoryScores,
      issues: result.issues,
      totalNodesScanned: result.totalNodesScanned,
      scanDurationMs: result.scanDurationMs,
      timestamp: result.timestamp,
      scope: result.scope,
    };
  }
}
