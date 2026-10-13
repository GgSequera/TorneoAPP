<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTorneoStore } from '@/stores/torneos' 
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/axios'
import { useToast } from '@/components/ui/toast/use-toast'
import localforage from 'localforage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNetwork } from '@/composables/useNetwork'
import { ArrowLeft, Wand2, Plus, Trash2 } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const route = useRoute()
const router = useRouter()
const torneoStore = useTorneoStore()
const authStore = useAuthStore()
const { toast } = useToast()
const { isOnline } = useNetwork()

// Detección de Roles
const rolUsuario = computed(() => authStore.usuario?.rol?.toLowerCase() || '')
const esAdmin = computed(() => rolUsuario.value === 'administrador' || rolUsuario.value === 'admin')
const esArbitro = computed(() => rolUsuario.value === 'arbitro')
const esJugador = computed(() => rolUsuario.value === 'jugador')

// Permiso para modificar resultados de partidos
const puedeCargarMarcador = computed(() => esAdmin.value || esArbitro.value)

const esPartidoFinalizado = computed(() => partidoSeleccionado.value?.estado === 'Finalizado')
const penalesLocalInput = ref(null)
const penalesVisitanteInput = ref(null)
const torneoId = route.params.id
const catalogoEquipos = ref([])
const equipoSeleccionado = ref("")
const datosTorneo = ref(null)

const handleOnline = async () => {
  await torneoStore.sincronizarTorneosYResultados()
}

const vistaActiva = ref('fixture') 
// --- NAVEGACIÓN ESTILO PREMIER LEAGUE ---
const jornadaActivaIndex = ref(0)

const jornadaSeleccionada = computed(() => {
  const lista = torneoStore.fixture || []
  if (lista.length === 0) return null
  return lista[jornadaActivaIndex.value] || lista[0]
})

const anteriorJornada = () => {
  if (jornadaActivaIndex.value > 0) {
    jornadaActivaIndex.value--
  }
}

const siguienteJornada = () => {
  const total = (torneoStore.fixture || []).length
  if (jornadaActivaIndex.value < total - 1) {
    jornadaActivaIndex.value++
  }
}

// Helper para buscar el escudo de un equipo por su ID
// Helper para buscar el escudo de un equipo por su ID
const obtenerEscudoEquipo = (equipoId) => {
  const eq = (torneoStore.equiposInscritos || []).find((e) => e.id === equipoId)
  return eq?.urlEscudo || null
}
const equiposDisponibles = computed(() => {
  return catalogoEquipos.value.filter(equipo => 
    equipo.estado === 'Aprobado' &&
    !torneoStore.equiposInscritos.some(inscrito => inscrito.id === equipo.id)
  )
})

// --- HELPERS PARA EL BRACKET DE LLAVES ---
const esGanador = (partido, lado) => {
  if (partido.golesLocal === null || partido.golesVisitante === null) return false
  if (partido.golesLocal > partido.golesVisitante) return lado === 'local'
  if (partido.golesVisitante > partido.golesLocal) return lado === 'visitante'
  if (partido.penalesLocal !== null && partido.penalesVisitante !== null) {
    if (partido.penalesLocal > partido.penalesVisitante) return lado === 'local'
    if (partido.penalesVisitante > partido.penalesLocal) return lado === 'visitante'
  }
  return false
}

const esPerdedor = (partido, lado) => {
  if (partido.golesLocal === null || partido.golesVisitante === null) return false
  return !esGanador(partido, lado) && partido.estado === 'Finalizado'
}

onMounted(async () => {
  window.addEventListener('online', handleOnline)
  await torneoStore.sincronizarTorneosYResultados()

  await torneoStore.obtenerFixture(torneoId)
  await torneoStore.obtenerTorneos()
  datosTorneo.value = torneoStore.torneos.find(t => t.id == torneoId)

  await torneoStore.fetchEquiposPorTorneo(torneoId)
  
  if (esAdmin.value) {
    try {
      const respuesta = await api.get('/api/v1/equipos')
      catalogoEquipos.value = respuesta.data
    } catch (e) { 
      console.error("Error al cargar catálogo") 
    }
  }

  if (datosTorneo.value?.formato === 'Liga') {
    await torneoStore.obtenerTablaPosiciones(torneoId)
  }

  await torneoStore.obtenerTopGoleadores(torneoId) 
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
})

const inscribir = async () => {

 const maximoPermitido = datosTorneo.value?.maxEquipos || 16
  if (torneoStore.equiposInscritos.length >= maximoPermitido) {
    return toast({ 
      title: 'Capacidad Máxima Alcanzada', 
      description: `Este torneo tiene un límite de ${maximoPermitido} equipos y ya está completo.`, 
      variant: 'destructive' 
    })
  }

  // 🛡️ VALIDACIÓN PREVENTIVA: Si ya tiene Fixture generado
  if (torneoStore.fixture && torneoStore.fixture.length > 0) {
    return toast({
      title: 'Torneo en curso',
      description: 'No puedes inscribir nuevos equipos porque el calendario ya fue generado.',
      variant: 'destructive'
    })
  }
  if (!equipoSeleccionado.value) return
  const exito = await torneoStore.inscribirEquipo(torneoId, equipoSeleccionado.value)
  
  if (exito) {
    equipoSeleccionado.value = "" 
    if(!isOnline.value){
      toast({ title: 'Guardado Offline', description: 'La inscripción se guardó localmente y se sincronizará al volver la conexión.' })
    } else {
      toast({ title: '¡Inscripción exitosa!', description: 'Equipo agregado correctamente.' })
    }
  }else{
      toast({ 
      title: 'Inscripción Rechazada', 
      description: 'No se pudo inscribir el equipo. Es posible que el torneo haya alcanzado su cupo máximo o el equipo ya esté inscrito.', 
      variant: 'destructive' 
    })
  }
}

