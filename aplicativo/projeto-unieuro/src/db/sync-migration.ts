/**
 * Versão 4: sincronização entre tablets. O `id` continua sendo a chave local e o
 * `uuid` identifica o registro entre tablets.
 *
 * - `dispositivo`: este tablet (`local = 1`) e os que já mandaram dados.
 * - `sync_contador`: último contador e último HLC deste tablet.
 * - `sync_vetor`: até que contador de cada tablet já foi recebido.
 * - `sync_log`: histórico de envios e recebimentos, sem dado pessoal.
 * - `sync_conflito`: versões perdedoras e registros em quarentena.
 * - `profissional_alias` e `paciente_alias`: uuids unificados.
 *
 * Os gatilhos marcam toda gravação local, para nada ficar fora da
 * sincronização. Gravação que já vem marcada de outro tablet não é remarcada.
 *
 * DELETE é bloqueado: um registro apagado voltaria na próxima sincronização.
 * Use exclusão lógica (`ativo`).
 *
 * Se uma migração futura recriar uma destas tabelas, recrie também os gatilhos.
 */

/** UUID v4 gerado em SQL. */
const SQL_UUID = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`;

const LOCAL_DEVICE = '(SELECT id FROM dispositivo WHERE local = 1)';

const NOW_MILLIS = `CAST(round((julianday('now') - 2440587.5) * 86400000) AS INTEGER)`;

/** HLC (formato de `hlc.ts`) a partir da data de uma coluna. */
const hlcFrom = (dateColumn: string) =>
  `printf('%015d', CAST(round((julianday(${dateColumn}) - 2440587.5) * 86400000) AS INTEGER))
    || '-000000-' || ${LOCAL_DEVICE}`;

// Mesma regra de `nextHlc` (hlc.ts): hora atual ou, se o relógio voltou, último HLC + 1.
const RESERVE_STAMP = `
    UPDATE sync_contador SET
        ultimo_seq = ultimo_seq + 1,
        ultimo_hlc = CASE
            WHEN ${NOW_MILLIS} > CAST(substr(ultimo_hlc, 1, 15) AS INTEGER)
                THEN printf('%015d-000000-%s', ${NOW_MILLIS}, origem_id)
            ELSE printf('%015d-%06d-%s', CAST(substr(ultimo_hlc, 1, 15) AS INTEGER),
                CAST(substr(ultimo_hlc, 17, 6) AS INTEGER) + 1, origem_id)
        END
    WHERE origem_id = ${LOCAL_DEVICE};`;

const CURRENT_STAMP = `
        versao_hlc = (SELECT ultimo_hlc FROM sync_contador WHERE origem_id = ${LOCAL_DEVICE}),
        origem_id = ${LOCAL_DEVICE},
        origem_seq = (SELECT ultimo_seq FROM sync_contador WHERE origem_id = ${LOCAL_DEVICE})`;

/**
 * `fields`: colunas que geram marca ao mudar. CPF cifrado e ficha ficam de fora
 * porque são locais.
 */
function syncTriggers(table: string, fields: string[]): string {
  return `
CREATE UNIQUE INDEX IF NOT EXISTS ${table}_uuid ON ${table} (uuid);

CREATE TRIGGER IF NOT EXISTS ${table}_exclusao_bloqueada
BEFORE DELETE ON ${table}
BEGIN
    SELECT RAISE(ABORT, '${table} sincronizado nao pode ser apagado; use a exclusao logica');
END;

CREATE TRIGGER IF NOT EXISTS ${table}_insercao_marcada
AFTER INSERT ON ${table}
WHEN NEW.versao_hlc IS NULL
BEGIN
    ${RESERVE_STAMP}
    UPDATE ${table} SET uuid = coalesce(NEW.uuid, ${SQL_UUID}), ${CURRENT_STAMP}
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS ${table}_alteracao_marcada
AFTER UPDATE OF ${fields.join(', ')} ON ${table}
WHEN NEW.versao_hlc IS OLD.versao_hlc
BEGIN
    ${RESERVE_STAMP}
    UPDATE ${table} SET ${CURRENT_STAMP}
    WHERE id = NEW.id;
