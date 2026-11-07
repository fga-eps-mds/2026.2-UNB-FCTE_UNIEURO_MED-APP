import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Colors } from '@/constants/theme';
import {
  CpfResponsavelCampo,
  ERRO_CPF_INVALIDO,
  ERRO_CPF_VAZIO,
  ROTULO_CPF_RESPONSAVEL,
  erroDoCpf,
} from '@/features/avaliacao/cpf-responsavel';
import { createTermoStyles } from '@/features/avaliacao/termo-consentimento.styles';

const styles = createTermoStyles(Colors.light);

function Campo({ inicial = '', aoMudar }: Readonly<{ inicial?: string; aoMudar?: jest.Mock }>) {
  const [valor, setValor] = useState(inicial);
  return (
    <CpfResponsavelCampo
      styles={styles}
      valor={valor}
      onChange={(novo) => {
        setValor(novo);
        aoMudar?.(novo);
      }}
    />
  );
}

const campo = () => screen.getByLabelText(ROTULO_CPF_RESPONSAVEL);

describe('erroDoCpf', () => {
  it('não aponta erro num CPF válido, com ou sem máscara', () => {
    expect(erroDoCpf('111.444.777-35', true)).toBeUndefined();
    expect(erroDoCpf('11144477735', false)).toBeUndefined();
  });

  it('só cobra o CPF vazio depois que a pessoa sai do campo', () => {
    expect(erroDoCpf('', false)).toBeUndefined();
    expect(erroDoCpf('', true)).toBe(ERRO_CPF_VAZIO);
    expect(erroDoCpf('   ', true)).toBe(ERRO_CPF_VAZIO);
  });

  it('não reclama de um CPF incompleto enquanto ele é digitado', () => {
    expect(erroDoCpf('111.444', false)).toBeUndefined();
  });

  it('aponta na hora o CPF completo e inválido', () => {
    expect(erroDoCpf('111.444.777-36', false)).toBe(ERRO_CPF_INVALIDO);
    expect(erroDoCpf('111.111.111-11', false)).toBe(ERRO_CPF_INVALIDO);
  });

  it('aponta o CPF incompleto depois que a pessoa sai do campo', () => {
    expect(erroDoCpf('111.444', true)).toBe(ERRO_CPF_INVALIDO);
  });
});

describe('CpfResponsavelCampo', () => {
  it('mostra o rótulo visível e o campo com a dica de formato', () => {
    render(<Campo />);

    expect(screen.getAllByText(ROTULO_CPF_RESPONSAVEL).length).toBeGreaterThan(0);
    expect(campo()).toHaveProp('placeholder', '000.000.000-00');
    expect(campo()).toHaveProp('keyboardType', 'number-pad');
    expect(campo()).toHaveProp('maxLength', 14);
  });

  it('não deixa o CPF ir para o preenchimento automático', () => {
    render(<Campo />);

    expect(campo()).toHaveProp('importantForAutofill', 'no');
    expect(campo()).toHaveProp('autoComplete', 'off');
  });

  it('aplica a máscara a cada digitação e ignora o que não é dígito', () => {
    const aoMudar = jest.fn();
    render(<Campo aoMudar={aoMudar} />);

    fireEvent.changeText(campo(), '11144');
    expect(campo()).toHaveProp('value', '111.44');
    fireEvent.changeText(campo(), '111.444.777-35 xx');
    expect(campo()).toHaveProp('value', '111.444.777-35');
    expect(aoMudar).toHaveBeenLastCalledWith('111.444.777-35');
  });

  it('limita o CPF a 11 dígitos', () => {
    render(<Campo />);

    fireEvent.changeText(campo(), '111444777359999');

    expect(campo()).toHaveProp('value', '111.444.777-35');
  });

  it('não mostra erro antes de a pessoa mexer no campo', () => {
    render(<Campo />);

    expect(screen.queryByText(ERRO_CPF_VAZIO)).toBeNull();
    expect(screen.queryByText(ERRO_CPF_INVALIDO)).toBeNull();
  });

  it('pede o CPF quando a pessoa sai do campo sem preenchê-lo', () => {
    render(<Campo />);

    fireEvent(campo(), 'focus');
    fireEvent(campo(), 'blur');

    expect(screen.getByText(ERRO_CPF_VAZIO)).toBeOnTheScreen();
    expect(campo()).toHaveProp('accessibilityHint', ERRO_CPF_VAZIO);
  });

  it('aponta o CPF inválido assim que ele fica completo', () => {
    render(<Campo />);

    fireEvent.changeText(campo(), '11144477736');

    expect(screen.getByText(ERRO_CPF_INVALIDO)).toBeOnTheScreen();
  });

  it('tira o erro quando o CPF fica válido', () => {
    render(<Campo />);
    fireEvent.changeText(campo(), '11144477736');

    fireEvent.changeText(campo(), '11144477735');

    expect(screen.queryByText(ERRO_CPF_INVALIDO)).toBeNull();
    expect(campo().props.accessibilityHint).toBeUndefined();
  });

  it('destaca a borda do campo em foco e do campo inválido', () => {
    render(<Campo />);
    const estilo = () => JSON.stringify(campo().props.style);

    expect(estilo()).not.toContain(Colors.light.primary);
    fireEvent(campo(), 'focus');
    expect(estilo()).toContain(Colors.light.primary);
    fireEvent.changeText(campo(), '11144477736');
    expect(estilo()).toContain(Colors.light.error);
    fireEvent(campo(), 'blur');
    expect(estilo()).not.toContain(Colors.light.primary);
  });
});
