# Frontend Design & Interaction — Sistema Fórmula Engenharia

---

## 1. Direção Estética

### Conceito

O sistema é uma ferramenta técnica usada por engenheiros e desenhistas ao longo do dia de trabalho. O design parte de um princípio **industrial-refinado**: denso de informação, mas sem parecer pesado. Sem arredondamentos excessivos, sem gradientes decorativos. A estética remete a plantas técnicas — precisão, hierarquia clara, espaço bem ocupado.

O que torna esse sistema memorável: a **sidebar escura como âncora visual permanente**, o **timer verde pulsante** sempre visível quando há trabalho em andamento, e a **árvore de estrutura** do painel admin que revela edifícios inteiros de forma progressiva.

### Tom geral

Profissional, direto, confiável. Nada piscando sem motivo. Animações existem para orientar — não para decorar.

---

## 2. Identidade Visual

### Logotipo

Usar o logo oficial da Fórmula Engenharia e Consultoria (arquivo `logo-formula.png`) no header da sidebar. Versão horizontal, sobre fundo escuro. Manter o espaço de respiro mínimo de `16px` em todos os lados.

### Paleta de Cores

```css
:root {
  /* Verdes — identidade da marca */
  --verde-principal:   #5a8a4a;   /* botões primários, timer ativo, links */
  --verde-hover:       #3b6d11;   /* hover de botões, estado ativo de nav */
  --verde-claro:       #eaf3de;   /* fundo de badges "Ok", alertas positivos */
  --verde-texto:       #27500a;   /* texto sobre fundo verde claro */

  /* Cinzas — estrutura e texto */
  --cinza-900:         #1e1e1c;   /* sidebar, header escuro */
  --cinza-800:         #2c2c2a;   /* textos primários, headings */
  --cinza-600:         #6b6b6b;   /* textos secundários, labels, metadados */
  --cinza-300:         #b4b2a9;   /* bordas, divisores */
  --cinza-100:         #f1efe8;   /* fundo geral das páginas */
  --cinza-50:          #f8f7f4;   /* fundo de cards, painéis internos */

  /* Branco */
  --branco:            #ffffff;

  /* Status semânticos */
  --status-fazendo-bg:   #e6f1fb;   /* azul claro */
  --status-fazendo-text: #185fa5;   /* azul escuro */
  --status-ok-bg:        #eaf3de;   /* verde claro */
  --status-ok-text:      #27500a;   /* verde escuro */
  --status-atend-bg:     #faeeda;   /* âmbar claro */
  --status-atend-text:   #854f0b;   /* âmbar escuro */
  --status-gerado-bg:    #f1efe8;   /* cinza claro */
  --status-gerado-text:  #5f5e5a;   /* cinza médio */
  --status-impresso-bg:  #d3d1c7;
  --status-impresso-text:#2c2c2a;
  --status-montada-bg:   #2c2c2a;   /* fundo escuro — etapa final */
  --status-montada-text: #f1efe8;

  /* Feedback */
  --erro:     #e24b4a;
  --aviso:    #ba7517;
  --sucesso:  #3b6d11;

  /* Timer */
  --timer-bg:     #5a8a4a;
  --timer-texto:  #ffffff;
  --timer-pulso:  rgba(90, 138, 74, 0.25);
}
```

### Modo Escuro

O modo escuro **não é o padrão** — o ambiente de trabalho é uma sala iluminada durante o dia. Implementar dark mode como opção via toggle no perfil, usando `data-theme="dark"` no `<html>`. Variáveis redefinidas:

```css
[data-theme="dark"] {
  --cinza-100:  #1e1e1c;
  --cinza-50:   #2c2c2a;
  --branco:     #1e1e1c;
  --cinza-800:  #f1efe8;
  --cinza-600:  #b4b2a9;
  --cinza-300:  #444441;
}
```

---

## 3. Tipografia

### Famílias

