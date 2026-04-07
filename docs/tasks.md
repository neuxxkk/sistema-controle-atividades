# Plano de Reestruturacao LLM-First

## 1. Objetivo

Reestruturar o sistema para:

- Seguir exibicao em arvore inspirada no TQS (hierarquia, densidade visual e navegacao).
- Unificar regras de negocio de tarefas, etapas e status.
- Garantir rastreabilidade de tempo total da tarefa e contribuicao por funcionario.
- Permitir que um LLM execute implementacao por fases com baixa ambiguidade.

## 2. Escopo funcional (canonico)

### 2.1 Hierarquia de exibicao e dominio

- Construtora
- Edificio
- Pavimento
- Tarefa de pavimento (Vigas, Lajes)
- Tarefa de edificio (Grelha Refinada, Bloco de fundacao, Cortina, Escada, Rampa)

Regra:

- Tarefas unicas por edificio: uma instancia por edificio.
- Tarefas por pavimento: uma instancia por pavimento.

### 2.2 Etapas por tipo de tarefa

Tipos com multiplas etapas:

- Vigas
    1. Gerar desenhos
    2. Rascunho
    3. Montar formato
- Lajes
    1. Elaboracao inicial
    2. Correcao
    3. Montar formato

Tipos de etapa unica:

- Grelha Refinada
- Bloco de fundacao
- Cortina
- Escada
- Rampa

## 3. Modelo de estado (separar lifecycle de etapa)

### 3.1 Status de ciclo de vida

Estados permitidos:

- Pendente
- Em andamento
- Pausada
- Finalizada

Definicoes:

- Pendente: ainda nao iniciada.
- Em andamento: sendo executada por um funcionario vinculado.
- Pausada: interrompida, mantendo vinculo do ultimo responsavel.
- Finalizada: concluida (ultima etapa concluida).

### 3.2 Etapa atual

- `etapa_atual` e obrigatoria para tarefas com multiplas etapas.
- Em tarefas de etapa unica, `etapa_atual = 1` fixo.

### 3.3 Regra de conclusao

- Se tarefa tiver multiplas etapas: so pode ir para Finalizada quando `etapa_atual` for a ultima e acao de finalizar for valida.
- Se tarefa tiver etapa unica: pode finalizar a partir de Em andamento ou Pausada, respeitando permissao.

## 4. Acoes e pre-condicoes (deterministicas)

### 4.1 Iniciar tarefa

- Pre-condicoes:
    - Status atual = Pendente.
    - Funcionario nao possui outra tarefa Em andamento.
- Efeitos:
    - Status -> Em andamento.
    - Vincula funcionario atual.
    - Abre sessao de trabalho.

### 4.2 Pausar tarefa

- Pre-condicoes:
    - Status atual = Em andamento.
    - Usuario atual e o funcionario vinculado.
- Efeitos:
    - Status -> Pausada.
    - Fecha sessao de trabalho ativa.

### 4.3 Retomar tarefa

- Pre-condicoes:
    - Status atual = Pausada.
    - Usuario atual pode ser diferente do vinculado (roubo permitido).
    - Usuario atual nao possui outra tarefa Em andamento.
- Efeitos:
    - Status -> Em andamento.
    - Vinculo passa para usuario atual (se diferente).
    - Abre nova sessao de trabalho.

### 4.4 Avancar etapa

- Pre-condicoes:
    - Nao estar na ultima etapa.
    - Status atual = Pausada por qualquer funcionario OU Em andamento pelo proprio vinculado.
- Efeitos:
    - Incrementa `etapa_atual`.
    - Mantem status (Pausada ou Em andamento).
    - Registra historico de etapa.

### 4.5 Finalizar tarefa

- Pre-condicoes:
    - Estar na ultima etapa (ou etapa unica).
    - Status atual = Pausada por qualquer funcionario OU Em andamento pelo proprio vinculado.
- Efeitos:
    - Status -> Finalizada.
    - Se houver sessao ativa, fecha sessao.
    - Registra historico final.

## 5. Regras de negocio obrigatorias

- Um funcionario so pode ter 1 tarefa Em andamento por vez.
- Apenas 1 funcionario pode estar vinculado a uma tarefa por vez.
- Funcionario pode iniciar/retomar nova tarefa mesmo com tarefas pausadas.
- Roubo de vinculo so e permitido quando status = Pausada.
- Nunca permitir roubo quando status = Em andamento.
- Quando uma tarefa for executada por 2+ funcionarios, o sistema deve calcular:
    - Tempo total da tarefa ate conclusao.
    - Tempo contribuido por funcionario.

## 6. Requisitos de exibicao (Frontend)

### 6.1 Arvore de tarefas

- Inspiracao visual: modelo TQS (denso, legivel, compacto, profissional).
- Hierarquia obrigatoria na UI:
    - Edificio
    - Pavimentos
    - Tarefas (Lajes/Vigas/Escada/Rampa/etc.)
- Permitir expandir multiplos nos simultaneamente:
    - Abrir varias lajes ao mesmo tempo.
    - Acao global: expandir tudo / recolher tudo por edificio.

### 6.2 Informacoes por linha de tarefa

Cada tarefa deve exibir:

- Status atual.
- Etapa atual e total de etapas (quando aplicavel), exemplo: 2/3.
- Funcionario vinculado (quando Em andamento ou Pausada).
- Acoes permitidas naquele contexto (iniciar, pausar, retomar, avancar, finalizar).

