import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { guardarEnCola } from '@/lib/syncQueue'

const API_URL = 'https://localhost:7101'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// 1. INTERCEPTOR DE PETICIONES (CSRF)
api.interceptors.request.use((config) => {
  const cookies = document.cookie.split(';')
  let tokenCsrf = null

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim()
    if (cookie.startsWith('XSRF-TOKEN=')) {
      tokenCsrf = decodeURIComponent(cookie.substring('XSRF-TOKEN='.length))
      break
    }
  }

  if (tokenCsrf && config.headers) {
    config.headers['X-XSRF-TOKEN'] = tokenCsrf
  }

  return config
}, (error) => {
  return Promise.reject(error)
})

// Función de ayuda para convertir imágenes a Base64 (Texto)
const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// 2. INTERCEPTOR DE RESPUESTAS (401 + Sincronización Offline)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // A) Manejo de sesión expirada o usuario suspendido (401)
    if (error.response && error.response.status === 401) {
      const authStore = useAuthStore()
      authStore.usuario = null

      if (error.config.url?.includes('/auth/me')) {
        // Solo limpiamos, no mostramos alerta roja ni forzamos redirección
        return Promise.reject(error)
      }

      authStore.errorAutenticacion = error.response.data?.Mensaje || error.response.data?.mensaje || 'Tu sesión ha expirado o tu cuenta fue suspendida.'
      
      router.push('/login')
      return Promise.reject(error)
    }

    // B) Detección de Modo Offline (POST, PUT, DELETE)
    const esPeticionEscritura = ['post', 'put', 'delete'].includes(error.config?.method?.toLowerCase())
    const sinConexion = !error.response || !navigator.onLine

    if (sinConexion && esPeticionEscritura) {
      const metodo = error.config.method.toUpperCase()
      const url = error.config.url

      // Control seguro de la data para evitar SyntaxError con JSON.parse
      let data = null
      let esFormData = false
      if (error.config.data instanceof FormData || error.config.data?.constructor?.name === 'FormData' || (error.config.headers && error.config.headers['Content-Type'] === 'multipart/form-data')) {
      //if (error.config.data instanceof FormData) {
        esFormData = true
        data = {}
        for (const [key, value] of error.config.data.entries()) {
          if (value instanceof File || value instanceof Blob) {
            // Si es la imagen, la convertimos a texto seguro (Base64)
            const base64 = await fileToBase64(value)
            data[key] = { isFile: true, name: value.name, type: value.type, content: base64 }
          } else {
            // Si es el texto normal (como el Nombre)
            data[key] = value
          }
        }
      } else if (error.config.data) {
        try {
          data = typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data
        } catch {
          data = error.config.data
        }
      }

      guardarEnCola(url, metodo, data,esFormData)

      // Respuesta simulada de éxito (202 Accepted)
      return Promise.resolve({
        data: { mensaje: 'Guardado localmente. Se sincronizará al volver la conexión.' },
        status: 202,
        statusText: 'Accepted (Offline)',
        headers: {},
        config: error.config
      })
    }

    return Promise.reject(error)
  }
)