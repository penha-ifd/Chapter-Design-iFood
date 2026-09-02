// ============================================================
// Google Apps Script — Tomate IFDS Usage Tracker
// ============================================================
// COMO USAR:
// 1. Crie uma Google Sheet nova
// 2. Vá em Extensões > Apps Script
// 3. Cole este código inteiro no editor
// 4. Clique em "Implantar" > "Nova implantação"
// 5. Tipo: "App da Web"
//    - Executar como: "Eu" (sua conta)
//    - Quem tem acesso: "Qualquer pessoa"
// 6. Copie a URL gerada e cole no App.tsx (TRACKING_URL)
//
// IMPORTANTE: Toda vez que alterar este código, crie uma
// NOVA implantação (não edite a existente).
// ============================================================

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  return handleRequest(params);
}

function doPost(e) {
  var data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }
  } catch (_) {
    data = (e && e.parameter) ? e.parameter : {};
  }
  return handleRequest(data);
}

function handleRequest(data) {
  try {
    if (!data || Object.keys(data).length === 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'ok', message: 'no data' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Cria cabeçalho se a planilha estiver vazia
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Usuário',
        'User ID',
        'File Name',
        'Scope',
        'Score',
        'Total Issues',
        'Componentes',
        'Cores',
        'Tipografia',
        'Espaçamento',
        'Nodes Scanned',
        'Duration (s)',
      ]);
      sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date().toISOString(),
      data.userName || 'Desconhecido',
      data.userId || '',
      data.fileName || '',
      data.scope || '',
      Number(data.score) || 0,
      Number(data.totalIssues) || 0,
      Number(data.component) || 0,
      Number(data.color) || 0,
      Number(data.typography) || 0,
      Number(data.spacing) || 0,
      Number(data.nodesScanned) || 0,
      Number(data.durationSec) || 0,
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
