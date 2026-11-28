/**
 * Esquema do banco SQLite do aplicativo.
 *
 * A versão 1 é o `dados/schema.sql` do repositório MED-IA (branch
 * `feat/database`), copiado para cá porque o Expo não executa o script Python
 * que cria o banco. A versão 2 troca o CPF em texto puro por CPF cifrado e índice
 * de busca, a versão 3 cria o paciente e o atendimento, a versão 4 registra a
 * desativação da conta, a versão 5 guarda a decisão do TCLE, a versão 6 cria as
 * tarefas de desenho, o desenho e o traçado, a versão 7 guarda as autorizações dos
 * itens 9 e 10 do TCLE, a versão 8 guarda o CPF cifrado do responsável legal e a
 * versão 9 guarda o perfil do profissional (médico ou superusuário).
 * Nenhuma delas existe ainda no
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
 * Versão 7: registra escolhas separadas de autorização para imagens desta pesquisa
 * e uso futuro de dados. Valores nulos preservam registros feitos em versões
 * anteriores ou decisões de recusa sem que os itens fossem respondidos.
 */
const SCHEMA_V7 = `
ALTER TABLE consentimento ADD COLUMN autoriza_imagens_pesquisa INTEGER
    CHECK (autoriza_imagens_pesquisa IS NULL OR autoriza_imagens_pesquisa IN (0, 1));
ALTER TABLE consentimento ADD COLUMN autoriza_dados_pesquisa_futura INTEGER
    CHECK (autoriza_dados_pesquisa_futura IS NULL OR autoriza_dados_pesquisa_futura IN (0, 1));
`;

/**
 * Versão 8: CPF do responsável legal que assinou o TCLE (#21, correção da
 * validação do PO). Segue o padrão de identificadores sensíveis do aplicativo: o
 * banco guarda só a cifra (AES-GCM, `cpfProtector`), nunca o CPF em texto. Não há
 * índice de busca, porque nenhuma consulta procura consentimento pelo CPF do
 * responsável. A coluna é nula para o paciente, para a recusa e para os
 * consentimentos gravados antes desta versão. Só o aceite pelo responsável legal
 * pode ter valor: o `CHECK` barra o CPF de responsável em qualquer outro registro.
 */
const SCHEMA_V8 = `
ALTER TABLE consentimento ADD COLUMN cpf_responsavel_cifrado TEXT
    CHECK (
      cpf_responsavel_cifrado IS NULL
      OR (
        assinado_por = 'responsavel_legal'
        AND aceito = 1
        AND length(trim(cpf_responsavel_cifrado)) > 0
      )
    );
`;

/**
 * Versão 9: perfil do profissional (#49). O superusuário é o responsável pela
 * pesquisa: só ele vê os atendimentos de todos os profissionais. Toda conta,
 * inclusive as que já existem no tablet, fica como médico. O superusuário nasce
 * de uma conta de administrador criada para isso, e não do cadastro comum: o PO
 * pediu um "cadastro master" e que "um superusuário só nasça de um superusuário"
 * (reunião de 09/11). As duas regras ficam no repositório do profissional.
 *
 * `superusuario_por` guarda quem concedeu o perfil. Vazio num superusuário quer
 * dizer administrador inicial; num médico, fica sempre vazio. Na sincronização
 * entre tablets (#118), é por ela que se sabe se dois tablets criaram cada um o
 * seu administrador, e qual deles veio primeiro. Também registra quem deu acesso
 * aos atendimentos de todos, o que a LGPD pede.
 */
const SCHEMA_V9 = `
ALTER TABLE profissional ADD COLUMN perfil TEXT NOT NULL DEFAULT 'medico'
    CHECK (perfil IN ('medico', 'superusuario'));
ALTER TABLE profissional ADD COLUMN superusuario_por INTEGER REFERENCES profissional (id)
    CHECK (superusuario_por IS NULL OR perfil = 'superusuario');
`;

