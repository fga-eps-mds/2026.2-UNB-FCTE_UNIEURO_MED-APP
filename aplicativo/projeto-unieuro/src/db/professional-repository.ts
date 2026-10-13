import type { SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';
import { cpfProtector } from '@/db/cpf-runtime';
import { getDatabase } from '@/db/database';

export type ProfessionalInsert = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  cpf: string;
  passwordHash: string;
  createdAt: string;
};

/** O CPF não faz parte da leitura comum: use `getCpf`, que o decifra sob demanda. */
export type Professional = {
  id: number;
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
};

type ProfessionalRow = {
  id: number;
  nome: string;
  email: string;
  crm_numero: string;
  uf_crm: string;
  senha_hash: string;
  criacao: string;
  last_update: string;
  ativo: number;
};

const SELECT_PROFESSIONAL =
  'SELECT id, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo FROM profissional';

const toProfessional = (row: ProfessionalRow): Professional => ({
  id: row.id,
  name: row.nome,
  email: row.email,
  crmNumber: row.crm_numero,
  crmState: row.uf_crm,
  passwordHash: row.senha_hash,
  createdAt: row.criacao,
  updatedAt: row.last_update,
  active: row.ativo === 1,
});

/**
 * Acesso à tabela `profissional`. Atende ao `ProfessionalRepository` usado no
 * cadastro e oferece as consultas de que o login precisa.
 *
 * A conexão e o protetor de CPF são recebidos como parâmetro para que os testes
 * possam trocá-los. O e-mail é comparado sem diferenciar maiúsculas, pela
 * `COLLATE NOCASE` da coluna. O CPF nunca é gravado em texto: o banco guarda o
 * CPF cifrado e um índice de busca, e a checagem de duplicidade usa o índice.
 */
export function createProfessionalRepository(
  open: () => Promise<SQLiteDatabase> = getDatabase,
  protector: CpfProtector = cpfProtector,
) {
  const findFirst = async (where: string, ...params: (string | number)[]) => {
    const database = await open();
    const row = await database.getFirstAsync<ProfessionalRow>(
      `${SELECT_PROFESSIONAL} WHERE ${where} LIMIT 1`,
      params,
    );
    return row ? toProfessional(row) : null;
  };

  return {
    async emailExists(email: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE email = ? LIMIT 1',
        [email.trim()],
      );
      return row !== null;
    },

    async crmExists(crmNumber: string, crmState: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? LIMIT 1',
        [crmNumber, crmState],
      );
      return row !== null;
    },

    async cpfExists(cpf: string): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE cpf_indice = ? LIMIT 1',
        [await protector.blindIndex(cpf)],
      );
      return row !== null;
    },

    async getCpf(id: number): Promise<string | null> {
      const database = await open();
      const row = await database.getFirstAsync<{ cpf_cifrado: string }>(
        'SELECT cpf_cifrado FROM profissional WHERE id = ? LIMIT 1',
        [id],
      );
      return row ? protector.decrypt(row.cpf_cifrado) : null;
    },

    async insert(professional: ProfessionalInsert): Promise<void> {
      const database = await open();
      const [cpfCifrado, cpfIndice] = await Promise.all([
        protector.encrypt(professional.cpf),
        protector.blindIndex(professional.cpf),
      ]);
      await database.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          professional.name,
          professional.email,
          professional.crmNumber,
          professional.crmState,
          cpfCifrado,
          cpfIndice,
          professional.passwordHash,
          professional.createdAt,
          professional.createdAt,
        ],
      );
    },

    findByEmail(email: string): Promise<Professional | null> {
      return findFirst('email = ?', email.trim());
    },

    findById(id: number): Promise<Professional | null> {
      return findFirst('id = ?', id);
    },
  };
}

export type SqliteProfessionalRepository = ReturnType<typeof createProfessionalRepository>;

export const professionalRepository = createProfessionalRepository();
