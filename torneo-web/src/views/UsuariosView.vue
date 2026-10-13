<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUsuarioStore } from '@/stores/usuarios'
import { useNetwork } from '@/composables/useNetwork'
import { useToast } from '@/components/ui/toast/use-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Check, X, Search, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const usuarioStore = useUsuarioStore()
const { isOnline } = useNetwork()
const { toast } = useToast()

const modalAbierto = ref(false)
const guardando = ref(false)
const usuarioEditandoId = ref<string | number | null>(null)

// --- ESTADOS DE FILTRO Y PAGINACIÓN ---
const filtroBusqueda = ref('')
const paginaActual = ref(1)
const elementosPorPagina = ref(5)

// Filtrado reactivo por nombre, correo o rol
const usuariosFiltrados = computed(() => {
  const termino = filtroBusqueda.value.toLowerCase().trim()
  if (!termino) return usuarioStore.usuarios

  return usuarioStore.usuarios.filter((u: any) => 
    (u.nombre || '').toLowerCase().includes(termino) ||
    (u.correo || '').toLowerCase().includes(termino) ||
    (u.rol || '').toLowerCase().includes(termino) ||
    (u.estado || '').toLowerCase().includes(termino)
  )
})

// Cálculo de páginas totales
const totalPaginas = computed(() => {
  return Math.ceil(usuariosFiltrados.value.length / elementosPorPagina.value) || 1
})

// Segmento de usuarios para la página actual
const usuariosPaginados = computed(() => {
  const inicio = (paginaActual.value - 1) * elementosPorPagina.value
  return usuariosFiltrados.value.slice(inicio, inicio + elementosPorPagina.value)
})

// Rango de elementos mostrados
const rangoElementos = computed(() => {
  const total = usuariosFiltrados.value.length
  if (total === 0) return { inicio: 0, fin: 0, total: 0 }
  const inicio = (paginaActual.value - 1) * elementosPorPagina.value + 1
  const fin = Math.min(paginaActual.value * elementosPorPagina.value, total)
  return { inicio, fin, total }
})

// Navegación de páginas
const paginaAnterior = () => {
  if (paginaActual.value > 1) paginaActual.value--
}

const paginaSiguiente = () => {
  if (paginaActual.value < totalPaginas.value) paginaActual.value++
}

// Si el usuario escribe en el buscador, regresamos a la página 1
watch(filtroBusqueda, () => {
  paginaActual.value = 1
})

// --- SINCRONIZACIÓN Y CICLO DE VIDA ---
const handleOnline = () => {
  usuarioStore.sincronizarPendientes()
}

onMounted(async () => {
  window.addEventListener('online', handleOnline)
  await usuarioStore.sincronizarPendientes()
  await usuarioStore.obtenerUsuarios()
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
})

// --- ACCIONES DE ESTADO ---
const aprobarUsuario = async (id: number, nombre: string) => {
  if (confirm(`¿Habilitar el acceso oficial a "${nombre}"?`)) {
    const exito = await usuarioStore.cambiarEstadoUsuario(id, 'Aprobado')
    if (exito) {
      toast({ title: 'Usuario Aprobado', description: `"${nombre}" ya puede ingresar al sistema.` })
    }
  }
}

const suspenderUsuario = async (id: number, nombre: string) => {
  if (confirm(`¿Suspender el acceso a "${nombre}"?`)) {
    const exito = await usuarioStore.cambiarEstadoUsuario(id, 'Suspendido')
    if (exito) {
      toast({ title: 'Acceso Suspendido', description: `Se bloqueó la cuenta de "${nombre}".`, variant: 'destructive' })
    }
  }
}

// --- FORMULARIO Y MODAL ---
const formulario = ref({
  nombre: '',
  correo: '',
  clave: '',
  rol: '' 
})

const abrirModalCrear = () => {
  usuarioEditandoId.value = null
  formulario.value = { nombre: '', correo: '', clave: '', rol: 'Jugador' }
  modalAbierto.value = true
}

const abrirModalEditar = (usuario: any) => {
  usuarioEditandoId.value = usuario.id
  formulario.value = { 
    nombre: usuario.nombre, 
    correo: usuario.correo, 
    clave: '', 
    rol: usuario.rol 
  }
  modalAbierto.value = true
}

