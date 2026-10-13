<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEquipoStore } from '@/stores/equipos'

// Importaciones de Shadcn UI
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNetwork } from '@/composables/useNetwork'

// ⚠️ Cambia este puerto por el que usa tu backend .NET (ej. https://localhost:7123 o http://localhost:5000)
const API_BASE_URL = 'https://localhost:7101' 

const equipoStore = useEquipoStore()
const { equipos, cargando } = storeToRefs(equipoStore)

const modalAbierto = ref(false)
const guardando = ref(false)
const equipoEditandoId = ref<number | null>(null)

const nombreEquipo = ref('')
const archivoEscudo = ref<File | null>(null)
const vistaPrevia = ref<string | null>(null)
const { isOnline } = useNetwork()

onMounted(async () => {
  await equipoStore.obtenerEquipos()
})

// Formateador para las imágenes servidas por .NET
const resolverUrlEscudo = (url?: string) => {
  if (!url) return 'https://placehold.co/100?text=Logo'
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}

const abrirModalCrear = () => {
  equipoEditandoId.value = null
  nombreEquipo.value = ''
  archivoEscudo.value = null
  vistaPrevia.value = null
  modalAbierto.value = true
}

const abrirModalEditar = (equipo: any) => {
  equipoEditandoId.value = equipo.id
  nombreEquipo.value = equipo.nombre
  archivoEscudo.value = null
  vistaPrevia.value = resolverUrlEscudo(equipo.urlEscudo)
  modalAbierto.value = true
}

// Capturar el archivo seleccionado del <input type="file" />
const manejarSeleccionArchivo = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    archivoEscudo.value = file
    vistaPrevia.value = URL.createObjectURL(file) // Genera vista previa local instantánea
  }
}

const guardarEquipo = async () => {
  if (!nombreEquipo.value.trim()) return
  
  guardando.value = true
  
  // Construimos el FormData requerido por [FromForm] en .NET
  const data = new FormData()
  data.append('Nombre', nombreEquipo.value)
  
  if (archivoEscudo.value) {
    data.append('Escudo', archivoEscudo.value) // Nombre exacto de la propiedad 'Escudo' en C#
  }
  
  let exito = false
  if (equipoEditandoId.value) {
    exito = await equipoStore.actualizarEquipo(equipoEditandoId.value, data)
  } else {
    exito = await equipoStore.crearEquipo(data)
  }
  
  if (exito) {
    modalAbierto.value = false
    await equipoStore.obtenerEquipos()
  } else {
    alert("Hubo un error al guardar el equipo.")
  }
  guardando.value = false
}

const manejarEliminar = async (id: number, nombre: string) => {
  const confirmado = window.confirm(`¿Estás seguro de eliminar al equipo "${nombre}"?`)
  if (confirmado) {
    await equipoStore.eliminarEquipo(id)
  }
}

</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Equipos</h2>
        <p class="text-muted-foreground">Gestiona el catálogo de equipos del sistema.</p>
      </div>
      <Button @click="abrirModalCrear">+ Nuevo Equipo</Button>
    </div>

    <!-- Tabla de Equipos -->
    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[100px]">Escudo</TableHead>
            <TableHead>Nombre del Equipo</TableHead>
            <TableHead class="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="cargando">
            <TableCell colspan="3" class="text-center py-10 text-muted-foreground">
              Cargando equipos...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="equipos.length === 0">
            <TableCell colspan="3" class="text-center py-10 text-muted-foreground">
              No hay equipos registrados.
            </TableCell>
          </TableRow>
          <TableRow v-else v-for="equipo in equipos" :key="equipo.id">
            <TableCell>
              <!-- Mostramos la imagen concatenando el backend URL -->
              <img 
                :src="resolverUrlEscudo(equipo.urlEscudo)" 
                :alt="equipo.nombre" 
                class="w-10 h-10 object-contain rounded-full bg-card border shadow-sm"
                @error.once="$event.target.src = '/favicon.svg'"
              />
            </TableCell>
            <TableCell class="font-medium">{{ equipo.nombre }}</TableCell>
            <TableCell class="text-right space-x-2">
              <Button variant="outline" size="sm" @click="abrirModalEditar(equipo)" :disabled="!isOnline">Editar</Button>
              <Button variant="destructive" size="sm" @click="manejarEliminar(equipo.id, equipo.nombre)" :disabled="!isOnline">Eliminar</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Modal Formulario -->
    <Dialog :open="modalAbierto" @update:open="modalAbierto = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{{ equipoEditandoId ? 'Editar Equipo' : 'Nuevo Equipo' }}</DialogTitle>
        </DialogHeader>
        
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label for="nombre" class="text-right">Nombre</Label>
            <Input id="nombre" v-model="nombreEquipo" class="col-span-3" placeholder="Ej: Real Madrid" />
          </div>

          <!-- Selector de Archivo -->
          <div class="grid grid-cols-4 items-center gap-4">
            <Label for="archivo" class="text-right">Escudo</Label>
            <Input 
              id="archivo" 
              type="file" 
              accept="image/*" 
              class="col-span-3 cursor-pointer" 
              @change="manejarSeleccionArchivo" 
            />
          </div>
          
          <!-- Previsualización del escudo -->
          <div v-if="vistaPrevia" class="flex flex-col items-center justify-center mt-2">
            <span class="text-xs text-muted-foreground mb-1">Vista previa:</span>
            <img :src="vistaPrevia" class="w-20 h-20 object-contain rounded-xl border p-1 shadow-sm bg-card" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="modalAbierto = false">Cancelar</Button>
          <Button type="submit" @click="guardarEquipo" :disabled="guardando || !nombreEquipo.trim()">
            {{ guardando ? 'Guardando...' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>