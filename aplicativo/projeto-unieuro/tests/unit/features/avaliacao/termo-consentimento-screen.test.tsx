import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import TermoConsentimentoScreen, {
  ETAPA_CONSENTIMENTO,
  type ContextoDecisao,
} from '@/features/avaliacao/termo-consentimento-screen';
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
  versaoTermo,
  autorizaImagensPesquisa,
  autorizaDadosPesquisaFutura,
}: ContextoDecisao) {
  return (
    <Text>{`Assina: ${quemAssina}; versão: ${versaoTermo}; imagens: ${autorizaImagensPesquisa}; futuro: ${autorizaDadosPesquisaFutura}`}</Text>
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
        `Assina: paciente; versão: ${TERMO_TCLE.versao}; imagens: null; futuro: null`,
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
        `Assina: responsavel_legal; versão: ${TERMO_TCLE.versao}; imagens: null; futuro: null`,
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
        `Assina: paciente; versão: ${TERMO_TCLE.versao}; imagens: true; futuro: false`,
      ),
    ).toBeOnTheScreen();
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText(ETAPA_CONSENTIMENTO)).toBeNull();
  });
});
