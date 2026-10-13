<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTorneoStore } from '@/stores/torneos'
import { useAuthStore } from '@/stores/auth'
import { useEquipoStore } from '@/stores/equipos'
import { useNetwork } from '@/composables/useNetwork'
import { useToast } from '@/components/ui/toast/use-toast'

// Importaciones de Shadcn UI
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const torneoStore = useTorneoStore()
const authStore = useAuthStore()
const equipoStore = useEquipoStore()
const { isOnline } = useNetwork()
const { toast } = useToast()
const { torneos, cargando } = storeToRefs(torneoStore)

// Detección de Roles
const rolUsuario = computed(() => authStore.usuario?.rol?.toLowerCase() || '')
const esAdmin = computed(() => rolUsuario.value === 'administrador' || rolUsuario.value === 'admin')
const esArbitro = computed(() => rolUsuario.value === 'arbitro')
const esJugador = computed(() => rolUsuario.value === 'jugador')

// Filtro de torneos para el Jugador (solo los de su equipo)
const torneosFiltrados = computed(() => {
  if (esAdmin.value || esArbitro.value) {
    return torneos.value
  }

  // Si es jugador y tiene equipo, mostramos los torneos donde compite
  if (esJugador.value && equipoStore.miPerfil?.tieneEquipo) {
    const nombreEquipo = equipoStore.miPerfil.equipo
    return torneos.value.filter((t: any) => {
      // Si el objeto torneo incluye equipos inscritos
      if (t.equipos && Array.isArray(t.equipos)) {
        return t.equipos.some((e: any) => e.nombre === nombreEquipo)
      }
      return true
    })
  }

  return torneos.value
})

const fechaCalendario = computed({
  get: () => {
    return formulario.value.fechaInicio ? parseDate(formulario.value.fechaInicio) : undefined
  },
  set: (val: DateValue | undefined) => {
    formulario.value.fechaInicio = val ? val.toString() : ''
  }
})

const handleOnline = async () => {
  await torneoStore.sincronizarTorneosYResultados()
}

const modalAbierto = ref(false)
const guardando = ref(false)
const torneoEditandoId = ref<number | null>(null)

const formulario = ref({
  nombre: '',
  fechaInicio: '',
  formato: '',
  minEquipos: 0,
  maxEquipos: 0
})

onMounted(async () => {
  window.addEventListener('online', handleOnline)
  await torneoStore.sincronizarTorneosYResultados()
  await torneoStore.obtenerTorneos()

  if (esJugador.value && authStore.usuario?.id) {
    await equipoStore.verificarPerfilJugador(authStore.usuario.id)
  }
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
})

const abrirModalCrear = () => {
  torneoEditandoId.value = null
  formulario.value = { nombre: '', fechaInicio: '', formato: 'Liga', minEquipos: 4, maxEquipos: 16 }
  modalAbierto.value = true
}

const abrirModalEditar = (torneo: any) => {
  torneoEditandoId.value = torneo.id
  formulario.value = { 
    nombre: torneo.nombre, 
    fechaInicio: torneo.fechaInicio ? torneo.fechaInicio.split('T')[0] : '',
    formato: torneo.formato || 'Liga',
    minEquipos: torneo.minEquipos || 4,
    maxEquipos: torneo.maxEquipos || 16
  }
  modalAbierto.value = true
}

const guardarTorneo = async () => {
  if (!formulario.value.nombre.trim() || !formulario.value.fechaInicio) {
    return toast({ title: 'Campos requeridos', description: 'Completa el nombre y la fecha.', variant: 'destructive' })
  }
  guardando.value = true
  
  let exito = false
  if (torneoEditandoId.value) {
    if (!navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'No puedes editar torneos sin internet.', variant: 'destructive' })
      guardando.value = false
      return
    }
    exito = await torneoStore.ActualizarTorneo(torneoEditandoId.value, {
      nombre: formulario.value.nombre,
      fechaInicio: formulario.value.fechaInicio,
      formato: formulario.value.formato,
      minEquipos: formulario.value.minEquipos,
      maxEquipos: formulario.value.maxEquipos
    } as any)
  } else {
    exito = await torneoStore.crearTorneo({
      nombre: formulario.value.nombre,
      fechaInicio: formulario.value.fechaInicio,
      formato: formulario.value.formato,
      minEquipos: formulario.value.minEquipos,
      maxEquipos: formulario.value.maxEquipos
    } as any)
    
    if (!navigator.onLine && exito) {
      toast({ title: 'Guardado Offline', description: 'Se sincronizará al recuperar la conexión.' })
    }
  }
  
  if (exito) {
    toast({ title: '¡Éxito!', description: torneoEditandoId.value ? 'Torneo actualizado.' : 'Torneo creado con éxito.' })
    modalAbierto.value = false
  } else {
    toast({ title: 'Error', description: 'No se pudo guardar el torneo.', variant: 'destructive' })
  }
  guardando.value = false
}

