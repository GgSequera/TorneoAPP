<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJugadorStore } from '@/stores/jugador'
// IMPORTANTE: Asegúrate de que esta ruta coincida con tu store real de equipos
import { useEquipoStore } from '@/stores/equipos' 
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
const filtroEquiposSeleccionados = ref<number[]>([]) // Array para selección múltiple
const mostrarDropdownFiltroEquipos = ref(false)

// Cargar datos al montar la vista
onMounted(async () => {
  await jugadorStore.obtenerJugadores()
  await equipoStore.obtenerEquipos()
  //jugadorStore.obtenerJugadores()
  // Asumiendo que tu store tiene equiposInscritos o equipos, carga la lista si está vacía
  // equipoStore.obtenerEquipos() 
})

// --- LÓGICA DE FILTRADO REACTIVO ---
// Computado que cruza todos los filtros en tiempo real
const jugadoresFiltrados = computed(() => {
  return jugadorStore.jugadores.filter((jugador) => {
    // Filtro por texto (Nombre)
    const nombreSeguro = jugador.nombreCompleto || ''
    const coincideNombre = nombreSeguro.toLowerCase().includes((filtroNombre.value || '').toLowerCase())

    //const coincideNombre = jugador.nombreCompleto.toLowerCase().includes(filtroNombre.value.toLowerCase())
    
    // Filtro por selección múltiple (Equipos). Si el array está vacío, asume "Todos"
    const coincideEquipo = filtroEquiposSeleccionados.value.length === 0 
      || filtroEquiposSeleccionados.value.includes(jugador.equipoId)
    
    // Filtro por Dropdown (Posición)
    const coincidePosicion = filtroPosicion.value === 'todas' || jugador.posicion === filtroPosicion.value

    return coincideNombre && coincideEquipo && coincidePosicion
  })
})

const toggleFiltroEquipo = (equipoId: number) => {
  const index = filtroEquiposSeleccionados.value.indexOf(equipoId)
  if (index > -1) {
    filtroEquiposSeleccionados.value.splice(index, 1) // Quitar si ya estaba
  } else {
    filtroEquiposSeleccionados.value.push(equipoId) // Agregar si no estaba
  }
}

// --- LÓGICA DEL AUTOCOMPLETE (FORMULARIO) ---
const equiposParaFormulario = computed(() => {
  // Ajusta "equipoStore.equipos" al array real donde guardas tus equipos
  const lista = equipoStore.equipos || [] // CAMBIAR AQUÍ POR TU ARRAY DE EQUIPOS REAL
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

// --- GUARDAR ---
const guardarJugador = async () => {
  if (!formulario.value.equipoId) return alert('Por favor, selecciona un equipo.');
  const exito = await jugadorStore.crearJugador({
    equipoId: formulario.value.equipoId,
    nombreCompleto: formulario.value.nombreCompleto,
    posicion: formulario.value.posicion,
    dorsal: formulario.value.dorsal!
  });
  if (exito) {
    formulario.value.nombreCompleto = '';
    formulario.value.posicion = '';
    formulario.value.dorsal = null;
    formulario.value.equipoId = null;
    busquedaEquipo.value = '';
  }
}

// Helper para mostrar el nombre del equipo en la tabla
const obtenerNombreEquipo = (equipoId: number) => {
  // Ajusta "equipoStore.equipos" al array real
  const equipo = (equipoStore.equipos || []).find((e: any) => e.id === equipoId) 
  return equipo ? equipo.nombre : `Equipo #${equipoId}`
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto text-zinc-100 space-y-8">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold tracking-tight text-white">Gestión de Jugadores</h1>
    </div>

    <!-- TARJETA DEL FORMULARIO -->
    <div class="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm p-6">
      <div class="flex flex-col space-y-1.5 mb-6">
        <h3 class="text-lg font-semibold leading-none tracking-tight text-white">Agregar Nuevo Jugador</h3>
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

        <div class="md:col-span-4 space-y-2 relative">
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
            {{ jugadorStore.loading ? 'Guardando...' : 'Guardar Jugador' }}
          </Button>
        </div>
      </form>
    </div>

    <!-- SECCIÓN DE LISTA Y FILTROS -->
    <div class="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm p-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h3 class="text-lg font-semibold text-white">Directorio de Jugadores</h3>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Input 
            v-model="filtroNombre" 
            type="text" 
            placeholder="Buscar por nombre..." 
            class="w-full sm:w-48 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
          />

          <!-- Dropdown Equipos -->
          <div class="relative">
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
                <SelectItem value="todas">Posicion (Todas)</SelectItem>
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
              <TableHead class="text-zinc-400">Equipo</TableHead>
              <TableHead class="text-right text-zinc-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="jugadoresFiltrados.length === 0" class="border-zinc-800">
              <TableCell colspan="5" class="h-24 text-center text-zinc-500">
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
              <TableCell class="text-zinc-300">{{ obtenerNombreEquipo(jugador.equipoId) }}</TableCell>
              <TableCell class="text-right">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  class="bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900 hover:text-red-100"
                  @click="jugadorStore.eliminarJugador(jugador.id)"
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