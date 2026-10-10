import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import type { AttendanceRepository, PatientField } from '@/features/avaliacao/attendance';
import NewAttendanceScreen from '@/features/avaliacao/new-attendance-screen';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const BOTAO = 'Ir para o termo de consentimento';

function criarRepositorio(sobrescritas: Partial<AttendanceRepository> = {}): AttendanceRepository {
  return {
    findPatientByCpf: jest.fn(async () => null),
    createAttendance: jest.fn(async () => ({ attendanceId: 42 })),
    ...sobrescritas,
  };
}

function renderizarTela({
  repository = criarRepositorio(),
  professional = profissional as SessionProfessional | null,
} = {}) {
  const onRegistered = jest.fn();
  render(
    <SessionProvider initialProfessional={professional}>
      <NewAttendanceScreen repository={repository} onRegistered={onRegistered} />
    </SessionProvider>,
  );
  return { repository, onRegistered };
}

type Usuario = ReturnType<typeof userEvent.setup>;

const dadosValidos = {
  'Nome completo': 'José Alves Martins',
  CPF: '12345678909',
  'Número da ficha': '2026-0184',
  'Data de nascimento': '14031948',
  'Escolaridade (anos)': '5',
};

async function preencherFormulario(
  user: Usuario,
  trocas: Partial<Record<keyof typeof dadosValidos, string>> = {},
) {
  for (const [rotulo, valor] of Object.entries({ ...dadosValidos, ...trocas })) {
    if (valor) await user.type(screen.getByLabelText(rotulo), valor);
  }
}

const enviar = (user: Usuario) => user.press(screen.getByRole('button', { name: BOTAO }));

const campo = (nome: PatientField) => within(screen.getByTestId(`campo-${nome}`));

const MENSAGEM_DE_ERRO = /^(Preencha (o|a) |Informe |A data |Escolha )/;

