# Tomate — Design System Audit Plugin for Figma

> **Versão:** 1.0.0 (MVP)
> **Autor:** Tiago — Staff Design Engineer, iFood Ads
> **Licença:** Proprietário (UNLICENSED)
> **Plataforma:** Figma Desktop
> **Design System alvo:** iFDS (iFood Design System — Web)

---

## 1. Visão Geral

O **Tomate** é um plugin para Figma que audita a conformidade de layouts com o Design System iFDS. Ele analisa componentes, cores, tipografia e espaçamento, gerando uma pontuação de conformidade (0–100) e uma lista detalhada de issues com opções de correção automática.

### Problema que resolve

Equipes de design frequentemente criam layouts que se desviam do Design System — componentes detached, cores off-token, tipografias inconsistentes e espaçamentos fora da escala. Sem uma ferramenta automatizada, essas inconsistências passam despercebidas até o handoff ou code review.

### Proposta de valor

- **Auditoria automatizada** em 4 dimensões (componentes, cores, tipografia, espaçamento)
- **Score de conformidade** ponderado e granular
- **Correções automáticas** para issues de cores e espaçamento
- **Navegação direta** para nodes com problemas no canvas

---

## 2. Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **Library Parser** | Indexa componentes, color tokens e text styles da biblioteca iFDS, com cache local de 24h |
| **Audit Engine** | Motor de análise com traversal recursivo de nodes e cálculo de scores ponderados |
| **Issue Detector** | Detecção granular de 10 tipos de issues em 4 categorias |
| **Conformity Score** | Pontuação 0–100 com breakdown por categoria |
| **Auto-fix** | Correção automática para cores off-token (fill/stroke) e espaçamentos fora da escala |
| **Issue Review** | Revisão issue-by-issue com ações de Fix, Skip e Navigate |
| **API Figma** | Integração com a API REST do Figma para buscar componentes e styles do arquivo DS |

---

## 3. Arquitetura

### 3.1 Diagrama de camadas

```
┌─────────────────────────────────────────────────┐
│                   UI (React)                     │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ │
│  │  Home    │ │ Scanning │ │Results │ │Review│ │
│  └──────────┘ └──────────┘ └────────┘ └──────┘ │
│         ↕ postMessage / onMessage                │
├─────────────────────────────────────────────────┤
│              Plugin Sandbox (Figma)              │
│  ┌────────────┐  ┌──────────────┐               │
│  │ Controller │──│ Library      │               │
│  │            │  │ Parser       │               │
│  │            │  └──────────────┘               │
│  │            │  ┌──────────────┐               │
│  │            │──│ Audit Engine │               │
│  │            │  └──────┬───────┘               │
│  │            │         │                        │
│  │            │  ┌──────┴───────┐               │
│  │            │──│ Issue        │               │
│  │            │  │ Detector     │               │
│  └────────────┘  └──────────────┘               │
│                  ┌──────────────┐               │
│                  │ Color Utils  │               │
│                  └──────────────┘               │
├─────────────────────────────────────────────────┤
│              Shared (types + constants)          │
└─────────────────────────────────────────────────┘
```

### 3.2 Comunicação UI ↔ Plugin

O Figma usa uma arquitetura de iframe isolado. A UI (React) roda em um iframe e se comunica com o plugin sandbox via `postMessage`.

**Mensagens UI → Plugin (`PluginMessage`):**

| Tipo | Payload | Descrição |
|---|---|---|
| `load-library` | — | Solicita carregamento do índice da biblioteca |
| `save-token` | `token: string` | Salva token da API Figma |
| `set-library-index` | `index: SerializedLibraryIndex` | Envia índice externo (via API) |
| `start-scan` | `scope: 'selection' \| 'page'` | Inicia auditoria |
| `fix-issue` | `issueId: string` | Aplica correção automática |
| `skip-issue` | `issueId: string` | Pula issue |
| `navigate-to-node` | `nodeId: string` | Navega até o node no canvas |
| `resize` | `width, height` | Redimensiona janela do plugin |

**Mensagens Plugin → UI (`UIMessage`):**

