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

## Antes de abrir o Pull Request

Confirme localmente que o projeto compila e que os testes passam.

## Pull Requests

- Todo PR deve estar vinculado a uma Issue. Use `Closes #numero` na descrição.
- O PR aponta para `develop`, não para `main`.
- Solicite revisão de no mínimo 1 colega antes do merge.
- O quality gate do SonarCloud precisa passar. PR com gate reprovado não é mergeado.
- PRs sem Issue vinculada não serão aceitos.

### Como revisar

- Não aprove um Pull Request sem ter lido e compreendido o que está sendo alterado.
- Mantenha o foco construtivo: aponte o problema concreto e, quando possível, sugira o caminho.
- Sem contexto para avaliar, peça a revisão de quem tem, em vez de aprovar por omissão.

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
| 1.0 | Criação do Guia de Contribuição do repositório do aplicativo | [Artur Mendonça Arruda](https://github.com/ArtyMend07) | 19/09/2026 | | |
