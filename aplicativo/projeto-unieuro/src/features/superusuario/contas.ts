import { formatCrm } from '@/features/auth/session';
import type { ExamTone } from '@/features/home/patients';
import { normalize } from '@/features/shared/busca';

/**
 * Conta de profissional como o repositório entrega para a área do superusuário.
 * Espelha a `ProfessionalAccount` do banco, que esta camada não importa.
 */
export type ContaProfissional = {
  id: number;
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  active: boolean;
  superuser: boolean;
  examCount: number;
};

export type ContasRepository = {
  /** Só responde a um superusuário com a conta ativa, já para os demais a lista vem vazia. */
  listAccounts(requesterId: number): Promise<ContaProfissional[]>;
};

export type SituacaoConta = 'ativa' | 'desativada' | 'superusuario';

export const SITUACAO_LABEL: Record<SituacaoConta, string> = {
  ativa: 'Ativa',
  desativada: 'Desativada',
  superusuario: 'Superusuário',
};

/** Cor do selo. Verde/amarelo/azul */
export const SITUACAO_TONE: Record<SituacaoConta, ExamTone> = {
  ativa: 'success',
  desativada: 'warning',
  superusuario: 'info',
};

/** Uma linha da tabela de contas. */
export type LinhaConta = {
  id: number;
  nome: string;
  email: string;
  /** CRM no formato certo "12345/DF". */
  crm: string;
  situacao: SituacaoConta;
  exames: number;
  /** "Desativar conta" só aparece para médico com a conta ativa. */
  podeDesativar: boolean;
  /** "Redefinir senha" também: a senha do superusuário se troca nas configurações. */
  podeRedefinirSenha: boolean;
};

// Uma conta desativada aparece como desativada mesmo que seja de superusuário.
export function situacaoDa({ active, superuser }: ContaProfissional): SituacaoConta {
  if (!active) return 'desativada';
  return superuser ? 'superusuario' : 'ativa';
}

export function toLinhaConta(conta: ContaProfissional): LinhaConta {
  return {
    id: conta.id,
    nome: conta.name,
    email: conta.email,
    crm: formatCrm(conta),
    situacao: situacaoDa(conta),
    exames: conta.examCount,
    podeDesativar: conta.active && !conta.superuser,
    podeRedefinirSenha: conta.active && !conta.superuser,
  };
}

/**
 * Busca por nome, do CRM ou e-mail, sem diferenciar
 * acentos nem maiúsculas. Sem texto, devolve todas as contas.
 */
export function filtrarContas(linhas: readonly LinhaConta[], busca: string): LinhaConta[] {
  const termo = normalize(busca);
  if (!termo) return [...linhas];
  return linhas.filter((linha) =>
    [linha.nome, linha.crm, linha.email].some((campo) => normalize(campo).includes(termo)),
  );
}
