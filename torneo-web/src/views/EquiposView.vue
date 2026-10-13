<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEquipoStore, type Equipo } from '@/stores/equipos'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/components/ui/toast/use-toast'

const equiposStore = useEquipoStore()
const authStore = useAuthStore()
const { toast } = useToast()

// Estados reactivos
const pestañaActiva = ref<'aprobados' | 'pendientes'>('aprobados')
const modalAbierto = ref(false)
const modoEdicion = ref(false)
const equipoEditandoId = ref<number | null>(null)
const cargandoAccion = ref(false)

// Formulario de creación/edición
const formulario = ref({
  nombre: '',
  escudo: null as File | null,
  urlEscudoActual: ''
})

// Verificar si el usuario es Administrador
const esAdmin = computed(() => {
  const rol = authStore.usuario?.rol?.toLowerCase()
  return rol === 'administrador' || rol === 'admin'
})

// Equipos Aprobados
const equiposAprobados = computed(() => {
  return equiposStore.equipos.filter(e => e.estado === 'Aprobado' || !e.estado)
})

// Equipos Pendientes de Aprobación
const equiposPendientes = computed(() => {
  return equiposStore.equipos.filter(e => e.estado === 'Pendiente')
})

onMounted(async () => {
  await equiposStore.obtenerEquipos()
})

// Aprobar equipo
const aprobarEquipo = async (equipo: Equipo) => {
  cargandoAccion.value = true
  const exito = await equiposStore.cambiarEstadoEquipo(equipo.id, 'Aprobado')
  cargandoAccion.value = false

  if (exito) {
    toast({
      title: '¡Equipo Aprobado!',
      description: `El club "${equipo.nombre}" ya puede participar en los torneos.`
    })
  } else {
    toast({
      title: 'Error',
      description: 'No se pudo aprobar el equipo.',
      variant: 'destructive'
    })
  }
}

// Rechazar equipo
const rechazarEquipo = async (equipo: Equipo) => {
  if (!confirm(`¿Estás seguro de rechazar la solicitud de "${equipo.nombre}"?`)) return

  cargandoAccion.value = true
  const exito = await equiposStore.cambiarEstadoEquipo(equipo.id, 'Rechazado')
  cargandoAccion.value = false

  if (exito) {
    toast({
      title: 'Solicitud Rechazada',
      description: `El equipo "${equipo.nombre}" fue rechazado.`,
      variant: 'destructive'
    })
  }
}

// Manejo del modal de creación/edición
const abrirModalNuevo = () => {
  modoEdicion.value = false
  equipoEditandoId.value = null
  formulario.value = { nombre: '', escudo: null, urlEscudoActual: '' }
  modalAbierto.value = true
}

const abrirModalEditar = (equipo: Equipo) => {
  modoEdicion.value = true
  equipoEditandoId.value = equipo.id
  formulario.value = {
    nombre: equipo.nombre,
    escudo: null,
    urlEscudoActual: equipo.urlEscudo
  }
  modalAbierto.value = true
}

const manejarArchivo = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    formulario.value.escudo = target.files[0]
  }
}

const guardarEquipo = async () => {
  if (!formulario.value.nombre.trim()) {
    toast({ title: 'Atención', description: 'El nombre es obligatorio.', variant: 'destructive' })
    return
  }

  const formData = new FormData()
  formData.append('Nombre', formulario.value.nombre)
  if (formulario.value.escudo) {
    formData.append('Escudo', formulario.value.escudo)
  }

  cargandoAccion.value = true
  let exito = false

  if (modoEdicion.value && equipoEditandoId.value) {
    exito = await equiposStore.actualizarEquipo(equipoEditandoId.value, formData)
  } else {
    exito = await equiposStore.crearEquipo(formData)
  }

  cargandoAccion.value = false

  if (exito) {
    modalAbierto.value = false
    toast({
      title: modoEdicion.value ? '¡Actualizado!' : '¡Creado!',
      description: `Equipo guardado exitosamente.`
    })
  } else {
    toast({ title: 'Error', description: 'No se pudo guardar el equipo.', variant: 'destructive' })
  }
}

