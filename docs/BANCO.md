# Banco de Dados

## Tabelas atuais

### historias

- id
- created_at
- titulo
- autor
- sinopse
- categoria
- capa_url

---

### capitulos

- id
- created_at
- historia_titulo
- capitulo_numero
- capitulo_titulo
- conteudo
- eh_vip

---

### perfis_leitores

- id
- email
- eh_vip
- vip_expira_em
- livros_comprados
- nome
- avatar_url
- historico_leitura

---

## Melhorias planejadas

- Migrar relacionamento para historia_id
- Criar tabela favoritos
- Criar tabela pagamentos
- Criar tabela comentarios
- Criar tabela notificacoes
- Criar tabela biblioteca