END;
`;
}

const addSyncColumns = (table: string) => `
ALTER TABLE ${table} ADD COLUMN uuid TEXT;
ALTER TABLE ${table} ADD COLUMN versao_hlc TEXT;
ALTER TABLE ${table} ADD COLUMN origem_id TEXT;
ALTER TABLE ${table} ADD COLUMN origem_seq INTEGER;
`;

// Registros antigos viram gravações deste tablet. O contador é único para as três tabelas.
const stampExisting = (table: string, dateColumn: string, offset: string) => `
UPDATE ${table} SET
    uuid = ${SQL_UUID},
    origem_id = ${LOCAL_DEVICE},
    origem_seq = id + ${offset},
    versao_hlc = ${hlcFrom(dateColumn)}
WHERE uuid IS NULL;
`;

const MAX_PROFESSIONAL = '(SELECT coalesce(max(id), 0) FROM profissional)';
const MAX_PATIENT = '(SELECT coalesce(max(id), 0) FROM paciente)';
const MAX_ATTENDANCE = '(SELECT coalesce(max(id), 0) FROM avaliacao)';

export const SCHEMA_V4 = `
CREATE TABLE IF NOT EXISTS dispositivo (
    id TEXT PRIMARY KEY,
    apelido TEXT,
    local INTEGER NOT NULL DEFAULT 0 CHECK (local IN (0, 1)),
    criacao TEXT NOT NULL,
    revogado_em TEXT,
    CHECK (length(id) = 36)
);
CREATE UNIQUE INDEX IF NOT EXISTS dispositivo_um_local ON dispositivo (local) WHERE local = 1;

INSERT INTO dispositivo (id, local, criacao)
SELECT ${SQL_UUID}, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM dispositivo WHERE local = 1);

CREATE TABLE IF NOT EXISTS sync_contador (
    origem_id TEXT PRIMARY KEY REFERENCES dispositivo (id),
    ultimo_seq INTEGER NOT NULL DEFAULT 0 CHECK (ultimo_seq >= 0),
    ultimo_hlc TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sync_vetor (
    origem_id TEXT PRIMARY KEY,
    ultimo_seq_recebido INTEGER NOT NULL CHECK (ultimo_seq_recebido >= 0)
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY,
    direcao TEXT NOT NULL CHECK (direcao IN ('envio', 'recebimento')),
    par_id TEXT,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    enviados INTEGER NOT NULL DEFAULT 0,
    recebidos INTEGER NOT NULL DEFAULT 0,
    conflitos INTEGER NOT NULL DEFAULT 0,
    quarentena INTEGER NOT NULL DEFAULT 0,
    resultado TEXT NOT NULL CHECK (resultado IN ('sucesso', 'recusado', 'erro')),
    motivo TEXT
);

CREATE TABLE IF NOT EXISTS sync_conflito (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('versao_perdedora', 'quarentena')),
    tabela TEXT NOT NULL,
    registro_uuid TEXT NOT NULL,
    versao_hlc TEXT,
    motivo TEXT NOT NULL,
    dados TEXT NOT NULL,
    criacao TEXT NOT NULL,
    resolvido_em TEXT
);

CREATE TABLE IF NOT EXISTS profissional_alias (
    uuid_alias TEXT PRIMARY KEY,
    uuid_principal TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paciente_alias (
    uuid_alias TEXT PRIMARY KEY,
    uuid_principal TEXT NOT NULL
);

${addSyncColumns('profissional')}
${addSyncColumns('paciente')}
${addSyncColumns('avaliacao')}

${stampExisting('profissional', 'last_update', '0')}
${stampExisting('paciente', 'last_update', MAX_PROFESSIONAL)}
${stampExisting('avaliacao', 'last_update', `${MAX_PROFESSIONAL} + ${MAX_PATIENT}`)}

INSERT INTO sync_contador (origem_id, ultimo_seq, ultimo_hlc)
SELECT id,
    ${MAX_PROFESSIONAL} + ${MAX_PATIENT} + ${MAX_ATTENDANCE},
    coalesce((SELECT max(versao_hlc) FROM (
        SELECT versao_hlc FROM profissional
        UNION ALL SELECT versao_hlc FROM paciente
        UNION ALL SELECT versao_hlc FROM avaliacao)), '')
FROM dispositivo WHERE local = 1;

${syncTriggers('profissional', ['nome', 'email', 'crm_numero', 'uf_crm', 'senha_hash', 'ativo', 'criacao'])}
${syncTriggers('paciente', ['nome', 'data_nascimento', 'escolaridade_anos', 'sexo', 'criacao'])}
${syncTriggers('avaliacao', ['id_profissional', 'id_paciente', 'data_hora_inicio', 'estado'])}
`;