describe('NewAttendanceScreen', () => {
  it('apresenta o título como cabeçalho', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: 'Novo exame' })).toBeOnTheScreen();
    expect(
      screen.getByText('Preencha os dados do paciente para iniciar a avaliação.'),
    ).toBeOnTheScreen();
  });

  describe('Cenário: identificação mínima do paciente', () => {
    it('pede só os seis dados do paciente', () => {
      renderizarTela();

      for (const rotulo of Object.keys(dadosValidos)) {
        expect(screen.getByLabelText(rotulo)).toBeOnTheScreen();
      }
      expect(screen.getByRole('button', { name: 'Sexo' })).toBeOnTheScreen();
      expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(5);
    });
  });

  describe('Cenário: campo obrigatório vazio', () => {
    it('indica embaixo de cada campo o que falta e não grava', async () => {
      const user = userEvent.setup();
      const { repository, onRegistered } = renderizarTela();

      await enviar(user);

      expect(await campo('name').findByText('Preencha o nome completo.')).toBeOnTheScreen();
      expect(campo('cpf').getByText('Preencha o CPF.')).toBeOnTheScreen();
      expect(campo('recordNumber').getByText('Preencha o número da ficha.')).toBeOnTheScreen();
      expect(campo('birthDate').getByText('Preencha a data de nascimento.')).toBeOnTheScreen();
      expect(
        campo('schooling').getByText('Preencha a escolaridade, em anos de estudo.'),
      ).toBeOnTheScreen();
      expect(campo('sex').queryByText(MENSAGEM_DE_ERRO)).toBeNull();
      expect(repository.findPatientByCpf).not.toHaveBeenCalled();
      expect(repository.createAttendance).not.toHaveBeenCalled();
      expect(onRegistered).not.toHaveBeenCalled();
    });

    it('aponta só o campo que falta', async () => {
      const user = userEvent.setup();
      const { repository } = renderizarTela();

      await preencherFormulario(user, { 'Número da ficha': '' });
      await enviar(user);

      expect(
        await campo('recordNumber').findByText('Preencha o número da ficha.'),
      ).toBeOnTheScreen();
      expect(screen.getAllByText(MENSAGEM_DE_ERRO)).toHaveLength(1);
      expect(repository.createAttendance).not.toHaveBeenCalled();
    });

    it('trata o nome só com espaços como vazio', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await preencherFormulario(user, { 'Nome completo': '   ' });
      await enviar(user);

      expect(await campo('name').findByText('Preencha o nome completo.')).toBeOnTheScreen();
    });

    it('anuncia a mensagem para o leitor de tela', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await enviar(user);

      expect(await campo('cpf').findByText('Preencha o CPF.')).toHaveProp(
        'accessibilityLiveRegion',
        'polite',
      );
    });

    it('apaga a mensagem do campo quando o médico o corrige', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await enviar(user);
      await campo('name').findByText('Preencha o nome completo.');
      await user.type(screen.getByLabelText('Nome completo'), 'José');

      expect(campo('name').queryByText('Preencha o nome completo.')).toBeNull();
      expect(campo('cpf').getByText('Preencha o CPF.')).toBeOnTheScreen();
    });
  });

  describe('Cenário: escolaridade do paciente', () => {
    it('não segue sem a escolaridade', async () => {
      const user = userEvent.setup();
      const { repository } = renderizarTela();

      await preencherFormulario(user, { 'Escolaridade (anos)': '' });
      await enviar(user);

      expect(
        await campo('schooling').findByText('Preencha a escolaridade, em anos de estudo.'),
      ).toBeOnTheScreen();
      expect(repository.createAttendance).not.toHaveBeenCalled();
    });

    it.each(['-1', 'ab'])('recusa a escolaridade "%s"', async (escolaridade) => {
      const user = userEvent.setup();
      const { repository } = renderizarTela();

      await preencherFormulario(user, { 'Escolaridade (anos)': escolaridade });
      await enviar(user);

      expect(
        await campo('schooling').findByText(
          'Informe a escolaridade em anos de estudo, só com números inteiros.',
        ),
      ).toBeOnTheScreen();
      expect(repository.createAttendance).not.toHaveBeenCalled();
    });
  });

  describe('Cenário: CPF inválido', () => {
    it('pede para corrigir o CPF e não grava', async () => {
      const user = userEvent.setup();
      const { repository, onRegistered } = renderizarTela();

      await preencherFormulario(user, { CPF: '12345678900' });
      await enviar(user);

      expect(await campo('cpf').findByText('Informe um CPF válido.')).toBeOnTheScreen();
      expect(screen.getAllByText(MENSAGEM_DE_ERRO)).toHaveLength(1);
      expect(screen.queryByText(/123\.?456/)).toBeNull();
      expect(repository.findPatientByCpf).not.toHaveBeenCalled();
      expect(onRegistered).not.toHaveBeenCalled();
    });
  });

  describe('Cenário: data de nascimento inválida', () => {
    it.each([
      ['que não existe', '31021950', 'Informe uma data que exista, no formato DD/MM/AAAA.'],
      ['incompleta', '1403', 'Informe uma data que exista, no formato DD/MM/AAAA.'],
      ['no futuro', '01012999', 'A data de nascimento não pode ser depois de hoje.'],
    ])('pede para corrigir a data %s e não grava', async (_caso, data, mensagem) => {
      const user = userEvent.setup();
      const { repository } = renderizarTela();

      await preencherFormulario(user, { 'Data de nascimento': data });
      await enviar(user);

      expect(await campo('birthDate').findByText(mensagem)).toBeOnTheScreen();
      expect(repository.createAttendance).not.toHaveBeenCalled();
    });
  });

  describe('Cenário: atendimento registrado', () => {
    it('grava com o médico da sessão e avisa a rota com o id do atendimento', async () => {
      const user = userEvent.setup();
      const { repository, onRegistered } = renderizarTela();

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'Sexo' }));
      await user.press(screen.getByRole('radio', { name: 'Masculino' }));
      await enviar(user);

      await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(42));
      expect(repository.findPatientByCpf).toHaveBeenCalledWith('12345678909');
      expect(repository.createAttendance).toHaveBeenCalledWith({
        patient: {
          name: 'José Alves Martins',
          cpf: '12345678909',
          recordNumber: '2026-0184',
          birthDate: '1948-03-14',
          schoolingYears: 5,
          sex: 'masculino',
        },
        professionalId: profissional.id,
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      });
      expect(screen.queryByText(MENSAGEM_DE_ERRO)).toBeNull();
    });

    it('grava sem o sexo, que não é obrigatório', async () => {
      const user = userEvent.setup();
      const { repository, onRegistered } = renderizarTela();

      await preencherFormulario(user);
      await enviar(user);

      await waitFor(() => expect(onRegistered).toHaveBeenCalledWith(42));
      expect(repository.createAttendance).toHaveBeenCalledWith(
        expect.objectContaining({ patient: expect.objectContaining({ sex: null }) }),
      );
    });

    it('não grava duas vezes num toque duplo', async () => {
      const repository = criarRepositorio({
        findPatientByCpf: jest.fn(() => new Promise<null>(() => undefined)),
      });
      const user = userEvent.setup();
      renderizarTela({ repository });

      await preencherFormulario(user);
      await enviar(user);
      await enviar(user);

      expect(repository.findPatientByCpf).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: BOTAO })).toBeDisabled();
    });

    it('avisa quando o banco falha e continua na tela', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const repository = criarRepositorio({
        createAttendance: jest.fn(async () => Promise.reject(new Error('falha no banco'))),
      });
      const user = userEvent.setup();
      const { onRegistered } = renderizarTela({ repository });

      await preencherFormulario(user);
      await enviar(user);

      await waitFor(() =>
        expect(alerta).toHaveBeenCalledWith(
          'Atendimento não registrado',
          'Não foi possível salvar o atendimento. Tente novamente.',
        ),
      );
      expect(onRegistered).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: BOTAO })).toBeEnabled();
      expect(screen.getByLabelText('Nome completo')).toHaveDisplayValue('José Alves Martins');
    });
  });

  describe('máscaras', () => {
    it('formata o CPF enquanto o médico digita', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await user.type(screen.getByLabelText('CPF'), '1234567');
      expect(screen.getByLabelText('CPF')).toHaveDisplayValue('123.456.7');

      await user.type(screen.getByLabelText('CPF'), '8909');
      expect(screen.getByLabelText('CPF')).toHaveDisplayValue('123.456.789-09');
    });

    it('formata a data de nascimento enquanto o médico digita', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await user.type(screen.getByLabelText('Data de nascimento'), '14031948');

      expect(screen.getByLabelText('Data de nascimento')).toHaveDisplayValue('14/03/1948');
    });

    it('abre o teclado numérico nos campos de números', () => {
      renderizarTela();

      for (const rotulo of ['CPF', 'Data de nascimento', 'Escolaridade (anos)']) {
        expect(screen.getByLabelText(rotulo)).toHaveProp('keyboardType', 'number-pad');
      }
      expect(screen.getByLabelText('Nome completo')).toHaveProp('autoCapitalize', 'words');
    });
  });

  describe('seletor de sexo', () => {
    it('abre as opções, escolhe uma e mostra a escolha no campo', async () => {
      const user = userEvent.setup();
      renderizarTela();
      const seletor = screen.getByRole('button', { name: 'Sexo' });
      expect(seletor).toHaveAccessibilityValue({ text: 'Não informado' });

      await user.press(seletor);
      expect(screen.getByRole('header', { name: 'Sexo do paciente' })).toBeOnTheScreen();
      await user.press(screen.getByRole('radio', { name: 'Feminino' }));

      expect(screen.queryByRole('radio', { name: 'Feminino' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Sexo' })).toHaveAccessibilityValue({
        text: 'Feminino',
      });
      expect(campo('sex').getByText('Feminino')).toBeOnTheScreen();
    });

    it('marca a opção já escolhida ao abrir de novo', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await user.press(screen.getByRole('button', { name: 'Sexo' }));
      await user.press(screen.getByRole('radio', { name: 'Masculino' }));
      await user.press(screen.getByRole('button', { name: 'Sexo' }));

      expect(screen.getByRole('radio', { name: 'Masculino' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Feminino' })).not.toBeChecked();
    });

    it('fecha sem escolher ao tocar em Cancelar', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await user.press(screen.getByRole('button', { name: 'Sexo' }));
      await user.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('radio', { name: 'Feminino' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Sexo' })).toHaveAccessibilityValue({
        text: 'Não informado',
      });
    });
  });

  describe('profissional responsável', () => {
    it('mostra nome, CRM e e-mail do médico logado', () => {
      renderizarTela();

      expect(
        screen.getByText('Ana Carolina Souza · CRM 12345/DF · ana.souza@unieuro.com.br'),
      ).toBeOnTheScreen();
      expect(
        screen.getByLabelText('Ana Carolina Souza, CRM 12345/DF, ana.souza@unieuro.com.br'),
      ).toBeOnTheScreen();
    });

    it('volta ao login quando não há médico logado', () => {
      renderizarTela({ professional: null });

      expect(useRouter().replace).toHaveBeenCalledWith('/');
      expect(screen.queryByRole('header', { name: 'Novo exame' })).toBeNull();
    });
  });

  describe('disposição dos campos', () => {
    const medirTela = (width: number, height: number) =>
      fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', {
        nativeEvent: { layout: { width, height } },
      });

    it('põe os campos em duas linhas de três no tablet', () => {
      renderizarTela();

      medirTela(1280, 800);

      expect(screen.getByTestId('linha-identificacao')).toHaveStyle({ flexDirection: 'row' });
      expect(screen.getByTestId('linha-perfil')).toHaveStyle({ flexDirection: 'row' });
      expect(screen.getByRole('header', { name: 'Novo exame' })).toHaveStyle({ fontSize: 34 });
    });

    it('põe os campos em uma coluna em tela estreita', () => {
      renderizarTela();

      medirTela(390, 844);

      expect(screen.getByTestId('linha-identificacao')).toHaveStyle({
        flexDirection: 'column',
      });
      expect(screen.getByTestId('linha-perfil')).toHaveStyle({ flexDirection: 'column' });
      expect(screen.getByRole('header', { name: 'Novo exame' })).toHaveStyle({ fontSize: 28 });
    });
  });
});
