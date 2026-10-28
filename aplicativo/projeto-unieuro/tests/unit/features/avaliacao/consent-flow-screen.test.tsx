import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { getAttendancePatient, registerConsentDecision } from '@/features/avaliacao/composition';
import ConsentFlowScreen, {
  MENSAGEM_FALHA_DECISAO,
} from '@/features/avaliacao/consent-flow-screen';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

import { desenharNoQuadro, medirQuadro } from '../../../test-support/desenho';

jest.mock('@/features/avaliacao/use-consent-gate', () => ({ useConsentGate: jest.fn() }));
jest.mock('@/features/avaliacao/composition', () => ({
  registerConsentDecision: jest.fn(),
  getAttendancePatient: jest.fn(),
}));
jest.mock('@/features/captura/imagem-desenho', () => ({ gerarImagemDesenho: jest.fn() }));

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const ROTULO_QUADRO = 'Área de assinatura';
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ACEITE = {
  sucesso: true,
  estado: 'em_andamento',
  decididoEm: '2026-10-25T12:00:00.000Z',
} as const;
const RECUSA = {
  sucesso: true,
  estado: 'cancelada',
  decididoEm: '2026-10-25T12:00:00.000Z',
} as const;

const botaoAssinar = () => screen.getByRole('button', { name: 'Assinar e iniciar' });
const botaoRecusar = () => screen.getByRole('button', { name: 'Recusar' });
const confirmarRecusa = () => screen.getByRole('button', { name: 'Confirmar recusa' });

async function renderizar(atendimento: string | undefined = '12') {
  render(
    <SessionProvider initialProfessional={profissional}>
      <ConsentFlowScreen atendimento={atendimento} />
    </SessionProvider>,
  );
  // Deixa a consulta do paciente terminar dentro do `act`.
  await act(async () => {});
  return userEvent.setup();
}