const guardarUsuario = async () => {
  if (!formulario.value.nombre || !formulario.value.correo) {
    return toast({ title: 'Campos requeridos', description: 'Completa el nombre y el correo.', variant: 'destructive' })
  }
  
  guardando.value = true
  let exito = false

  if (usuarioEditandoId.value) {
    if (!navigator.onLine) {
      toast({ title: 'Sin conexión', description: 'No puedes editar usuarios sin internet.', variant: 'destructive' })
      guardando.value = false
      return
    }
    exito = await usuarioStore.actualizarUsuario(usuarioEditandoId.value, formulario.value)
  } else {
    exito = await usuarioStore.crearUsuario(formulario.value)
    if (!navigator.onLine && exito) {
      toast({ title: 'Guardado Offline', description: 'Se sincronizará al recuperar la conexión.' })
    }
  }

  if (exito) {
    toast({ title: '¡Éxito!', description: usuarioEditandoId.value ? 'Usuario actualizado.' : 'Usuario registrado con éxito.' })
    modalAbierto.value = false
    await usuarioStore.obtenerUsuarios()
  } else {
    toast({ title: 'Error', description: 'No se pudo guardar el usuario.', variant: 'destructive' })
  }
  guardando.value = false
}

const manejarEliminar = async (id: number, nombre: string) => {
  if (confirm(`¿Estás seguro de eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) {
    const exito = await usuarioStore.eliminarUsuario(id)
    if (exito) {
      toast({ title: 'Usuario Eliminado', description: `Se eliminó la cuenta de "${nombre}".`, variant: 'destructive' })
    }
  }
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto text-zinc-100 space-y-6">
    
    <!-- Cabecera con Botón Crear -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">Gestión de Accesos</h1>
        <p class="text-zinc-400 text-xs mt-1">Directorio de usuarios registrados, roles y estados de cuenta.</p>
      </div>
      
      <Button 
        @click="abrirModalCrear" 
        class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20"
      >
        + Nuevo Usuario
      </Button>
    </div>

    <!-- Barra de Filtros y Búsqueda -->
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
      
      <!-- Buscador -->
      <div class="relative w-full sm:w-72">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <Input 
          v-model="filtroBusqueda" 
          placeholder="Buscar por nombre, correo o rol..." 
          class="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-xs focus-visible:ring-primary h-9"
        />
      </div>

      <!-- Selector de cantidad por página -->
      <div class="flex items-center gap-2 text-xs text-zinc-400 w-full sm:w-auto justify-end">
        <span>Filas por página:</span>
        <select 
          v-model.number="elementosPorPagina" 
          class="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-md px-2 py-1 outline-none focus:border-primary text-xs"
        >
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="20">20</option>
        </select>
      </div>

    </div>

    <!-- Tabla de Usuarios Paginada -->
    <div class="border border-zinc-800 rounded-xl bg-zinc-950/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader class="bg-zinc-950 border-b border-zinc-800">
          <TableRow class="hover:bg-transparent">
            <TableHead class="text-zinc-400">Usuario</TableHead>
            <TableHead class="text-zinc-400">Email</TableHead>
            <TableHead class="text-zinc-400">Rol</TableHead>
            <TableHead class="text-center text-zinc-400">Estado</TableHead>
            <TableHead class="text-right text-zinc-400">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="usuarioStore.loading" class="border-zinc-800">
            <TableCell colspan="5" class="h-28 text-center text-zinc-500">
              Cargando usuarios... ⏳
            </TableCell>
          </TableRow>

          <TableRow v-else-if="usuariosPaginados.length === 0" class="border-zinc-800">
            <TableCell colspan="5" class="h-28 text-center text-zinc-500">
              No se encontraron usuarios coincidentes.
            </TableCell>
          </TableRow>
          
          <TableRow 
            v-for="user in usuariosPaginados" 
            :key="user.id" 
            class="border-zinc-800 hover:bg-zinc-800/40 transition-colors"
          >
            <TableCell class="font-bold text-zinc-200">
              {{ user.nombre }}
            </TableCell>
            <TableCell class="text-zinc-400 font-mono text-xs">
              {{ user.correo }}
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="border-zinc-700 bg-zinc-900 text-zinc-300 font-semibold text-[11px]">
                {{ user.rol }}
              </Badge>
            </TableCell>
            <TableCell class="text-center">
              <Badge 
                :class="{
                  'bg-amber-950/60 text-amber-400 border border-amber-900/50': user.estado === 'Pendiente',
                  'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50': user.estado === 'Aprobado',
                  'bg-red-950/60 text-red-400 border border-red-900/50': user.estado === 'Suspendido'
                }"
              >
                {{ user.estado }}
              </Badge>
            </TableCell>
            
            <!-- Acciones -->
            <TableCell class="text-right space-x-1.5">
              <!-- Botón Aprobar -->
              <Button 
                v-if="user.estado === 'Pendiente' || user.estado === 'Suspendido'"
                size="sm" 
                variant="outline"
                class="border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50 h-8 px-2"
                @click="aprobarUsuario(user.id, user.nombre)"
                :disabled="!isOnline"
                title="Habilitar acceso"
              >
                <Check class="w-3.5 h-3.5 mr-1" />
                Aprobar
              </Button>

              <!-- Botón Suspender -->
              <Button 
                v-if="user.estado === 'Aprobado'"
                variant="outline" 
                size="sm" 
                class="border-amber-900/50 text-amber-500 hover:bg-amber-900/30 h-8 px-2"
                @click="suspenderUsuario(user.id, user.nombre)"
                :disabled="!isOnline"
                title="Suspender acceso"
              >
                <X class="w-3.5 h-3.5 mr-1" />
                Suspender
              </Button>

              <!-- Botones CRUD -->
              <Button 
                variant="outline" 
                size="sm" 
                class="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-8"
                @click="abrirModalEditar(user)" 
                :disabled="!isOnline"
              >
                Editar
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                class="bg-red-950/50 text-red-400 border border-red-900 hover:bg-red-900 hover:text-white h-8"
                @click="manejarEliminar(user.id, user.nombre)" 
                :disabled="!isOnline"
              >
                Eliminar
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pie de Tabla con Controles de Paginación -->
      <div class="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div>
          Mostrando <span class="font-semibold text-zinc-200">{{ rangoElementos.inicio }}</span> a 
          <span class="font-semibold text-zinc-200">{{ rangoElementos.fin }}</span> de 
          <span class="font-semibold text-zinc-200">{{ rangoElementos.total }}</span> usuarios
        </div>

        <div class="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            @click="paginaAnterior" 
            :disabled="paginaActual <= 1"
            class="h-8 px-2.5 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <ChevronLeft class="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <span class="px-2 font-mono font-medium text-zinc-300">
            {{ paginaActual }} / {{ totalPaginas }}
          </span>

          <Button 
            variant="outline" 
            size="sm" 
            @click="paginaSiguiente" 
            :disabled="paginaActual >= totalPaginas"
            class="h-8 px-2.5 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            Siguiente
            <ChevronRight class="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Modal de Formulario -->
    <div v-if="modalAbierto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <h3 class="text-lg font-bold text-zinc-100">
            {{ usuarioEditandoId ? 'Editar Usuario' : 'Nuevo Usuario' }}
          </h3>
          <button @click="modalAbierto = false" class="text-zinc-500 hover:text-zinc-300 text-xl font-bold">&times;</button>
        </div>
        
        <div class="p-6 space-y-4 text-left">
          <div>
            <label class="block text-xs font-semibold text-zinc-300 mb-1">Nombre Completo</label>
            <input v-model="formulario.nombre" type="text" placeholder="Ej. Carlos Valderrama" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-primary" />
          </div>
          
          <div>
            <label class="block text-xs font-semibold text-zinc-300 mb-1">Correo Electrónico</label>
            <input v-model="formulario.correo" type="email" placeholder="usuario@copaapp.com" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-zinc-300 mb-1">Rol del Sistema</label>
            <select v-model="formulario.rol" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-primary">
              <option value="" disabled>Selecciona un rol...</option>
              <option value="Administrador">Administrador</option>
              <option value="Arbitro">Arbitro</option>
              <option value="Jugador">Jugador</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-zinc-300 mb-1">
              Contraseña <span v-if="usuarioEditandoId" class="text-xs text-zinc-500">(Dejar en blanco para conservar actual)</span>
            </label>
            <input v-model="formulario.clave" type="password" placeholder="••••••••" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
        
        <div class="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/50">
          <Button variant="ghost" @click="modalAbierto = false">Cancelar</Button>
          <Button class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold" @click="guardarUsuario" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar Usuario' }}
          </Button>
        </div>
      </div>
    </div>

  </div>
</template>