const darDeBaja = async (equipoId) => {
  if (!confirm("¿Seguro que quieres sacar a este equipo del torneo?")) return
  
  const exito = await torneoStore.desinscribirEquipo(torneoId, equipoId)
  if (exito) {
    if(!isOnline.value){
      toast({ title: 'Guardado Offline', description: 'El equipo fue eliminado localmente y se sincronizará al volver la conexión.', variant: 'destructive' })
    } else {
      toast({ title: 'Equipo eliminado', description: 'El equipo fue dado de baja.', variant: 'destructive' })
    }
  }
}

const modalConfirmacionAbierto = ref(false)
const abrirConfirmacionFixture = () => {
  modalConfirmacionAbierto.value = true
}

const procesarFixture = async () => {
  modalConfirmacionAbierto.value = false 
  if (!isOnline.value) {
    return toast({ title: 'Sin conexión', description: 'No puedes generar un fixture sin internet.', variant: 'destructive' })
  }
  const resultado = await torneoStore.generarFixture(route.params.id)
  
  if (resultado.exito) {
    toast({ title: '¡Fixture Generado!', description: resultado.mensaje })
    await torneoStore.obtenerFixture(torneoId)
  } else {
    toast({ title: 'Error', description: resultado.mensaje, variant: 'destructive' })
  }
}

const obtenerNombreRonda = (numeroRonda, totalRondas) => {
  const distanciaAEstrategiaFinal = totalRondas - numeroRonda
  switch (distanciaAEstrategiaFinal) {
    case 0: return '🏆 Gran Final'
    case 1: return '🔥 Semifinales'
    case 2: return '⚔️ Cuartos de Final'
    case 3: return '🥊 Octavos de Final'
    default: return `Ronda ${numeroRonda}`
  }
}

const partidoSeleccionado = ref(null)
const golesLocalInput = ref(0)
const golesVisitanteInput = ref(0)
const modalAbierto = ref(false)

const registroGolesLocal = ref([])
const registroGolesVisitante = ref([])

const jugadoresLocal = ref([])
const jugadoresVisitante = ref([])

const abrirModalMarcador = async (partido) => {
  // 🛡️ REGLA: Si no es Admin ni Árbitro, no puede abrir el editor de resultados
  if (!puedeCargarMarcador.value) return

  if (partido.equipoLocalNombre === 'Por definir' || partido.equipoVisitanteNombre === 'Por definir') {
    return
  }
  if (partido.estado === 'Finalizado') {
    toast({ 
      title: 'Partido Cerrado', 
      description: 'Este resultado ya es definitivo y no puede ser modificado.', 
      variant: 'destructive' 
    })
  }
  
  partidoSeleccionado.value = partido
  golesLocalInput.value = 0
  golesVisitanteInput.value = 0
  
  const detalleLocal = partido.golesLocalDetalle || []
  const detalleVisitante = partido.golesVisitanteDetalle || []
  
  registroGolesLocal.value = [...detalleLocal]
  registroGolesVisitante.value = [...detalleVisitante]
  
  const marcadorLocal = partido.golesLocal ?? 0
  while (registroGolesLocal.value.length < marcadorLocal) {
    registroGolesLocal.value.push({ jugadorId: '', minuto: null })
  }
  
  const marcadorVisitante = partido.golesVisitante ?? 0
  while (registroGolesVisitante.value.length < marcadorVisitante) {
    registroGolesVisitante.value.push({ jugadorId: '', minuto: null })
  }

  golesLocalInput.value = marcadorLocal
  golesVisitanteInput.value = marcadorVisitante
  
  penalesLocalInput.value = partido.penalesLocal ?? null
  penalesVisitanteInput.value = partido.penalesVisitante ?? null

  try {
    let todosLosJugadores = []

    if (isOnline.value) {
      const respuesta = await api.get('/api/v1/jugadores')
      todosLosJugadores = respuesta.data
      await localforage.setItem('jugadores_offline', todosLosJugadores)
    } else {
      todosLosJugadores = (await localforage.getItem('jugadores_offline')) || []
    }

    jugadoresLocal.value = todosLosJugadores.filter(
      j => String(j.equipoId) === String(partido.equipoLocalId)
    )
    jugadoresVisitante.value = todosLosJugadores.filter(
      j => String(j.equipoId) === String(partido.equipoVisitanteId)
    )

  } catch (error) {
    console.error("Error al cargar jugadores para el acta:", error)
    const respaldos = (await localforage.getItem('jugadores_offline')) || []
    jugadoresLocal.value = respaldos.filter(j => String(j.equipoId) === String(partido.equipoLocalId))
    jugadoresVisitante.value = respaldos.filter(j => String(j.equipoId) === String(partido.equipoVisitanteId))
  }
  
  modalAbierto.value = true
}

