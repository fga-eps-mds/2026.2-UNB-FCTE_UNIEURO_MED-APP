# CLAUDE.md — MED (aplicativo)

O Claude Code lê este arquivo automaticamente em toda sessão aberta neste
repositório. Ele resume o produto, as regras de processo da disciplina e as
convenções de código. Quem mudar uma convenção atualiza este arquivo no mesmo PR.

## 1. O produto

- O MED é um aplicativo Android para rastreio cognitivo de idosos por testes de
  desenho (relógio, cubo e uma figura geométrica ainda a confirmar com o cliente),
  com escore calculado por um modelo de IA embarcado.
- Parceria UnB FCTE e UniEuro, na disciplina Engenharia de Produto de Software
  (EPS 2026.2). *Product Owner*: prof. Vinícius Rispoli. Cliente: Dr. Arthur Dutra
  do Bomfim. Professor da disciplina: Hilmer Neri.
- Roda **100% offline** num tablet Android comum. Nenhum dado sai do aparelho
  automaticamente.
- O paciente não faz login e **nunca vê o escore**.
- Repositórios: este (aplicativo), `-IA` (treino do modelo, fora do tablet) e
  `-DOCS` (documentação, atas e dashboard). Visão do produto, arquitetura e backlog:
  https://fga-eps-mds.github.io/2026.2-UNB-FCTE_UNIEURO_MED-DOCS/

## 2. Processo: regras da disciplina

Estas regras vêm da avaliação da R1 (Ata 08, 02/10/2026) e valem para todo PR.

1. **Só implemente história validada pelo PO.** A issue precisa do rótulo
   `validada pelo PO`. Sem ele, pare e avise: a validação é pedida no Discord, com o
   link da issue.
2. Fluxo de cada história: plano aprovado por uma pessoa → testes junto com o
   código → implementação → lint, formatação e suíte completa → revisão pelos
   agentes → commit → PR revisado por um colega.
3. **Quem implementa escreve os testes do próprio código.** Teste unitário faz parte
   da implementação, não é uma etapa depois dela.
4. **A história só fecha depois do aceite do PO**, no teste de aceitação. Por isso o
   PR de história usa `Refs #N`, nunca `Closes #N`: a `develop` é a branch padrão e o
   `Closes` fecharia a história no merge. Tarefa e correção podem usar `Closes`.
5. Depois do merge, a história vai para a coluna **Aceitação PO** do ZenHub, e os
   cenários dela entram no instrumento de teste de aceitação da próxima entrega.
6. Pontos de estimativa ficam só em histórias de usuário, nunca em tarefas.
7. Decisões e dúvidas ficam registradas em comentário na issue ou no PR. O professor
   avalia a comunicação pelo repositório.
8. Quem abre o PR precisa conseguir explicar qualquer trecho dele numa revisão
   síncrona. Antes de abrir, leia o diff inteiro.
9. O Claude não faz push, não abre nem aprova PR, não mescla e não fecha issue por
   conta própria: ele prepara tudo e pede confirmação.

## 3. Arquitetura

- Estilo: **monólito modular em camadas** (documento de arquitetura, seção 3).
  Camadas, de cima para baixo: apresentação → aplicação → domínio e processamento →
  infraestrutura local. Cada camada só depende das que estão abaixo dela.
- Módulos previstos: `acesso`, `avaliacao`, `captura`, `inferencia`, `exportacao` e
  `db`. No código atual existem `src/features/auth` (o módulo de acesso) e `src/db`.
- Estrutura de `aplicativo/projeto-unieuro/src`:
  - `app/`: rotas do Expo Router (apresentação);
  - `features/<módulo>/`: telas, estilos e regras do módulo;
  - `db/`: SQLite (schema, migrations e repositórios);
  - `constants/` e `hooks/`: tema e utilidades.
- **Regra de camadas:** arquivos de `src/app` e componentes de tela não importam
  `@/db`. Eles recebem o que precisam do módulo da feature. Hoje
  `src/app/index.tsx` e `src/app/register.tsx` quebram essa regra, e a correção está
  pendente: não copie esse padrão.
- Banco: SQLite via `expo-sqlite`. As migrations ficam em `src/db/schema.ts`, na
  lista `MIGRATIONS`. Nunca edite uma migration já publicada; crie uma nova.
