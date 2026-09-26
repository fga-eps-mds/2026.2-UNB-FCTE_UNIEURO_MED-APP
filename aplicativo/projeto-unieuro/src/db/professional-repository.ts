import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

export type ProfessionalInsert = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  passwordHash: string;
  createdAt: string;
};

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
      const row = await database.getFirstAsync('SELECT 1 FROM profissional WHERE email = ? LIMIT 1', [
        email.trim(),
      ]);
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

    async insert(professional: ProfessionalInsert): Promise<void> {
      const database = await open();
      await database.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          professional.name,
          professional.email,
          professional.crmNumber,
          professional.crmState,
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
