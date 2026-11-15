import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { render, screen, userEvent, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { toPatientDetail, type PatientDetail } from '@/features/home/patient-detail';
import PatientDetailScreen, {
  LOADING_MESSAGE,
  LOAD_FAILED_MESSAGE,
  NOT_FOUND_MESSAGE,
} from '@/features/home/patient-detail-screen';

const profissional: SessionProfessional = {
  id: 1,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const jose: PatientDetail = toPatientDetail({
  id: 7,
  name: 'José Alves Martins',
  recordNumber: '2026-0184',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
  exams: [
    { id: 12, startedAt: '2026-10-05T14:32:00', state: 'concluida' },
    { id: 9, startedAt: '2026-09-28T10:05:00', state: 'interrompida' },
  ],
});

// A idade depende do dia de hoje; a tela recebe a data para o teste não envelhecer.
const HOJE = new Date(2026, 10, 13);

type Estado = {
  patient?: PatientDetail | null;
  loading?: boolean;
  loadFailed?: boolean;
  notFound?: boolean;
};

function renderTela(estado: Estado = {}, sessao: SessionProfessional | null = profissional) {
  const { patient = jose, loading = false, loadFailed = false, notFound = false } = estado;
  return render(
    <SessionProvider initialProfessional={sessao}>
      <PatientDetailScreen
        patient={patient}
        loading={loading}
        loadFailed={loadFailed}
        notFound={notFound}
        today={HOJE}
      />
    </SessionProvider>,
  );
}

describe('PatientDetailScreen', () => {
  describe('Cenário: abrir um paciente', () => {
    it('mostra o nome e os dados do paciente', () => {
      renderTela();

      expect(screen.getByRole('header', { name: 'José Alves Martins' })).toBeOnTheScreen();
      expect(screen.getByText('2026-0184')).toBeOnTheScreen();
      expect(screen.getByText('14/03/1948 · 78 anos')).toBeOnTheScreen();
      expect(screen.getByText('5 anos')).toBeOnTheScreen();
      expect(screen.getByText('Masculino')).toBeOnTheScreen();
    });

    it('avisa quando o sexo não foi informado', () => {
      renderTela({ patient: { ...jose, sex: null } });

      expect(screen.getByText('Não informado')).toBeOnTheScreen();
    });

    it('mostra os exames do mais recente ao mais antigo, com a situação de cada um', () => {
      renderTela();

      expect(screen.getByText('2 exames, do mais recente para o mais antigo')).toBeOnTheScreen();
      const exames = screen.getAllByTestId('exame');
      expect(exames).toHaveLength(2);
      expect(exames[0]).toHaveTextContent(/05\/10\/2026 · 14:32/);
      expect(exames[0]).toHaveTextContent(/Concluído/);
      expect(exames[1]).toHaveTextContent(/28\/09\/2026 · 10:05/);
      expect(exames[1]).toHaveTextContent(/Interrompido/);
    });

    it('diz que foi o próprio profissional quem aplicou os exames', () => {
      renderTela();

      expect(screen.getAllByText('Aplicado por Ana Carolina Souza')).toHaveLength(2);
    });

    it('mostra a situação de um exame que ainda não terminou', () => {
      renderTela({
        patient: toPatientDetail({
          id: 7,
          name: 'José Alves Martins',
          recordNumber: '2026-0184',
          birthDate: '1948-03-14',
          schoolingYears: 5,
          sex: 'masculino',
          exams: [{ id: 3, startedAt: '2026-10-06T09:00:00', state: 'em_andamento' }],
        }),
      });

      expect(screen.getByText('1 exame')).toBeOnTheScreen();
      expect(screen.getByTestId('exame')).toHaveTextContent(/Em andamento/);
    });

    it('mostra a situação "Recusou o termo" para o exame cancelado', () => {
      renderTela({
        patient: toPatientDetail({
          id: 7,
          name: 'José Alves Martins',
          recordNumber: '2026-0184',
          birthDate: '1948-03-14',
          schoolingYears: 5,
          sex: 'masculino',
          exams: [{ id: 3, startedAt: '2026-10-06T09:00:00', state: 'cancelada' }],
        }),
      });

      expect(screen.getByTestId('exame')).toHaveTextContent(/Recusou o termo/);
    });
  });

  describe('Cenário: situação além da cor', () => {
    const comEstado = (state: string) =>
      toPatientDetail({
        id: 7,
        name: 'José Alves Martins',
        recordNumber: '2026-0184',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
        exams: [{ id: 3, startedAt: '2026-10-06T09:00:00', state }],
      });

    // Cor e ícone de cada situação seguem as mensagens do guia de identidade visual.
    it.each([
      ['concluida', 'check-circle', Colors.light.success],
      ['interrompida', 'alert', Colors.light.warning],
      ['cancelada', 'alert', Colors.light.warning],
      ['erro_inferencia', 'close-circle', Colors.light.error],
      ['em_andamento', 'information', Colors.light.info],
    ])('o exame %s mostra o ícone %s junto ao texto', (state, icone, cor) => {
      renderTela({ patient: comEstado(state) });

      const exame = screen.getByTestId('exame');
      const { name, color } = within(exame).UNSAFE_getByType(MaterialCommunityIcons).props;
      expect(name).toBe(icone);
      expect(color).toBe(cor);
    });

    it('esconde o ícone do leitor de tela, que lê só o texto da situação', () => {
      renderTela({ patient: comEstado('erro_inferencia') });

      const icone = within(screen.getByTestId('exame')).UNSAFE_getByType(MaterialCommunityIcons);
      expect(icone.props.accessibilityElementsHidden).toBe(true);
      expect(icone.props.importantForAccessibility).toBe('no-hide-descendants');
    });

    it('mostra o erro ao calcular com a cor de erro, e não com a de "Em andamento"', () => {
      renderTela({ patient: comEstado('erro_inferencia') });

      const texto = screen.getByText('Erro ao calcular');
      expect(texto).toHaveStyle({ color: Colors.light.error });
      expect(screen.getByTestId('situacao')).toHaveStyle({
        backgroundColor: Colors.light.errorBg,
      });
    });
  });

  describe('Cenário: leitor de tela', () => {
    it('lê cada exame de uma vez, com data, hora, profissional e situação', () => {
      renderTela();

      const exame = screen.getByLabelText(
        '05/10/2026 às 14:32, aplicado por Ana Carolina Souza, Concluído',
      );
      expect(exame).toBe(screen.getAllByTestId('exame')[0]);
      expect(exame.props.accessible).toBe(true);
      expect(
        screen.getByLabelText('28/09/2026 às 10:05, aplicado por Ana Carolina Souza, Interrompido'),
      ).toBeOnTheScreen();
    });
  });

  describe('Cenário: voltar para a lista', () => {
    it('volta para a tela anterior pelo botão "Pacientes"', async () => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: 'Voltar para a lista de pacientes' }));

      expect(useRouter().back).toHaveBeenCalled();
    });

    it('mostra o nome e o CRM do profissional', () => {
      renderTela();

      expect(screen.getByText('CRM 12345/DF')).toBeOnTheScreen();
    });
  });

  describe('Cenário: leitura dos dados', () => {
    it('mostra que está carregando, sem dizer que o paciente não existe', () => {
      renderTela({ patient: null, loading: true });

      expect(screen.getByText(LOADING_MESSAGE)).toBeOnTheScreen();
      expect(screen.queryByText(NOT_FOUND_MESSAGE)).toBeNull();
    });

    it('avisa que o paciente não foi encontrado e deixa voltar', async () => {
      const user = userEvent.setup();
      renderTela({ patient: null, notFound: true });

      expect(screen.getByText(NOT_FOUND_MESSAGE)).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Voltar para a lista de pacientes' }));
      expect(useRouter().back).toHaveBeenCalled();
    });

    it('avisa que não foi possível carregar o paciente', () => {
      renderTela({ patient: null, loadFailed: true });

      expect(screen.getByText(LOAD_FAILED_MESSAGE)).toBeOnTheScreen();
    });

    it('mantém o paciente na tela quando uma leitura posterior falha', () => {
      renderTela({ loadFailed: true });

      expect(screen.getByText(LOAD_FAILED_MESSAGE)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'José Alves Martins' })).toBeOnTheScreen();
    });
  });

  describe('Cenário: tela aberta sem login', () => {
    it('volta para o login', () => {
      renderTela({}, null);

      expect(useRouter().replace).toHaveBeenCalledWith('/');
      expect(screen.queryByText('José Alves Martins')).toBeNull();
    });
  });
});