- Os repositórios recebem por injeção a função que abre o banco
  (`createProfessionalRepository(open)`), o que permite testá-los com banco real.

## 4. Dados sensíveis (LGPD e protocolo médico)

- São sensíveis: CPF e dados do profissional; nome, ficha, nascimento e escolaridade
  do paciente; traçados, imagens e escores.
- Senha: só com `hashPassword` e `verifyPassword`, de
  `src/features/auth/password.ts` (PBKDF2-SHA256, sal aleatório, 100 mil iterações).
  Nunca grave senha em texto nem crie outro esquema de hash.
- Identificadores como o CPF devem ser gravados cifrados. O CPF ainda está em texto
  puro (pendência conhecida): não amplie o problema gravando novos identificadores
  em texto puro.
- SQL sempre com parâmetros (`?`), nunca concatenando valores.
- A exportação em XML só acontece por comando explícito do profissional.
- Proibido (ver `CONTRIBUTING.md`, "Restrições do produto"): permissão de rede, SDK
  de telemetria ou analytics, envio de dado para fora do aparelho, log de
  identificação de paciente, traçado, imagem ou escore, e escore na tela do paciente.
- O APK de entrega não declara a permissão de internet: o `app.config.js` bloqueia as
  permissões sem uso nos perfis `preview` e `production`. O backup automático do
  Android e a transferência entre aparelhos ficam desligados em todos os builds
  (`android.allowBackup` e `plugins/with-data-extraction-rules.js`). Permissão nova
  precisa de justificativa no PR.
- A sincronização entre tablets está em estudo. Qualquer canal de sincronização é um
  ponto de exposição de dados e precisa ser discutido com o PO antes de implementado.

## 5. Testes

- Jest com o preset `jest-expo/android` e Testing Library para React Native. O
  arquivo de teste fica ao lado do testado, com sufixo `.test.ts` ou `.test.tsx`.
- Cada cenário BDD da história vira pelo menos um teste, com o nome do cenário.
- Teste de integração (tela → regra → banco) usa SQLite real, sem mock do
  repositório. Ainda não existe adaptador de SQLite real para o Jest: a primeira
  história que precisar cria esse suporte (por exemplo, um banco em memória com a
  mesma interface do `expo-sqlite`), e as seguintes reutilizam.
- O `jest.config.js` define o piso de cobertura (90% de instruções, linhas e
  funções; 80% de ramos). Não baixe o piso: escreva o teste que falta.
- Prefira consultas por papel e rótulo de acessibilidade. O público tem 60 anos ou
  mais, e acessibilidade quebrada é defeito.
- Nenhum teste depende de rede, de aparelho físico ou de dado real de paciente.

## 6. Comandos

Na pasta `aplicativo/projeto-unieuro`:

```bash
npm ci                             # instala as dependências
npm test                           # roda a suíte
npm run test:coverage              # cobertura e relatório de execução para o SonarCloud
npm run lint -- --max-warnings 0   # ESLint, sem erro nem aviso
npm run format                     # formata com o Prettier
npm run format:check               # confere a formatação
```

O workflow `build.yml` roda lint, formatação, testes e SonarCloud em todo PR. O
`release.yml` gera uma release a cada merge na `develop` ou na `main`, com o `.json`
das métricas anexado; o rótulo do PR define a versão (`MAJOR RELEASE`,
`MINOR RELEASE`, sem rótulo para correção, `NOT RELEASE` para não gerar).

## 7. Branches, commits e PRs

- Toda branch sai da `develop` e todo PR aponta para ela. Push direto em `develop` ou
  `main` não é permitido.
- Nomes: `feat/<issue>-<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`,
  `test/<slug>`.
- Commits em Conventional Commits, em português (`feat(cadastro): ...`). Um commit
  por alteração lógica.
- PR com revisão de pelo menos um colega e quality gate do SonarCloud aprovado.

## 8. Fluxo com o Claude Code

- `/nova-historia <número da issue>` conduz o fluxo da seção 2, com paradas para
  aprovação humana.
- Agentes de revisão, usados antes do PR: `revisor-testes` (testes e cobertura) e
  `revisor-lgpd` (dados sensíveis, funcionamento offline e camadas).
