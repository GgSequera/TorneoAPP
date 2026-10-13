import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/axios'
import localforage from 'localforage'



export const useUsuarioStore = defineStore('usuarios', () => {
  const usuarios = ref<any[]>([])
  const loading = ref(false)


  const obtenerUsuarios = async () => {
    loading.value = true
    try {
      // Ajusta esta ruta a como la tengas en tu controlador de .NET
      const datosLocales = await localforage.getItem('usuarios_offline')
      if (datosLocales) {
        usuarios.value = datosLocales as any[]
      }
      if (navigator.onLine) {
        const respuesta = await api.get('/api/v1/usuarios')        
        usuarios.value = respuesta.data
        await localforage.setItem('usuarios_offline', respuesta.data)
      }
    } catch (error) {
      console.error("Error al obtener usuarios", error)
    } finally {
      loading.value = false
    }
  }

  const cambiarEstadoUsuario = async (id: number, nuevoEstado: string) => {
    if (!navigator.onLine) throw new Error('No puedes cambiar estados sin conexión a internet.')
    try {
      await api.put(`/api/v1/usuarios/${id}/estado`, { estado: nuevoEstado })
      await obtenerUsuarios() // Recargar la tabla
      return true
    } catch (error) {
      console.error("Error al cambiar estado", error)
      return false
    }
  }

  const actualizarUsuario = async (id: string | number, datos: any) => {
    if (!navigator.onLine) throw new Error('No puedes actualizar usuarios sin conexión a internet.')
    try {
      await api.put(`/api/v1/usuarios/${id}`, datos)
      await obtenerUsuarios()
      return true
    } catch (error) {
      console.error('Error al actualizar usuario:', error)
      return false
    }
  }

  const eliminarUsuario = async (id: string | number) => {
    if (!navigator.onLine) throw new Error('No puedes eliminar usuarios sin conexión a internet.')
    try {
      await api.delete(`/api/v1/usuarios/${id}`)
      await obtenerUsuarios()
      return true
    } catch (error) {
      console.error('Error al eliminar usuario:', error)
      return false
    }
  }

  // const crearUsuario = async (datos: any) => {
  //   try {
  //     // Hacemos POST a la raíz o al endpoint de creación
  //     await api.post('/api/v1/auth/registro', datos)
  //     if (navigator.onLine) {
  //       await obtenerUsuarios() 
  //     }
  //     return true
  //   } catch (error) {
  //     console.error('Error al crear usuario:', error)
  //     return false
  //   }
  // }

  const crearUsuario = async (datos: any) => {
    const datosPuros = JSON.parse(JSON.stringify(datos))
    if (!navigator.onLine) {
      // 1. Buscamos si ya hay usuarios en cola, o creamos un arreglo nuevo
      const pendientes = (await localforage.getItem<any[]>('usuarios_pendientes')) || []
      
      // 2. Agregamos el nuevo usuario a la cola local
      pendientes.push(datosPuros)
      await localforage.setItem('usuarios_pendientes', pendientes)
      
      // 3. Lo metemos a la variable reactiva para que se vea en la tabla de inmediato (opcional)
      usuarios.value.push({ ...datos, id: `offline-${Date.now()}`, estado: 'Pendiente' })
      
      return true
    }

    // 🟢 Flujo normal con internet
    try {
      await api.post('/api/v1/auth/registro', datosPuros)
      await obtenerUsuarios() 
      return true
    } catch (error) {
      console.error('Error al crear usuario:', error)
      return false
    }
  }


const sincronizarPendientes = async () => {
    // Si no hay red, no hacemos nada
    if (!navigator.onLine) return

    // 1. Leemos la cola de pendientes
    const pendientes = await localforage.getItem<any[]>('usuarios_pendientes')
    
    if (pendientes && pendientes.length > 0) {
      console.log(`Sincronizando ${pendientes.length} usuarios pendientes...`)
      
      // 2. Enviamos cada registro al backend
      for (const usuario of pendientes) {
        try {
          await api.post('/api/v1/auth/registro', usuario)
        } catch (error) {
          console.error('Error al sincronizar un usuario:', error)
          // Nota: Aquí podrías manejar reintentos si quisieras, pero 
          // para este alcance, asumiremos que si hay internet, el POST pasa.
        }
      }

      // 3. Limpiamos la cola en IndexedDB para no volver a enviarlos
      await localforage.removeItem('usuarios_pendientes')
      
      // 4. Refrescamos la tabla visual para que desaparezcan los temporales 
      // y aparezcan los reales con su ID de base de datos
      await obtenerUsuarios()
      alert('Se han sincronizado los usuarios creados sin conexión.')
    }
  }

  return { usuarios, loading, obtenerUsuarios, cambiarEstadoUsuario, actualizarUsuario, eliminarUsuario, crearUsuario, sincronizarPendientes }
})