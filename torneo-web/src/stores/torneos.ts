import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/axios'
import localforage from 'localforage'

export interface Torneo {
  id: number | string
  nombre: string
  estado: string
  [key: string]: any
}

export interface ResultadoPayload {
  partidoId: number;
  golesLocal: number;
  golesVisitante: number;
  penalesLocal: number | null;
  penalesVisitante: number | null;
  detalleGoles: Array<{ jugadorId: number | string; minuto: number }>;
}

export const useTorneoStore = defineStore('torneos', () => {
  const torneos = ref<Torneo[]>([])
  const cargando = ref(false) 
  const equiposInscritos = ref<any[]>([])
  const fixture = ref<any[]>([])
  const tablaPosiciones = ref<any[]>([])
  const topGoleadores = ref<any[]>([])

  // ==========================================
  // CONSULTAS (GET) - ESTRATEGIA OFFLINE-FIRST
  // ==========================================

  const obtenerTorneos = async () => {
    cargando.value = true
    try {
      const locales = await localforage.getItem<Torneo[]>('torneos_offline')
      if (locales) torneos.value = locales

      if (navigator.onLine) {
        const respuesta = await api.get<Torneo[]>('/api/v1/torneos') 
        torneos.value = respuesta.data
        await localforage.setItem('torneos_offline', respuesta.data)
      }
    } catch (error) {
      console.error('Error al obtener torneos:', error)
    } finally {
      cargando.value = false
    }
  }

  const obtenerFixture = async (torneoId: number | string) => {
    try {
      const cacheKey = `fixture_offline_${torneoId}`
      const locales = await localforage.getItem<any[]>(cacheKey)
      if (locales) fixture.value = locales

      if (navigator.onLine) {
        const response = await api.get(`/api/v1/torneos/${torneoId}/fixture`)
        fixture.value = response.data
        await localforage.setItem(cacheKey, response.data)
      }
      return { exito: true }
    } catch (error) {
      console.error("Error al obtener el fixture:", error)
      return { exito: false }
    }
  }

  const fetchEquiposPorTorneo = async (torneoId: number | string) => {
    try {
      const cacheKey = `equipos_torneo_offline_${torneoId}`
      const locales = await localforage.getItem<any[]>(cacheKey)
      if (locales) equiposInscritos.value = locales

      if (navigator.onLine) {
        const respuesta = await api.get(`/api/v1/torneos/${torneoId}/equipos`)
        equiposInscritos.value = respuesta.data
        await localforage.setItem(cacheKey, respuesta.data)
      }
    } catch (error) {
      console.error("Error al cargar equipos:", error)
    }
  }

  const obtenerTablaPosiciones = async (torneoId: number | string) => {
    try {
      const cacheKey = `posiciones_offline_${torneoId}`
      const locales = await localforage.getItem<any[]>(cacheKey)
      if (locales) tablaPosiciones.value = locales

      if (navigator.onLine) {
        const { data } = await api.get(`/api/v1/torneos/${torneoId}/posiciones`)
        tablaPosiciones.value = data
        await localforage.setItem(cacheKey, data)
      }
    } catch (error) {
      console.error("Error tabla de posiciones:", error)
    }
  }

  const obtenerTopGoleadores = async (torneoId: string | number) => {
    try {
      const cacheKey = `goleadores_offline_${torneoId}`
      const locales = await localforage.getItem<any[]>(cacheKey)
      if (locales) topGoleadores.value = locales

      if (navigator.onLine) {
        const respuesta = await api.get(`/api/v1/torneos/${torneoId}/goleadores`)
        topGoleadores.value = respuesta.data
        await localforage.setItem(cacheKey, respuesta.data)
      }
    } catch (error) {
      console.error("Error al obtener goleadores:", error)
    }
  }

  // ==========================================
  // ESCRITURAS OFFLINE (ENCOLA EN LOCALFORAGE)
  // ==========================================

  const crearTorneo = async (datosTorneo: { nombre: string, fechaInicio: string }) => {
    const datosPuros = JSON.parse(JSON.stringify(datosTorneo))
    
    if (!navigator.onLine) {
      const pendientes = (await localforage.getItem<any[]>('torneos_pendientes')) || []
      pendientes.push(datosPuros)
      await localforage.setItem('torneos_pendientes', pendientes)
      
      torneos.value.push({ ...datosPuros, id: `offline-${Date.now()}`, estado: 'Pendiente' })
      return true
    }

    try {
      await api.post('/api/v1/torneos', datosPuros)
      await obtenerTorneos()
      return true
    } catch (error) {
      console.error('Error al crear el torneo:', error)
      return false
    }
  }

  const guardarResultado = async (payload: ResultadoPayload) => {
    const payloadPuro = JSON.parse(JSON.stringify(payload))
    
    if (!navigator.onLine) {
      console.log("1. Detectó modo offline. Intentando guardar:", payloadPuro)
      
      try {
        const pendientes = (await localforage.getItem<any[]>('resultados_pendientes')) || []
        console.log("2. Resultados pendientes actuales en BD:", pendientes)
        
        pendientes.push(payloadPuro)
        await localforage.setItem('resultados_pendientes', pendientes)
        
        console.log("3. ¡Guardado exitoso en localforage! Total en cola:", pendientes.length)
        
        // Vamos a verificar si de verdad se guardó leyéndolo inmediatamente
        const comprobacion = await localforage.getItem('resultados_pendientes')
        console.log("4. Comprobación de lectura inmediata:", comprobacion)
        
        return { exito: true, mensaje: "Resultado guardado localmente." }
      } catch (error) {
        console.error("🔴 Error grave de localforage al guardar:", error)
        return { exito: false, mensaje: "Error local" }
      }
    }

    // (Aquí va el try/catch normal con el api.put)
    try {
      await api.put(`/api/v1/partidos/resultado`, payloadPuro)
      return { exito: true }
    } catch (error:any) {
      const mensaje = error.response?.data?.detail || error.response?.data?.message || "Error al guardar"
      return { exito: false, mensaje }
    }
  }

  // ==========================================
  // SINCRONIZACIÓN AUTOMÁTICA
  // ==========================================

  const sincronizarTorneosYResultados = async () => {
    if (!navigator.onLine) return

    // 1. Sincronizar Torneos
    const torneosPendientes = await localforage.getItem<any[]>('torneos_pendientes')
    if (torneosPendientes && torneosPendientes.length > 0) {
      for (const t of torneosPendientes) {
        try { await api.post('/api/v1/torneos', t) } catch (e) { console.error(e) }
      }
      await localforage.removeItem('torneos_pendientes')
      await obtenerTorneos()
    }

    // 2. Sincronizar Resultados
    const resultadosPendientes = await localforage.getItem<any[]>('resultados_pendientes')
    if (resultadosPendientes && resultadosPendientes.length > 0) {
      for (const r of resultadosPendientes) {
        try { await api.put(`/api/v1/partidos/resultado`, r) } catch (e) { console.error(e) }
      }
      await localforage.removeItem('resultados_pendientes')
      alert('Se han sincronizado los resultados de los partidos pendientes.')
    }
  }

  // ==========================================
  // ESCRITURAS BLOQUEADAS SIN INTERNET
  // ==========================================

  const EliminarTorneo = async (id: number ) => {
    if (!navigator.onLine) throw new Error('No puedes eliminar sin red.')
    try {
      await api.delete(`/api/v1/torneos/${id}`)
      await obtenerTorneos()
      return true
    } catch (error) { return false }
  }

  const ActualizarTorneo = async (id: number, datosTorneo: { nombre: string, fechaInicio: string, formato: string }) => {
    if (!navigator.onLine) throw new Error('No puedes actualizar sin red.')
    try {
      await api.put(`/api/v1/torneos/${id}`, datosTorneo)
      await obtenerTorneos()
      return true
    } catch (error) { return false }
  }

  const inscribirEquipo = async (torneoId: number | string, equipoId: number | string) => {
    //if (!navigator.onLine) throw new Error('No puedes inscribir equipos sin red.')
    try {
      await api.post(`/api/v1/torneos/${torneoId}/equipos/${equipoId}`)
      if (navigator.onLine){
        await fetchEquiposPorTorneo(torneoId)
      }
      return true 
    } catch (error) { return false }
  }

  const desinscribirEquipo = async (torneoId: number | string, equipoId: number | string) => {
    //if (!navigator.onLine) throw new Error('No puedes desinscribir equipos sin red.')
    try {
      await api.delete(`/api/v1/torneos/${torneoId}/equipos/${equipoId}`)
      if(navigator.onLine){
        await fetchEquiposPorTorneo(torneoId) 
      }
      return true
    } catch (error) { return false }
  }

  const generarFixture = async (torneoId : number | string) => {
    if (!navigator.onLine) throw new Error('No puedes generar fixture sin red.')
    try {
      const response = await api.post(`/api/v1/torneos/${torneoId}/generar-fixture`)
      return { exito: true, mensaje: response.data.mensaje }
    } catch (error: any) {
      return { exito: false, mensaje: error.response?.data?.message || "Error al generar" }
    }
  }

  return { 
    torneos, cargando, equiposInscritos, fixture, tablaPosiciones, topGoleadores,
    obtenerTorneos, fetchEquiposPorTorneo, obtenerFixture, obtenerTablaPosiciones, obtenerTopGoleadores,
    crearTorneo, guardarResultado, 
    EliminarTorneo, ActualizarTorneo, inscribirEquipo, desinscribirEquipo, generarFixture,
    sincronizarTorneosYResultados
  }
})