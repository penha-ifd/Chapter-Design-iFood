// ============================================================
// Usage Tracker — envia dados de cada scan para Google Sheets
// Delega o fetch para a UI (iframe) via postMessage,
// pois o sandbox do plugin tem restrições de rede.
// ============================================================

export function trackScanUsage(
  result: {
    totalScore: number;
    issues: Array<{ severity: string; status: string; category: string }>;
    totalNodesScanned: number;
    scanDurationMs: number;
    scope: string;
  },
  user: { name: string; id: string },
): void {
  try {
    let fileName = '';
    try { fileName = figma.root?.name || ''; } catch (_) {}

    const pending = (result.issues || []).filter(i => i.status === 'pending');
    const catCounts = { component: 0, color: 0, typography: 0, spacing: 0 };
    pending.forEach(i => {
      if (i.category in catCounts) {
        catCounts[i.category as keyof typeof catCounts]++;
      }
    });

    const payload = {
      userName: user.name || 'Desconhecido',
      userId: user.id || '',
      fileName,
      scope: result.scope || '',
      score: result.totalScore || 0,
      totalIssues: pending.length,
      component: catCounts.component,
      color: catCounts.color,
      typography: catCounts.typography,
      spacing: catCounts.spacing,
      nodesScanned: result.totalNodesScanned || 0,
      durationSec: +((result.scanDurationMs || 0) / 1000).toFixed(1),
    };

    figma.ui.postMessage({ type: 'track-usage', payload });
  } catch (err) {
    console.error('[Tomate tracker] erro:', err instanceof Error ? err.message : String(err));
  }
}
