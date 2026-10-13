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

const equipoStore = useEquipoStore()
const { equipos, cargando } = storeToRefs(equipoStore)

const modalAbierto = ref(false)
const guardando = ref(false)
const equipoEditandoId = ref<number | null>(null)

const formulario = ref({
  nombre: '',
  urlEscudo: ''
})

onMounted(async () => {
  await equipoStore.obtenerEquipos()
})

const abrirModalCrear = () => {
  equipoEditandoId.value = null
  formulario.value = { nombre: '', urlEscudo: '' }
  modalAbierto.value = true
}

const abrirModalEditar = (equipo: any) => {
  equipoEditandoId.value = equipo.id
  formulario.value = { 
    nombre: equipo.nombre, 
    urlEscudo: equipo.urlEscudo 
  }
  modalAbierto.value = true
}

const guardarEquipo = async () => {
  if (!formulario.value.nombre.trim() || !formulario.value.urlEscudo.trim()) return
  
  guardando.value = true
  let exito = false
  
  if (equipoEditandoId.value) {
    exito = await equipoStore.actualizarEquipo(equipoEditandoId.value, formulario.value)
  } else {
    exito = await equipoStore.crearEquipo(formulario.value)
  }
  
  if (exito) {
    modalAbierto.value = false
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
              <!-- Mostramos la imagen del escudo -->
              <img 
                :src="equipo.urlEscudo" 
                :alt="equipo.nombre" 
                class="w-10 h-10 object-contain rounded-full bg-card shadow-sm"
                onerror="this.src='https://placehold.co/100?text=Logo'" 
              />
            </TableCell>
            <TableCell class="font-medium">{{ equipo.nombre }}</TableCell>
            <TableCell class="text-right space-x-2">
              <Button variant="outline" size="sm" @click="abrirModalEditar(equipo)">Editar</Button>
              <Button variant="destructive" size="sm" @click="manejarEliminar(equipo.id, equipo.nombre)">Eliminar</Button>
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
            <Input id="nombre" v-model="formulario.nombre" class="col-span-3" placeholder="Ej: Real Madrid" />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label for="urlEscudo" class="text-right">URL Escudo</Label>
            <Input id="urlEscudo" v-model="formulario.urlEscudo" class="col-span-3" placeholder="https://..." />
          </div>
          
          <!-- Previsualización del escudo -->
          <div v-if="formulario.urlEscudo" class="flex justify-center mt-4">
            <img :src="formulario.urlEscudo" class="w-20 h-20 object-contain rounded-full border shadow-md bg-card" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="modalAbierto = false">Cancelar</Button>
          <Button type="submit" @click="guardarEquipo" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>