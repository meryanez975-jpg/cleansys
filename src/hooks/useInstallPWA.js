import { useState, useEffect } from 'react'

// Captura el evento lo antes posible, antes de que React monte
let _prompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _prompt = e
})

export function useInstallPWA() {
  const [puedeInstalar, setPuedeInstalar] = useState(!!_prompt)

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault()
      _prompt = e
      setPuedeInstalar(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setPuedeInstalar(false))
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
    }
  }, [])

  async function instalar() {
    if (!_prompt) return
    _prompt.prompt()
    const { outcome } = await _prompt.userChoice
    if (outcome === 'accepted') {
      _prompt = null
      setPuedeInstalar(false)
    }
  }

  return { puedeInstalar, instalar }
}
