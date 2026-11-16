/**
 * Códigos de erro da sincronização. Cada falha tem um código próprio, que aparece
 * na tela e vai para o `motivo` do histórico (`sync_log`), para o suporte saber
 * onde ela aconteceu sem depender da descrição de quem a viu.
 *
 * As faixas de 100 a 499 são da sincronização: 1xx antes de procurar, 2xx na
 * conexão, 3xx na troca pelo Nearby e 4xx na troca por arquivo. Os códigos não
 * levam dado pessoal. Quando a falha vem do Nearby, o código do Google aparece
 * junto. Não reaproveite um código: o suporte pode já tê-lo anotado.
 */

const RETRY_OR_REPORT = 'Tente de novo. Se continuar, informe este código ao suporte do MED.';
const SAME_VERSION_OR_REPORT =
  'Confira se os dois tablets estão com a mesma versão do aplicativo. Se estiverem, informe este código ao suporte do MED.';
const SAME_VERSION = 'Instale a mesma versão do aplicativo nos dois tablets.';
const OPEN_PERMISSIONS = 'Libere em Configurações → Apps → MED → Permissões e tente de novo.';
const MOVE_CLOSER =
  'Aproxime os tablets, deixe a tela de sincronização aberta nos dois e tente de novo.';

type Entry = {
  title: string;
  /** O que fazer. `null` quando a causa basta. */
  action: string | null;
  /** Aviso, e não erro: parte da troca deu certo. */
  warning?: boolean;
};

export const SYNC_ERRORS = {
  // 1xx: antes de procurar.
  101: {
    title: 'Permissão de dispositivos próximos negada',
    action:
      'Permita o acesso a dispositivos próximos. Se negou antes, libere nas configurações do Android, em Apps → MED → Permissões.',
  },
  102: { title: 'Bluetooth desligado', action: 'Ative o Bluetooth e tente de novo.' },
  103: {
    title: 'Localização desligada',
    action: 'Ative a localização do tablet. Ela é necessária para encontrar tablets próximos.',
  },
  104: { title: 'Falha ao ler os dados do próprio tablet', action: RETRY_OR_REPORT },
  110: {
    title: 'O Android não liberou a permissão de dispositivos próximos',
    action: OPEN_PERMISSIONS,
  },
  111: {
    title: 'O Android não liberou a permissão de localização',
    action: `Esta versão do Android exige a localização para procurar tablets. ${OPEN_PERMISSIONS}`,
  },
  112: {
    title: 'A busca por Bluetooth precisa da localização ligada',
    action: 'Ative a localização nas configurações rápidas e tente de novo.',
  },
  113: {
    title: 'O Bluetooth ou o Wi-Fi do tablet não respondeu',
    action: 'Desligue e ligue os dois e tente de novo.',
  },
  114: { title: 'Falta ao aplicativo uma permissão de Wi-Fi', action: RETRY_OR_REPORT },
  115: {
    title: 'Outro aplicativo está usando a busca por aparelhos próximos',
    action: 'Feche-o (por exemplo, o Compartilhamento por proximidade) e tente de novo.',
  },
  116: { title: 'O Google Play Services deste tablet está desatualizado', action: null },
  117: { title: 'O Google Play Services está desativado neste tablet', action: null },
  119: { title: 'Falha ao começar a procurar tablets', action: RETRY_OR_REPORT },

  // 2xx: conexão.
  201: {
    title: 'Falha ao conectar ao outro tablet',
    action: 'Confira se o outro tablet está perto e com a tela de sincronização aberta.',
  },
  202: {
    title: 'Senha incorreta',
    action: 'Digite a senha com que você entrou no aplicativo.',
  },
  203: { title: 'Falha ao aceitar a conexão', action: MOVE_CLOSER },
  204: {
    title: 'O outro tablet cancelou a conexão',
    action: 'Tente de novo e confirme o código nos dois tablets.',
  },
  205: { title: 'A conexão com o outro tablet não foi concluída', action: MOVE_CLOSER },
  206: {
    title: 'A conexão caiu antes de começar a troca',
    action: `Nada foi alterado neste tablet. ${MOVE_CLOSER}`,
  },
  207: { title: 'Falha ao conferir a senha', action: RETRY_OR_REPORT },

  // 3xx: troca pelo Nearby.
  301: { title: 'Os tablets estão com versões diferentes do aplicativo', action: SAME_VERSION },
  302: { title: 'O outro tablet está com outra versão do aplicativo', action: SAME_VERSION },
  303: { title: 'O outro tablet se identificou como este mesmo tablet', action: RETRY_OR_REPORT },
  304: { title: 'Dados recebidos em formato não reconhecido', action: SAME_VERSION_OR_REPORT },
  305: { title: 'Parte dos dados chegou fora de ordem', action: SAME_VERSION_OR_REPORT },
  306: { title: 'Confirmação recebida fora de ordem', action: SAME_VERSION_OR_REPORT },
  307: { title: 'O outro tablet recomeçou a troca no meio', action: SAME_VERSION_OR_REPORT },
  311: {
    title: 'O outro tablet foi bloqueado e não pode mais enviar dados',
    action: 'Fale com o responsável pela pesquisa.',
  },
  312: { title: 'Dados de outro tablet chegaram no meio da troca', action: RETRY_OR_REPORT },
  313: { title: 'Falha ao gravar os dados recebidos', action: RETRY_OR_REPORT },
  320: {
    title: 'O outro tablet interrompeu a troca',
    action: 'A causa aparece no outro tablet, com o código de erro dele.',
  },
  330: { title: 'Falha ao preparar os dados para enviar', action: RETRY_OR_REPORT },
  340: {
    title: 'A conexão caiu antes do fim da troca',
    action: 'Os dados recebidos até ali foram salvos. Sincronize de novo para receber o restante.',
    warning: true,
  },
  341: {
    title: 'O outro tablet não confirmou o fim da troca',
    action: 'Os dados recebidos aqui foram salvos. Confira no outro tablet se ele também terminou.',
    warning: true,
  },

  // 4xx: troca por arquivo.
  401: { title: 'Senha não informada', action: 'Digite a sua senha para continuar.' },
  402: {
    title: 'Senha incorreta',
    action: 'Digite a senha com que você entrou no aplicativo.',
  },
  403: { title: 'Falha ao gerar o pacote', action: RETRY_OR_REPORT },
  404: {
    title: 'Falha ao enviar o pacote',
    action: 'Tente de novo ou escolha outro aplicativo para enviar o arquivo.',
  },
  405: { title: 'Falha ao conferir a senha', action: RETRY_OR_REPORT },
  410: {
    title: 'Código do pacote incompleto',
    action: 'Digite o código de 12 caracteres exibido no outro tablet.',
  },
  411: {
    title: 'Falha ao ler o arquivo escolhido',
    action: 'Confira se o arquivo foi copiado inteiro e tente de novo.',
  },
  412: {
    title: 'O arquivo não é um pacote de sincronização do MED',
    action: 'Escolha o arquivo .medsync gerado no outro tablet.',
  },
  413: {
    title: 'O código não confere com este pacote',
    action: 'Confira o código exibido no outro tablet.',
  },
  414: {
    title: 'O pacote foi gerado por outra versão do aplicativo',
    action: `${SAME_VERSION} Depois, gere um novo pacote.`,
  },
  415: {
    title: 'Este pacote foi gerado neste mesmo tablet',
    action: 'Escolha o pacote gerado no outro tablet.',
  },
  416: {
    title: 'O tablet que gerou este pacote foi bloqueado e não pode mais enviar dados',
    action: 'Fale com o responsável pela pesquisa.',
  },
  417: {
    title: 'Falha ao importar o pacote',
    action: `Nenhum dado foi alterado. ${RETRY_OR_REPORT}`,
  },
  418: {
    title: 'Só parte dos dados foi importada',
    action: 'O que entrou continua salvo. Importe o mesmo pacote de novo para completar.',
  },
} as const satisfies Record<number, Entry>;

