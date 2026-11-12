import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { BackHandler } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  DIGITOS_INCOMPLETOS,
  DIGITOS_INCORRETOS,
  DIGITOS_VAZIOS,
  type ProfessionalCpfRepository,
} from '@/features/avaliacao/confirmacao-profissional';
import TelaFinalScreen, {
  AGRADECIMENTO,
  BOTAO_PROFISSIONAL,
  FALHA_NA_CONFERENCIA,
  ORIENTACAO,
} from '@/features/avaliacao/tela-final-screen';

const ROTULO_CPF = 'Quatro primeiros dígitos do CPF';
const CPF_PROTEGIDO = '11144477735';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const repositorio = {
  getCpf: jest.fn(async () => CPF_PROTEGIDO as string | null),
} satisfies ProfessionalCpfRepository;

function renderizarTela(professional: SessionProfessional | null = profissional) {
  render(
    <SessionProvider initialProfessional={professional}>
      <TelaFinalScreen repository={repositorio} />
    </SessionProvider>,
  );
}

async function pedirConfirmacao() {
  const user = userEvent.setup();
  renderizarTela();
  await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
  return user;
}

describe('TelaFinalScreen', () => {
  it('fim do teste: mostra só o agradecimento, sem escore, faixa ou resultado', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    expect(screen.getByText(ORIENTACAO)).toBeOnTheScreen();
    expect(screen.queryByText(/escore|pontua|faixa|resultado|nota/i)).toBeNull();
  });

  it('pede quatro dígitos numéricos do CPF, e não a senha', async () => {
    await pedirConfirmacao();

    const campo = screen.getByLabelText(ROTULO_CPF);
    expect(campo).toBeOnTheScreen();
    expect(campo).toHaveProp('inputMode', 'numeric');
    expect(campo).toHaveProp('keyboardType', 'number-pad');
    expect(campo).toHaveProp('maxLength', 4);
    expect(campo).toHaveProp('secureTextEntry', true);
    expect(screen.queryByText(/senha/i)).toBeNull();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('remove caracteres não numéricos e limita a entrada a quatro dígitos', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '1a1149');

    expect(screen.getByLabelText(ROTULO_CPF)).toHaveDisplayValue('1114');
  });

  it('com os quatro dígitos corretos, volta à área do profissional', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(repositorio.getCpf).toHaveBeenCalledWith(profissional.id);
    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('com dígitos incorretos, avisa, permanece na tela final e permite nova tentativa', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '9999');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${DIGITOS_INCORRETOS}`)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
    expect(screen.getByLabelText(ROTULO_CPF)).toHaveDisplayValue('');

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu'));
  });

  it.each([
    ['', DIGITOS_VAZIOS],
    ['111', DIGITOS_INCOMPLETOS],
  ])('entrada %p não libera o acesso e pode ser corrigida', async (digitos, mensagem) => {
    const user = await pedirConfirmacao();

    if (digitos) await user.type(screen.getByLabelText(ROTULO_CPF), digitos);
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${mensagem}`)).toBeOnTheScreen();
    expect(repositorio.getCpf).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
  });

  it('cancelar preserva a tela final e descarta somente os dígitos digitados', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    expect(screen.queryByLabelText(ROTULO_CPF)).toBeNull();
    expect(repositorio.getCpf).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
    expect(screen.getByLabelText(ROTULO_CPF)).toHaveDisplayValue('');
  });

  it('o voltar do Android não sai da tela final', () => {
    const inscrever = jest.spyOn(BackHandler, 'addEventListener');
    renderizarTela();

    const [, aoVoltar] = inscrever.mock.calls[inscrever.mock.calls.length - 1];
    expect(aoVoltar({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);

    expect(useRouter().back).not.toHaveBeenCalled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    inscrever.mockRestore();
  });

  it('com erro de leitura, preserva a tela final e permite tentar novamente', async () => {
    const user = await pedirConfirmacao();
    repositorio.getCpf.mockRejectedValueOnce(new Error('banco indisponível'));

    await user.type(screen.getByLabelText(ROTULO_CPF), '1114');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${FALHA_NA_CONFERENCIA}`)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu'));
  });

  it('volta ao login quando não há profissional logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText(AGRADECIMENTO)).toBeNull();
  });
});