const guardarMarcador = async () => {
  if (!partidoSeleccionado.value) return

  if (datosTorneo.value?.formato === 'Llaves' && golesLocalInput.value === golesVisitanteInput.value) {
    if (penalesLocalInput.value === null || penalesVisitanteInput.value === null) {
      toast({ title: 'Atención', description: 'Debes ingresar el resultado de los penales para desempatar.', variant: 'destructive' })
      return
    }
    if (penalesLocalInput.value === penalesVisitanteInput.value) {
      toast({ title: 'Atención', description: 'Los penales no pueden quedar empatados.', variant: 'destructive' })
      return
    }
  }

  const golesAEnviar = [
    ...registroGolesLocal.value.map(g => ({ jugadorId: g.jugadorId, minuto: g.minuto || 0 })),
    ...registroGolesVisitante.value.map(g => ({ jugadorId: g.jugadorId, minuto: g.minuto || 0 }))
  ].filter(g => g.jugadorId !== '')

  const payload = {
    partidoId: partidoSeleccionado.value.partidoId,
    golesLocal: Number(golesLocalInput.value) || 0,
    golesVisitante: Number(golesVisitanteInput.value) || 0,
    penalesLocal: penalesLocalInput.value !== null && penalesLocalInput.value !== '' ? Number(penalesLocalInput.value) : null,
    penalesVisitante: penalesVisitanteInput.value !== null && penalesVisitanteInput.value !== '' ? Number(penalesVisitanteInput.value) : null,
    detalleGoles: golesAEnviar 
  }

  const resultado = await torneoStore.guardarResultado(payload)
  if (resultado.exito) {
    modalAbierto.value = false
    if (!isOnline.value) {
       toast({ title: 'Guardado Offline', description: 'El marcador se guardó localmente y se enviará al conectarse.' })
    } else {
       toast({ title: '¡Resultado Guardado!', description: 'El marcador y los goleadores se registraron correctamente.' })
       await torneoStore.obtenerFixture(torneoId)
       await torneoStore.obtenerTopGoleadores(torneoId) 
    }
  } else {
    toast({ title: 'Operación denegada', description: resultado.mensaje, variant: 'destructive' })
  }
}

const sumarGoles = (equipo) => {
  if (equipo === 'local') golesLocalInput.value++
  if (equipo === 'visitante') golesVisitanteInput.value++
}

const restarGoles = (equipo) => {
  if (equipo === 'local' && golesLocalInput.value > 0) golesLocalInput.value--
  if (equipo === 'visitante' && golesVisitanteInput.value > 0) golesVisitanteInput.value--
}

watch(golesLocalInput, (nuevoValor) => {
  const actual = registroGolesLocal.value.length
  if (nuevoValor > actual) {
    for(let i = 0; i < (nuevoValor - actual); i++) {
      registroGolesLocal.value.push({ jugadorId: '', minuto: null })
    }
  } else if (nuevoValor < actual) {
    registroGolesLocal.value.splice(nuevoValor)
  }
})

