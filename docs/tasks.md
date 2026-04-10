# INSTALACAO NO SERVIDOR (TRUENAS SCALE)

## 1. Preparar servidor (TrueNAS)
1. Acesse via System Settings > Shell (Shell Browser) ou via SSH.
2. Nao use apt no TrueNAS SCALE.
3. Atualize o sistema somente pela interface web do TrueNAS em System Settings > Update.
4. Garanta que o recurso Apps esteja configurado no TrueNAS (dataset de apps e catalogo ativos).

## 2. Validar ambiente de execucao no TrueNAS
1. Verifique se git esta disponivel:

```bash
git --version
```

2. Verifique se docker e docker compose estao disponiveis no host:

```bash
docker --version
docker compose version
```

3. Se docker compose nao estiver disponivel no host, use o deploy pelo menu Apps do TrueNAS (Custom App) em vez de shell.

## 3. Clonar projeto no servidor
1. Escolha pasta de deploy:

```bash
mkdir -p ~/apps && cd ~/apps
```

2. Clone o repositorio:

```bash
git clone <URL_DO_REPOSITORIO> sistema-controle-atividades
cd sistema-controle-atividades
```

## 4. Configurar variaveis de ambiente
1. Crie arquivo .env na raiz do projeto:

```bash
cat > .env << 'EOF'
DB_PASSWORD=troque_esta_senha_forte
EOF
```

2. Se for expor para outras maquinas da rede, ajuste no frontend a URL publica da API em [docker-compose.yml](docker-compose.yml):
   NEXT_PUBLIC_API_URL deve apontar para o IP do NAS, por exemplo http://192.168.0.50:8000.

## 5. Subir stack com Docker Compose (quando disponivel)
1. Build + start dos servicos:

```bash
docker compose up -d --build
```

2. Verificar containers:

```bash
docker compose ps
```

## 6. Aplicar migracoes do banco
1. Rode upgrade alembic dentro do container da API:

```bash
docker compose exec api alembic upgrade head
```

2. Conferir revisao atual:

```bash
docker compose exec api alembic current
```

## 7. Validar funcionamento inicial
1. Health da API:

```bash
curl http://localhost:8000/
```

2. Endpoint de dashboard:

```bash
curl http://localhost:8000/api/dashboard/progresso
```

3. Acessar frontend no navegador:

```text
http://IP_DO_NAS:3000
```

## 8. Seed inicial (opcional)
1. Para popular dados de teste:

```bash
docker compose exec api python /app/seed_mock_real.py
```

2. Se quiser ambiente limpo antes do seed, use com cuidado:

```bash
docker compose exec api python /app/cleanup_db.py
docker compose exec api alembic upgrade head
docker compose exec api python /app/seed_mock_real.py
```

## 9. Primeiro bootstrap de acesso
1. Garanta que exista ao menos 1 usuario admin ativo.
2. Faça o primeiro acesso com nome de admin para cadastrar a primeira maquina.
3. Depois disso, os funcionarios podem usar o fluxo de primeiro acesso normalmente.

## 10. Operacao e manutencao
1. Ver logs da API:

```bash
docker compose logs -f api
```

2. Ver logs do frontend:

```bash
docker compose logs -f frontend
```

3. Atualizar sistema em nova versao:

```bash
cd ~/apps/sistema-controle-atividades
git pull
docker compose up -d --build
docker compose exec api alembic upgrade head
```

4. Backup rapido do banco PostgreSQL:

```bash
docker compose exec db pg_dump -U formula formula_db > backup_formula_db.sql
```

## 11. Checklist final de go-live
1. .env configurado com senha forte.
2. Containers db, api e frontend em status Up.
3. Migracoes aplicadas (alembic current no head).
4. Frontend acessivel na rede local.
5. Primeiro acesso admin realizado com sucesso.
6. Funcionario consegue primeiro acesso e auto login no mesmo dispositivo.

## 12. Alternativa sem Docker Compose no shell (Apps do TrueNAS)
1. Abra Apps no painel web do TrueNAS.
2. Crie apps para banco, API e frontend (ou use Custom App com as mesmas imagens e variaveis do docker-compose.yml).
3. Configure os mesmos parametros:
  - Banco PostgreSQL com usuario formula, database formula_db e senha igual ao DB_PASSWORD.
  - API com DATABASE_URL apontando para o servico do banco.
  - Frontend com NEXT_PUBLIC_API_URL apontando para o IP/porta publica da API.
4. Exponha portas equivalentes:
  - API: 8000
  - Frontend: 3000
5. Aplique migracoes executando no container da API:

```bash
docker exec -it <container_api> alembic upgrade head
```

