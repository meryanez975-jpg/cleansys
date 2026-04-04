import { useEffect, useState, useCallback } from 'react'

/**
 * Bloquea la navegación cuando hay cambios sin guardar.
 *
 * @param {boolean} hayCambios - true cuando hay ediciones sin guardar
 * @returns { navegarConGuardia, showConfirm, confirmar, cancelar }
 */
export function useGuardiaNavegacion(hayCambios) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFn, setPendingFn]     = useState(null)

  // Aviso en cierre/recarga del navegador
  useEffect(() => {
    if (!hayCambios) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hayCambios])

  /**
   * Llama a `fn` directamente si no hay cambios,
   * o muestra el modal de confirmación si los hay.
   */
  const navegarConGuardia = useCallback((fn) => {
    if (!hayCambios) { fn(); return }
    setPendingFn(() => fn)
    setShowConfirm(true)
  }, [hayCambios])

  function confirmar() {
    setShowConfirm(false)
    if (pendingFn) pendingFn()
    setPendingFn(null)
  }

  function cancelar() {
    setShowConfirm(false)
    setPendingFn(null)
  }

  return { navegarConGuardia, showConfirm, confirmar, cancelar }
}
