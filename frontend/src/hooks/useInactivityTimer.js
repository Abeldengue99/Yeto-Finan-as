import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook de inatividade do utilizador.
 * Monitoriza eventos de interação (mouse, teclado, scroll, toque)
 * e dispara o callback `onInactive` após `timeoutMs` milissegundos sem atividade.
 *
 * @param {Function} onInactive - Callback executado ao atingir o tempo de inatividade.
 * @param {number} timeoutMs - Tempo de inatividade em milissegundos (padrão: 30 minutos).
 */
export default function useInactivityTimer(onInactive, timeoutMs = 30 * 60 * 1000) {
  const lastActivityRef = useRef(Date.now());
  const onInactiveRef = useRef(onInactive);

  // Manter referência atualizada sem recriar listeners
  useEffect(() => {
    onInactiveRef.current = onInactive;
  }, [onInactive]);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Eventos que indicam atividade do utilizador
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      window.addEventListener(event, registerActivity, { passive: true });
    });

    // Verificação periódica a cada 60 segundos (eficiente, sem resets constantes)
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        onInactiveRef.current();
      }
    }, 60_000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, registerActivity);
      });
      clearInterval(checkInterval);
    };
  }, [timeoutMs, registerActivity]);
}
