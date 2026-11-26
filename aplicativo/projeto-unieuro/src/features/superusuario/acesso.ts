import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { returnToLogin, useSession, type SessionProfessional } from '@/features/auth/session';

/** Responsável pela pesquisa (#49): o único perfil que abre a área do superusuário (#119). */
export function ehSuperusuario(profissional: SessionProfessional | null | undefined): boolean {
  return profissional?.superuser === true;
}

/**
 * Guarda das telas exclusivas do superusuário. Sem sessão, volta ao login; com um médico
 * comum, volta à tela inicial sem mostrar nada da área. Devolve o profissional só quando
 * ele pode ver a tela, e a tela não desenha nada enquanto recebe `null`.
 */
export function useSomenteSuperusuario(): SessionProfessional | null {
  const router = useRouter();
  const { professional } = useSession();
  const permitido = ehSuperusuario(professional);

  useEffect(() => {
    if (!professional) returnToLogin(router);
    else if (!permitido) router.replace('/menu');
  }, [professional, permitido, router]);

  return permitido ? professional : null;
}
