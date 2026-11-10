import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import TermoConsentimentoScreen, {
  ETAPA_CONSENTIMENTO,
  type ContextoDecisao,
} from '@/features/avaliacao/termo-consentimento-screen';
import { ROTULO_CPF_RESPONSAVEL } from '@/features/avaliacao/cpf-responsavel';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

// Substitui a área de assinatura do Eduardo: mostra o que a tela entrega a ela.
function acoesDeTeste({
  quemAssina,
  cpfResponsavel,
  versaoTermo,
  autorizaImagensPesquisa,
  autorizaDadosPesquisaFutura,
}: ContextoDecisao) {
  return (
    <Text>{`Assina: ${quemAssina}; cpf: ${cpfResponsavel}; versão: ${versaoTermo}; imagens: ${autorizaImagensPesquisa}; futuro: ${autorizaDadosPesquisaFutura}`}</Text>
  );
}

function renderizarTela(professional: SessionProfessional | null = profissional) {
  render(
    <SessionProvider initialProfessional={professional}>
      <TermoConsentimentoScreen
        acoes={acoesDeTeste}
        paciente={{ nome: 'José Alves Martins', ficha: '2026-0184' }}
      />
    </SessionProvider>,
  );
}

describe('TermoConsentimentoScreen', () => {
  it('apresentação do termo: mostra o paciente, a etapa, o termo e a declaração', () => {
    renderizarTela();

    expect(screen.getByText('José Alves Martins · Ficha 2026-0184')).toBeOnTheScreen();
    expect(screen.getByText(ETAPA_CONSENTIMENTO)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: TERMO_TCLE.titulo })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Declaração de consentimento' })).toBeOnTheScreen();
    expect(screen.getByText(TERMO_TCLE.declaracao)).toBeOnTheScreen();
  });

  it('apresentação do termo: nenhuma tarefa de desenho é aberta antes da decisão', () => {
    renderizarTela();

    const router = useRouter();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('aceite pelo paciente: entrega à assinatura "paciente" e a versão do termo', () => {
    renderizarTela();

    expect(screen.getByRole('radio', { name: 'Paciente' })).toBeChecked();
    expect(
      screen.getByText(
        `Assina: paciente; cpf: null; versão: ${TERMO_TCLE.versao}; imagens: null; futuro: null`,
      ),
    ).toBeOnTheScreen();
  });

  it('aceite pelo responsável legal: entrega à assinatura quem foi marcado', async () => {
    const user = userEvent.setup();
    renderizarTela();

    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

    expect(screen.getByRole('radio', { name: 'Responsável legal' })).toBeChecked();
    expect(
      screen.getByText(
        `Assina: responsavel_legal; cpf: null; versão: ${TERMO_TCLE.versao}; imagens: null; futuro: null`,
      ),
    ).toBeOnTheScreen();
  });

  it('mostra as duas escolhas sem pré-seleção e entrega as respostas ao contexto', async () => {
    const user = userEvent.setup();
    renderizarTela();

    const radios = [
      'Uso das imagens: Sim',
      'Uso das imagens: Não',
      'Uso futuro: Sim',
      'Uso futuro: Não',
    ];
    for (const label of radios)
      expect(screen.getByRole('radio', { name: label })).not.toBeChecked();

    await user.press(screen.getByRole('radio', { name: 'Uso das imagens: Sim' }));
    await user.press(screen.getByRole('radio', { name: 'Uso futuro: Não' }));

    expect(
      screen.getByText(
        `Assina: paciente; cpf: null; versão: ${TERMO_TCLE.versao}; imagens: true; futuro: false`,
      ),
    ).toBeOnTheScreen();
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText(ETAPA_CONSENTIMENTO)).toBeNull();
  });

  describe('CPF do responsável legal', () => {
    const campoCpf = () => screen.queryByLabelText(ROTULO_CPF_RESPONSAVEL);

    it('ao selecionar Paciente, o campo de CPF não é exibido', () => {
      renderizarTela();

      expect(screen.getByRole('radio', { name: 'Paciente' })).toBeChecked();
      expect(campoCpf()).toBeNull();
    });

    it('ao selecionar Responsável legal, exibe o campo de CPF do responsável', async () => {
      const user = userEvent.setup();
      renderizarTela();

      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

      expect(campoCpf()).toBeOnTheScreen();
    });

    it('entrega o CPF como nulo enquanto estiver vazio ou inválido', async () => {
      const user = userEvent.setup();
      renderizarTela();
      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

      fireEvent.changeText(campoCpf()!, '111.444.777');
      expect(screen.getByText(/Assina: responsavel_legal; cpf: null;/)).toBeOnTheScreen();
      fireEvent.changeText(campoCpf()!, '11144477736');
      expect(screen.getByText(/Assina: responsavel_legal; cpf: null;/)).toBeOnTheScreen();
    });

    it('entrega só os 11 dígitos quando o CPF digitado é válido', async () => {
      const user = userEvent.setup();
      renderizarTela();
      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

      fireEvent.changeText(campoCpf()!, '11144477735');

      expect(campoCpf()).toHaveProp('value', '111.444.777-35');
      expect(screen.getByText(/Assina: responsavel_legal; cpf: 11144477735;/)).toBeOnTheScreen();
    });

    it('ao voltar para Paciente, esconde o campo e não entrega o CPF digitado', async () => {
      const user = userEvent.setup();
      renderizarTela();
      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
      fireEvent.changeText(campoCpf()!, '11144477735');

      await user.press(screen.getByRole('radio', { name: 'Paciente' }));

      expect(campoCpf()).toBeNull();
      expect(screen.getByText(/Assina: paciente; cpf: null;/)).toBeOnTheScreen();
    });

    it('descarta o CPF digitado ao voltar para Paciente: ao escolher o responsável de novo, o campo está vazio', async () => {
      const user = userEvent.setup();
      renderizarTela();
      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
      fireEvent.changeText(campoCpf()!, '11144477735');
      await user.press(screen.getByRole('radio', { name: 'Paciente' }));

      await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));

      expect(campoCpf()).toHaveProp('value', '');
      expect(screen.getByText(/Assina: responsavel_legal; cpf: null;/)).toBeOnTheScreen();
    });
  });
});