```css
/* Headings e labels de interface */
font-family: 'Barlow Condensed', sans-serif;

/* Corpo de texto, tabelas, formulários */
font-family: 'DM Sans', sans-serif;

/* Timer, timestamps, IDs técnicos */
font-family: 'JetBrains Mono', monospace;
```

Importação via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?
  family=Barlow+Condensed:wght@400;500;600;700&
  family=DM+Sans:wght@400;500&
  family=JetBrains+Mono:wght@400;500&
  display=swap" rel="stylesheet">
```

**Justificativa das escolhas:**
- `Barlow Condensed` — fonte condensada, técnica, usada em indústria e construção civil. Economiza espaço horizontal em labels densas. Remete a chapas metálicas e plantas de engenharia.
- `DM Sans` — legível em tamanhos pequenos, sem serifa, neutra o suficiente para não competir com o Barlow. Boa para textos corridos e tabelas.
- `JetBrains Mono` — padrão para qualquer valor numérico que precise de alinhamento preciso (timer, timestamps, durações).

### Escala Tipográfica

```css
/* Barlow Condensed */
--text-display:   28px / 700 / letter-spacing: 0.02em   /* nome do edifício, título de página */
--text-heading:   20px / 600                             /* seções, cards de painel */
--text-label:     14px / 500 / uppercase / ls: 0.08em   /* labels de campo, cabeçalhos de coluna */
--text-sublabel:  12px / 400 / uppercase / ls: 0.06em   /* metadados, breadcrumbs */

/* DM Sans */
--text-body:      15px / 400                             /* texto corrido */
--text-body-sm:   13px / 400                             /* linhas de tabela, lista de atividades */
--text-caption:   12px / 400                             /* timestamps, notas */

/* JetBrains Mono */
--text-timer:     32px / 500                             /* timer principal */
--text-mono-sm:   12px / 400                             /* timestamps em tabela */
```

### Regras de uso

- Títulos de página: `Barlow Condensed 700 28px`, maiúsculas, cor `--cinza-800`
- Labels de campo acima de inputs: `Barlow Condensed 500 12px`, uppercase, `--cinza-600`, `letter-spacing: 0.08em`
- Texto de linhas em tabelas: `DM Sans 400 13px`, `--cinza-800`
- Timestamps e durações: sempre `JetBrains Mono`, nunca `DM Sans`
- Nunca misturar Barlow e DM Sans na mesma linha

---

## 4. Espaçamento e Grid

### Sistema de Espaçamento

Base `4px`. Todos os valores de margin, padding e gap devem ser múltiplos de 4.

```
4px   — separação mínima (ícone ↔ texto, inline)
8px   — padding interno de badges e chips
12px  — gap entre elementos relacionados dentro de um card
16px  — padding padrão de card, gap de lista
24px  — separação entre seções dentro de uma página
32px  — padding de página (lateral)
48px  — separação entre blocos maiores
```

### Layout Geral

```
┌─────────────┬────────────────────────────────────────┐
│             │  Header da página (56px)               │
│  Sidebar    ├────────────────────────────────────────┤
│  (240px     │                                        │
│  fixa)      │  Área de conteúdo (scroll vertical)    │
│             │  padding: 32px                         │
│             │                                        │
└─────────────┴────────────────────────────────────────┘
```

- Sidebar: `240px`, fixa, fundo `--cinza-900`, sem colapso em desktop
- Header da página: `56px`, fundo `--branco`, borda inferior `1px solid --cinza-300`
- Conteúdo: largura máxima `1200px`, centralizado com `margin: 0 auto`
- Grid interno: CSS Grid com `gap: 24px`

---

## 5. Componentes de Interface

### 5.1 Sidebar

```
Fundo: --cinza-900
Largura: 240px (fixa)
Altura: 100vh (fixa, sem scroll)
```

**Estrutura:**
```
[Logo Fórmula — 64px de altura, padding 20px]
─────────────────────────────────────────────
[Nav principal]
  Ícone + Label — Barlow Condensed 500 14px
  Hover: fundo rgba(255,255,255,0.06), transição 150ms
  Ativo: borda esquerda 3px solid --verde-principal,
         fundo rgba(90,138,74,0.15), texto branco