const eliminarEquipo = async (equipo: Equipo) => {
  if (!confirm(`¿Eliminar definitivamente el equipo "${equipo.nombre}"?`)) return
  const exito = await equiposStore.eliminarEquipo(equipo.id)
  if (exito) {
    toast({ title: 'Eliminado', description: 'Equipo eliminado.', variant: 'destructive' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Gestión de Equipos</h1>
        <p class="text-sm text-muted-foreground">Administra los clubes participantes y solicitudes de inscripción.</p>
      </div>

      <!-- Botón de Nuevo Equipo (Solo visible para Admin) -->
      <button
        v-if="esAdmin"
        @click="abrirModalNuevo"
        class="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 transition"
      >
        + Registrar Equipo
      </button>
    </div>

    <!-- Pestañas de Navegación (Solo para Admin) -->
    <div v-if="esAdmin" class="flex border-b border-border space-x-4">
      <button
        @click="pestañaActiva = 'aprobados'"
        :class="[
          'pb-3 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2',
          pestañaActiva === 'aprobados'
            ? 'border-emerald-600 text-emerald-600 font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        ]"
      >
        <span>Equipos Activos</span>
        <span class="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-xs font-semibold">
          {{ equiposAprobados.length }}
        </span>
      </button>

      <button
        @click="pestañaActiva = 'pendientes'"
        :class="[
          'pb-3 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2',
          pestañaActiva === 'pendientes'
            ? 'border-amber-500 text-amber-600 font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        ]"
      >
        <span>Solicitudes Pendientes</span>
        <span
          v-if="equiposPendientes.length > 0"
          class="rounded-full bg-amber-500 text-white px-2 py-0.5 text-xs font-bold animate-pulse"
        >
          {{ equiposPendientes.length }}
        </span>
        <span v-else class="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
          0
        </span>
      </button>
    </div>

    <!-- VISTA 1: SOLICITUDES PENDIENTES (Solo visible para Admin cuando elige esta pestaña) -->
    <div v-if="esAdmin && pestañaActiva === 'pendientes'" class="space-y-4">
      <div v-if="equiposPendientes.length === 0" class="text-center py-12 bg-card rounded-xl border border-dashed border-border">
        <p class="text-muted-foreground">🎉 No hay solicitudes pendientes de aprobación en este momento.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="equipo in equiposPendientes"
          :key="equipo.id"
          class="bg-card rounded-xl border border-amber-300/40 p-5 shadow-sm space-y-4 hover:border-amber-400 transition"
        >
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
              <img
                v-if="equipo.urlEscudo"
                :src="equipo.urlEscudo.startsWith('http') ? equipo.urlEscudo : `https://localhost:7101${equipo.urlEscudo}`"
                :alt="equipo.nombre"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-xl font-bold text-muted-foreground">⚽</span>
            </div>
            <div>
              <h3 class="font-bold text-foreground text-lg">{{ equipo.nombre }}</h3>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ⏳ Pendiente de Aprobación
              </span>
            </div>
          </div>

          <p v-if="equipo.codigoInvitacion" class="text-xs text-muted-foreground">
            Código temporal: <span class="font-mono font-semibold">{{ equipo.codigoInvitacion }}</span>
          </p>

          <!-- Acciones de Aprobación / Rechazo -->
          <div class="flex gap-2 pt-2 border-t border-border">
            <button
              @click="aprobarEquipo(equipo)"
              :disabled="cargandoAccion"
              class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition text-center shadow-sm"
            >
              ✓ Aprobar
            </button>
            <button
              @click="rechazarEquipo(equipo)"
              :disabled="cargandoAccion"
              class="flex-1 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white text-xs font-semibold py-2 px-3 rounded-lg transition text-center"
            >
              ✕ Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- VISTA 2: EQUIPOS APROBADOS (Catálogo normal) -->
    <div v-else class="space-y-4">
      <div v-if="equiposAprobados.length === 0" class="text-center py-12 bg-card rounded-xl border border-dashed border-border">
        <p class="text-muted-foreground">No hay equipos activos registrados todavía.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="equipo in equiposAprobados"
          :key="equipo.id"
          class="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4 hover:shadow-md transition"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                <img
                  v-if="equipo.urlEscudo"
                  :src="equipo.urlEscudo.startsWith('http') ? equipo.urlEscudo : `https://localhost:7101${equipo.urlEscudo}`"
                  :alt="equipo.nombre"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-lg font-bold text-muted-foreground">⚽</span>
              </div>
              <div>
                <h3 class="font-bold text-foreground">{{ equipo.nombre }}</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ✓ Activo
                </span>
              </div>
            </div>

            <!-- Botones de Editar y Eliminar (Solo visibles para Administrador) -->
            <div v-if="esAdmin" class="flex items-center gap-1">
              <button
                @click="abrirModalEditar(equipo)"
                class="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition text-xs"
                title="Editar"
              >
                ✏️
              </button>
              <button
                @click="eliminarEquipo(equipo)"
                class="text-destructive/70 hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition text-xs"
                title="Eliminar"
              >
                🗑️
              </button>
            </div>
          </div>

          <div v-if="equipo.codigoInvitacion && esAdmin" class="text-xs text-muted-foreground pt-2 border-t border-border flex justify-between">
            <span>Código de invitación:</span>
            <span class="font-mono font-bold text-foreground">{{ equipo.codigoInvitacion }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE CREACIÓN / EDICIÓN -->
    <div
      v-if="modalAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div class="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-xl space-y-4">
        <h2 class="text-xl font-bold text-foreground">
          {{ modoEdicion ? 'Editar Equipo' : 'Nuevo Equipo' }}
        </h2>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-foreground mb-1">Nombre del Club</label>
            <input
              v-model="formulario.nombre"
              type="text"
              placeholder="Ej. Real Insystech FC"
              class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-foreground mb-1">Escudo (Imagen PNG/JPG)</label>
            <input
              type="file"
              accept="image/*"
              @change="manejarArchivo"
              class="w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-border">
          <button
            @click="modalAbierto = false"
            class="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            @click="guardarEquipo"
            :disabled="cargandoAccion"
            class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow"
          >
            {{ cargandoAccion ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>