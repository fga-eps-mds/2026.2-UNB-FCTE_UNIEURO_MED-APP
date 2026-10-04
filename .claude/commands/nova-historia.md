---
description: Conduz uma história de usuário do MED do início ao fim — validação, plano, testes, implementação, revisão e PR
argument-hint: <número da issue no APP, por exemplo 7>
---

# Fluxo de história — #$ARGUMENTS

Conduza o fluxo da seção 2 do `CLAUDE.md` para a issue **#$ARGUMENTS** do
repositório `fga-eps-mds/2026.2-UNB-FCTE_UNIEURO_MED-APP`. Siga as etapas na ordem,
sem pular nenhuma, e pare para confirmação humana nos pontos marcados com
**[PARAR]**.

Se `$ARGUMENTS` estiver vazio ou não for um número, pergunte qual issue trabalhar.

## 1. Buscar a história e conferir a validação

- Rode `gh issue view $ARGUMENTS --repo fga-eps-mds/2026.2-UNB-FCTE_UNIEURO_MED-APP --json title,body,labels,state,comments`.
- Confirme que é uma história de usuário (título `[USER STORY]` ou rótulo `US`). Se
  for tarefa ou bug, avise: este fluxo é para histórias.
- **Se a issue não tiver o rótulo `validada pelo PO`, pare.** Explique que, pela regra
  da disciplina, a história só vai para o código depois da validação do PO, pedida
  no Discord com o link da issue. Só continue se a pessoa confirmar que a validação
  aconteceu, e peça que ela coloque o rótulo.
- Leia a história, os cenários BDD, as regras, os protótipos anexados e as
  observações técnicas. Se um critério estiver ambíguo ou não puder ser testado,
  pare e pergunte: não suponha o escopo.
- Se algum cenário depender de algo que ainda não existe (por exemplo, o fluxo dos
  desenhos), diga quais cenários ficam fora desta entrega.

## 2. Preparar a branch

- Confira `git status` e a branch atual. Se houver trabalho em andamento que não é
  desta história, avise antes de trocar de branch e não descarte nada.
- Atualize a `develop` (`git fetch origin`, `git switch develop`,
  `git pull --ff-only`) e crie `feat/$ARGUMENTS-<slug>` a partir dela. O slug sai do
  título: minúsculas, hífens, sem acento.

## 3. Plano **[PARAR]**

- Entre em Plan Mode antes de tocar em qualquer arquivo.
- Proponha um plano concreto:
  - os arquivos a criar ou alterar, por camada (seção 3 do `CLAUDE.md`);
  - o teste de cada cenário BDD, com o nome que ele vai ter;
  - se a mudança precisa de migration nova;
  - quais dados sensíveis são tocados e como ficam protegidos (seção 4);
  - o que fica fora desta entrega.
- Peça aprovação com `ExitPlanMode`. Não implemente sem a aprovação explícita.

## 4. Testes junto com a implementação

- Escreva o teste de cada cenário antes ou junto do código, nunca depois.
- Se a mudança tocar no banco, inclua pelo menos um teste de integração com SQLite
  real (seção 5 do `CLAUDE.md`).

## 5. Implementar

- Siga as camadas e as regras de dados sensíveis do `CLAUDE.md`.
- Não traga dependência, padrão ou abstração nova sem alinhar com a pessoa antes.

## 6. Verificar

Na pasta `aplicativo/projeto-unieuro`, rode e deixe tudo passando:

- `npm run lint -- --max-warnings 0`
- `npm run format:check` (para corrigir: `npm run format`)
- `npm run test:coverage`, com a cobertura acima do piso do `jest.config.js`

## 7. Revisar

- Rode os agentes `revisor-testes` e `revisor-lgpd` sobre o diff da história
  (`git diff develop...HEAD`).
- Resolva o que eles marcarem como bloqueante. Os demais achados, discuta com a
  pessoa.

## 8. Commit e PR **[PARAR]**

- Faça os commits em Conventional Commits, em português (ver `CONTRIBUTING.md`).
- **Não faça push nem abra o PR.** Apresente:
  - o resumo do que foi feito e a lista de arquivos;
  - o comando de push sugerido;
  - o título e o corpo sugeridos para o PR, com `Refs #$ARGUMENTS` (nunca `Closes`),
    como cada critério de aceitação foi atendido e testado, e um roteiro curto de
    teste manual (passos e resultado esperado) para o instrumento de aceitação do PO.
- Lembre a pessoa de:
  - ler o diff inteiro antes de abrir o PR, porque ela precisa saber explicar cada
    trecho;
  - pedir a revisão de um colega e mover o card para Review/QA no ZenHub;
  - depois do merge, mover a história para **Aceitação PO**, sem fechá-la.
