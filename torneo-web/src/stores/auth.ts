import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/axios'
import localforage from 'localforage'

export interface UsuarioAuth {
  id?: number
  nombre?: string
  correo?: string
  rol?: string
}

export const useAuthStore = defineStore('auth', () => {
  // Estado: guardaremos los datos del usuario aquí
  const usuario = ref<any>(null)
  const errorAutenticacion = ref<string | null>(null)

  // Función auxiliar para precargar la base de datos local
  const precargarDatosOffline = async () => {
    if (!navigator.onLine) return

    try {
      const [torneosRes, equiposRes, jugadoresRes] = await Promise.all([
        api.get('/api/v1/torneos'),
        api.get('/api/v1/equipos'),
        api.get('/api/v1/jugadores')
      ])

      await localforage.setItem('torneos_offline', torneosRes.data)
      await localforage.setItem('equipos_offline', equiposRes.data)
      await localforage.setItem('jugadores_offline', jugadoresRes.data)

      console.log('✅ Base de datos local (Torneos, Equipos, Jugadores) precargada con éxito.')
    } catch (error) {
      console.error('⚠️ Error al precargar datos para uso offline:', error)
    }
  }

  // Acción: iniciar sesión y precargar
  const iniciarSesion = async (correo: string, contrasena: string) => {
    errorAutenticacion.value = null
    
    try {
      // 1. Hacemos el POST a tu backend enviando las credenciales
      await api.post('/api/v1/auth/login', {
        correo: correo,
        clave: contrasena
      })
      await verificarSesion()
      // 2. Buscar el Token CSRF justo después de iniciar sesión
      //await api.get('/api/v1/auth/csrf')

      // 3. Guardamos los datos del usuario
      //usuario.value = respuesta.data.user || { email: correo }
      
      // ⚡ 4. PRECARGA MAESTRA OFFLINE
      await precargarDatosOffline()

      return true 
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error)
      errorAutenticacion.value = error.response?.data?.Mensaje || 'Credenciales incorrectas'
      throw error
    }
  }

  const registrarUsuario = async (datosRegistro: any) => {
    try {
      errorAutenticacion.value = null;
      await api.post('/api/v1/auth/registro', datosRegistro);
    } catch (error: any) {
      errorAutenticacion.value = error.response?.data?.mensaje || 'Error al registrar la cuenta';
      throw error;
    }
  };

  // Verifica con el backend si la cookie sigue siendo válida
  const verificarSesion = async () => {
    try {
      await api.get('/api/v1/auth/csrf')
      const respuesta = await api.get('/api/v1/auth/me')
      usuario.value = respuesta.data.usuario || respuesta.data

      // Opcional: precargar si el usuario recarga la página estando online
      if (navigator.onLine) {
        precargarDatosOffline()
      }

      return true
    } catch (error) {
      usuario.value = null
      return false
    }
  }

const cerrarSesion = async () => {
    try {
      if (navigator.onLine) {
        await api.post('/api/v1/auth/logout') 
      }
    } catch (error) {
      console.error('Error al cerrar sesión en el backend:', error)
    } finally {
      usuario.value = null
      
      // 1. Limpieza tradicional
      localStorage.clear()
      sessionStorage.clear()

      // 2. 💣 DESTRUCCIÓN MASIVA DEL CACHÉ DE WORKBOX (El verdadero culpable)
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys()
          await Promise.all(cacheKeys.map(key => caches.delete(key)))
          console.log("Caché del Service Worker destruida.")
        } catch (err) {
          console.error("No se pudo limpiar la caché del navegador:", err)
        }
      }

      // 3. Ahora sí, recargamos hacia el login limpios de todo pecado
      window.location.href = '/login'
    }
  }
  const estaAutenticado = () => usuario.value !== null

  return { usuario, errorAutenticacion, iniciarSesion, verificarSesion, estaAutenticado, cerrarSesion, registrarUsuario }
})