| Tipo | Payload | Descrição |
|---|---|---|
| `library-status` | `loaded, componentCount, colorCount, textStyleCount` | Status do carregamento da biblioteca |
| `token-loaded` | `token: string \| null` | Token da API carregado do cache |
| `scan-progress` | `progress: number, message: string` | Progresso do scan (0–100) |
| `scan-complete` | `result: AuditResult` | Resultado completo da auditoria |
| `issue-fixed` | `issueId, success, newScore?` | Resultado da correção |
| `issue-skipped` | `issueId, newScore?` | Issue pulada |
| `score-updated` | `result: AuditResult` | Score recalculado |
| `error` | `message: string` | Erro |

---

## 4. Modelo de Dados

### 4.1 LibraryIndex

Índice completo da biblioteca do Design System:

| Campo | Tipo | Descrição |
|---|---|---|
| `components` | `LibraryComponentInfo[]` | Lista de componentes indexados |
| `componentNames` | `Set<string>` | Set de nomes para lookup rápido |
| `colorTokens` | `ColorToken[]` | Tokens de cor extraídos |
| `textStyles` | `TextStyleToken[]` | Estilos de texto extraídos |
| `spacingScale` | `number[]` | Escala de espaçamento |
| `lastBuilt` | `number` | Timestamp do último build |

### 4.2 AuditResult

Resultado completo de uma auditoria:

| Campo | Tipo | Descrição |
|---|---|---|
| `totalScore` | `number` | Score total (0–100) |
| `categoryScores` | `CategoryScore[]` | Scores por categoria |
| `issues` | `AuditIssue[]` | Lista de issues encontradas |
| `totalNodesScanned` | `number` | Total de nodes analisados |
| `scanDurationMs` | `number` | Duração do scan em ms |
| `timestamp` | `number` | Timestamp da auditoria |
| `scope` | `string` | Escopo analisado |

### 4.3 AuditIssue

Representa uma issue individual:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | Identificador único |
| `nodeId` | `string` | ID do node no Figma |
| `nodeName` | `string` | Nome do node |
| `nodePath` | `string[]` | Caminho hierárquico do node |
| `issueType` | `IssueType` | Tipo da issue |
| `category` | `IssueCategory` | Categoria da issue |
| `severity` | `IssueSeverity` | Severidade |
| `description` | `string` | Descrição humana |
| `currentValue` | `string` | Valor encontrado |
| `expectedValue` | `string` | Valor esperado |
| `suggestion` | `string?` | Sugestão de correção |
| `fixData` | `FixData?` | Dados para auto-fix |
| `status` | `'pending' \| 'fixed' \| 'skipped'` | Status da issue |

### 4.4 FixData (correções automáticas)

| Tipo | Campos | Ação |
|---|---|---|
| `apply-fill` | `nodeId, color: RGB` | Aplica cor de preenchimento |
| `apply-stroke` | `nodeId, color: RGB` | Aplica cor de contorno |
| `apply-spacing` | `nodeId, property, value` | Aplica valor de espaçamento |
| `reconnect-component` | `nodeId, componentKey` | Reconecta componente |
| `manual` | `nodeId` | Requer correção manual |

---

## 5. Sistema de Scoring

### 5.1 Pesos por categoria

| Categoria | Peso | Justificativa |
|---|---|---|
| **Componentes** | 40% | Maior impacto na consistência e manutenibilidade |
| **Cores** | 25% | Identidade visual e acessibilidade |
| **Tipografia** | 20% | Legibilidade e hierarquia |
| **Espaçamento** | 15% | Ritmo visual e alinhamento |

### 5.2 Cálculo do score

1. Para cada categoria, o score individual é: `(nodes conformes / total de nodes analisados) × 100`
2. O score total é a média ponderada: `Σ (score_categoria × peso_categoria)`
3. Issues corrigidas ou puladas são removidas do cálculo (recalculação em tempo real)

### 5.3 Faixas de classificação