### 6.3 Nome composto de edificio

- Exibir nome no formato: `Construtora - Edificio`.
- Exemplo: `Anima - Ed Major`.

### 6.4 Tela Admin (edificios)

- Visao geral completa da arvore de tarefas e status.
- Impressao com filtro por pavimentos e lajes selecionadas.
- Layout de impressao com legibilidade tipo planilha (estilo excel).

### 6.5 Dashboard de funcionario

- Mesmo modelo visual da arvore do admin.
- Com restricoes de permissao (somente acoes permitidas ao funcionario).

## 7. Lacunas do estado atual (para orientar refatoracao)

Resumo observado:

- Fluxo atual mistura status antigos (Gerado, Impresso, Montada, Ok, Atendendo comentarios) com novo objetivo.
- Nomenclatura atual usa `Pausado`; alvo funcional pede `Pausada`.
- Fluxo de status atual e orientado por transicao de status, nao por acoes de negocio explicitas.
- Arvore atual no frontend limita abertura simultanea de lajes (deve permitir multiplas abertas).

Diretriz:

- Migrar para modelo baseado em `acao + validacao de pre-condicao + efeito`.

## 8. Plano de implementacao por fases

### Fase 1 - Dominio e dados

- Introduzir campos explicitos:
    - `status_ciclo` (Pendente, Em andamento, Pausada, Finalizada)
    - `etapa_atual` (int)
    - `etapa_total` (int)
- Criar migracao para mapear dados legados.
- Ajustar historico para registrar acao, etapa anterior/nova e usuario.

### Fase 2 - Regras de negocio e API

- Criar endpoints por acao:
    - `POST /api/atividades/{id}/iniciar`
    - `POST /api/atividades/{id}/pausar`
    - `POST /api/atividades/{id}/retomar`
    - `POST /api/atividades/{id}/avancar-etapa`
    - `POST /api/atividades/{id}/finalizar`
- Centralizar validacoes em service unico.
- Garantir atomicidade das operacoes com transacao.

### Fase 3 - Frontend arvore TQS-like

- Refatorar componente de arvore para expansao multipla.
- Adicionar comandos globais de expansao/retracao.
- Exibir colunas compactas:
    - Tarefa
    - Etapa
    - Status
    - Vinculado
    - Acao
- Padronizar regras de habilitacao dos botoes com base no backend.

### Fase 4 - Impressao e produtividade

- Criar modo de impressao com filtros por pavimento/laje.
- Exibir consolidado de tempo total e tempo por funcionario.

## 9. Criterios de aceite (Definition of Done)

- Regra 1 tarefa Em andamento por funcionario e bloqueada corretamente.
- Retomar com roubo funciona apenas quando tarefa esta Pausada.
- Nunca ha 2 funcionarios vinculados simultaneamente na mesma tarefa.
- Tarefas com 3 etapas so finalizam na etapa 3.
- Arvore permite abrir varias lajes/atividades ao mesmo tempo.
- Admin consegue imprimir subconjunto selecionado de pavimentos/lajes.
- Dashboard de funcionario usa mesma hierarquia visual do admin.
- Relatorio de contribuicao por funcionario bate com soma de sessoes.

## 10. Casos de teste minimos

- Iniciar tarefa pendente sem sessao ativa previa.
- Bloquear iniciar segunda tarefa em paralelo para mesmo funcionario.
- Pausar por funcionario nao vinculado deve falhar.
- Retomar por outro funcionario em tarefa pausada deve transferir vinculo.
- Avancar etapa fora da ultima etapa deve funcionar.
- Finalizar antes da ultima etapa deve falhar.
- Finalizar na ultima etapa deve encerrar sessao ativa.
- Soma de contribuicao por funcionario deve bater com total da tarefa.

## 11. Backlog posterior

- Filtros no historico por funcionario, mes e edificio.
- Filtros de tempo por edificio/tarefa e por pessoa.

## 12. Contrato para execucao por LLM




contrato para implementacao automatizada:

```yaml
objetivo: Reestruturar fluxo de tarefas para modelo acao-orientado com arvore TQS-like

ordem_execucao:
    - fase_1_dominio_e_dados
    - fase_2_regras_e_api
    - fase_3_frontend_arvore
    - fase_4_impressao_e_relatorios

regras_inviolaveis:
    - um_funcionario_uma_tarefa_em_andamento
    - um_vinculo_por_tarefa
    - roubo_somente_pausada
    - finalizar_somente_ultima_etapa

acoes:
    - iniciar
    - pausar
    - retomar
    - avancar_etapa
    - finalizar

status_ciclo:
    - Pendente
    - Em andamento
    - Pausada
    - Finalizada

entregaveis_por_fase:
    fase_1_dominio_e_dados:
        - migracoes
        - ajustes_modelos
        - historico_expandido
    fase_2_regras_e_api:
        - servico_de_workflow
        - endpoints_por_acao
        - testes_de_regra
    fase_3_frontend_arvore:
        - expansao_multipla
        - colunas_compactas
        - acoes_contextuais
    fase_4_impressao_e_relatorios:
        - impressao_filtrada
        - consolidado_de_tempo

saida_esperada:
    - listar_arquivos_alterados
    - descrever_regras_implementadas
    - apresentar_testes_executados
    - apontar_riscos_pendentes
```

