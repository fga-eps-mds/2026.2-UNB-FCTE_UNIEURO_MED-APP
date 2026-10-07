/**
 * Esquema do banco SQLite do aplicativo.
 *
 * A versão 1 é o `dados/schema.sql` do repositório MED-IA (branch
 * `feat/database`), copiado para cá porque o Expo não executa o script Python
 * que cria o banco. As duas cópias precisam continuar iguais.
 */

export const DATABASE_NAME = 'med.db';

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS profissional (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    crm_numero TEXT NOT NULL,
    uf_crm TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criacao TEXT NOT NULL,
    last_update TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    UNIQUE (crm_numero, uf_crm),
    CHECK (length(trim(nome)) > 0),
    CHECK (length(trim(crm_numero)) > 0),
    CHECK (crm_numero NOT GLOB '*[^0-9]*'),
    CHECK (uf_crm GLOB '[A-Z][A-Z]'),
    CHECK (cpf GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CHECK (length(trim(senha_hash)) > 0)
);
`;

/**
 * Versão 2: data e hora da desativação da conta (#5). A conta desativada não é
 * apagada, porque os exames aplicados por ela são dados da pesquisa.
 */
const SCHEMA_V2 = `
ALTER TABLE profissional ADD COLUMN desativacao TEXT;
`;

/**
 * Cada posição leva o banco da versão anterior para a seguinte: a posição 0
 * cria a versão 1, a posição 1 criará a versão 2, e assim por diante. Para
 * mudar o esquema, acrescente um passo no fim; não altere os que já existem,
 * porque os tablets com o banco criado não os executam de novo.
 */
export const MIGRATIONS: readonly string[] = [SCHEMA_V1, SCHEMA_V2];

export const SCHEMA_VERSION = MIGRATIONS.length;