export type SyncErrorCode = keyof typeof SYNC_ERRORS;

/** O que a tela precisa para mostrar uma falha. */
export type SyncFailure = {
  code: SyncErrorCode;
  /** Código do Nearby (Google), quando a falha veio dele. */
  nearby: number | null;
  /** Lotes recebidos antes da falha ficaram gravados. */
  kept: boolean;
};

export const syncFailure = (
  code: SyncErrorCode,
  { nearby = null, kept = false }: { nearby?: number | null; kept?: boolean } = {},
): SyncFailure => ({ code, nearby, kept });

// Vem antes da ação: "tente de novo" completa o que faltou.
const KEPT = 'Os dados recebidos até ali foram salvos.';

export type FailureText = {
  /** "Senha incorreta (Cód. de Erro: 202)". */
  headline: string;
  /** O que fazer, ou `null`. */
  action: string | null;
  /** Para o leitor de tela, sem abreviação. */
  spoken: string;
  warning: boolean;
};

export function describeFailure({ code, nearby, kept }: SyncFailure): FailureText {
  const entry: Entry = SYNC_ERRORS[code];
  const warning = entry.warning ?? false;
  const nearbyPart = nearby === null ? '' : ` · Nearby ${nearby}`;
  const label = warning ? 'Cód.:' : 'Cód. de Erro:';
  const action = [kept ? KEPT : null, entry.action].filter(Boolean).join(' ') || null;
  const spokenCode = `${warning ? 'Código' : 'Código de erro'} ${code}${
    nearby === null ? '' : `, código do Nearby ${nearby}`
  }`;
  return {
    headline: `${entry.title} (${label} ${code}${nearbyPart})`,
    action,
    spoken: [`${entry.title}.`, `${spokenCode}.`, action].filter(Boolean).join(' '),
    warning,
  };
}

/** Código do Nearby em `ERR_NEARBY_<código>`, ou `null` se o erro não veio dele. */
export function nearbyStatus(error: unknown): number | null {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  const match = typeof code === 'string' ? /^ERR_NEARBY_(-?\d+)$/.exec(code) : null;
  return match ? Number(match[1]) : null;
}

const START_FAILURES: { codes: number[]; code: SyncErrorCode }[] = [
  { codes: [8029, 8030, 8031, 8037, 8038, 8039], code: 110 },
  { codes: [8034, 8036], code: 111 },
  { codes: [8025], code: 112 },
  { codes: [8007], code: 113 },
  { codes: [8032, 8033], code: 114 },
  { codes: [8050], code: 115 },
  { codes: [2], code: 116 },
  { codes: [3], code: 117 },
];

/** Falha ao começar a procurar, pelo código do Nearby. */
export function startFailure(status: number | null): SyncFailure {
  const known = START_FAILURES.find(({ codes }) => status !== null && codes.includes(status));
  return syncFailure(known?.code ?? 119, { nearby: status });
}

/** Resultado da conexão que voltou com falha. */
export const STATUS_CONNECTION_REJECTED = 8004;