| Faixa | Score | Cor | Significado |
|---|---|---|---|
| **Excelente** | 90–100 | Verde (#22C55E) | Altamente conforme ao DS |
| **Bom** | 70–89 | Lima (#84CC16) | Conforme com ajustes menores |
| **Atenção** | 50–69 | Amarelo (#EAB308) | Desvios significativos |
| **Crítico** | 0–49 | Vermelho (#EF4444) | Não conformidade severa |

---

## 6. Tipos de Issues

### 6.1 Componentes

| Tipo | Severidade | Descrição |
|---|---|---|
| `detached-component` | Crítica | Componente foi desvinculado da biblioteca (detach) |
| `missing-component` | Média | Componente não encontrado na biblioteca |
| `potential-new-component` | Baixa | Padrão repetido que poderia ser componentizado |

### 6.2 Cores

| Tipo | Severidade | Descrição |
|---|---|---|
| `off-token-fill` | Alta | Cor de preenchimento não corresponde a nenhum token (Delta-E > 5) |
| `off-token-stroke` | Alta | Cor de contorno não corresponde a nenhum token (Delta-E > 5) |

### 6.3 Tipografia

| Tipo | Severidade | Descrição |
|---|---|---|
| `missing-text-style` | Alta | Texto sem text style aplicado |
| `off-font-family` | Alta | Família tipográfica não é do DS |
| `off-font-size` | Média | Tamanho de fonte não está na escala do DS |
| `off-line-height` | Baixa | Line-height não corresponde ao text style |

### 6.4 Espaçamento

| Tipo | Severidade | Descrição |
|---|---|---|
| `off-spacing` | Média | Valor de espaçamento (gap, padding) fora da escala do DS |

---

## 7. Algoritmo de Cores (Delta-E)

O plugin utiliza o algoritmo **CIELAB Delta-E (CIE76)** para comparação de cores, que é perceptualmente uniforme — ou seja, a distância numérica corresponde à diferença visual percebida pelo olho humano.

### Fluxo

1. **RGB → XYZ → LAB**: Converte a cor do node para o espaço CIELAB
2. **Delta-E**: Calcula a distância euclidiana entre a cor do node e cada token de cor
3. **Threshold**: Se a menor distância for > 5 (Delta-E), a cor é considerada off-token
4. **Sugestão**: O token mais próximo (menor Delta-E) é sugerido como correção

### Threshold

- **Delta-E ≤ 5**: Cores são consideradas equivalentes (conformes)
- **Delta-E > 5**: Cor é off-token (issue gerada)

---

## 8. Escala de Espaçamento

A escala de espaçamento segue a progressão definida no iFDS:

```
0  |  2  |  4  |  8  |  12  |  16  |  20  |  24  |  32  |  40  |  48  |  56  |  64  |  80  |  96  |  120  |  160
```

Valores de `gap`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `itemSpacing` que não correspondem a nenhum valor da escala geram uma issue com sugestão do valor mais próximo.

---

## 9. Cache e Performance

### Cache da biblioteca

- Armazenamento: `figma.clientStorage` (persistente por máquina)
- Chave: `tomate-library-index`
- TTL: **24 horas**
- O cache é serializado (Set → Array) e desserializado automaticamente

### Índice externo (API Figma)

- Quando disponível, o plugin busca componentes e styles via API REST do Figma
- Endpoint: `https://api.figma.com/v1`
- Arquivo DS: `YuYore4hgyjGuWHDtSeLrhxP`
- Domínios permitidos: `api.figma.com`, `fonts.googleapis.com`, `fonts.gstatic.com`

---

## 10. Fluxo de Uso

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌────────────┐
│  1. Home │────▶│ 2. Scanning  │────▶│3. Results│────▶│ 4. Review  │
│          │     │              │     │          │     │            │
│ Conectar │     │ Progresso    │     │ Score    │     │ Fix / Skip │
│ Escopo   │     │ Análise      │     │ Breakdown│     │ Navigate   │
│ Iniciar  │     │              │     │          │     │            │
└──────────┘     └──────────────┘     └──────────┘     └────────────┘
                                                              │
                                                              ▼
                                                       Score atualizado
                                                       em tempo real
```

### Passo a passo

1. **Inicialização**: O plugin carrega e tenta recuperar o índice da biblioteca do cache
2. **Conexão**: A UI busca componentes e styles via API Figma (token hardcoded)
3. **Seleção de escopo**: O usuário escolhe entre auditar a **seleção atual** ou a **página inteira**
4. **Scan**: O audit engine percorre todos os nodes recursivamente, aplicando os detectores de issue
5. **Resultados**: A UI exibe o score total, breakdown por categoria e contadores de severidade
6. **Revisão**: O usuário percorre cada issue individualmente, podendo:
   - **Fix**: Aplicar correção automática (quando disponível)
   - **Skip**: Ignorar a issue
   - **Navigate**: Navegar até o node no canvas do Figma
7. **Recálculo**: Após cada fix/skip, o score é recalculado em tempo real

---

## 11. Stack Tecnológica

### Plugin (Figma Sandbox)

| Tecnologia | Versão | Uso |
|---|---|---|
| TypeScript | 5.3.2 | Linguagem |
| esbuild | 0.24.0 | Bundler (output: IIFE, ES2017) |
| @figma/plugin-typings | latest | Tipagens da API Figma |

### UI (iframe React)

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19.2.4 | Framework UI |
| TypeScript | 5.3.2 | Linguagem |
| Vite | 7.3.1 | Bundler + dev server |
| Tailwind CSS | 4.2.1 | Estilização |
| shadcn/ui | 3.8.5 | Componentes base |
| Radix UI | 1.4.3 | Primitivos acessíveis |
| Remix Icon | 4.9.0 | Ícones |
| vite-plugin-singlefile | 2.3.0 | Gera HTML single-file |

### Qualidade

| Ferramenta | Uso |
|---|---|
| ESLint | Linting com regras Figma + TypeScript |
| @figma/eslint-plugin-figma-plugins | Regras específicas para plugins Figma |

---

## 12. Estrutura do Projeto

```
Tomate/
├── manifest.json                  # Configuração do plugin Figma
├── package.json                   # Dependências e scripts
├── tsconfig.json                  # Configuração TypeScript
├── vite.config.ts                 # Configuração Vite (build da UI)
├── build.mjs                      # Script de build do plugin (esbuild)
├── components.json                # Configuração shadcn/ui
├── code.js                        # Plugin compilado (output)
├── ui.html                        # UI compilada (output, single-file)
│
├── src/
│   ├── plugin/                    # Código do plugin (sandbox Figma)
│   │   ├── controller.ts          # Entry point e comunicação
│   │   ├── library-parser.ts      # Indexação da biblioteca DS
│   │   ├── audit-engine.ts        # Motor de análise e scoring
│   │   ├── issue-detector.ts      # Detecção de issues
│   │   └── color-utils.ts         # Utilitários de cor (CIELAB)
│   │
│   ├── shared/                    # Código compartilhado
│   │   ├── types.ts               # Interfaces e tipos TypeScript
│   │   └── constants.ts           # Constantes e configuração
│   │
│   └── ui/                        # Interface React
│       ├── main.tsx               # Entry point React
│       ├── App.tsx                # Componente raiz e gerenciamento de estado
│       ├── index.css              # Estilos globais (Tailwind)
│       ├── lib/utils.ts           # Utilitários (cn helper)
│       ├── screens/
│       │   ├── home.tsx           # Tela inicial
│       │   ├── scanning.tsx       # Tela de progresso
│       │   ├── results.tsx        # Tela de resultados
│       │   └── review.tsx         # Tela de revisão de issues
│       └── components/
│           ├── issue-card.tsx     # Card de issue individual
│           ├── score-gauge.tsx    # Gauge circular do score
│           └── ui/               # Componentes shadcn/ui base
│               ├── badge.tsx
│               ├── button.tsx
│               ├── card.tsx
│               ├── input.tsx
│               └── progress.tsx
```

---

## 13. Configuração e Build

### Pré-requisitos

- Node.js (recomendado: v20+)
- npm
- Figma Desktop

### Instalação

```bash
git clone <repositório>
cd Tomate
npm install
```

### Scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `build` | `npm run build` | Build completo (plugin + UI) |
| `build:plugin` | `npm run build:plugin` | Build apenas do plugin (code.js) |
| `build:ui` | `npm run build:ui` | Build apenas da UI |
| `watch` | `npm run watch` | Watch mode para desenvolvimento |
| `dev:ui` | `npm run dev:ui` | Dev server da UI (Vite) |
| `lint` | `npm run lint` | Verifica erros de lint |
| `lint:fix` | `npm run lint:fix` | Corrige erros de lint automaticamente |

### Como importar no Figma

1. Abra o **Figma Desktop**
2. Vá em **Plugins → Development → Import plugin from manifest...**
3. Selecione o arquivo `manifest.json` na raiz do projeto
4. Execute: **Plugins → Development → Tomate IFDS Web**

---

## 14. Configurações Internas

### Manifest do Plugin

| Campo | Valor |
|---|---|
| **Nome** | Tomate IFDS Web |
| **ID** | 1608892467883580078 |
| **API** | 1.0.0 |
| **Editor** | Figma |
| **Acesso ao documento** | dynamic-page |

### Constantes configuráveis (`src/shared/constants.ts`)

| Constante | Valor | Descrição |
|---|---|---|
| `COLOR_DISTANCE_THRESHOLD` | 5 | Threshold Delta-E para considerar cor off-token |
| `PLUGIN_UI_WIDTH` | 380px | Largura da janela do plugin |
| `PLUGIN_UI_HEIGHT` | 580px | Altura da janela do plugin |
| `DS_FILE_KEY` | `YuYore4hgyjGuWHDtSeLrhxP` | ID do arquivo Figma do Design System |
| `FIGMA_API_BASE` | `https://api.figma.com/v1` | Base URL da API Figma |

---

## 15. Limitações Conhecidas (MVP)

| Limitação | Detalhe |
|---|---|
| Token da API hardcoded | O token da API Figma está hardcoded no código da UI (`App.tsx`). Em produção, deve ser substituído por input do usuário ou secret management. |
| Arquivo DS fixo | O `DS_FILE_KEY` aponta para um arquivo Figma específico. Não há seletor dinâmico de arquivo DS. |
| Sem persistência de resultados | Os resultados da auditoria não são salvos — cada scan gera um novo resultado. |
| Sem exportação de relatório | Não há funcionalidade de exportar o relatório em PDF, CSV ou outro formato. |
| Correção limitada | Auto-fix disponível apenas para cores (fill/stroke) e espaçamentos. Componentes detached requerem correção manual. |
| Single page | Audita apenas uma página por vez (seleção ou página atual). |

---

## 16. Glossário

| Termo | Definição |
|---|---|
| **iFDS** | iFood Design System — sistema de design do iFood |
| **Token** | Valor de design nomeado e reutilizável (cor, espaçamento, tipografia) |
| **Off-token** | Valor que não corresponde a nenhum token do DS |
| **Detached** | Componente desvinculado da instância original da biblioteca |
| **Delta-E** | Métrica de diferença perceptual de cor no espaço CIELAB |
| **CIELAB** | Espaço de cor perceptualmente uniforme (L* luminosidade, a* verde–vermelho, b* azul–amarelo) |
| **Score de conformidade** | Pontuação de 0 a 100 indicando o grau de aderência ao Design System |
| **Escala de espaçamento** | Conjunto finito de valores de espaçamento definidos pelo DS |
| **clientStorage** | API do Figma para persistir dados no dispositivo do usuário |
| **Sandbox** | Ambiente isolado onde o código do plugin Figma executa, sem acesso direto ao DOM |

---

## 17. Roadmap (futuro)

- [ ] Input dinâmico do token da API Figma
- [ ] Seletor de arquivo DS (multi-DS)
- [ ] Exportação de relatório (PDF/CSV)
- [ ] Persistência de histórico de auditorias
- [ ] Auditoria cross-page
- [ ] Dashboard comparativo entre versões
- [ ] Integração com CI/CD (auditoria automatizada)
- [ ] Suporte a variables (Figma Variables API)

---

*Documentação gerada em 26/02/2026. Plugin Tomate v1.0.0.*