─────────────────────────────────────────────
[Spacer flex-grow]
─────────────────────────────────────────────
[Rodapé da sidebar]
  Avatar + Nome do usuário logado
  Botão "Trocar usuário" (ícone, sem label)
```

**Itens de navegação — Funcionário:**
- `⬛ Minhas atividades` (página inicial)
- `📋 Histórico`

**Itens de navegação — Admin:**
- `⬛ Dashboard`
- `🏢 Edifícios`
- `👥 Usuários`
- `⚙️ Configurações`

Usar ícones do `lucide-react` (tamanho 18px, `stroke-width: 1.5`).

---

### 5.2 Header de Página

```
Altura: 56px
Fundo: --branco
Borda: border-bottom: 1px solid var(--cinza-300)
Padding lateral: 32px
```

**Estrutura:**
```
[Título da página — Barlow Condensed 700 28px]   [Breadcrumb]   [Ações da página →]
```

Breadcrumb: `DM Sans 13px --cinza-600`, separador `/`, links em `--verde-principal` ao hover.

Ações da página: botões alinhados à direita, máximo 2 por página.

---

### 5.3 Botões

**Primário:**
```css
background: var(--verde-principal);
color: var(--branco);
font: Barlow Condensed 600 14px uppercase letter-spacing: 0.06em;
padding: 10px 20px;
border-radius: 4px;
border: none;
transition: background 150ms ease;

:hover  → background: var(--verde-hover)
:active → transform: translateY(1px)
:disabled → opacity: 0.45, cursor: not-allowed
```

**Secundário:**
```css
background: transparent;
color: var(--cinza-800);
border: 1px solid var(--cinza-300);
/* demais propriedades idênticas ao primário */

:hover → border-color: var(--cinza-600), background: var(--cinza-100)
```

**Destrutivo:**
```css
background: transparent;
color: var(--erro);
border: 1px solid var(--erro);

:hover → background: #fcebeb
```

**Ícone (icon-only):**
```css
width: 36px; height: 36px;
border-radius: 4px;
display: flex; align-items: center; justify-content: center;
background: transparent;
border: 1px solid var(--cinza-300);
color: var(--cinza-600);

