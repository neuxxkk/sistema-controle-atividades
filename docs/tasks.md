# Restruturação do sistema

## Buscar se asemelhar com padrão de árvores do TQS (exibição, lógica e estrutura)

## Hierarquia e fluxo de tarefas e status

### Hierarquia de tarefas
***Edificio***
    **Único por edificio:** todas possuem somente uma unica etapa
        - Grelha Refinada
        - Bloco de fundação
        - Cortina
        - Escada
        - Rampa
    **Por Pavimento**: 
        - Vigas: possui 3 etapas de desenvolvimento
            1. Gerar Desenhos
            2. Rascunho
            3. Montar formato (Atender comentário e montar formato)
        - Lajes: possui 3 etapas de desenvolvimento
            1. Elaboração inicial
            2. Correção
            3. Montar formato (Atender comentário e montar formato)

### Status
    - Pendente: Não foi iniciado por ninguém
    - Fazendo/Em andamento: em qualquer que seja a etapa, estão em andamento.
    - Pausada: Toda tarefa em andamento pode ser pausada
    - Finalizado/OK: Apos a ultima etapa sao marcadas como finalizadas

### Ações
    - Iniciar tarefa: deve estar pendente
    - Pausar tarefa: deve estar em andamento pelo proprio funcionario.
    - Retomar tarefa: deve estar pausada, funcionario pode "roubar" vinculo.
    - Avançar para proxima etapa/finalizar etapa: deve estar ou pausada por qualquer um ou em andamento pelo proprio funcionario e não estar na ultima etapa
    - Finalizar: deve estar ou pausada ou em andamento (pelo proprio funcionario) e na ultima etapa

## Regras de negócio
    - Um funcionário só pode ter uma tarefa em andamento por vez
    - Somente um funcionario pode estar vinculado a uma tarefa
    - Um funcionario pode iniciar/retomar outra tarefa enquanto tem uma ou mais pausadas.
    - Caso uma tarefa seja executada por 2 ou mais funcionarios, o sitema deve registrar quanto tempo foi gasto ate a conclusao da tarefa e quanto tempo cada funcionario contribuiu para isso.
    - O funcionário pode "roubar" o vinculo da tarefa somente se ela estiver pausada nunca quando em andamento 

## Refatoração no frontend

### Visualização de tarefas nos edificios
    - Usar de inspiração exibição modelo arvore de edificios do programa TQS
    - Compactar visualização, mas manter visual profissional e moderno (usuário final tem familiaridade com excel, linhas compactas)
    - Implementar opção para abrir visualização (buttons empilhados verticalmente simulando dropbox) todas as lajes e atividades do edificio de uma vez só (atualmente nao é permitido abrir mais de uma)
    - Arvore de exibição deve seguir hierarquia (edificio -> Pavimentos -> Lajes/Vigas/escadas/...)

### Informações exibidas
    - Nome da contrutora deve estar embutido no nome do edficio, ex: Anima - Ed Major
    - Nas tarefas:
        * Status da tarefa
        * Etapa em que se encontra no caso de vigas e lajes.
        * Funcionario vinculado: quando em andamento ou pausado.
        * Ação permitida naquele status.


### Página edificios admin
    - Visualização de tarefas nos edificios
    - Opção de impressão com filtro de lajes e pavimentos (imprimir selecionados) com vizualização semelhante a do excel.
    - A ideia é que o admin tenha uma visão geral amigável das tarefas e de seus status 

###  Página dashboard funcionários
    - Vizualização identica à do admin, porem mantendo permissoes e restrições.


## Para depois
    - Filtro no historico de tarefas: role funcionario
        * mes, predio, pesquisa

    - Filtro de tempo por edificio/tarefa e por pessoa 

