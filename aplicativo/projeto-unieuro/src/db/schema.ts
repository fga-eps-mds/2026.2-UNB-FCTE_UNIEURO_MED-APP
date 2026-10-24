/**
 * Esquema do banco SQLite do aplicativo.
 *
 * A versão 1 é o `dados/schema.sql` do repositório MED-IA (branch
 * `feat/database`), copiado para cá porque o Expo não executa o script Python
 * que cria o banco. A versão 2 troca o CPF em texto puro por CPF cifrado e índice
 * de busca, a versão 3 cria o paciente e o atendimento, a versão 4 registra a
 * desativação da conta e a versão 5 guarda a decisão do TCLE. Nenhuma delas existe
 * ainda no `schema.sql` do MED-IA: as
 * duas cópias divergem a partir da versão 2 até que o repositório MED-IA seja
 * atualizado.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { protectStoredCpfs } from '@/db/cpf-migration';
import type { CpfProtector } from '@/db/cpf-protection';

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
 * Versão 3: paciente e atendimento (#7). O paciente guarda o CPF no mesmo
 * formato do profissional (cifra e índice de busca), e o índice é `UNIQUE`
 * porque o paciente que volta é reaproveitado pelo CPF. A tabela se chama
 * `avaliacao`, como no modelo de dados da arquitetura: é o que a issue chama de
 * atendimento. O atendimento nasce aguardando o consentimento, porque a próxima
 * tela é o TCLE, e o `CHECK` já traz todos os estados da seção 5.2 da
 * arquitetura, já que o SQLite só altera um `CHECK` recriando a tabela.
 */
const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS paciente (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf_cifrado TEXT NOT NULL,
    cpf_indice TEXT NOT NULL UNIQUE,
    numero_ficha TEXT NOT NULL,
    data_nascimento TEXT NOT NULL,
    escolaridade_anos INTEGER NOT NULL,
    sexo TEXT,
    criacao TEXT NOT NULL,
    last_update TEXT NOT NULL,
    CHECK (length(trim(nome)) > 0),
    CHECK (length(trim(cpf_cifrado)) > 0),
    CHECK (length(cpf_indice) = 64 AND cpf_indice NOT GLOB '*[^0-9a-f]*'),
    CHECK (length(trim(numero_ficha)) > 0),
    CHECK (data_nascimento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (escolaridade_anos >= 0),
    CHECK (sexo IS NULL OR sexo IN ('feminino', 'masculino'))
);

CREATE TABLE IF NOT EXISTS avaliacao (
    id INTEGER PRIMARY KEY,
    id_profissional INTEGER NOT NULL REFERENCES profissional (id),
    id_paciente INTEGER NOT NULL REFERENCES paciente (id),
    data_hora_inicio TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'aguardando_consentimento',
    last_update TEXT NOT NULL,
    CHECK (estado IN (
        'aguardando_consentimento', 'em_andamento', 'processando_resultado',
        'erro_inferencia', 'concluida', 'cancelada', 'interrompida'
    ))
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_profissional ON avaliacao (id_profissional);
CREATE INDEX IF NOT EXISTS idx_avaliacao_paciente ON avaliacao (id_paciente);
`;

/**
 * Versão 4: data e hora da desativação da conta (#5). A conta desativada não é
 * apagada, porque os exames aplicados por ela são dados da pesquisa.
 */
const SCHEMA_V4 = `
ALTER TABLE profissional ADD COLUMN desativacao TEXT;
`;

/**
 * Versão 5: decisão do TCLE (#21). A chave única garante no banco a regra de um
 * único consentimento por avaliação. A linha não existe enquanto a pessoa ainda
 * não decidiu; nesse período, a avaliação permanece em
 * `aguardando_consentimento`.
 */
const SCHEMA_V5 = `
CREATE TABLE IF NOT EXISTS consentimento (
    id INTEGER PRIMARY KEY,
    id_avaliacao INTEGER NOT NULL UNIQUE REFERENCES avaliacao (id),
    versao_tcle TEXT NOT NULL,
    aceito INTEGER NOT NULL CHECK (aceito IN (0, 1)),
    assinado_por TEXT NOT NULL CHECK (assinado_por IN ('paciente', 'responsavel_legal')),
    data_hora TEXT NOT NULL,
    CHECK (length(trim(versao_tcle)) > 0),
    CHECK (length(trim(data_hora)) > 0)
);
`;

/**
 * Um passo é um script SQL ou, quando a mudança precisa de cálculo (como cifrar
 * dados já gravados), uma função que recebe o banco e o protetor de CPF.
 */
export type MigrationStep =
  | string
  | ((database: SQLiteDatabase, protector: CpfProtector) => Promise<void>);

/**
 * Cada posição leva o banco da versão anterior para a seguinte: a posição 0
 * cria a versão 1, a posição 1 leva à versão 2 (CPF protegido), a posição 2 à
 * versão 3 (paciente e atendimento), a posição 3 à versão 4 (desativação da
 * conta), a posição 4 à versão 5 (consentimento), e assim por diante. Para
 * mudar o esquema, acrescente um passo no fim;
 * não altere os que já existem, porque os tablets com o banco criado não os
 * executam de novo.
 */
export const MIGRATIONS: readonly MigrationStep[] = [
  SCHEMA_V1,
  protectStoredCpfs,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