watch(golesVisitanteInput, (nuevoValor) => {
  const actual = registroGolesVisitante.value.length
  if (nuevoValor > actual) {
    for(let i = 0; i < (nuevoValor - actual); i++) {
      registroGolesVisitante.value.push({ jugadorId: '', minuto: null })
    }
  } else if (nuevoValor < actual) {
    registroGolesVisitante.value.splice(nuevoValor)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- 1. Cabecera -->
    <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div>
        <router-link to="/torneos" class="inline-flex items-center text-sm text-zinc-400 hover:text-white transition-colors mb-4 group">
          <ArrowLeft class="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Volver a Torneos
        </router-link>
        
        <h2 class="text-3xl font-bold text-white capitalize">
          {{ datosTorneo ? datosTorneo.nombre : 'Cargando torneo...' }}
        </h2>
        <p class="text-zinc-400 mt-1">
          <span v-if="esJugador">Consulta el calendario, resultados y tabla de tu torneo.</span>
          <span v-else>Administra las inscripciones y el calendario oficial.</span>
        </p>
      </div>

      <!-- Botón Generar Fixture (SOLO VISIBLE PARA ADMIN) -->
      <Button 
        v-if="esAdmin && (!torneoStore.fixture || torneoStore.fixture.length === 0)"
        @click="abrirConfirmacionFixture"
        :disabled="torneoStore.equiposInscritos.length < 2"
        class="bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 border-0 h-10 px-6"
      >
        <Wand2 class="w-4 h-4 mr-2" />
        Generar Fixture
      </Button>
    </div>

    <!-- 2. Grid de Contenido -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Tarjeta Izquierda: Inscribir Equipo (SOLO VISIBLE PARA ADMIN) -->
      <div v-if="esAdmin" class="lg:col-span-1 border border-zinc-800 bg-zinc-900 rounded-xl shadow-sm p-6 flex flex-col h-fit">
        <div class="flex justify-between items-start mb-2">
          <h3 class="text-lg font-semibold text-white mb-1">Inscribir Equipo</h3>
          <span 
              :class="[
                'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                torneoStore.equiposInscritos.length >= (datosTorneo?.maxEquipos || 16)
                  ? 'bg-red-950/60 border-red-500/40 text-red-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
              ]"
            >
              {{ torneoStore.equiposInscritos.length }} / {{ datosTorneo?.maxEquipos || '∞' }} Cupos
            </span>
        </div>
        <p class="text-sm text-zinc-400 mb-6">Equipos disponibles: {{ equiposDisponibles.length }}</p>
        
        <div class="space-y-4">
          <select 
            v-model="equipoSeleccionado" 
            class="w-full bg-zinc-950 border border-zinc-700 text-white rounded-md p-2.5 text-sm focus:ring-zinc-500 focus:border-zinc-500 outline-none"
          >
            <option value="" disabled>Selecciona un equipo...</option>
            <option v-for="equipo in equiposDisponibles" :key="equipo.id" :value="equipo.id">
              {{ equipo.nombre }}
            </option>
          </select>

          <Button 
            class="w-full bg-white text-black hover:bg-zinc-200" 
            @click="inscribir"
            :disabled="!equipoSeleccionado || equiposDisponibles.length === 0"
          >
            <Plus class="w-4 h-4 mr-2" />
            Inscribir al Torneo
          </Button>
        </div>
      </div>

      <!-- Tarjeta Derecha: Equipos Participantes (Se expande si no es Admin) -->
      <div :class="[esAdmin ? 'lg:col-span-2' : 'lg:col-span-3', 'border border-zinc-800 bg-zinc-900 rounded-xl shadow-sm overflow-hidden flex flex-col']">
        <div class="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <h3 class="text-lg font-semibold text-white">
            Equipos Participantes ({{ torneoStore.equiposInscritos.length }})
          </h3>
        </div>
        
        <Table>
          <TableHeader class="bg-zinc-950/50">
            <TableRow class="hover:bg-transparent border-zinc-800">
              <TableHead class="text-zinc-400 w-[100px]">Escudo</TableHead>
              <TableHead class="text-zinc-400">Nombre del Club</TableHead>
              <TableHead v-if="esAdmin" class="text-zinc-400 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="equipo in torneoStore.equiposInscritos" :key="equipo.id" class="border-zinc-800 hover:bg-zinc-800/50">
              <TableCell>
                <img v-if="equipo.urlEscudo" :src="equipo.urlEscudo" class="w-8 h-8 rounded-full bg-zinc-950 object-contain p-0.5 border border-zinc-800" />
                <div v-else class="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs text-zinc-400 border border-zinc-700">⚽</div>
              </TableCell>
              <TableCell class="font-medium text-zinc-200 text-base">{{ equipo.nombre }}</TableCell>
              <TableCell v-if="esAdmin" class="text-right">
                <Button variant="destructive" size="sm" class="bg-red-950/50 text-red-500 border border-red-900 hover:bg-red-900 hover:text-white" @click="darDeBaja(equipo.id)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
            
            <TableRow v-if="torneoStore.equiposInscritos.length === 0">
              <TableCell :colspan="esAdmin ? 3 : 2" class="h-32 text-center text-zinc-500">
                No hay equipos inscritos aún.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

    </div>
  </div>

  <!-- SECCIÓN INFERIOR CON PESTAÑAS (FIXTURE / POSICIONES / GOLEADORES) -->
  <Card v-if="torneoStore.fixture?.length > 0" class="mt-8 bg-zinc-950 border-zinc-800 text-white shadow-xl">
    
    <CardHeader class="border-b border-zinc-800/60 bg-zinc-900/40 pb-0 px-6 pt-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <CardTitle class="text-xl font-bold flex items-center gap-2">
            <span>🏆 Detalles del Torneo</span>
          </CardTitle>
          <CardDescription class="text-zinc-400 text-xs mt-1">
            Formato: <span class="text-primary font-semibold uppercase">{{ datosTorneo?.formato }}</span>
          </CardDescription>
        </div>
      </div>

      <!-- PESTAÑAS -->
      <div class="flex gap-6 border-b border-zinc-800">
        <button 
          @click="vistaActiva = 'fixture'"
          :class="['pb-3 text-sm font-medium transition-colors relative', 
                   vistaActiva === 'fixture' ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300']"
        >
          Calendario y Posiciones
          <div v-if="vistaActiva === 'fixture'" class="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>
        </button>
        
        <button 
          @click="vistaActiva = 'goleadores'"
          :class="['pb-3 text-sm font-medium transition-colors relative', 
                   vistaActiva === 'goleadores' ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300']"
        >
          Top 10 Goleadores
          <div v-if="vistaActiva === 'goleadores'" class="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>
        </button>
      </div>
    </CardHeader>
    
    <CardContent class="pt-6">
      <!-- VISTA 1: FIXTURE Y POSICIONES -->
      <div v-show="vistaActiva === 'fixture'">
        
        <!-- FORMATO LIGA -->
        <!-- ⚽ FORMATO LIGA ESTILO PREMIER LEAGUE -->
        <div v-if="datosTorneo?.formato === 'Liga'" class="space-y-8">
          
          <!-- BARRA DE NAVEGACIÓN CENTRAL DE FECHAS (ESTILO PREMIER LEAGUE) -->
          <div class="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div class="flex items-center justify-between max-w-md mx-auto">
              
              <!-- Botón Anterior -->
              <button 
                @click="anteriorJornada" 
                :disabled="jornadaActivaIndex === 0"
                class="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 flex items-center justify-center text-white transition-all shadow-md active:scale-95 border border-zinc-700"
                title="Jornada anterior"
              >
                ◀
              </button>

              <!-- Título Central Fecha -->
              <div class="text-center space-y-1">
                <span class="text-xs uppercase tracking-widest text-emerald-400 font-bold font-mono">Calendario Oficial</span>
                <h3 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Fecha {{ jornadaSeleccionada?.numero }}
                </h3>
                <p class="text-xs text-zinc-400 font-medium">
                  {{ jornadaSeleccionada?.partidos?.length || 0 }} partidos programados
                </p>
              </div>

              <!-- Botón Siguiente -->
              <button 
                @click="siguienteJornada" 
                :disabled="jornadaActivaIndex >= (torneoStore.fixture?.length - 1)"
                class="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 flex items-center justify-center text-white transition-all shadow-md active:scale-95 border border-zinc-700"
                title="Siguiente jornada"
              >
                ▶
              </button>

            </div>

            <!-- Selector Rápido para Ligas de muchos equipos (28 equipos = 27 fechas) -->
            <div v-if="torneoStore.fixture?.length > 4" class="mt-4 pt-4 border-t border-zinc-800/60 flex items-center justify-center gap-2">
              <span class="text-xs text-zinc-400">Saltar a fecha:</span>
              <select 
                v-model="jornadaActivaIndex" 
                class="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-emerald-500"
              >
                <option v-for="(jorn, idx) in torneoStore.fixture" :key="jorn.jornadaId" :value="idx">
                  Jornada {{ jorn.numero }}
                </option>
              </select>
            </div>
          </div>

          <!-- LISTA DE PARTIDOS DE LA JORNADA SELECCIONADA (ESTILO PREMIER LEAGUE) -->
<div 
              v-for="partido in jornadaSeleccionada.partidos" 
              :key="partido.partidoId"
              @click="abrirModalMarcador(partido)"
              :class="[
                'p-3.5 sm:p-5 flex items-center justify-between gap-2 transition-all group',
                puedeCargarMarcador ? 'hover:bg-zinc-800/40 cursor-pointer' : 'cursor-default'
              ]"
            >
              <!-- EQUIPO LOCAL (Alineado a la derecha, recortable si no cabe) -->
              <div class="flex items-center justify-end gap-2 sm:gap-3 flex-1 min-w-0">
                <span class="font-bold text-xs sm:text-base text-zinc-200 group-hover:text-white text-right truncate">
                  {{ partido.equipoLocalNombre }}
                </span>
                
                <!-- Escudo Local -->
                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  <img 
                    v-if="obtenerEscudoEquipo(partido.equipoLocalId)" 
                    :src="obtenerEscudoEquipo(partido.equipoLocalId)" 
                    class="w-full h-full object-contain p-0.5" 
                  />
                  <span v-else class="text-[10px] sm:text-xs font-black text-zinc-400">
                    {{ partido.equipoLocalNombre.slice(0, 2).toUpperCase() }}
                  </span>
                </div>
              </div>

              <!-- 👇 MARCADOR CENTRAL BLINDADO (shrink-0 y whitespace-nowrap) -->
              <div class="flex flex-col items-center justify-center shrink-0 px-1 sm:px-3">
                <div class="bg-zinc-950 border border-zinc-800 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl shadow-inner flex items-center justify-center whitespace-nowrap min-w-[65px] sm:min-w-[85px]">
                  <span v-if="partido.golesLocal !== null" class="text-sm sm:text-lg font-black text-emerald-400 font-mono tracking-wider whitespace-nowrap">
                    {{ partido.golesLocal }} : {{ partido.golesVisitante }}
                  </span>
                  <span v-else class="text-xs sm:text-sm font-bold text-zinc-400 font-mono whitespace-nowrap">
                    VS
                  </span>
                </div>
                
                <span v-if="partido.estado === 'Finalizado'" class="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mt-1 whitespace-nowrap">
                  ✓ Finalizado
                </span>
                <span v-else class="text-[9px] font-medium text-zinc-500 mt-1 whitespace-nowrap">
                  Por jugar
                </span>
              </div>

              <!-- EQUIPO VISITANTE (Alineado a la izquierda, recortable si no cabe) -->
              <div class="flex items-center justify-start gap-2 sm:gap-3 flex-1 min-w-0">
                <!-- Escudo Visitante -->
                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  <img 
                    v-if="obtenerEscudoEquipo(partido.equipoVisitanteId)" 
                    :src="obtenerEscudoEquipo(partido.equipoVisitanteId)" 
                    class="w-full h-full object-contain p-0.5" 
                  />
                  <span v-else class="text-[10px] sm:text-xs font-black text-zinc-400">
                    {{ partido.equipoVisitanteNombre.slice(0, 2).toUpperCase() }}
                  </span>
                </div>

                <span class="font-bold text-xs sm:text-base text-zinc-200 group-hover:text-white text-left truncate">
                  {{ partido.equipoVisitanteNombre }}
                </span>
              </div>

            </div>

          <!-- TABLA DE POSICIONES (AHORA SIEMPRE ACCESIBLE ABAJO) -->
          <div class="tabla-posiciones-container mt-8 pt-4 border-t border-zinc-800">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-bold text-white flex items-center gap-2">
                <span>📊</span> Tabla General de Posiciones
              </h3>
              <span class="text-xs text-zinc-400 font-mono">Actualizado en tiempo real</span>
            </div>

            <div class="overflow-x-auto rounded-xl border border-zinc-800 shadow-xl">
              <table class="w-full text-left border-collapse bg-zinc-900">
                <thead>
                  <tr class="bg-zinc-950 border-b border-zinc-800">
                    <th class="p-3 text-zinc-400 font-semibold text-xs">Pos</th>
                    <th class="p-3 text-zinc-400 font-semibold text-xs">Club</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">PJ</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">PG</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">PE</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">PP</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">GF</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">GC</th>
                    <th class="p-3 text-center text-zinc-400 font-semibold text-xs">DG</th>
                    <th class="p-3 text-center text-emerald-400 font-bold text-xs">Pts</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/50">
                  <tr v-for="(fila, index) in torneoStore.tablaPosiciones" :key="fila.equipoId" class="hover:bg-zinc-800/50 transition-colors">
                    <td class="p-3 text-center font-bold font-mono text-zinc-400 text-xs">
                      <span v-if="index < 3" class="text-emerald-400 font-black">#{{ index + 1 }}</span>
                      <span v-else>{{ index + 1 }}</span>
                    </td>
                    <td class="p-3 flex items-center gap-2.5 text-zinc-200 font-bold text-sm">
                      <img v-if="fila.urlEscudo" :src="fila.urlEscudo" class="w-6 h-6 object-contain rounded-full" />
                      {{ fila.nombreEquipo }}
                    </td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.pj }}</td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.pg }}</td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.pe }}</td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.pp }}</td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.gf }}</td>
                    <td class="p-3 text-center text-zinc-400 text-xs">{{ fila.gc }}</td>
                    <td class="p-3 text-center font-mono font-semibold text-xs" :class="fila.dg > 0 ? 'text-emerald-400' : (fila.dg < 0 ? 'text-red-400' : 'text-zinc-400')">
                      {{ fila.dg > 0 ? `+${fila.dg}` : fila.dg }}
                    </td>
                    <td class="p-3 text-center font-black text-emerald-400 text-sm">{{ fila.puntos }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
        <!-- FORMATO LLAVES -->
<!-- 🏆 FORMATO LLAVES (BRACKET PRO CON ESCUDOS Y PENALES) -->
      <div v-else-if="datosTorneo?.formato === 'Llaves'" class="flex gap-8 overflow-x-auto pb-8 pt-2 snap-x">
        <div 
          v-for="ronda in torneoStore.fixture" 
          :key="ronda.jornadaId"
          class="flex flex-col justify-around min-w-[280px] sm:min-w-[300px] snap-center"
        >
          <!-- Encabezado de la Ronda (Dorado si es la Final) -->
          <div 
            :class="[
              'text-center font-black text-xs uppercase tracking-wider py-2 px-4 rounded-full mb-4 shadow-sm border',
              ronda.numero === torneoStore.fixture.length
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300'
            ]"
          >
            {{ obtenerNombreRonda(ronda.numero, torneoStore.fixture.length) }}
          </div>

          <!-- Partidos de la Ronda -->
          <div 
            v-for="partido in ronda.partidos" 
            :key="partido.partidoId"
            @click="abrirModalMarcador(partido)"
            :class="[
              'bg-zinc-900/90 border my-3 rounded-2xl overflow-hidden shadow-xl transition-all relative group',
              ronda.numero === torneoStore.fixture.length 
                ? 'border-amber-500/40 hover:border-amber-400' 
                : 'border-zinc-800 hover:border-zinc-600',
              puedeCargarMarcador ? 'cursor-pointer' : 'cursor-default'
            ]"
          >
            
            <!-- FILA 1: EQUIPO LOCAL -->
            <div 
              class="p-3 text-xs flex justify-between items-center border-b border-zinc-800/80 transition-colors"
              :class="{
                'bg-emerald-950/40 font-bold text-white': esGanador(partido, 'local'),
                'opacity-50 text-zinc-400': esPerdedor(partido, 'local'),
                'text-zinc-200': !esGanador(partido, 'local') && !esPerdedor(partido, 'local')
              }"
            >
              <!-- Escudo y Nombre Local -->
              <div class="flex items-center gap-2.5 truncate pr-2">
                <div class="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                  <img 
                    v-if="obtenerEscudoEquipo(partido.equipoLocalId)" 
                    :src="obtenerEscudoEquipo(partido.equipoLocalId)" 
                    class="w-full h-full object-contain p-0.5" 
                  />
                  <span v-else class="text-[10px] text-zinc-500 font-bold">
                    {{ partido.equipoLocalNombre === 'Por definir' ? '?' : partido.equipoLocalNombre.slice(0, 2).toUpperCase() }}
                  </span>
                </div>
                
                <span class="truncate font-semibold text-xs sm:text-sm">
                  {{ partido.equipoLocalNombre }}
                </span>
              </div>

              <!-- Marcador Local (Goles y Penales) -->
              <div class="flex items-center gap-1 shrink-0 font-mono">
                <span 
                  v-if="partido.penalesLocal !== null && partido.penalesVisitante !== null" 
                  class="text-[10px] text-amber-400 font-bold"
                  title="Goles en penales"
                >
                  ({{ partido.penalesLocal }})
                </span>
                <span 
                  :class="[
                    'px-2 py-0.5 rounded text-xs font-black min-w-[24px] text-center',
                    esGanador(partido, 'local') ? 'bg-emerald-600 text-white' : 'bg-zinc-950 text-zinc-300'
                  ]"
                >
                  {{ partido.golesLocal ?? '-' }}
                </span>
              </div>
            </div>

            <!-- FILA 2: EQUIPO VISITANTE -->
            <div 
              class="p-3 text-xs flex justify-between items-center transition-colors"
              :class="{
                'bg-emerald-950/40 font-bold text-white': esGanador(partido, 'visitante'),
                'opacity-50 text-zinc-400': esPerdedor(partido, 'visitante'),
                'text-zinc-200': !esGanador(partido, 'visitante') && !esPerdedor(partido, 'visitante')
              }"
            >
              <!-- Escudo y Nombre Visitante -->
              <div class="flex items-center gap-2.5 truncate pr-2">
                <div class="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                  <img 
                    v-if="obtenerEscudoEquipo(partido.equipoVisitanteId)" 
                    :src="obtenerEscudoEquipo(partido.equipoVisitanteId)" 
                    class="w-full h-full object-contain p-0.5" 
                  />
                  <span v-else class="text-[10px] text-zinc-500 font-bold">
                    {{ partido.equipoVisitanteNombre === 'Por definir' ? '?' : partido.equipoVisitanteNombre.slice(0, 2).toUpperCase() }}
                  </span>
                </div>
                
                <span class="truncate font-semibold text-xs sm:text-sm">
                  {{ partido.equipoVisitanteNombre }}
                </span>
              </div>

              <!-- Marcador Visitante (Goles y Penales) -->
              <div class="flex items-center gap-1 shrink-0 font-mono">
                <span 
                  v-if="partido.penalesLocal !== null && partido.penalesVisitante !== null" 
                  class="text-[10px] text-amber-400 font-bold"
                  title="Goles en penales"
                >
                  ({{ partido.penalesVisitante }})
                </span>
                <span 
                  :class="[
                    'px-2 py-0.5 rounded text-xs font-black min-w-[24px] text-center',
                    esGanador(partido, 'visitante') ? 'bg-emerald-600 text-white' : 'bg-zinc-950 text-zinc-300'
                  ]"
                >
                  {{ partido.golesVisitante ?? '-' }}
                </span>
              </div>
            </div>

            <!-- ETIQUETA INFORMATIVA INFERIOR (SI HUBO PENALES O FINALIZÓ) -->
            <div 
              v-if="partido.penalesLocal !== null && partido.penalesVisitante !== null" 
              class="bg-amber-950/20 border-t border-amber-900/30 px-2 py-0.5 text-center text-[9px] font-bold text-amber-400 uppercase tracking-widest"
            >
              Definido por Penales (PEN)
            </div>

          </div>
        </div>
      </div>
      </div>

      <!-- VISTA 2: TOP GOLEADORES -->
      <div v-show="vistaActiva === 'goleadores'" class="animate-in fade-in slide-in-from-bottom-2">
        <div class="border border-zinc-800 rounded-xl overflow-hidden">
          <Table>
            <TableHeader class="bg-zinc-900/80">
              <TableRow class="border-zinc-800 hover:bg-transparent">
                <TableHead class="w-[80px] text-center text-zinc-400">Top</TableHead>
                <TableHead class="text-zinc-400">Jugador</TableHead>
                <TableHead class="text-zinc-400">Equipo</TableHead>
                <TableHead class="text-center text-zinc-400">Goles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow 
                v-for="(goleador, index) in torneoStore.topGoleadores" 
                :key="goleador.jugadorId"
                class="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
              >
                <TableCell class="text-center font-mono font-bold text-zinc-500">
                  <span v-if="index === 0" class="text-yellow-500 text-lg">🥇</span>
                  <span v-else-if="index === 1" class="text-zinc-300 text-lg">🥈</span>
                  <span v-else-if="index === 2" class="text-amber-700 text-lg">🥉</span>
                  <span v-else>{{ index + 1 }}</span>
                </TableCell>
                <TableCell class="font-bold text-zinc-200">{{ goleador.nombreCompleto }}</TableCell>
                <TableCell class="text-zinc-400 text-sm">{{ goleador.nombreEquipo }}</TableCell>
                <TableCell class="text-center font-black text-primary text-lg">{{ goleador.goles }}</TableCell>
              </TableRow>

              <TableRow v-if="torneoStore.topGoleadores.length === 0">
                <TableCell colspan="4" class="h-32 text-center text-zinc-500">
                  Aún no hay goles registrados en partidos finalizados.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

    </CardContent>
  </Card>

  <!-- MODAL DE RESULTADOS (SOLO ÁRBITRO O ADMIN) -->
