import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/axios'

// 1. Actualizamos la interfaz con tus campos exactos
export interface Equipo {
  id: number
  nombre: string
  urlEscudo: string
  estado?: string           // 👈 Agregamos estado
  codigoInvitacion?: string // 👈 Agregamos 
}

export interface PerfilJugador {
  tieneEquipo: boolean
  esCapitan?: boolean
  equipo?: string
  codigoInvitacion?: string
}

export const useEquipoStore = defineStore('equipos', () => {
  const equipos = ref<Equipo[]>([])
  const cargando = ref(false)
  const miPerfil = ref<PerfilJugador | null>(null)
  const obtenerEquipos = async () => {
    cargando.value = true
    try {
      const respuesta = await api.get<Equipo[]>('/api/v1/equipos')
      equipos.value = respuesta.data
    } catch (error) {
      console.error('Error al obtener los equipos:', error)
    } finally {
      cargando.value = false
    }
  }

  // 2. Ahora pedimos torneoId, nombre y urlEscudo al crear
  const crearEquipo = async (datosEquipo: FormData) => {
    try {
        await api.post('/api/v1/equipos', datosEquipo, {
          headers: {
            //'Content-Type': 'multipart/form-data'
            'Content-Type': undefined
          }
        })
        if (navigator.onLine) {
            await obtenerEquipos() 
        } else {
            console.log('📌 Equipo guardado localmente (Offline).')
        }
        return true
    } catch (error) {
        console.error('Error al crear el equipo:', error)
        return false
    }
  }

  // 3. Y los mismos campos al actualizar
  const actualizarEquipo = async (id: number, datosEquipo: FormData) => {
    try {
      await api.put(`/api/v1/equipos/${id}`, datosEquipo,{
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      await obtenerEquipos()
      return true
    } catch (error) {
      console.error('Error al actualizar el equipo:', error)
      return false
    }
  }

  const eliminarEquipo = async (id: number) => {
    try {
      await api.delete(`/api/v1/equipos/${id}`)
      await obtenerEquipos()
      return true
    } catch (error) {
      console.error('Error al eliminar el equipo:', error)
      return false
    }
  }

  const verificarPerfilJugador = async () => {
    try {
      const { data } = await api.get<PerfilJugador>('/api/v1/equipos/mi-perfil-jugador')
      miPerfil.value = data
      return data
    } catch (error) {
      console.error('Error al verificar perfil de jugador:', error)
      return { tieneEquipo: false }
    }
  }

  // 👑 5. Crear como capitán
  const crearComoCapitan = async (datos: {
    nombreEquipo: string
    urlEscudo?: string
    nombreJugador: string
    dorsal: number
    posicion?: string
  }) => {
    try {
      const { data } = await api.post('/api/v1/equipos/crear-como-capitan', datos)
      await verificarPerfilJugador()
      return { exito: true, codigo: data.codigoInvitacion }
    } catch (error: any) {
      return { 
        exito: false, 
        mensaje: error.response?.data?.mensaje || 'Error al registrar el equipo.' 
      }
    }
  }

  // ⚽ 6. Unirse por código
  const unirsePorCodigo = async (datos: {
    codigoInvitacion: string
    nombreJugador: string
    dorsal: number
    posicion?: string
  }) => {
    try {
      const { data } = await api.post('/api/v1/equipos/unirse-por-codigo', datos)
      await verificarPerfilJugador()
      return { exito: true, equipoNombre: data.equipoNombre }
    } catch (error: any) {
      return { 
        exito: false, 
        mensaje: error.response?.data?.mensaje || 'El código ingresado no es válido.' 
      }
    }
  }

  const cambiarEstadoEquipo = async (id: number, nuevoEstado: string) => {
    try {
      await api.patch(`/api/v1/equipos/${id}/estado`, { nuevoEstado })
      await obtenerEquipos()
      return true
    } catch (error) {
      console.error('Error al cambiar estado del equipo:', error)
      return false
    }
  }


  return { 
    equipos, 
    cargando, 
    obtenerEquipos, 
    crearEquipo, 
    actualizarEquipo, 
    eliminarEquipo,
    miPerfil,
    verificarPerfilJugador,
    crearComoCapitan,
    unirsePorCodigo,
    cambiarEstadoEquipo
    }
})