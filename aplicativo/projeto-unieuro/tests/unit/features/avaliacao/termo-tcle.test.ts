import {
  QUEM_ASSINA_OPCOES,
  TERMO_TCLE,
  descreverVersao,
  type TermoTcle,
} from '@/features/avaliacao/termo-tcle';

describe('termo do TCLE', () => {
  it('tem versão, título, pesquisador e ao menos uma seção com texto', () => {
    expect(TERMO_TCLE.versao).not.toBe('');
    expect(TERMO_TCLE.titulo).toBe('Termo de consentimento livre e esclarecido');
    expect(TERMO_TCLE.pesquisador).toContain('Pesquisador responsável');
    expect(TERMO_TCLE.secoes.length).toBeGreaterThan(0);
    for (const secao of TERMO_TCLE.secoes) {
      expect(secao.titulo).not.toBe('');
      expect(secao.paragrafos.length).toBeGreaterThan(0);
    }
  });

  it('fica marcado como provisório até chegar o texto oficial do cliente', () => {
    expect(TERMO_TCLE.provisorio).toBe(true);
    expect(descreverVersao(TERMO_TCLE)).toBe('Versão do termo: rascunho (texto provisório)');
  });

  it('mostra só o número da versão quando o texto é o oficial', () => {
    const oficial: TermoTcle = { ...TERMO_TCLE, versao: '1.0', provisorio: false };

    expect(descreverVersao(oficial)).toBe('Versão do termo: 1.0');
  });

  it('oferece paciente e responsável legal como quem assina', () => {
    expect(QUEM_ASSINA_OPCOES.map((opcao) => opcao.valor)).toEqual([
      'paciente',
      'responsavel_legal',
    ]);
  });
});