/**
 * Versão 10: desistência do exame (#25). A avaliação passa a `interrompida` e
 * guarda a tarefa em que parou (1 a 3), o motivo, que é opcional, e a data e hora.
 * Os desenhos já confirmados continuam gravados, e a retomada volta o estado para
 * `em_andamento` sem apagar a última interrupção.
 */
const SCHEMA_V10 = `
ALTER TABLE avaliacao ADD COLUMN tarefa_interrupcao INTEGER
    CHECK (tarefa_interrupcao IS NULL OR tarefa_interrupcao BETWEEN 1 AND 3);
ALTER TABLE avaliacao ADD COLUMN motivo_interrupcao TEXT
    CHECK (motivo_interrupcao IS NULL
        OR motivo_interrupcao IN ('cansaco', 'nao_quis_continuar', 'mal_estar', 'outro'));
ALTER TABLE avaliacao ADD COLUMN data_hora_interrupcao TEXT;
`;

/**
 * Estados depois dos três desenhos. Ata 12 (09/11): exame finalizado faz parte da
 * pesquisa e não pode ser excluído. Só os gatilhos da versão 11 usam esta lista: o
 * código da exclusão saiu do aplicativo, mas os gatilhos continuam no banco.
 *
 * Os gatilhos ficam gravados no banco do tablet quando a versão 11 roda. Mudar esta
 * lista depois disso não muda os gatilhos já criados: é preciso uma migration nova.
 */
export const FINALIZED_STATES = ['processando_resultado', 'erro_inferencia', 'concluida'] as const;

const FINALIZED_STATES_SQL = `(${FINALIZED_STATES.map((estado) => `'${estado}'`).join(', ')})`;

const FINALIZADOS = FINALIZED_STATES_SQL;

/**
 * Versão 11: exclusão de exame (#58) e de paciente (#47). Nada é apagado de
 * verdade: o exame recebe a data e o profissional da exclusão e sai das listas,
 * mas continua no tablet. Excluir um paciente marca os exames dele aplicados pelo
 * profissional, porque o mesmo paciente pode ter exames de outro médico.
 *
 * A tabela `exclusao` registra cada pedido com data, hora e profissional, e não
 * aceita alteração nem remoção. Os gatilhos garantem a regra no banco, por
 * qualquer caminho do código: exame finalizado não é excluído nem apagado, a
 * exclusão não é desfeita e o exame excluído não muda mais de estado.
 *
 * Sem uso desde a Ata 13 (16/11): a exclusão foi trocada pela marcação (versão 12) e o
 * código dela saiu do aplicativo. As colunas `excluido_em` e `excluido_por`, a
 * tabela `exclusao` e os gatilhos continuam no banco, porque migration publicada não
 * se edita, mas nada no aplicativo lê nem grava neles.
 */
const SCHEMA_V11 = `
ALTER TABLE avaliacao ADD COLUMN excluido_em TEXT;
ALTER TABLE avaliacao ADD COLUMN excluido_por INTEGER REFERENCES profissional (id);

CREATE TABLE IF NOT EXISTS exclusao (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('paciente', 'exame')),
    id_paciente INTEGER NOT NULL REFERENCES paciente (id),
    id_avaliacao INTEGER REFERENCES avaliacao (id),
    id_profissional INTEGER NOT NULL REFERENCES profissional (id),
    data_hora TEXT NOT NULL,
    CHECK ((tipo = 'exame') = (id_avaliacao IS NOT NULL)),
    CHECK (length(trim(data_hora)) > 0)
);

CREATE TRIGGER IF NOT EXISTS exclusao_sem_alteracao
BEFORE UPDATE ON exclusao
BEGIN
    SELECT RAISE(ABORT, 'registro de exclusao nao pode ser alterado');
END;

CREATE TRIGGER IF NOT EXISTS exclusao_sem_remocao
BEFORE DELETE ON exclusao
BEGIN
    SELECT RAISE(ABORT, 'registro de exclusao nao pode ser apagado');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_finalizada_sem_exclusao
BEFORE UPDATE OF excluido_em ON avaliacao
WHEN NEW.excluido_em IS NOT NULL AND OLD.estado IN ${FINALIZADOS}
BEGIN
    SELECT RAISE(ABORT, 'exame finalizado nao pode ser excluido');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_exclusao_definitiva
BEFORE UPDATE OF excluido_em, excluido_por ON avaliacao
WHEN OLD.excluido_em IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'exclusao do exame nao pode ser desfeita');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_excluida_sem_mudanca
BEFORE UPDATE OF estado ON avaliacao
WHEN OLD.excluido_em IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'exame excluido nao muda de estado');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_finalizada_sem_remocao
BEFORE DELETE ON avaliacao
WHEN OLD.estado IN ${FINALIZADOS}
BEGIN
    SELECT RAISE(ABORT, 'exame finalizado nao pode ser apagado');
END;
`;