<!-- MODAL DE RESULTADOS RESPONSIVE Y SCROLLABLE -->
  <Dialog v-if="puedeCargarMarcador" v-model:open="modalAbierto">
    <DialogContent class="sm:max-w-lg w-[95vw] max-h-[88vh] flex flex-col p-0 bg-zinc-950 border-zinc-800 text-white shadow-2xl rounded-2xl overflow-hidden">
      
      <!-- 1. Cabecera Fija -->
      <DialogHeader class="bg-zinc-900/90 p-4 sm:p-5 border-b border-zinc-800 shrink-0">
        <DialogTitle class="text-lg sm:text-xl font-bold text-center tracking-wide text-white">Resultado del Partido</DialogTitle>
        <DialogDescription class="text-xs text-zinc-400 text-center mt-0.5">
          Registra el marcador final y los autores de los goles
        </DialogDescription>
      </DialogHeader>

      <!-- 2. Cuerpo Desplazable (Scrollable) -->
      <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
        
        <!-- Marcador y Equipos -->
        <div class="flex items-center justify-between gap-2">
          
          <!-- EQUIPO LOCAL -->
          <div class="flex flex-col items-center w-[40%]">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-inner mb-2 overflow-hidden">
              <span class="text-2xl font-black text-zinc-400">
                {{ partidoSeleccionado?.equipoLocalNombre.charAt(0).toUpperCase() }}
              </span>
            </div>
            <p class="font-bold text-center text-xs sm:text-sm mb-2 line-clamp-2 h-8 flex items-center justify-center leading-tight">
              {{ partidoSeleccionado?.equipoLocalNombre }}
            </p>
            <div class="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-sm">
              <button 
                v-if="!esPartidoFinalizado" 
                @click="restarGoles('local')" 
                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-lg font-bold"
              >
                -
              </button>
              <input 
                v-model.number="golesLocalInput" 
                type="number" 
                min="0" 
                :readonly="esPartidoFinalizado"
                class="w-10 sm:w-12 text-center text-2xl sm:text-3xl font-black bg-transparent border-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
              <button 
                v-if="!esPartidoFinalizado" 
                @click="sumarGoles('local')" 
                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          <!-- VERSUS -->
          <div class="flex flex-col items-center justify-center w-[20%]">
             <span class="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
               VS
             </span>
          </div>

          <!-- EQUIPO VISITANTE -->
          <div class="flex flex-col items-center w-[40%]">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-inner mb-2 overflow-hidden">
              <span class="text-2xl font-black text-zinc-400">
                {{ partidoSeleccionado?.equipoVisitanteNombre.charAt(0).toUpperCase() }}
              </span>
            </div>
            <p class="font-bold text-center text-xs sm:text-sm mb-2 line-clamp-2 h-8 flex items-center justify-center leading-tight">
              {{ partidoSeleccionado?.equipoVisitanteNombre }}
            </p>
            <div class="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-sm">
              <button 
                v-if="!esPartidoFinalizado" 
                @click="restarGoles('visitante')" 
                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-lg font-bold"
              >
                -
              </button>
              <input 
                v-model.number="golesVisitanteInput" 
                type="number" 
                :readonly="esPartidoFinalizado"
                min="0" 
                class="w-10 sm:w-12 text-center text-2xl sm:text-3xl font-black bg-transparent border-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
              <button 
                v-if="!esPartidoFinalizado" 
                @click="sumarGoles('visitante')" 
                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

        </div>

        <!-- SECCIÓN DE PENALES (SI APLICA) -->
        <div 
          v-if="datosTorneo?.formato === 'Llaves' && golesLocalInput === golesVisitanteInput" 
          class="p-3 bg-orange-950/20 border border-orange-900/50 rounded-xl animate-in fade-in"
        >
          <p class="text-xs text-orange-400 font-bold text-center mb-2 uppercase tracking-wider">
            Tanda de Penales
          </p>
          <div class="flex items-center justify-center gap-4">
            <input 
              v-model.number="penalesLocalInput" 
              type="number" 
              min="0"
              class="w-12 h-9 text-center text-lg font-bold bg-zinc-950 border border-orange-900/50 rounded text-orange-300 focus:outline-none" 
            />
            <span class="text-zinc-500 text-xs font-bold">VS</span>
            <input 
              v-model.number="penalesVisitanteInput" 
              type="number" 
              min="0"
              class="w-12 h-9 text-center text-lg font-bold bg-zinc-950 border border-orange-900/50 rounded text-orange-300 focus:outline-none" 
            />
          </div>
        </div>

        <!-- ACTA DE GOLES: LOCAL -->
        <div v-if="golesLocalInput > 0" class="border-t border-zinc-800 pt-3 animate-in fade-in">
          <h4 class="text-xs font-bold text-zinc-300 mb-2 uppercase tracking-wider flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Goles: {{ partidoSeleccionado?.equipoLocalNombre }}
          </h4>
          <div v-for="(gol, index) in registroGolesLocal" :key="'loc'+index" class="flex gap-2 mb-2">
            <Select 
              :model-value="gol.jugadorId ? gol.jugadorId.toString() : ''"
              @update:model-value="(val) => gol.jugadorId = parseInt(val)"
              :disabled="esPartidoFinalizado"
            >
              <SelectTrigger class="flex-1 h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs sm:text-sm text-zinc-300">
                <SelectValue placeholder="Seleccionar Autor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem 
                    v-for="jugador in jugadoresLocal" 
                    :key="jugador.id" 
                    :value="jugador.id.toString()"
                  >
                    #{{ jugador.dorsal }} - {{ jugador.nombreCompleto }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <input 
              v-model.number="gol.minuto" 
              type="number" 
              placeholder="Min" 
              :disabled="esPartidoFinalizado" 
              class="w-16 h-9 text-center rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs sm:text-sm text-zinc-300"
            />
          </div>
        </div>

        <!-- ACTA DE GOLES: VISITANTE -->
        <div v-if="golesVisitanteInput > 0" class="border-t border-zinc-800 pt-3 animate-in fade-in">
          <h4 class="text-xs font-bold text-zinc-300 mb-2 uppercase tracking-wider flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Goles: {{ partidoSeleccionado?.equipoVisitanteNombre }}
          </h4>
          <div v-for="(gol, index) in registroGolesVisitante" :key="'vis'+index" class="flex gap-2 mb-2">
            <Select 
              :model-value="gol.jugadorId ? gol.jugadorId.toString() : ''"
              @update:model-value="(val) => gol.jugadorId = parseInt(val)"
              :disabled="esPartidoFinalizado"
            >
              <SelectTrigger class="flex-1 h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs sm:text-sm text-zinc-300">
                <SelectValue placeholder="Seleccionar Autor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem 
                    v-for="jugador in jugadoresVisitante" 
                    :key="jugador.id" 
                    :value="jugador.id.toString()"
                  >
                    #{{ jugador.dorsal }} - {{ jugador.nombreCompleto }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <input 
              v-model.number="gol.minuto" 
              type="number" 
              placeholder="Min" 
              :disabled="esPartidoFinalizado" 
              class="w-16 h-9 text-center rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs sm:text-sm text-zinc-300"
            />
          </div>
        </div>
      </div>

      <!-- 3. Botones Fijos Abajo (Siempre Visibles) -->
      <DialogFooter class="bg-zinc-900 p-3 sm:p-4 border-t border-zinc-800 flex flex-row justify-end gap-2 shrink-0">
        <Button 
          variant="outline" 
          size="sm"
          class="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white" 
          @click="modalAbierto = false"
        >
          {{ esPartidoFinalizado ? 'Cerrar' : 'Cancelar' }}
        </Button>
        <Button 
          v-if="!esPartidoFinalizado" 
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 text-white shadow-md" 
          @click="guardarMarcador"
        >
          Guardar Resultado
        </Button>
      </DialogFooter>
      
    </DialogContent>
  </Dialog>

  <!-- MODAL DE CONFIRMACIÓN DE FIXTURE -->
  <Dialog v-model:open="modalConfirmacionAbierto">
    <DialogContent class="sm:max-w-md bg-zinc-950 border-zinc-800 text-white shadow-2xl">
      <DialogHeader>
        <DialogTitle class="text-xl font-bold">Generar Calendario</DialogTitle>
        <DialogDescription class="text-zinc-400 mt-2">
          ¿Estás seguro de generar el fixture? Esta acción calculará y creará todos los partidos del torneo en base a los equipos inscritos.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="mt-4 flex justify-end gap-3 border-t border-zinc-800/50 pt-4">
        <Button variant="outline" class="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white" @click="modalConfirmacionAbierto = false">
          Cancelar
        </Button>
        <Button class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold" @click="procesarFixture">
          Sí, Generar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>