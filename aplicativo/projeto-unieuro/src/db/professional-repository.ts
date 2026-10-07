import type { SQLiteDatabase } from 'expo-sqlite';

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

export type Professional = {
  id: number;
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  cpf: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  deactivatedAt: string | null;
};

export type ProfessionalProfile = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
};

type ProfessionalRow = {
  id: number;
  nome: string;
  email: string;
  crm_numero: string;
  uf_crm: string;
  cpf: string;
  senha_hash: string;
  criacao: string;
  last_update: string;
  ativo: number;
  desativacao: string | null;
};

const SELECT_PROFESSIONAL =
  'SELECT id, nome, email, crm_numero, uf_crm, cpf, senha_hash, criacao, last_update, ativo, desativacao FROM profissional';

const toProfessional = (row: ProfessionalRow): Professional => ({
  id: row.id,
  name: row.nome,
  email: row.email,
  crmNumber: row.crm_numero,
  crmState: row.uf_crm,
  cpf: row.cpf,
  passwordHash: row.senha_hash,
  createdAt: row.criacao,
  updatedAt: row.last_update,
  active: row.ativo === 1,
  deactivatedAt: row.desativacao,
});

/**
 * Acesso à tabela `profissional`. Atende ao `ProfessionalRepository` usado no
 * cadastro, às consultas de que o login precisa e ao `AccountRepository` da
 * manutenção da conta.
 *
 * A conexão é recebida como função para que os testes possam trocar o banco.
 * O e-mail é comparado sem diferenciar maiúsculas, pela `COLLATE NOCASE` da
 * coluna.
 */
export function createProfessionalRepository(open: () => Promise<SQLiteDatabase> = getDatabase) {
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
      const row = await database.getFirstAsync('SELECT 1 FROM profissional WHERE cpf = ? LIMIT 1', [
        cpf,
      ]);
      return row !== null;
    },

    async insert(professional: ProfessionalInsert): Promise<void> {
      const database = await open();
      await database.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf, senha_hash, criacao, last_update)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          professional.name,
          professional.email,
          professional.crmNumber,
          professional.crmState,
          professional.cpf,
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

    async emailInUseByOther(email: string, id: number): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE email = ? AND id <> ? LIMIT 1',
        [email.trim(), id],
      );
      return row !== null;
    },

    async crmInUseByOther(crmNumber: string, crmState: string, id: number): Promise<boolean> {
      const database = await open();
      const row = await database.getFirstAsync(
        'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? AND id <> ? LIMIT 1',
        [crmNumber, crmState, id],
      );
      return row !== null;
    },

    async updateProfile(id: number, profile: ProfessionalProfile, updatedAt: string) {
      const database = await open();
      await database.runAsync(
        `UPDATE profissional SET nome = ?, email = ?, crm_numero = ?, uf_crm = ?, last_update = ?
         WHERE id = ?`,
        [profile.name, profile.email, profile.crmNumber, profile.crmState, updatedAt, id],
      );
    },

    async updatePasswordHash(id: number, passwordHash: string, updatedAt: string) {
      const database = await open();
      await database.runAsync(
        'UPDATE profissional SET senha_hash = ?, last_update = ? WHERE id = ?',
        [passwordHash, updatedAt, id],
      );
    },

    /**
     * Desativa a conta sem apagar o registro: os exames aplicados por ela
     * continuam ligados ao profissional. Uma conta já desativada não muda.
     */
    async deactivate(id: number, deactivatedAt: string) {
      const database = await open();
      await database.runAsync(
        `UPDATE profissional SET ativo = 0, desativacao = ?, last_update = ?
         WHERE id = ? AND ativo = 1`,
        [deactivatedAt, deactivatedAt, id],
      );
    },
  };
}

export type SqliteProfessionalRepository = ReturnType<typeof createProfessionalRepository>;

export const professionalRepository = createProfessionalRepository();