/**
 * Versão 12: marcação do exame como teste ou material de ensino (#58), no lugar da
 * exclusão. Na validação das histórias da R3, o cliente pediu que nada seja apagado e
 * que a exportação deixe claro o que foi teste ou ensino (Ata 13, 16/11). O exame
 * marcado continua nas listas e no tablet, inclusive o finalizado.
 *
 * As colunas guardam a marcação de agora, e a tabela `marcacao` guarda cada vez que
 * o exame foi marcado ou desmarcado, com o profissional e a data e hora. O histórico
 * não aceita alteração nem remoção. Os gatilhos repetem no banco que só o médico que
 * aplicou o exame marca ou desmarca, por qualquer caminho do código, e que a marcação de
 * agora sempre corresponde ao último registro do histórico: quem muda as colunas sem
 * gravar antes o registro (uma sincronização futura, por exemplo) é recusado.
 */
const SCHEMA_V12 = `
ALTER TABLE avaliacao ADD COLUMN marcacao TEXT CHECK (marcacao IN ('teste', 'ensino'));
ALTER TABLE avaliacao ADD COLUMN marcado_em TEXT;
ALTER TABLE avaliacao ADD COLUMN marcado_por INTEGER REFERENCES profissional (id);

CREATE TABLE IF NOT EXISTS marcacao (
    id INTEGER PRIMARY KEY,
    id_avaliacao INTEGER NOT NULL REFERENCES avaliacao (id),
    acao TEXT NOT NULL CHECK (acao IN ('marcar', 'desmarcar')),
    tipo TEXT CHECK (tipo IN ('teste', 'ensino')),
    id_profissional INTEGER NOT NULL REFERENCES profissional (id),
    data_hora TEXT NOT NULL,
    CHECK ((acao = 'marcar') = (tipo IS NOT NULL)),
    CHECK (length(trim(data_hora)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_marcacao_avaliacao ON marcacao (id_avaliacao);

CREATE TRIGGER IF NOT EXISTS marcacao_sem_alteracao
BEFORE UPDATE ON marcacao
BEGIN
    SELECT RAISE(ABORT, 'registro de marcacao nao pode ser alterado');
END;

CREATE TRIGGER IF NOT EXISTS marcacao_sem_remocao
BEFORE DELETE ON marcacao
BEGIN
    SELECT RAISE(ABORT, 'registro de marcacao nao pode ser apagado');
END;

CREATE TRIGGER IF NOT EXISTS marcacao_so_de_quem_aplicou
BEFORE INSERT ON marcacao
WHEN NEW.id_profissional IS NOT (SELECT id_profissional FROM avaliacao WHERE id = NEW.id_avaliacao)
BEGIN
    SELECT RAISE(ABORT, 'so quem aplicou o exame pode marcar ou desmarcar');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_marcada_por_quem_aplicou
BEFORE UPDATE OF marcacao, marcado_em, marcado_por ON avaliacao
WHEN NEW.marcacao IS NOT NULL AND NEW.marcado_por IS NOT OLD.id_profissional
BEGIN
    SELECT RAISE(ABORT, 'so quem aplicou o exame pode marcar ou desmarcar');
END;

CREATE TRIGGER IF NOT EXISTS avaliacao_marcacao_com_historico
BEFORE UPDATE OF marcacao, marcado_em, marcado_por ON avaliacao
WHEN NOT (
    (NEW.marcacao IS NULL AND NEW.marcado_em IS NULL AND NEW.marcado_por IS NULL
        AND (SELECT acao FROM marcacao WHERE id_avaliacao = NEW.id ORDER BY id DESC LIMIT 1)
            IS NOT 'marcar')
    OR EXISTS (SELECT 1 FROM marcacao m
        WHERE m.id = (SELECT max(id) FROM marcacao WHERE id_avaliacao = NEW.id)
          AND m.acao = 'marcar' AND m.tipo = NEW.marcacao
          AND m.id_profissional = NEW.marcado_por AND m.data_hora = NEW.marcado_em)
)
BEGIN
    SELECT RAISE(ABORT, 'marcacao sem registro no historico');
END;
`;

