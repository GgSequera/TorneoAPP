import localforage from 'localforage'
import { api } from '@/lib/axios'
import { useNotificacionesStore } from '@/stores/notificaciones'
window.localforage = localforage
// 1. Configuramos la base de datos IndexedDB
localforage.config({
  name: 'TorneoFutbolDB',
  storeName: 'peticiones_offline', // Nombre de la tabla
  description: 'Almacenamiento de peticiones sin conexión'
})

export interface PeticionPendiente {
  id: string
  url: string
  metodo: 'POST' | 'PUT' | 'DELETE'
  data: any
  esFormData?: boolean
  timestamp: number
}

const QUEUE_KEY = 'cola_peticiones_offline'

// 2. Guardar en IndexedDB (Ahora es asíncrono)
export const guardarEnCola = async (url: string, metodo: 'POST' | 'PUT' | 'DELETE', data: any, esFormData = false) => {
  try {
    const cola: PeticionPendiente[] = (await localforage.getItem(QUEUE_KEY)) || []
    
    const nuevaPeticion: PeticionPendiente = {
      id: crypto.randomUUID(),
      url,
      metodo,
      data,
      esFormData,
      timestamp: Date.now()
    }

    cola.push(nuevaPeticion)
    await localforage.setItem(QUEUE_KEY, cola)
    console.log('📌 Guardado en IndexedDB (localforage) para sincronizar después:', nuevaPeticion)
  } catch (error) {
    console.error('Error guardando en IndexedDB:', error)
  }
}

// 3. Procesar la cola al volver la conexión
export const procesarCola = async () => {
  try {
    const cola: PeticionPendiente[] = (await localforage.getItem(QUEUE_KEY)) || []
    if (cola.length === 0) return

    console.log(`🔄 Sincronizando ${cola.length} acciones pendientes desde IndexedDB...`)

    const colaRestante: PeticionPendiente[] = []

    for (const item of cola) {
      try {
        let payload = item.data
        let config = {}
        if (item.esFormData) {
          payload = new FormData()
          for (const key in item.data) {
            const val = item.data[key]
            //payload.append(key, item.data[key])
            if (val && typeof val === 'object' && val.isFile) {
              // Convertimos el texto Base64 de vuelta a un Archivo (Blob)
              const response = await fetch(val.content)
              const blob = await response.blob()
              payload.append(key, blob, val.name)
            } else {
              // Es texto normal (Ej: El nombre del equipo)
              payload.append(key, val)
            }
          }
          //config = { headers: { 'Content-Type': 'multipart/form-data' } }
          config = { headers: { 'Content-Type': undefined } }
        }
        if (item.metodo === 'POST') await api.post(item.url, payload, config)

        if (item.metodo === 'PUT') await api.put(item.url, payload, config)
        if (item.metodo === 'DELETE') await api.delete(item.url)

        let entidad = 'Registro'
        if (item.url.includes('/equipos')) entidad = 'Equipo'
        else if (item.url.includes('/torneos')) entidad = 'Torneo'
        else if (item.url.includes('/jugadores')) entidad = 'Jugador'
        else if (item.url.includes('/usuarios')) entidad = 'Usuario'

        let accion = 'sincronizado'
        if (item.metodo === 'POST') accion = 'creado'
        if (item.metodo === 'PUT') accion = 'actualizado'
        if (item.metodo === 'DELETE') accion = 'eliminado'

        const notificaciones = useNotificacionesStore()
        notificaciones.agregarNotificacion(`✅ ${entidad} ${accion} correctamente tras recuperar la conexión.`)
        console.log(`✅ Sincronizado con éxito: ${item.metodo} ${item.url}`)
      } catch (error) {
        console.error(`❌ Falló la re-sincronización de ${item.url}:`, error)
        colaRestante.push(item) // Si falla por red, se queda en la cola
      }
    }

    // Actualizamos IndexedDB solo con los que fallaron
    await localforage.setItem(QUEUE_KEY, colaRestante)
  } catch (error) {
    console.error('Error procesando la cola de IndexedDB:', error)
  }
}

// 4. Listener automático
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('🌐 Conexión reestablecida. Procesando IndexedDB...')
    procesarCola()
  })
}