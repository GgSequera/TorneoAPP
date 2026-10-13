<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJugadorStore } from '@/stores/jugador'
import { useEquipoStore } from '@/stores/equipos' 
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/components/ui/toast/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const jugadorStore = useJugadorStore()
const equipoStore = useEquipoStore()
const authStore = useAuthStore()
const { toast } = useToast()

// Detección de Roles
const rolUsuario = computed(() => authStore.usuario?.rol?.toLowerCase() || '')
const esAdmin = computed(() => rolUsuario.value === 'administrador' || rolUsuario.value === 'admin')
const esJugador = computed(() => rolUsuario.value === 'jugador')
const esCapitan = computed(() => esJugador.value && equipoStore.miPerfil?.esCapitan)

// Detectar el equipo del jugador conectado
const miEquipo = computed(() => {
  if (!equipoStore.miPerfil?.tieneEquipo) return null
  return (equipoStore.equipos || []).find((e: any) => e.nombre === equipoStore.miPerfil.equipo)
})

// --- ESTADO DEL FORMULARIO ---
const formulario = ref({
  equipoId: null as number | null,
  nombreCompleto: '',
  posicion: '',
  dorsal: null as number | null
})
const busquedaEquipo = ref('')
const mostrarSugerencias = ref(false)

// --- ESTADO DE LOS FILTROS PARA LA TABLA ---
const filtroNombre = ref('')
const filtroPosicion = ref('todas')
const filtroEquiposSeleccionados = ref<number[]>([])
const mostrarDropdownFiltroEquipos = ref(false)

// Cargar datos al montar la vista
onMounted(async () => {
  await Promise.all([
    jugadorStore.obtenerJugadores(),
    equipoStore.obtenerEquipos()
  ])

  // Si es jugador, consultamos su perfil para saber a qué equipo pertenece
  if (esJugador.value && authStore.usuario?.id) {
    await equipoStore.verificarPerfilJugador(authStore.usuario.id)
    if (miEquipo.value) {
      formulario.value.equipoId = miEquipo.value.id
      busquedaEquipo.value = miEquipo.value.nombre
    }
  }
})

// --- LÓGICA DE FILTRADO REACTIVO MULTI-ROL ---
const jugadoresFiltrados = computed(() => {
  return jugadorStore.jugadores.filter((jugador) => {
    // 🛡️ REGLA CLAVE: Si es Jugador, solo puede ver la plantilla de su propio equipo
    if (esJugador.value) {
      if (!miEquipo.value || jugador.equipoId !== miEquipo.value.id) {
        return false
      }
    }

    // Filtro por texto (Nombre)
    const nombreSeguro = jugador.nombreCompleto || ''
    const coincideNombre = nombreSeguro.toLowerCase().includes((filtroNombre.value || '').toLowerCase())

    // Filtro por selección múltiple de equipos (solo activo para Admin)
    const coincideEquipo = esJugador.value || filtroEquiposSeleccionados.value.length === 0 
      || filtroEquiposSeleccionados.value.includes(jugador.equipoId)
    
    // Filtro por Posición
    const coincidePosicion = filtroPosicion.value === 'todas' || jugador.posicion === filtroPosicion.value

    return coincideNombre && coincideEquipo && coincidePosicion
  })
})

const toggleFiltroEquipo = (equipoId: number) => {
  const index = filtroEquiposSeleccionados.value.indexOf(equipoId)
  if (index > -1) {
    filtroEquiposSeleccionados.value.splice(index, 1)
  } else {
    filtroEquiposSeleccionados.value.push(equipoId)
  }
}

// --- LÓGICA DEL AUTOCOMPLETE (FORMULARIO) ---
const equiposParaFormulario = computed(() => {
  const lista = equipoStore.equipos || []
  if (!busquedaEquipo.value) return lista
  return lista.filter((e: any) => e.nombre.toLowerCase().includes(busquedaEquipo.value.toLowerCase()))
})

const seleccionarEquipo = (equipo: any) => {
  formulario.value.equipoId = equipo.id
  busquedaEquipo.value = equipo.nombre
  mostrarSugerencias.value = false
}

const manejarBlur = () => {
  setTimeout(() => { mostrarSugerencias.value = false }, 200)
}