const manejarEliminar = async (id: number, nombre: string) => {
  if (!navigator.onLine) {
    return toast({ title: 'Sin conexión', description: 'No puedes eliminar torneos sin internet.', variant: 'destructive' })
  }

  const confirmado = window.confirm(`¿Estás seguro de que deseas eliminar el torneo "${nombre}"?`)
  if (confirmado) {
    const exito = await torneoStore.EliminarTorneo(id)
    if (exito) {
      toast({ title: 'Torneo Eliminado', description: `Se eliminó "${nombre}".`, variant: 'destructive' })
    }
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Cabecera -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-zinc-100">Torneos</h2>
        <p class="text-zinc-400">
          <span v-if="esJugador">Competiciones en las que participa tu club.</span>
          <span v-else>Gestiona los torneos de fútbol y su estado.</span>
        </p>
      </div>

      <!-- Diálogo (Modal) de Shadcn (SOLO VISIBLE PARA ADMIN) -->
      <Dialog v-if="esAdmin" v-model:open="modalAbierto">
        <DialogTrigger as-child>
          <Button @click="abrirModalCrear" variant="outline" class="border-dashed border-zinc-700 text-zinc-300 hover:text-primary hover:border-primary/50 hover:bg-primary/10">
            + Nuevo Torneo
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[425px] bg-zinc-900 border-zinc-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle class="text-zinc-100">{{ torneoEditandoId ? 'Editar torneo' : 'Crear nuevo torneo' }}</DialogTitle>
            <DialogDescription class="text-zinc-400">
              Ingresa los detalles básicos del torneo. Haz clic en guardar cuando termines.
            </DialogDescription>
          </DialogHeader>
          
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <Label for="nombre" class="text-zinc-200">Nombre del Torneo</Label>
              <Input 
                id="nombre" 
                v-model="formulario.nombre" 
                placeholder="Ej. Copa Libertadores 2026" 
                class="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
              />
            </div>
            
            <div class="grid gap-2 flex-col">
              <Label class="text-zinc-200">Fecha de Inicio</Label>
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    :class="cn(
                      'justify-start text-left font-normal bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-primary',
                      !formulario.fechaInicio ? 'text-zinc-500' : 'text-zinc-100'
                    )"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    {{ formulario.fechaInicio ? format(parseISO(formulario.fechaInicio), 'PPP', { locale: es }) : "Selecciona una fecha" }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0 bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
                  <Calendar v-model="fechaCalendario" color="zinc" />
                </PopoverContent>
              </Popover>
            </div>

            <div class="grid gap-2 flex-col mt-2">
              <Label class="text-zinc-200">Formato del Torneo</Label>
              <Select v-model="formulario.formato">
                <SelectTrigger class="w-full bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-primary">
                  <SelectValue placeholder="Selecciona un formato..." />
                </SelectTrigger>
                <SelectContent class="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectGroup>
                    <SelectItem value="Liga">🏆 Liga (Todos contra todos)</SelectItem>
                    <SelectItem value="Llaves">⚔️ Llaves (Eliminación directa)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="grid gap-2">
                <Label for="minEquipos" class="text-zinc-200">Mín. Equipos</Label>
                <Input 
                  id="minEquipos" 
                  type="number"
                  min="2"
                  v-model.number="formulario.minEquipos" 
                  class="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-primary"
                />
              </div>
              <div class="grid gap-2">
                <Label for="maxEquipos" class="text-zinc-200">Máx. Equipos</Label>
                <Input 
                  id="maxEquipos" 
                  type="number"
                  min="2"
                  v-model.number="formulario.maxEquipos" 
                  class="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-primary"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" class="border-zinc-800 text-zinc-300 bg-zinc-950 hover:bg-zinc-800 hover:text-zinc-100" @click="modalAbierto = false">
              Cancelar
            </Button>
            <Button type="submit" @click="guardarTorneo" :disabled="guardando">
              {{ guardando ? 'Guardando...' : (torneoEditandoId ? 'Actualizar' : 'Crear') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Contenedor de la Tabla -->
    <div class="border border-zinc-800 rounded-md bg-zinc-900 shadow-sm overflow-hidden">
      <div v-if="cargando" class="p-8 text-center text-zinc-500">
        Cargando torneos... ⏳
      </div>
      
      <Table v-else>
        <TableHeader class="bg-zinc-950/50 border-b border-zinc-800">
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-[100px] text-zinc-400">ID</TableHead>
            <TableHead class="text-zinc-400">Nombre</TableHead>
            <TableHead class="text-zinc-400">Estado</TableHead>
            <TableHead class="text-right text-zinc-400">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="torneo in torneosFiltrados" :key="torneo.id" class="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
            <TableCell class="font-medium text-zinc-300">#{{ torneo.id }}</TableCell>
            <TableCell class="text-zinc-100">{{ torneo.nombre }}</TableCell>
            <TableCell>
              <Badge :variant="torneo.estado.toLowerCase() === 'activo' ? 'default' : 'secondary'">
                {{ torneo.estado }}
              </Badge>
            </TableCell>
            
            <TableCell class="text-right space-x-2">
              <router-link :to="`/torneos/${torneo.id}`">
                <Button variant="outline" size="sm" class="border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-primary hover:border-primary/50 mr-2" :disabled="String(torneo.id).startsWith('offline-')">
                  Ver Detalle
                </Button>
                <Badge v-if="String(torneo.id).startsWith('offline-')" variant="outline" class="text-orange-500">
                  Pendiente de sincronizar
                </Badge>
              </router-link>
              
              <!-- Botones de Administrador -->
              <Button v-if="esAdmin" variant="outline" size="sm" class="border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-primary hover:border-primary/50" @click="abrirModalEditar(torneo)" :disabled="!isOnline">
                Editar
              </Button>
              <Button v-if="esAdmin" variant="destructive" size="sm" class="bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900 hover:text-red-100" @click="manejarEliminar(Number(torneo.id), torneo.nombre)" :disabled="!isOnline">
                Eliminar
              </Button>
            </TableCell>
          </TableRow>
          
          <TableRow v-if="torneosFiltrados.length === 0" class="border-zinc-800">
            <TableCell colspan="4" class="h-24 text-center text-zinc-500">
              <span v-if="esJugador">Tu equipo no está inscrito en ningún torneo actualmente.</span>
              <span v-else>No hay torneos registrados.</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>