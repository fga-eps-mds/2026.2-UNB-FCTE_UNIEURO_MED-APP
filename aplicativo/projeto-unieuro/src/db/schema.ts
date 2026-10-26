/**
 * Esquema do banco SQLite do aplicativo.
 *
 * A versão 1 é o `dados/schema.sql` do repositório MED-IA (branch
 * `feat/database`), copiado para cá porque o Expo não executa o script Python
 * que cria o banco. A versão 2 troca o CPF em texto puro por CPF cifrado e índice
 * de busca, a versão 3 cria o paciente e o atendimento, a versão 4 registra a
 * desativação da conta, a versão 5 guarda a decisão do TCLE e a versão 6 cria as
 * tarefas de desenho, o desenho e o traçado. Nenhuma delas existe ainda no
 * `schema.sql` do MED-IA: as
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
    assinatura_png BLOB,
    data_hora TEXT NOT NULL,
    CHECK (length(trim(versao_tcle)) > 0),
    CHECK (length(trim(data_hora)) > 0),
    CHECK (
      (aceito = 1 AND assinatura_png IS NOT NULL AND length(assinatura_png) > 0)
      OR (aceito = 0 AND assinatura_png IS NULL)
    )
);
`;

/**
 * Versão 6: tarefas, desenho e traçado de cada atendimento (#10), conforme o
 * modelo lógico da arquitetura, mais a largura e a altura do quadro na tarefa:
 * sem elas o traçado perde a escala, e nas trilhas não dá para saber por quais
 * círculos ele passou (`trilhas.ts` posiciona os círculos pelo tamanho do quadro).
 *
 * Os eventos do traçado não podem ser alterados nem apagados, porque os traços
 * desfeitos também contam como dado da coleta (Atas 06 e 07). Como as chaves
 * estrangeiras não apagam em cascata, isso também impede apagar a tarefa e o
 * atendimento que tenham traçado. Se entrar a exclusão a pedido (LGPD) ou de
 * pacientes (Ata 08), uma migração nova precisa rever esses gatilhos.
 */
const SCHEMA_V6 = `
CREATE TABLE IF NOT EXISTS tarefa (
    id INTEGER PRIMARY KEY,
    id_avaliacao INTEGER NOT NULL REFERENCES avaliacao (id),
    tipo TEXT NOT NULL CHECK (tipo IN ('relogio', 'cubo', 'trilhas')),
    ordem INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 3),
    largura REAL NOT NULL CHECK (largura > 0),
    altura REAL NOT NULL CHECK (altura > 0),
    data_hora_inicio TEXT NOT NULL,
    data_hora_termino TEXT,
    UNIQUE (id_avaliacao, ordem),
    UNIQUE (id_avaliacao, tipo),
    -- A ordem é fixa (tarefas.ts). A IA lê os desenhos por ela, então uma tela que
    -- gravasse o cubo na ordem 1 trocaria o resultado sem nenhum aviso. Melhor falhar.
    CHECK ((ordem = 1 AND tipo = 'relogio') OR (ordem = 2 AND tipo = 'cubo')
        OR (ordem = 3 AND tipo = 'trilhas'))
);

CREATE TABLE IF NOT EXISTS desenho (
    id INTEGER PRIMARY KEY,
    id_tarefa INTEGER NOT NULL UNIQUE REFERENCES tarefa (id),
    imagem_final BLOB NOT NULL,
    data_hora_confirmacao TEXT NOT NULL,
    CHECK (length(imagem_final) > 0)
);

CREATE TABLE IF NOT EXISTS evento_tracado (
    id INTEGER PRIMARY KEY,
    id_tarefa INTEGER NOT NULL REFERENCES tarefa (id),
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    tipo TEXT NOT NULL CHECK (tipo IN ('inicio', 'ponto', 'desfazer', 'limpar')),
    ponteiro TEXT CHECK (ponteiro IN ('caneta', 'dedo', 'mouse', 'desconhecido')),
    coord_x REAL,
    coord_y REAL,
    instante INTEGER NOT NULL CHECK (instante >= 0),
    -- Sem limite superior: no Android a pressão da caneta pode passar de 1.
    pressao REAL CHECK (pressao >= 0),
    inclinacao_x REAL,
    inclinacao_y REAL,
    UNIQUE (id_tarefa, ordem),
    CHECK (CASE WHEN tipo IN ('inicio', 'ponto')
        THEN coord_x IS NOT NULL AND coord_y IS NOT NULL AND ponteiro IS NOT NULL
        ELSE coord_x IS NULL AND coord_y IS NULL AND ponteiro IS NULL
            AND pressao IS NULL AND inclinacao_x IS NULL AND inclinacao_y IS NULL
    END)
);

CREATE TRIGGER IF NOT EXISTS evento_tracado_sem_alteracao
BEFORE UPDATE ON evento_tracado
BEGIN
    SELECT RAISE(ABORT, 'evento do tracado nao pode ser alterado');
END;

CREATE TRIGGER IF NOT EXISTS evento_tracado_sem_exclusao
BEFORE DELETE ON evento_tracado
BEGIN
    SELECT RAISE(ABORT, 'evento do tracado nao pode ser apagado');
END;
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
 * conta), a posição 4 à versão 5 (consentimento), a posição 5 à versão 6
 * (tarefas, desenho e traçado), e assim por diante. Para mudar o esquema,
 * acrescente um passo no fim; não altere os que já existem, porque os tablets com
 * o banco criado não os executam de novo.
 */
export const MIGRATIONS: readonly MigrationStep[] = [
  SCHEMA_V1,
  protectStoredCpfs,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