// --- GUARDAR JUGADOR ---
const guardarJugador = async () => {
  // Si es capitán, asignamos automáticamente su equipo
  if (esCapitan.value && miEquipo.value) {
    formulario.value.equipoId = miEquipo.value.id
  }

  if (!formulario.value.equipoId) {
    return toast({
      title: 'Equipo requerido',
      description: 'Por favor, selecciona un equipo para el jugador.',
      variant: 'destructive'
    })
  }

  const exito = await jugadorStore.crearJugador({
    equipoId: formulario.value.equipoId,
    nombreCompleto: formulario.value.nombreCompleto,
    posicion: formulario.value.posicion,
    dorsal: formulario.value.dorsal!
  })

  if (exito) {
    toast({
      title: '¡Jugador Registrado!',
      description: `${formulario.value.nombreCompleto} se incorporó a la plantilla.`
    })
    formulario.value.nombreCompleto = ''
    formulario.value.posicion = ''
    formulario.value.dorsal = null
    
    if (esAdmin.value) {
      formulario.value.equipoId = null
      busquedaEquipo.value = ''
    }
  } else {
    toast({
      title: 'Error',
      description: 'No se pudo guardar el jugador.',
      variant: 'destructive'
    })
  }
}

const eliminarJugador = async (jugadorId: number) => {
  if (!confirm('¿Estás seguro de desvincular a este jugador?')) return
  const exito = await jugadorStore.eliminarJugador(jugadorId)
  if (exito) {
    toast({
      title: 'Jugador Eliminado',
      description: 'La ficha fue desvinculada del equipo.',
      variant: 'destructive'
    })
  }
}