:hover → background: var(--cinza-100), color: var(--cinza-800)
```

---

### 5.4 Badges de Status

Todos os badges seguem o mesmo padrão estrutural, variando apenas as variáveis de cor:

```css
.badge {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
```

| Status | Background | Texto | Indicador |
|---|---|---|---|
| Fazendo | `--status-fazendo-bg` | `--status-fazendo-text` | `●` pulsante azul |
| Ok | `--status-ok-bg` | `--status-ok-text` | `✓` estático |
| Atendendo comentários | `--status-atend-bg` | `--status-atend-text` | `!` estático |
| Gerado | `--status-gerado-bg` | `--status-gerado-text` | `○` vazio |
| Impresso | `--status-impresso-bg` | `--status-impresso-text` | `◑` meio preenchido |
| Montada | `--status-montada-bg` | `--status-montada-text` | `●` sólido escuro |

O indicador `●` do status "Fazendo" tem animação `pulse`:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.badge-fazendo .dot { animation: pulse 1.8s ease-in-out infinite; }
```

---

### 5.5 Cards de Atividade (Tela do Funcionário)

O card é o componente mais usado no sistema. Deve comunicar rapidamente: o quê, em qual laje, qual status, há quanto tempo.

```
┌──────────────────────────────────────────────────────────┐
│ [Badge status]                           [Prédio / Laje] │
│                                                          │
│  Vigas — Formato                                         │
│  Barlow Condensed 700 20px --cinza-800                  │
│                                                          │
│  Ed. Residencial Sol Nascente · Laje 3                   │
│  DM Sans 13px --cinza-600                               │
│                                                          │
│ ──────────────────────────────────────────────────────── │
│ [Timer: 00:47:23]              [Botão Finalizar]         │
└──────────────────────────────────────────────────────────┘
```

**Especificações:**
```css
.card-atividade {
  background: var(--branco);
  border: 1px solid var(--cinza-300);
  border-radius: 6px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 200ms ease;
}

.card-atividade:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
}

/* Card com sessão ativa — destaque verde sutil */
.card-atividade.ativa {
  border-left: 3px solid var(--verde-principal);
  padding-left: 21px; /* compensa a borda de 3px */
}
```

**Timer dentro do card:**
```css
.card-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 500;
  color: var(--verde-principal);
  letter-spacing: 0.02em;
}
```

---

### 5.6 Timer Principal (Tela do Funcionário)

Quando há uma sessão ativa, um banner fixo aparece no topo da área de conteúdo (abaixo do header da página), sempre visível ao rolar:

```
┌──────────────────────────────────────────────────────────────┐
│  ● Em andamento   Vigas — Formato · Laje 3    01:23:45  [■]  │
└──────────────────────────────────────────────────────────────┘
```

```css
.timer-banner {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--verde-principal);
  color: var(--branco);
  padding: 12px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.timer-banner .valor {
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  font-weight: 500;
  margin-left: auto;
}

.timer-banner .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--branco);
  animation: pulse 1.8s ease-in-out infinite;
  flex-shrink: 0;
}
```

---

### 5.7 Inputs e Formulários

```css
/* Label */
.field-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cinza-600);
  display: block;
  margin-bottom: 6px;
}

/* Input */
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: var(--cinza-800);
  background: var(--branco);
  border: 1px solid var(--cinza-300);
  border-radius: 4px;
  outline: none;
  transition: border-color 150ms ease;
}

.field-input:focus {
  border-color: var(--verde-principal);
  box-shadow: 0 0 0 3px rgba(90,138,74,0.15);
}

.field-input::placeholder {
  color: var(--cinza-300);
}
```

**Campo numérico de lajes (especial):**

O campo `Número de pavimentos-tipo` na criação de edifício tem um input numérico com stepper customizado (+ e − como botões ao lado) e uma pré-visualização imediata abaixo mostrando quantas lajes serão geradas:

```
[  −  ] [  3  ] [  +  ]

Serão geradas: Fundação, Laje 1, Laje 2, Laje 3, FundCX, TampaCX
               DM Sans 13px --cinza-600 (atualiza em tempo real com JS)
```

---

### 5.8 Tabelas (Histórico e Dashboard)

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
}

.table thead th {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cinza-600);
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid var(--cinza-300);
  background: var(--cinza-50);
}

.table tbody tr {
  border-bottom: 1px solid var(--cinza-100);
  transition: background 100ms ease;
}

.table tbody tr:hover {
  background: var(--cinza-50);
}

.table tbody td {
  padding: 12px 16px;
  color: var(--cinza-800);
  vertical-align: middle;
}

/* Coluna de timestamp */
.table td.timestamp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--cinza-600);
}

/* Coluna de duração */
.table td.duracao {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--cinza-800);
}
```

---

### 5.9 Árvore de Estrutura (Painel Admin — Edifícios)

Componente hierárquico expansível para visualizar: Edifício > Lajes > Atividades.

**Comportamento:**
- Por padrão, apenas os edifícios aparecem (nível 1 aberto)
- Clique no edifício expande suas lajes (animação de `max-height: 0 → auto` com `overflow: hidden`)
- Clique na laje expande suas atividades
- Cada atividade mostra nome, status atual, responsável, tempo acumulado

**Estrutura visual:**
```
▼ Ed. Residencial Sol Nascente          [Construtora ABC] [3 lajes] [68% concluído]
  ├─ Fundação
  │   ├─ Vigas > Rascunho     [Gerado]
  │   ├─ Vigas > Formato      [Fazendo ●]  João         00:12:40
  │   ├─ Lajes > Rascunho     [Ok ✓]       Maria        01:05:22
  │   └─ ...
  ├─ Laje 1
  └─ Laje 2
