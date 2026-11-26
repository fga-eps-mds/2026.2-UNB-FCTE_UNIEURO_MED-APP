import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  AjustesDoTesteProvider,
  type AjustesDoTeste,
} from '@/features/acessibilidade/ajustes-do-teste';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { DecisaoTermo } from '@/features/avaliacao/consent-decision';
import ExameInterrompidoScreen, {
  TITULO_INTERROMPIDO,
} from '@/features/avaliacao/exame-interrompido-screen';
import type { ExameInterrompido } from '@/features/avaliacao/interrupcao';
import TelaFinalScreen, { AGRADECIMENTO } from '@/features/avaliacao/tela-final-screen';
import {
  CORES_ALTO_CONTRASTE,
  CORES_DO_PACIENTE,
  ESCALA_LETRAS_MAIORES,
} from '@/features/avaliacao/tema-do-paciente';
import TermoConsentimentoScreen from '@/features/avaliacao/termo-consentimento-screen';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';

/**
 * A #24 vale para todo o fluxo do teste: além da instrução e das tarefas, o termo de
 * consentimento, a tela final e a do exame interrompido seguem o alto contraste e as
 * letras maiores escolhidos nas configurações.
 */

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const repositorio = { getCpf: jest.fn(async () => '52998224725') };

const exame: ExameInterrompido = {
  atendimentoId: 12,
  nomePaciente: 'José Alves Martins',
  fichaPaciente: '2026-0001',
  tarefa: 2,
  motivo: 'cansaco',
  interrompidoEm: '2026-11-12T14:06:00.000Z',
  tarefasGravadas: [1],
};

const LIGADOS: AjustesDoTeste = { altoContraste: true, letrasMaiores: true };
const DESLIGADOS: AjustesDoTeste = { altoContraste: false, letrasMaiores: false };

function comAjustes(ajustes: AjustesDoTeste, tela: ReactNode) {
  render(
    <SessionProvider initialProfessional={profissional}>
      <AjustesDoTesteProvider inicial={ajustes}>{tela}</AjustesDoTesteProvider>
    </SessionProvider>,
  );
}

const estiloDoTitulo = (nome: string) =>
  StyleSheet.flatten(screen.getByRole('header', { name: nome }).props.style);

const telas: { nome: string; titulo: string; tela: () => ReactNode }[] = [
  {
    nome: 'termo de consentimento',
    titulo: TERMO_TCLE.titulo,
    tela: () => (
      <TermoConsentimentoScreen
        acoes={() => <Text>ações</Text>}
        paciente={{ nome: 'José Alves Martins', ficha: '2026-0184' }}
      />
    ),
  },
  {
    nome: 'tela final',
    titulo: AGRADECIMENTO,
    tela: () => <TelaFinalScreen repository={repositorio} />,
  },
  {
    nome: 'exame interrompido',
    titulo: TITULO_INTERROMPIDO,
    tela: () => (
      <ExameInterrompidoScreen
        atendimento="12"
        repository={repositorio}
        carregar={jest.fn(async () => exame)}
        retomar={jest.fn(async () => ({ retomado: true as const, tarefa: 2 }))}
        onRetomado={jest.fn()}
      />
    ),
  },
];

describe('Cenário: configuração durante o teste (#24)', () => {
  it.each(telas)('$nome: segue o alto contraste e as letras maiores', async ({ titulo, tela }) => {
    comAjustes(DESLIGADOS, tela());
    await act(async () => {});
    const padrao = estiloDoTitulo(titulo);
    screen.unmount();

    comAjustes(LIGADOS, tela());
    await act(async () => {});
    const ajustado = estiloDoTitulo(titulo);

    expect(padrao.color).toBe(CORES_DO_PACIENTE.text);
    expect(ajustado.color).toBe(CORES_ALTO_CONTRASTE.text);
    expect(ajustado.fontSize).toBe(Math.round(padrao.fontSize * ESCALA_LETRAS_MAIORES));
  });

  it('o "Assinar e iniciar" desabilitado usa as cores do alto contraste', () => {
    comAjustes(LIGADOS, <DecisaoTermo onAssinar={jest.fn()} onRecusar={jest.fn()} />);

    const texto = StyleSheet.flatten(screen.getByText('Assinar e iniciar').props.style);
    expect(texto.color).toBe(CORES_ALTO_CONTRASTE.desabilitadoTexto);
  });

  it.each(telas.slice(1))(
    '$nome: o fundo pêssego vira branco no alto contraste',
    async ({ tela }) => {
      const fundoUsado = async (ajustes: AjustesDoTeste) => {
        comAjustes(ajustes, tela());
        await act(async () => {});
        const arvore = JSON.stringify(screen.toJSON());
        screen.unmount();
        return arvore.includes(`"backgroundColor":"${CORES_DO_PACIENTE.fundoAcolhedor}"`);
      };

      await expect(fundoUsado(DESLIGADOS)).resolves.toBe(true);
      await expect(fundoUsado(LIGADOS)).resolves.toBe(false);
    },
  );
});
