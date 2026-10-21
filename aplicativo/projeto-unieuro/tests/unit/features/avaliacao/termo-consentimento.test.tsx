import { fireEvent, render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { AVISO_ROLAGEM, TermoConsentimento } from '@/features/avaliacao/termo-consentimento';
import { createTermoStyles } from '@/features/avaliacao/termo-consentimento.styles';
import { TERMO_TCLE, descreverVersao } from '@/features/avaliacao/termo-tcle';

const styles = createTermoStyles(Colors.light);

function renderizarTermo() {
  render(<TermoConsentimento styles={styles} termo={TERMO_TCLE} />);
  return screen.getByLabelText('Texto do termo de consentimento');
}

function medir(rolagem: ReturnType<typeof renderizarTermo>, visivel: number, conteudo: number) {
  fireEvent(rolagem, 'layout', { nativeEvent: { layout: { width: 600, height: visivel } } });
  fireEvent(rolagem, 'contentSizeChange', 600, conteudo);
}

function rolarAte(rolagem: ReturnType<typeof renderizarTermo>, y: number) {
  fireEvent.scroll(rolagem, {
    nativeEvent: {
      contentOffset: { y },
      contentSize: { height: 2000 },
      layoutMeasurement: { height: 500 },
    },
  });
}

describe('TermoConsentimento', () => {
  it('apresentação do termo: mostra o texto completo e o número da versão', () => {
    renderizarTermo();

    expect(screen.getByRole('header', { name: TERMO_TCLE.titulo })).toBeOnTheScreen();
    expect(screen.getByText(TERMO_TCLE.pesquisa)).toBeOnTheScreen();
    expect(screen.getByText(TERMO_TCLE.pesquisador)).toBeOnTheScreen();
    for (const secao of TERMO_TCLE.secoes) {
      expect(screen.getByRole('header', { name: secao.titulo })).toBeOnTheScreen();
      for (const paragrafo of secao.paragrafos) {
        expect(screen.getByText(paragrafo)).toBeOnTheScreen();
      }
    }
    expect(screen.getByText(descreverVersao(TERMO_TCLE))).toBeOnTheScreen();
  });

  it('apresentação do termo: avisa que há mais texto até a rolagem chegar ao fim', () => {
    const rolagem = renderizarTermo();
    medir(rolagem, 500, 2000);

    expect(screen.getByText(AVISO_ROLAGEM)).toBeOnTheScreen();

    rolarAte(rolagem, 800);
    expect(screen.getByText(AVISO_ROLAGEM)).toBeOnTheScreen();

    rolarAte(rolagem, 1500);
    expect(screen.queryByText(AVISO_ROLAGEM)).toBeNull();
  });

  it('não avisa para rolar quando o termo inteiro cabe na tela', () => {
    const rolagem = renderizarTermo();
    medir(rolagem, 900, 880);

    expect(screen.queryByText(AVISO_ROLAGEM)).toBeNull();
  });
});