async function assinar() {
  medirQuadro(520, 160, ROTULO_QUADRO);
  fireEvent.press(screen.getByRole('radio', { name: 'Uso das imagens: Sim' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Uso futuro: Sim' }));
  await desenharNoQuadro([
    [20, 80],
    [90, 40],
    [160, 100],
  ]);
}

beforeEach(() => {
  jest.mocked(useConsentGate).mockReturnValue('aguardando_consentimento');
  jest.mocked(gerarImagemDesenho).mockReturnValue(PNG);
  jest.mocked(registerConsentDecision).mockResolvedValue(ACEITE);
  jest
    .mocked(getAttendancePatient)
    .mockResolvedValue({ name: 'José Alves Martins', recordNumber: '2026-0184' });
});

describe('portão do termo', () => {
  it('não mostra nada enquanto o estado da avaliação é consultado', async () => {
    jest.mocked(useConsentGate).mockReturnValue('carregando');

    await renderizar();

    expect(screen.queryByText(TERMO_TCLE.titulo)).toBeNull();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('segue para a instrução quando o consentimento já foi aceito', async () => {
    jest.mocked(useConsentGate).mockReturnValue('liberado');

    await renderizar();

    expect(screen.queryByText(TERMO_TCLE.titulo)).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('volta ao menu quando não há atendimento ou o consentimento foi recusado', async () => {
    jest.mocked(useConsentGate).mockReturnValue('bloqueado');

    await renderizar();

    expect(screen.queryByText(TERMO_TCLE.titulo)).toBeNull();
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('mostra o termo enquanto a avaliação aguarda o consentimento, sem abrir tarefa', async () => {
    await renderizar();

    expect(screen.getByText(TERMO_TCLE.titulo)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});

describe('cabeçalho do paciente', () => {
  it('mostra o nome e a ficha do paciente do atendimento', async () => {
    await renderizar();

    expect(await screen.findByText('José Alves Martins · Ficha 2026-0184')).toBeOnTheScreen();
    expect(getAttendancePatient).toHaveBeenCalledWith(12);
  });

  it('segue sem o cabeçalho quando o paciente não é encontrado', async () => {
    jest.mocked(getAttendancePatient).mockResolvedValue(null);

    await renderizar();

    expect(await screen.findByText(TERMO_TCLE.titulo)).toBeOnTheScreen();
    expect(screen.queryByText(/Ficha/)).toBeNull();
  });

  it('segue sem o cabeçalho quando a consulta falha', async () => {
    jest.mocked(getAttendancePatient).mockRejectedValue(new Error('banco indisponível'));

    await renderizar();

    expect(await screen.findByText(TERMO_TCLE.titulo)).toBeOnTheScreen();
    expect(screen.queryByText(/Ficha/)).toBeNull();
  });

  it('não atualiza a tela depois que ela foi fechada', async () => {
    let entregar: (valor: { name: string; recordNumber: string }) => void = () => undefined;
    jest
      .mocked(getAttendancePatient)
      .mockReturnValue(new Promise((resolver) => (entregar = resolver)));
    await renderizar();

    screen.unmount();
    entregar({ name: 'José Alves Martins', recordNumber: '2026-0184' });

    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});

describe('Cenário: aceite', () => {
  it('grava a assinatura em PNG com a versão do termo, quem assina e segue para a instrução', async () => {
    const user = await renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(gerarImagemDesenho).toHaveBeenCalledTimes(1);
    const [tracos, dimensoes] = jest.mocked(gerarImagemDesenho).mock.calls[0];
    expect(tracos).toHaveLength(1);
    expect(dimensoes).toEqual({ largura: 520, altura: 160 });
    expect(registerConsentDecision).toHaveBeenCalledWith({
      atendimentoId: 12,
      versaoTermo: TERMO_TCLE.versao,
      quemAssina: 'paciente',
      autorizaImagensPesquisa: true,
      autorizaDadosPesquisaFutura: true,
      aceito: true,
      assinaturaPng: PNG,
    });
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('grava o responsável legal quando é ele quem assina', async () => {
    const user = await renderizar();
    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
    await assinar();

    await user.press(botaoAssinar());

    expect(registerConsentDecision).toHaveBeenCalledWith(
      expect.objectContaining({ quemAssina: 'responsavel_legal', aceito: true }),
    );
  });

  it('não grava nada sem assinatura', async () => {
    const user = await renderizar();
    medirQuadro(520, 160, ROTULO_QUADRO);

    await user.press(botaoAssinar());

    expect(registerConsentDecision).not.toHaveBeenCalled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('segue pelo estado salvo quando a decisão já estava registrada', async () => {
    jest
      .mocked(registerConsentDecision)
      .mockResolvedValue({ sucesso: false, motivo: 'decisao_ja_registrada' });
    const user = await renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Cenário: recusa', () => {
  it('só grava depois da confirmação, sem assinatura, e volta ao menu', async () => {
    jest.mocked(registerConsentDecision).mockResolvedValue(RECUSA);
    const user = await renderizar();

    await user.press(botaoRecusar());
    expect(registerConsentDecision).not.toHaveBeenCalled();
    await user.press(confirmarRecusa());

    expect(registerConsentDecision).toHaveBeenCalledWith({
      atendimentoId: 12,
      versaoTermo: TERMO_TCLE.versao,
      quemAssina: 'paciente',
      autorizaImagensPesquisa: null,
      autorizaDadosPesquisaFutura: null,
      aceito: false,
    });
    expect(gerarImagemDesenho).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('desistir da recusa não grava nada e mantém o termo', async () => {
    const user = await renderizar();

    await user.press(botaoRecusar());
    await user.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(registerConsentDecision).not.toHaveBeenCalled();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(screen.getByText(TERMO_TCLE.titulo)).toBeOnTheScreen();
  });

  it('segue pelo estado salvo quando a decisão já estava registrada', async () => {
    jest
      .mocked(registerConsentDecision)
      .mockResolvedValue({ sucesso: false, motivo: 'decisao_ja_registrada' });
    const user = await renderizar();

    await user.press(botaoRecusar());
    await user.press(confirmarRecusa());

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });
});

describe('Cenário: falha ao registrar', () => {
  it('avisa, não navega e aceita outra tentativa de assinatura', async () => {
    jest.mocked(registerConsentDecision).mockRejectedValueOnce(new Error('banco indisponível'));
    const user = await renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_FALHA_DECISAO);
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(botaoAssinar()).toBeEnabled();

    await user.press(botaoAssinar());

    expect(registerConsentDecision).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('não grava quando a imagem da assinatura não pôde ser gerada', async () => {
    jest.mocked(gerarImagemDesenho).mockImplementationOnce(() => {
      throw new Error('Não foi possível criar a imagem do desenho.');
    });
    const user = await renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(registerConsentDecision).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_FALHA_DECISAO);
    expect(botaoAssinar()).toBeEnabled();
  });

  it('trata o atendimento inválido como falha, sem navegar', async () => {
    jest
      .mocked(registerConsentDecision)
      .mockResolvedValue({ sucesso: false, motivo: 'atendimento_invalido' });
    const user = await renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_FALHA_DECISAO);
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('mostra o aviso dentro da confirmação quando a recusa não pôde ser gravada', async () => {
    jest.mocked(registerConsentDecision).mockRejectedValueOnce(new Error('banco indisponível'));
    const user = await renderizar();

    await user.press(botaoRecusar());
    await user.press(confirmarRecusa());

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_FALHA_DECISAO);
    expect(confirmarRecusa()).toBeEnabled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});
