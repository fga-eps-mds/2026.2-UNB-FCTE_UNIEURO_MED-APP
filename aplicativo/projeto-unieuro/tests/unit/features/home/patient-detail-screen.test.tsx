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
  type ExamMarking,
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
    {
      id: 12,
      startedAt: '2026-10-05T14:32:00',
      state: 'concluida',
      professionalId: 1,
      marking: null,
    },
    {
      id: 9,
      startedAt: '2026-09-28T10:05:00',
      state: 'interrompida',
      professionalId: 1,
      marking: null,
    },
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

function renderTela(
  estado: Estado = {},
  sessao: SessionProfessional | null = profissional,
  marking?: ExamMarking,
) {
  const { patient = jose, loading = false, loadFailed = false, notFound = false } = estado;
  return render(
    <SessionProvider initialProfessional={sessao}>
      <PatientDetailScreen
        patient={patient}
        loading={loading}
        loadFailed={loadFailed}
        notFound={notFound}
        today={HOJE}
        marking={marking}
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

    it('para o superusuário, diz qual médico aplicou cada exame (#49)', () => {
      renderTela({
        patient: toPatientDetail({
          ...jose,
          exams: [
            {
              id: 12,
              startedAt: '2026-10-05T14:32:00',
              state: 'concluida',
              appliedBy: 'Paulo Henrique Rocha',
              professionalId: 101,
              marking: null,
            },
            {
              id: 9,
              startedAt: '2026-09-28T10:05:00',
              state: 'interrompida',
              appliedBy: 'Ana Carolina Souza',
              professionalId: 101,
              marking: null,
            },
          ],
        }),
      });

      const exames = screen.getAllByTestId('exame');
      expect(exames[0]).toHaveTextContent(/Aplicado por Paulo Henrique Rocha/);
      expect(exames[1]).toHaveTextContent(/Aplicado por Ana Carolina Souza/);
      expect(
        screen.getByLabelText(/aplicado por Paulo Henrique Rocha, Concluído/),
      ).toBeOnTheScreen();
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
          exams: [
            {
              id: 3,
              startedAt: '2026-10-06T09:00:00',
              state: 'em_andamento',
              professionalId: 1,
              marking: null,
            },
          ],
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
          exams: [
            {
              id: 3,
              startedAt: '2026-10-06T09:00:00',
              state: 'cancelada',
              professionalId: 1,
              marking: null,
            },
          ],
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
        exams: [
          { id: 3, startedAt: '2026-10-06T09:00:00', state, professionalId: 1, marking: null },
        ],
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

  describe('Cenário: marcar um exame como teste ou material de ensino (#58)', () => {
    const marcacaoGravada = () => ({
      mark: jest.fn(async () => ({ feito: true as const })),
      unmark: jest.fn(async () => ({ feito: true as const })),
      onChanged: jest.fn(),
    });

    const comMarcacao = (marking: 'teste' | 'ensino' | null, professionalId = 1) =>
      toPatientDetail({
        ...jose,
        exams: [
          {
            id: 12,
            startedAt: '2026-10-05T14:32:00',
            state: 'concluida',
            professionalId,
            marking,
          },
        ],
      });

    it('mostra a marcação ao lado da situação, e o leitor de tela lê a marcação', () => {
      renderTela({ patient: comMarcacao('ensino') });

      expect(within(screen.getByTestId('exame')).getByTestId('marcacao')).toHaveTextContent(
        'Material de ensino',
      );
      expect(
        screen.getByLabelText(
          '05/10/2026 às 14:32, aplicado por Ana Carolina Souza, Concluído, marcado como Material de ensino',
        ),
      ).toBeOnTheScreen();
    });

    it('sem marcação, a linha não mostra selo', () => {
      renderTela();

      expect(screen.queryByTestId('marcacao')).toBeNull();
    });

    it('oferece "Marcar" no exame do próprio médico, inclusive no finalizado', async () => {
      const user = userEvent.setup();
      const marking = marcacaoGravada();
      renderTela({ patient: comMarcacao(null) }, profissional, marking);

      await user.press(
        screen.getByRole('button', {
          name: 'Marcar o exame de 05/10/2026 · 14:32 como teste ou material de ensino',
        }),
      );
      await user.press(screen.getByRole('radio', { name: 'Teste' }));
      await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'senhaForte123');
      await user.press(screen.getByRole('button', { name: 'Marcar exame' }));

      expect(marking.mark).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ id: profissional.id }),
        'teste',
        'senhaForte123',
      );
      expect(marking.onChanged).toHaveBeenCalled();
      expect(screen.queryByRole('header', { name: 'Marcar este exame?' })).toBeNull();
    });

    it('no exame marcado, oferece desfazer a marcação com a senha', async () => {
      const user = userEvent.setup();
      const marking = marcacaoGravada();
      renderTela({ patient: comMarcacao('teste') }, profissional, marking);

      await user.press(
        screen.getByRole('button', { name: 'Desfazer a marcação do exame de 05/10/2026 · 14:32' }),
      );
      await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'senhaForte123');
      // O botão da linha tem o mesmo texto; o do diálogo é o último da tela.
      await user.press(screen.getAllByRole('button', { name: 'Desfazer marcação' }).at(-1)!);

      expect(marking.unmark).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ id: profissional.id }),
        'senhaForte123',
      );
      expect(marking.mark).not.toHaveBeenCalled();
      expect(marking.onChanged).toHaveBeenCalled();
    });

    it('Cenário: marcação cancelada: fecha o diálogo sem gravar nem reler', async () => {
      const user = userEvent.setup();
      const marking = marcacaoGravada();
      renderTela({ patient: comMarcacao(null) }, profissional, marking);

      await user.press(screen.getByRole('button', { name: /^Marcar o exame/ }));
      await user.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('header', { name: 'Marcar este exame?' })).toBeNull();
      expect(marking.mark).not.toHaveBeenCalled();
      expect(marking.onChanged).not.toHaveBeenCalled();
    });

    it('Cenário: superusuário: vê a marcação do exame de outro médico, sem poder mudá-la', () => {
      renderTela(
        { patient: comMarcacao('teste', 99) },
        { ...profissional, superuser: true },
        marcacaoGravada(),
      );

      expect(screen.getByTestId('marcacao')).toHaveTextContent('Teste');
      expect(screen.queryByRole('button', { name: /marcação|Marcar/ })).toBeNull();
    });

    it('sem a marcação ligada pela rota, não oferece o botão', () => {
      renderTela({ patient: comMarcacao(null) });

      expect(screen.queryByRole('button', { name: /^Marcar/ })).toBeNull();
    });
  });
});
