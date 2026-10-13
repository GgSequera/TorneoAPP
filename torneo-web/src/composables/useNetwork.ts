import { ref, onMounted, onUnmounted } from 'vue'

export function useNetwork() {
  // Inicializamos con el estado actual del navegador
  const isOnline = ref(navigator.onLine)

  const actualizarEstado = () => {
    isOnline.value = navigator.onLine
  }

  onMounted(() => {
    window.addEventListener('online', actualizarEstado)
    window.addEventListener('offline', actualizarEstado)
  })

  onUnmounted(() => {
    window.removeEventListener('online', actualizarEstado)
    window.removeEventListener('offline', actualizarEstado)
  })

  return { isOnline }
}