/**
 * Versão 13: resultado do modelo de IA calculado no tablet (#12). Cada exame tem no
 * máximo um resultado, gravado na mesma transação que leva o exame a "concluida".
 *
 * O resultado é dado da pesquisa e não muda depois de gravado: os gatilhos impedem
 * alterar e apagar a linha. Só um exame que espera o modelo (processando ou com erro
 * na tentativa anterior) recebe resultado. Os mapas guardam as 64 células de 8 × 8 em
 * float32 (256 bytes), e a versão do modelo identifica o arquivo que calculou o escore.
 */
const SCHEMA_V13 = `
CREATE TABLE IF NOT EXISTS resultado_modelo (
    id_avaliacao INTEGER PRIMARY KEY REFERENCES avaliacao (id),
    probabilidade REAL NOT NULL CHECK (probabilidade BETWEEN 0 AND 1),
    contribuicao_relogio REAL NOT NULL,
    contribuicao_cubo REAL NOT NULL,
    contribuicao_trilhas REAL NOT NULL,
    mapa_relogio BLOB NOT NULL CHECK (length(mapa_relogio) = 256),
    mapa_cubo BLOB NOT NULL CHECK (length(mapa_cubo) = 256),
    mapa_trilhas BLOB NOT NULL CHECK (length(mapa_trilhas) = 256),
    versao_modelo TEXT NOT NULL CHECK (length(trim(versao_modelo)) > 0),
    duracao_ms INTEGER NOT NULL CHECK (duracao_ms >= 0),
    data_hora TEXT NOT NULL CHECK (length(trim(data_hora)) > 0)
);

CREATE TRIGGER IF NOT EXISTS resultado_modelo_exame_aguardando
BEFORE INSERT ON resultado_modelo
WHEN (SELECT estado FROM avaliacao WHERE id = NEW.id_avaliacao)
    NOT IN ('processando_resultado', 'erro_inferencia')
BEGIN
    SELECT RAISE(ABORT, 'resultado so para exame que espera o modelo');
END;

CREATE TRIGGER IF NOT EXISTS resultado_modelo_sem_alteracao
BEFORE UPDATE ON resultado_modelo
BEGIN
    SELECT RAISE(ABORT, 'resultado do modelo nao pode ser alterado');
END;

CREATE TRIGGER IF NOT EXISTS resultado_modelo_sem_remocao
BEFORE DELETE ON resultado_modelo
BEGIN
    SELECT RAISE(ABORT, 'resultado do modelo nao pode ser apagado');
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
 * (tarefas, desenho e traçado), e a posição 6 à versão 7 (autorizações de dados),
 * a posição 7 à versão 8 (CPF do responsável legal), a posição 8 à versão 9
 * (perfil do profissional), a posição 9 à versão 10 (desistência do exame), a
 * posição 10 à versão 11 (exclusão de exame e de paciente), a posição 11 à
 * versão 12 (marcação do exame como teste ou ensino), a posição 12 à versão 13
 * (resultado do modelo), e assim por diante.
 * Para mudar o esquema,
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
  SCHEMA_V7,
  SCHEMA_V8,
  SCHEMA_V9,
  SCHEMA_V10,
  SCHEMA_V11,
  SCHEMA_V12,
  SCHEMA_V13,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