// Helper para mostrar el nombre del equipo en la tabla
const obtenerNombreEquipo = (equipoId: number) => {
  const equipo = (equipoStore.equipos || []).find((e: any) => e.id === equipoId) 
  return equipo ? equipo.nombre : `Equipo #${equipoId}`
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto text-zinc-100 space-y-8">
    <!-- ENCABEZADO CONTEXTUAL -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-zinc-800 pb-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">
          <span v-if="esJugador && miEquipo">Plantilla Oficial: {{ miEquipo.nombre }}</span>
          <span v-else>Directorio General de Jugadores</span>
        </h1>
        <p class="text-xs text-zinc-400 mt-1">
          <span v-if="esJugador">Lista oficial de compañeros registrados en tu escuadra.</span>
          <span v-else>Registro federativo de todos los futbolistas de la liga.</span>
        </p>
      </div>

      <div v-if="esJugador && miEquipo" class="bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300">
        ⚽ {{ jugadoresFiltrados.length }} integrantes en tu plantilla
      </div>
    </div>

    <!-- TARJETA DEL FORMULARIO (Visible para Admin o Capitán) -->
    <div v-if="esAdmin || esCapitan" class="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm p-6">
      <div class="flex flex-col space-y-1.5 mb-6">
        <h3 class="text-lg font-semibold leading-none tracking-tight text-white">
          {{ esCapitan ? 'Inscribir Nuevo Compañero en tu Plantilla' : 'Agregar Nuevo Jugador a la Liga' }}
        </h3>
        <p class="text-xs text-zinc-400">
          {{ esCapitan ? `El jugador se registrará directamente en ${miEquipo?.nombre}.` : 'Asigna los datos y club de destino.' }}
        </p>
      </div>
      
      <form @submit.prevent="guardarJugador" class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="md:col-span-2 space-y-2">
          <label class="text-sm font-medium text-zinc-300">Nombre Completo</label>
          <Input 
            v-model="formulario.nombreCompleto" 
            type="text" 
            required 
            placeholder="Ej. Lamine Yamal" 
            class="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-zinc-300">Posición</label>
          <Select v-model="formulario.posicion" required>
            <SelectTrigger class="w-full bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-primary">
              <SelectValue placeholder="Seleccione..." />
            </SelectTrigger>
            <SelectContent class="bg-zinc-900 border-zinc-800 text-zinc-100">
              <SelectGroup>
                <SelectItem value="Portero">Portero</SelectItem>
                <SelectItem value="Defensa">Defensa</SelectItem>
                <SelectItem value="Mediocampista">Mediocampista</SelectItem>
                <SelectItem value="Delantero">Delantero</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-zinc-300">Dorsal</label>
          <Input 
            v-model.number="formulario.dorsal" 
            type="number" 
            min="1" 
            max="99" 
            required 
            class="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-primary"
          />
        </div>

        <!-- Asignar Equipo: Solo editable si es Admin -->
        <div v-if="esAdmin" class="md:col-span-4 space-y-2 relative">
          <label class="text-sm font-medium text-zinc-300">Asignar Equipo</label>
          <Input 
            v-model="busquedaEquipo" 
            @focus="mostrarSugerencias = true" 
            @blur="manejarBlur" 
            type="text" 
            placeholder="Escribe para buscar un equipo..." 
            class="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-primary"
          />
          
          <ul v-if="mostrarSugerencias" class="absolute z-50 min-w-[8rem] w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 text-white shadow-lg max-h-48 overflow-y-auto mt-1">
            <li 
              v-for="equipo in equiposParaFormulario" 
              :key="equipo.id" 
              @click="seleccionarEquipo(equipo)" 
              class="relative flex cursor-pointer items-center rounded-sm px-3 py-2 text-sm hover:bg-zinc-800 hover:text-primary transition-colors"
            >
              {{ equipo.nombre }}
            </li>
          </ul>
        </div>
        
        <div class="md:col-span-4 flex justify-end mt-4">
          <Button type="submit" :disabled="jugadorStore.loading" class="h-10 px-6 font-bold shadow-lg shadow-primary/20">
            {{ jugadorStore.loading ? 'Guardando...' : (esCapitan ? 'Inscribir en mi Club' : 'Guardar Jugador') }}
          </Button>
        </div>
      </form>
    </div>

    <!-- SECCIÓN DE LISTA Y FILTROS -->
    <div class="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm p-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h3 class="text-lg font-semibold text-white">
          {{ esJugador ? 'Compañeros de Equipo' : 'Directorio de Jugadores' }}
        </h3>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Input 
            v-model="filtroNombre" 
            type="text" 
            placeholder="Buscar por nombre..." 
            class="w-full sm:w-48 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
          />

          <!-- Dropdown Equipos (SOLO VISIBLE PARA ADMIN) -->
          <div v-if="esAdmin" class="relative">
            <button 
              @click="mostrarDropdownFiltroEquipos = !mostrarDropdownFiltroEquipos"
              class="flex h-10 w-full sm:w-48 items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span class="truncate">
                {{ filtroEquiposSeleccionados.length === 0 ? 'Todos los Equipos' : `${filtroEquiposSeleccionados.length} Equipos` }}
              </span>
              <span class="text-xs ml-2 text-zinc-500">▼</span>
            </button>
            
            <div v-if="mostrarDropdownFiltroEquipos" class="absolute z-10 mt-1 w-full sm:w-48 rounded-md border border-zinc-800 bg-zinc-900 shadow-lg max-h-48 overflow-y-auto p-2">
              <label v-for="equipo in equipoStore.equipos" :key="equipo.id" class="flex items-center space-x-2 py-1.5 px-2 hover:bg-zinc-800 rounded cursor-pointer">
                <input 
                  type="checkbox" 
                  :checked="filtroEquiposSeleccionados.includes(equipo.id)" 
                  @change="toggleFiltroEquipo(equipo.id)"
                  class="rounded border-zinc-700 bg-zinc-950 text-primary focus:ring-primary"
                >
                <span class="text-sm text-zinc-300 truncate">{{ equipo.nombre }}</span>
              </label>
            </div>
          </div>

          <Select v-model="filtroPosicion">
            <SelectTrigger class="w-full sm:w-40 bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-primary">
              <SelectValue placeholder="Posición (Todas)" />
            </SelectTrigger>
            <SelectContent class="bg-zinc-900 border-zinc-800 text-zinc-100">
              <SelectGroup>
                <SelectItem value="todas">Posición (Todas)</SelectItem>
                <SelectItem value="Portero">Portero</SelectItem>
                <SelectItem value="Defensa">Defensa</SelectItem>
                <SelectItem value="Mediocampista">Mediocampista</SelectItem>
                <SelectItem value="Delantero">Delantero</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- TABLA DE RESULTADOS -->
      <div class="border border-zinc-800 rounded-md bg-zinc-950/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader class="bg-zinc-950 border-b border-zinc-800">
            <TableRow class="hover:bg-transparent">
              <TableHead class="text-zinc-400">Dorsal</TableHead>
              <TableHead class="text-zinc-400">Nombre del Jugador</TableHead>
              <TableHead class="text-zinc-400">Posición</TableHead>
              <TableHead v-if="esAdmin" class="text-zinc-400">Equipo</TableHead>
              <TableHead v-if="esAdmin || esCapitan" class="text-right text-zinc-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="jugadoresFiltrados.length === 0" class="border-zinc-800">
              <TableCell :colspan="esAdmin ? 5 : 4" class="h-24 text-center text-zinc-500">
                No se encontraron jugadores con los filtros aplicados.
              </TableCell>
            </TableRow>
            <TableRow 
              v-for="jugador in jugadoresFiltrados" 
              :key="jugador.id" 
              class="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
            >
              <TableCell class="font-bold text-primary">#{{ jugador.dorsal }}</TableCell>
              <TableCell class="text-zinc-200">{{ jugador.nombreCompleto }}</TableCell>
              <TableCell>
                <span class="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
                  {{ jugador.posicion }}
                </span>
              </TableCell>
              <TableCell v-if="esAdmin" class="text-zinc-300">{{ obtenerNombreEquipo(jugador.equipoId) }}</TableCell>
              <TableCell v-if="esAdmin || esCapitan" class="text-right">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  class="bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900 hover:text-red-100"
                  @click="eliminarJugador(jugador.id)"
                >
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      
    </div>
  </div>
</template>