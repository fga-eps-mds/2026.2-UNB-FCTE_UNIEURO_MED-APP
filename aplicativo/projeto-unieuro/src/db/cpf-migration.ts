import type { SQLiteDatabase } from 'expo-sqlite';

import type { CpfProtector } from '@/db/cpf-protection';

type LegacyRow = {
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
};

/**
 * Tabela da versão 2: no lugar do CPF em texto, `cpf_cifrado` (recuperável) e
 * `cpf_indice` (busca e unicidade). Não há como alterar a coluna `cpf`, que
 * tem `UNIQUE` e `CHECK`, então a tabela é recriada.
 */
const SCHEMA_V2 = `
CREATE TABLE profissional_v2 (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    crm_numero TEXT NOT NULL,
    uf_crm TEXT NOT NULL,
    cpf_cifrado TEXT NOT NULL,
    cpf_indice TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criacao TEXT NOT NULL,
    last_update TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    UNIQUE (crm_numero, uf_crm),
    CHECK (length(trim(nome)) > 0),
    CHECK (length(trim(crm_numero)) > 0),
    CHECK (crm_numero NOT GLOB '*[^0-9]*'),
    CHECK (uf_crm GLOB '[A-Z][A-Z]'),
    CHECK (length(trim(cpf_cifrado)) > 0),
    CHECK (length(cpf_indice) = 64 AND cpf_indice NOT GLOB '*[^0-9a-f]*'),
    CHECK (length(trim(senha_hash)) > 0)
);
`;

/**
 * Passo da versão 2 do banco: troca o CPF em texto puro por CPF cifrado mais
 * índice, preservando os demais campos de cada profissional. Os valores
 * protegidos são calculados antes de qualquer alteração no banco, então uma falha
 * de cifra não deixa a tabela pela metade. Nenhuma outra tabela referencia
 * `profissional` na versão 1; uma tabela futura que o faça precisa ser tratada
 * antes de recriá-la.
 */
export async function protectStoredCpfs(
  database: SQLiteDatabase,
  protector: CpfProtector,
): Promise<void> {
  const rows = await database.getAllAsync<LegacyRow>(
    'SELECT id, nome, email, crm_numero, uf_crm, cpf, senha_hash, criacao, last_update, ativo FROM profissional',
  );

  const protectedRows = await Promise.all(
    rows.map(async (row) => ({
      row,
      cpfCifrado: await protector.encrypt(row.cpf),
      cpfIndice: await protector.blindIndex(row.cpf),
    })),
  );

  await database.execAsync(SCHEMA_V2);

  for (const { row, cpfCifrado, cpfIndice } of protectedRows) {
    await database.runAsync(
      `INSERT INTO profissional_v2
         (id, nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.nome,
        row.email,
        row.crm_numero,
        row.uf_crm,
        cpfCifrado,
        cpfIndice,
        row.senha_hash,
        row.criacao,
        row.last_update,
        row.ativo,
      ],
    );
  }

  await database.execAsync(
    'DROP TABLE profissional; ALTER TABLE profissional_v2 RENAME TO profissional;',
  );
}
