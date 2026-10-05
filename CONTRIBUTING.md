# Guia de Contribuição

Este repositório contém o aplicativo Android do MED. As diretrizes abaixo se aplicam a qualquer alteração feita aqui.

Este guia trata de processo técnico. As expectativas de comportamento, respeito e inclusão valem igualmente para os três repositórios do projeto e estão no [Código de Conduta](https://github.com/fga-eps-mds/2026.2-UNB-FCTE_UNIEURO_MED-DOCS/blob/main/CODE_OF_CONDUCT.md), mantido no repositório de documentação.

## Padrão de Branch

A `develop` é a branch de integração, é dela que toda branch de trabalho sai e é para ela que todo Pull Request aponta. A `main` é a linha de release, ela recebe a `develop` apenas nas entregas de release major (R1, R2 e R3) e é o que o parceiro vê.

- `feat/nome-da-funcionalidade`
- `fix/nome-da-correcao`
- `chore/nome-da-tarefa`
- `docs/nome-do-documento`

Push direto em `main` e em `develop` não é permitido. Toda alteração passa por Pull Request.

## Padrão de Commits

Este repositório adota o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```
<tipo>(escopo opcional): descrição curta em português
```

| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade do aplicativo |
| `fix` | Correção de comportamento que não funcionava |
| `refactor` | Mesma lógica, estrutura refeita |
| `test` | Criação ou ajuste de testes |
| `chore` | Pipeline, dependências, configuração de build |
| `docs` | Documentação do repositório |

Exemplos:

```
feat(desenho): captura coordenadas e ordem do traçado
fix(login): corrige validação de senha no cadastro
chore(gradle): atualiza versão do plugin do Android
```

Commits atômicos: uma alteração lógica por commit.

## Testes

O projeto Expo fica em `aplicativo/projeto-unieuro`. Os comandos abaixo rodam a partir dessa pasta:

```bash
npm ci
npm test              # executa a suíte
npm run test:watch    # reexecuta a cada alteração
npm run test:coverage # gera o relatório em coverage/lcov.info
```

O runner é o Jest com o preset `jest-expo/android`, já que o produto roda apenas em tablet Android. A biblioteca de testes de componente é a Testing Library para React Native.

### Onde escrever

O arquivo de teste fica ao lado do arquivo testado, com o mesmo nome e o sufixo `.test.ts` ou `.test.tsx`:

```
src/features/auth/register-screen.tsx
src/features/auth/register-screen.test.tsx
```

### O que vale testar

- Prefira consultas por papel e por rótulo de acessibilidade, como `getByRole` e `getByLabelText`, em vez de detalhes de estilo. O público da avaliação tem 60 anos ou mais, então acessibilidade quebrada é defeito.
- Teste o comportamento observável: o que o usuário vê e o que acontece quando ele toca. Evite fixar detalhes internos que mudam sem mudar o comportamento.
- Nenhum teste pode depender de rede, de aparelho físico ou de dado real de paciente, pelas mesmas razões da seção de restrições do produto.

### Cobertura

O `jest.config.js` define um piso de cobertura, e o comando de cobertura falha abaixo dele. O piso sobe a cada release, acompanhando a cobertura real. Se uma alteração derrubar a cobertura, escreva o teste que falta em vez de baixar o piso.

## Antes de abrir o Pull Request

Na pasta `aplicativo/projeto-unieuro`, confirme localmente:

```bash
npm run lint -- --max-warnings 0   # nenhum erro nem aviso do ESLint
npm run format:check               # código no padrão do Prettier; corrija com npm run format
npm run test:coverage              # testes passando e cobertura acima do piso
```

O pipeline de build roda os mesmos comandos e reprova o PR se algum deles falhar.

## Pull Requests

- Todo PR deve estar vinculado a uma Issue:
  - em PR de **história de usuário**, use `Refs #numero`. A história só é fechada depois do aceite do PO no teste de aceitação, e o `Closes` a fecharia já no merge, porque a `develop` é a branch padrão do repositório;
  - em PR de tarefa ou de correção, use `Closes #numero`.
- O PR aponta para `develop`, não para `main`.
- Solicite revisão de no mínimo 1 colega antes do merge.
- O quality gate do SonarCloud precisa passar. PR com gate reprovado não é mergeado.
- PRs sem Issue vinculada não serão aceitos.

### Como revisar

- Não aprove um Pull Request sem ter lido e compreendido o que está sendo alterado.
- Mantenha o foco construtivo: aponte o problema concreto e, quando possível, sugira o caminho.
- Sem contexto para avaliar, peça a revisão de quem tem, em vez de aprovar por omissão.

## Fluxo com o Claude Code

Quem usa o [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) encontra neste repositório:

- o `CLAUDE.md`, com o resumo do produto, as regras da disciplina e as convenções de código;
- o comando `/nova-historia <número da issue>`, que conduz a história da validação ao PR, parando para você aprovar o plano e antes de qualquer push;
- os agentes `revisor-testes` e `revisor-lgpd`, para revisar o diff antes do PR.

O uso é opcional, e o checklist vale para todo mundo: história validada pelo PO, testes escritos por quem implementa, lint, formatação e testes passando, e revisão de um colega. Com ou sem IA, quem abre o PR precisa saber explicar cada trecho dele.

## Restrições do produto

O MED roda 100% offline no tablet e nenhum dado de paciente sai do dispositivo. Por isso, será recusado qualquer PR que:

- declare permissão de rede no `AndroidManifest.xml`;
- adicione SDK de telemetria, analytics ou crash reporting de terceiros;
- envie dado de atendimento, traçado ou imagem para fora do aparelho;
- registre em log qualquer identificação de paciente, traçado, imagem ou escore;
- exiba o escore na tela final do paciente.

Se uma biblioteca útil exigir rede como efeito colateral, registre isso no PR e proponha alternativa local.

## Histórico de Versões

| Versão | Descrição | Autor(es) | Data | Revisor(es) | Data de Revisão |
|---|---|---|---|---|---|
| 1.0 | Criação do Guia de Contribuição do repositório do aplicativo | [Artur Mendonça Arruda](https://github.com/ArtyMend07) | 19/09/2026 | [Lucas Mendonça Arruda](https://github.com/lucasarruda9), [Gabriel Lopes de Amorim](https://github.com/BrzGab) | 21/09/2026 |
| 1.1 | Inclusão da seção de testes, com comandos, convenção de arquivos e política de cobertura | [Thales Germano](https://github.com/thalesgvl) | 25/09/2026 | A definir | — |
| 1.2 | Inclusão do lint e da verificação de formatação na checagem antes do PR | [Vitor Carvalho Pereira](https://github.com/vcpVitor) | 04/10/2026 | | |
| 1.3 | Regra de `Refs` para histórias de usuário e seção do fluxo com o Claude Code | [Vitor Carvalho Pereira](https://github.com/vcpVitor) | 04/10/2026 | | |
