/**
 * Versão 9: sincronização entre tablets. O `id` continua sendo a chave local e o
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
 * Use exclusão lógica: `ativo = 0` e a data em `desativacao` (profissional) ou
 * `exclusao` (paciente e avaliação). A exclusão é uma alteração comum e viaja.
 *
 * A avaliação viaja inteira e só depois de finalizada (concluída, interrompida ou
 * cancelada). Consentimento, tarefas, desenhos e traçado vão junto dela e não têm
 * marca própria. Finalizada, ela não muda mais, nem as tabelas ligadas a ela: só a
 * exclusão lógica continua possível. Por isso o fluxo que conclui a avaliação
 * precisa gravar os desenhos antes de mudar o estado. `recebimento_pendente` só é
 * 1 enquanto a sincronização grava uma avaliação recebida e as tabelas dela.
 *
 * Se uma migração futura recriar uma destas tabelas, recrie também os gatilhos.
 */

/** Estados em que a avaliação viaja e não muda mais. */
export const FINAL_ATTENDANCE_STATES = ['concluida', 'interrompida', 'cancelada'] as const;

const FINAL_STATES_SQL = FINAL_ATTENDANCE_STATES.map((state) => `'${state}'`).join(', ');

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

const addLogicalDeletion = (table: string) => `
ALTER TABLE ${table} ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1));
ALTER TABLE ${table} ADD COLUMN exclusao TEXT;
`;

/** Avaliação finalizada e já gravada por inteiro. */
const isClosed = (alias: string) =>
  `${alias}.estado IN (${FINAL_STATES_SQL}) AND ${alias}.recebimento_pendente = 0`;

const closedAttendance = (idColumn: string) =>
  `EXISTS (SELECT 1 FROM avaliacao a WHERE a.id = ${idColumn} AND ${isClosed('a')})`;

const closedAttendanceOfTask = (taskColumn: string) => `EXISTS (
    SELECT 1 FROM tarefa t JOIN avaliacao a ON a.id = t.id_avaliacao
    WHERE t.id = ${taskColumn} AND ${isClosed('a')})`;

/** Recusa a gravação em `table` quando `when` diz que a avaliação já foi finalizada. */
const lockTrigger = (table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', when: string) => `
CREATE TRIGGER IF NOT EXISTS ${table}_${event.toLowerCase()}_avaliacao_finalizada
BEFORE ${event} ON ${table}
WHEN ${when}
BEGIN
    SELECT RAISE(ABORT, '${table} de avaliacao finalizada nao pode mudar');
END;
`;

const FINALIZED_ATTENDANCE_LOCK = `
CREATE TRIGGER IF NOT EXISTS avaliacao_finalizada_imutavel
BEFORE UPDATE OF id_profissional, id_paciente, data_hora_inicio, estado ON avaliacao
WHEN ${isClosed('OLD')} AND (
    NEW.id_profissional IS NOT OLD.id_profissional OR NEW.id_paciente IS NOT OLD.id_paciente
    OR NEW.data_hora_inicio IS NOT OLD.data_hora_inicio OR NEW.estado IS NOT OLD.estado)
BEGIN
    SELECT RAISE(ABORT, 'avaliacao finalizada nao pode mudar');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_recebimento_nao_reabre
BEFORE UPDATE OF recebimento_pendente ON avaliacao
WHEN OLD.recebimento_pendente = 0 AND NEW.recebimento_pendente = 1
BEGIN
    SELECT RAISE(ABORT, 'avaliacao finalizada nao pode mudar');
END;

-- O consentimento pode entrar numa avaliação já cancelada: a recusa do TCLE muda o
-- estado e grava a decisão na mesma transação. A chave única impede um segundo.
${lockTrigger('consentimento', 'UPDATE', closedAttendance('OLD.id_avaliacao'))}
${lockTrigger('consentimento', 'DELETE', closedAttendance('OLD.id_avaliacao'))}

${lockTrigger('tarefa', 'INSERT', closedAttendance('NEW.id_avaliacao'))}
${lockTrigger('tarefa', 'UPDATE', `${closedAttendance('OLD.id_avaliacao')} OR ${closedAttendance('NEW.id_avaliacao')}`)}
${lockTrigger('tarefa', 'DELETE', closedAttendance('OLD.id_avaliacao'))}

${lockTrigger('desenho', 'INSERT', closedAttendanceOfTask('NEW.id_tarefa'))}
${lockTrigger('desenho', 'UPDATE', `${closedAttendanceOfTask('OLD.id_tarefa')} OR ${closedAttendanceOfTask('NEW.id_tarefa')}`)}
${lockTrigger('desenho', 'DELETE', closedAttendanceOfTask('OLD.id_tarefa'))}

${lockTrigger('evento_tracado', 'INSERT', closedAttendanceOfTask('NEW.id_tarefa'))}
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

export const SCHEMA_V9 = `
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

${addLogicalDeletion('paciente')}
${addLogicalDeletion('avaliacao')}
ALTER TABLE avaliacao ADD COLUMN recebimento_pendente INTEGER NOT NULL DEFAULT 0
    CHECK (recebimento_pendente IN (0, 1));

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

${syncTriggers('profissional', [
  'nome',
  'email',
  'crm_numero',
  'uf_crm',
  'senha_hash',
  'ativo',
  'desativacao',
  'criacao',
])}
${syncTriggers('paciente', [
  'nome',
  'data_nascimento',
  'escolaridade_anos',
  'sexo',
  'ativo',
  'exclusao',
  'criacao',
])}
${syncTriggers('avaliacao', [
  'id_profissional',
  'id_paciente',
  'data_hora_inicio',
  'estado',
  'ativo',
  'exclusao',
])}
${FINALIZED_ATTENDANCE_LOCK}
`;