```

**Especificações:**
```css
/* Linha de edifício */
.tree-edificio {
  padding: 14px 16px;
  background: var(--branco);
  border: 1px solid var(--cinza-300);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

/* Ícone de toggle */
.tree-toggle {
  width: 20px;
  height: 20px;
  color: var(--cinza-600);
  transition: transform 200ms ease;
}
.tree-toggle.aberto { transform: rotate(90deg); }

/* Linha de laje */
.tree-laje {
  padding: 10px 16px 10px 36px; /* indent */
  border-left: 2px solid var(--cinza-300);
  margin-left: 12px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: var(--cinza-800);
  cursor: pointer;
}

/* Linha de atividade */
.tree-atividade {
  padding: 8px 16px 8px 52px;
  border-left: 2px solid var(--cinza-100);
  margin-left: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
}
```

**Barra de progresso de conclusão (por edifício):**
```css
.progress-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--cinza-100);
  overflow: hidden;
  width: 120px;
}

.progress-bar-fill {
  height: 100%;
  background: var(--verde-principal);
  border-radius: 2px;
  transition: width 400ms ease;
}
```

---

### 5.10 Modal de Confirmação

Usado ao finalizar atividade, trocar usuário, ou editar status como admin.

```css
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 150ms ease;
}

/* Container */
.modal {
  background: var(--branco);
  border-radius: 8px;
  padding: 32px;
  width: 440px;
  max-width: calc(100vw - 48px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  animation: slide-up 200ms ease;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
```

**Título:** `Barlow Condensed 700 22px --cinza-800`
**Corpo:** `DM Sans 14px --cinza-600`
**Rodapé:** botões Cancelar (secundário) + Confirmar (primário), alinhados à direita

---

### 5.11 Notificações Toast

Aparecem no canto inferior direito, empilhadas, com auto-dismiss de 4 segundos.

```css
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 200;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
}

.toast {
  padding: 12px 16px;
  border-radius: 6px;
  border-left: 4px solid;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  min-width: 280px;
  max-width: 360px;
  animation: toast-in 250ms ease;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

@keyframes toast-in {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

.toast.sucesso { background: var(--verde-claro); border-color: var(--verde-principal); color: var(--verde-texto); }
.toast.erro    { background: #fcebeb;            border-color: var(--erro);            color: #791f1f; }
.toast.aviso   { background: #faeeda;            border-color: var(--aviso);           color: #633806; }
```

**Casos de uso:**
- Atividade iniciada → toast sucesso: "Sessão iniciada — Vigas · Formato"
- Tentativa de segunda sessão → toast erro: "Você já tem uma atividade em andamento"
- Status editado pelo admin → toast aviso: "Status alterado com log registrado"

---

## 6. Telas — Especificação Detalhada

### 6.1 Tela de Seleção de Usuário (Primeiro Acesso)

Página de entrada limpa, sem sidebar, sem header.

**Layout:**
```
Fundo: --cinza-100

[ Logo Fórmula — centralizado, 180px de largura ]

[ "Quem está trabalhando neste computador?" ]
  Barlow Condensed 700 28px --cinza-800, text-align: center

[ Grid de cards de funcionário — 3 colunas, gap 16px ]
  Cada card:
    - Fundo --branco, borda --cinza-300, border-radius 6px
    - Padding 24px, text-align center
    - Avatar circular (iniciais, fundo --cinza-100, letra --cinza-800)
      Tamanho 56px, Barlow 700 22px
    - Nome — Barlow 600 16px --cinza-800
    - Hover: border-color --verde-principal, box-shadow leve
    - Click: abre modal de confirmação "Você é [Nome]?"
```

**Modal de confirmação:**
```
"Você é Maria Santos?"
[Não sou eu]   [Sim, sou eu →]
```

Ao confirmar, salva no `localStorage` e redireciona para a tela principal. Transição de página: `opacity 0 → 1` em 300ms.

---

### 6.2 Tela Principal — Funcionário (Minhas Atividades)

**Header da página:** "Minhas atividades" + botão "Ver histórico" (secundário)

**Estado: nenhuma sessão ativa**
```
[ Seção: Em andamento ]
  Card vazio — "Nenhuma atividade em andamento"
  Texto secundário: "Selecione uma atividade abaixo para começar"

[ Seção: Disponíveis para iniciar ]
  Lista de cards de atividade (sem timer, com botão "Iniciar")
```

**Estado: sessão ativa**
```
[ Timer Banner — sticky, fundo verde ]

[ Seção: Em andamento ]
  Card com borda verde, timer rodando, botão "Finalizar"

[ Seção: Disponíveis para iniciar ]
  Cards com botão "Iniciar" desabilitado + tooltip:
  "Finalize a atividade atual antes de iniciar outra"
```

**Interação "Iniciar":**
1. Usuário clica "Iniciar" em um card
2. Modal: "Iniciar sessão em Vigas — Formato · Laje 3?" → [Cancelar] [Iniciar]
3. Ao confirmar: POST `/api/sessoes`, card se move para "Em andamento", timer aparece, banner verde surge com animação `slide-down`

**Interação "Finalizar":**
1. Usuário clica "Finalizar"
2. Modal: "Finalizar sessão?" + tempo acumulado mostrado + novo status esperado
3. Ao confirmar: PUT `/api/sessoes/{id}/finalizar`, badge de status atualiza, card sai da seção "Em andamento"
4. Toast: "Sessão finalizada — 00:47:23 registrados"

---

### 6.3 Tela de Histórico — Funcionário

**Header:** "Histórico" + filtro de período (últimos 7 dias / 30 dias / personalizado)

**Cards de resumo no topo:**
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Total hoje       │ │ Total esta semana│ │ Atividades ok    │
│ 04:32:10         │ │ 22:18:45         │ │ 12               │
│ JetBrains Mono   │ │ JetBrains Mono   │ │ DM Sans          │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Tabela de sessões:**

Colunas: Data | Atividade | Edifício / Laje | Status resultante | Duração

Agrupada por dia (header sticky por dia com total do dia à direita).

---

### 6.4 Dashboard Admin — Visão Geral

**Header:** "Dashboard" + filtros (período, edifício, funcionário) em linha

**Seção: Atividades em andamento agora**
```
Atualização via WebSocket — ícone de conexão ativa no canto direito do card.
Lista compacta: ● Funcionário · Atividade · Edifício · 00:12:34
Se ninguém trabalhando: estado vazio elegante com ícone e texto "Nenhuma atividade ativa no momento"
```

**Seção: Progresso por edifício**
Grid de cards, um por edifício ativo:
```
┌─────────────────────────────────────────────────┐
│ Ed. Residencial Sol Nascente                    │
│ Construtora ABC                 [68%] ██████░░  │
│                                                 │
│ 3 funcionários · 42 atividades · 12 concluídas  │
│                                 [Ver detalhes →] │
└─────────────────────────────────────────────────┘
```

**Seção: Gráficos**

Dois gráficos lado a lado (Recharts):
- Esquerdo: barras horizontais — horas por funcionário na semana
- Direito: linha — atividades concluídas por dia nos últimos 30 dias

Paleta dos gráficos: `--verde-principal` como cor primária, `--cinza-300` para eixos e grids.

---

### 6.5 Painel Admin — Edifícios

**Header:** "Edifícios" + botão "Novo edifício" (primário)

Árvore expansível (ver seção 5.9). Acima da árvore: barra de busca por nome de edifício/construtora.

**Novo edifício — modal largo (600px):**
```
[ Construtora ]          (select com busca)
[ Nome do edifício ]     (input texto)
[ Descrição ]            (textarea, opcional)
[ Nº de pavimentos-tipo] (input numérico com stepper)

Pré-visualização de lajes: Fundação, Laje 1, Laje 2, ..., FundCX, TampaCX
                            Atualiza em tempo real conforme digita

[Cancelar]   [Gerar edifício →]
```

**Edição de status (inline):**
Ao clicar no badge de status de uma atividade na árvore, um dropdown aparece com os próximos status disponíveis para aquele tipo. Ao selecionar: salva com log, atualiza badge com animação de troca.

---

### 6.6 Painel Admin — Usuários

Tabela simples com: Nome | Role | Status (ativo/inativo) | Criado em | Ações

Formulário de novo usuário em modal:
```
[ Nome completo ]
[ Papel ]   ○ Funcionário   ○ Admin
```

Toggle de ativo/inativo na tabela com confirmação via toast (sem modal).

---

## 7. Animações e Micro-interações

### Princípios

- **Propósito antes de decoração.** Toda animação deve guiar o olhar ou confirmar uma ação.
- **Duração:** transições de estado 150–200ms (ease-out). Entradas de elementos novos 250–300ms (ease). Nunca mais que 400ms para UI utilitária.
- **Respeitar `prefers-reduced-motion`:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Inventário de Animações

| Momento | Animação | Duração |
|---|---|---|
| Entrada na tela principal (pós login) | Stagger de cards — cada card entra com `translateY(8px) → 0`, delay de `50ms * índice` | 200ms + delay |
| Timer banner aparece | `slideDown`: `translateY(-100%) → 0`, `opacity 0 → 1` | 250ms ease |
| Timer banner some | `slideUp`: `translateY(0) → -100%)`, `opacity 1 → 0` | 200ms ease |
| Badge de status troca | `fadeFlip`: `opacity 1 → 0 → 1` com troca de conteúdo no meio | 300ms |
| Card de atividade — iniciar sessão | Borda esquerda verde aparece com `scaleY(0 → 1)` (transform-origin: top) | 200ms |
| Modal aparece | `slide-up` + overlay `fade-in` | 200ms |
| Toast entra | `translateX(20px → 0)` + `opacity 0 → 1` | 250ms |
| Toast sai | `translateX(0 → 20px)` + `opacity 1 → 0` | 200ms |
| Nó da árvore expande | `max-height: 0 → conteúdo` + `opacity 0 → 1` | 250ms ease |
| Ícone toggle da árvore | `rotate(0 → 90deg)` | 200ms ease |
| Dot pulsante (sessão ativa) | `opacity 1 ↔ 0.4` loop | 1.8s ease-in-out |
| Progress bar ao carregar | `width: 0 → valor%` | 600ms ease-out (delay 300ms) |
| Barra de busca expande | `width: 40px → 240px` ao focar | 200ms ease |

### Hover States

Todos os elementos clicáveis devem ter feedback visual em `≤ 150ms`:

- Cards: `box-shadow` sutil
- Botões: mudança de `background`
- Linhas de tabela: `background: --cinza-50`
- Nav items da sidebar: `background rgba`
- Badges em modo admin (clicáveis): `cursor: pointer`, borda em destaque

---

## 8. Estados Vazios

Todo componente de lista ou seção deve ter um estado vazio bem projetado — não apenas "Nenhum resultado encontrado".

| Contexto | Mensagem principal | Subtexto | Ação |
|---|---|---|---|
| Sem atividades disponíveis | "Sem atividades no momento" | "O admin ainda não atribuiu atividades a este computador" | — |
| Histórico vazio | "Nenhuma sessão registrada" | "Seu histórico aparecerá aqui após iniciar a primeira atividade" | — |
| Dashboard sem edifícios | "Nenhum edifício cadastrado" | "Cadastre o primeiro edifício para começar a acompanhar a equipe" | Botão "Novo edifício" |
| Sem atividades ativas (real-time) | "Equipe sem atividades ativas" | "Nenhum funcionário iniciou uma sessão agora" | — |

Estilo do estado vazio:
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  gap: 8px;
}

.empty-state p:first-child {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--cinza-600);
}

.empty-state p:last-child {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: var(--cinza-300);
  max-width: 320px;
}
```

---

## 9. Acessibilidade

- Todos os elementos interativos devem ter `focus-visible` visível: `outline: 2px solid var(--verde-principal); outline-offset: 2px`
- Botões com ícone-only devem ter `aria-label` descritivo
- Badges de status devem ter `aria-label` com o texto completo (não apenas o ícone)
- Timer deve usar `aria-live="polite"` para não interromper leitores de tela a cada segundo — atualizar a região a cada minuto ou ao mudar de sessão
- Modais devem fazer `focus trap` enquanto abertos e retornar foco ao elemento que os abriu
- Contraste mínimo WCAG AA em todos os pares de cor (já garantido pelas combinações definidas acima)

---

## 10. Estrutura de Arquivos (Frontend)

```
src/
├── app/
│   ├── globals.css            ← variáveis CSS, reset, tipografia base
│   ├── layout.tsx             ← sidebar + estrutura geral
│   ├── page.tsx               ← tela de seleção de usuário
│   ├── dashboard/
│   │   └── page.tsx           ← tela principal do funcionário
│   ├── historico/
│   │   └── page.tsx
│   └── admin/
│       ├── page.tsx           ← dashboard admin
│       ├── edificios/
│       │   └── page.tsx
│       └── usuarios/
│           └── page.tsx
├── components/
│   ├── ui/
│   │   ├── Badge.tsx          ← StatusBadge com variantes
│   │   ├── Button.tsx         ← variantes primary/secondary/destructive/icon
│   │   ├── Card.tsx
│   │   ├── Modal.tsx          ← com focus trap
│   │   ├── Toast.tsx          ← com ToastProvider e useToast hook
│   │   ├── Input.tsx
│   │   ├── Table.tsx
│   │   └── EmptyState.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── PageHeader.tsx
│   │   └── TimerBanner.tsx
│   ├── atividades/
│   │   ├── CardAtividade.tsx
│   │   └── ListaAtividades.tsx
│   ├── admin/
│   │   ├── ArvoreEstrutura.tsx
│   │   ├── ModalNovoEdificio.tsx
│   │   └── GraficoProgresso.tsx
│   └── usuario/
│       └── CardSelecao.tsx
├── hooks/
│   ├── useUsuarioLocal.ts     ← lê/grava localStorage
│   ├── useSessaoAtiva.ts      ← estado global do timer
│   ├── useTimer.ts            ← intervalo de contagem
│   └── useWebSocket.ts        ← conexão com dashboard admin
├── lib/
│   ├── api.ts                 ← wrapper fetch tipado
│   ├── constants.ts           ← status, tipos de elemento, etc.
│   └── formatters.ts          ← formatDuracao, formatTimestamp
└── types/
    └── index.ts               ← tipos globais: Usuario, Atividade, Sessao, etc.
```

---

## 11. Checklist de Implementação (Frontend)

- [ ] Instalar e configurar Tailwind CSS com o design system customizado
- [ ] Configurar `globals.css` com todas as variáveis CSS da paleta
- [ ] Importar as fontes via `next/font` ou link Google Fonts no `layout.tsx`
- [ ] Implementar `useUsuarioLocal` e tela de seleção
- [ ] Implementar `useSessaoAtiva` com Context (compartilhado entre pages)
- [ ] Implementar `useTimer` com `setInterval` e cleanup no unmount
- [ ] Componente `StatusBadge` com todas as variantes e animação pulse
- [ ] `TimerBanner` sticky com animação de entrada/saída
- [ ] `CardAtividade` com estados: disponível, ativa, concluída
- [ ] Modais com `focus trap` e animações
- [ ] `Toast` com auto-dismiss e animações de entrada/saída
- [ ] Árvore de estrutura com expand/collapse animado
- [ ] Campo de lajes com pré-visualização em tempo real
- [ ] Gráficos com Recharts (cores da paleta Fórmula)
- [ ] WebSocket no dashboard admin com indicador de status de conexão
- [ ] Estados vazios em todos os componentes de lista
- [ ] `focus-visible` em todos os elementos interativos
- [ ] `aria-label` em botões ícone e badges
- [ ] Suporte a `prefers-reduced-motion`
- [ ] Toggle de dark mode com persistência em localStorage
