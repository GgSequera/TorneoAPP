<script setup lang="ts">
import { ref } from 'vue'
import { useEquipoStore } from '@/stores/equipos'

// Componentes Shadcn-UI
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Crown, Users, Check, Copy } from 'lucide-vue-next'

const emit = defineEmits(['completado'])
const equipoStore = useEquipoStore()

const modalAbierto = ref(true)
const paso = ref<'seleccion' | 'formulario_capitan' | 'formulario_jugador' | 'exito'>('seleccion')
const guardando = ref(false)
const mensajeError = ref('')
const codigoGenerado = ref('')

const formCapitan = ref({
  nombreEquipo: '',
  urlEscudo: '',
  nombreJugador: '',
  dorsal: 10,
  posicion: 'Delantero'
})

const formJugador = ref({
  codigoInvitacion: '',
  nombreJugador: '',
  dorsal: 1,
  posicion: 'Mediocampista'
})

const procesarCapitan = async () => {
  if (!formCapitan.value.nombreEquipo || !formCapitan.value.nombreJugador) {
    mensajeError.value = 'Ingresa el nombre del equipo y tu nombre.'
    return
  }

  guardando.value = true
  mensajeError.value = ''

  const res = await equipoStore.crearComoCapitan(formCapitan.value)
  guardando.value = false

  if (res.exito) {
    codigoGenerado.value = res.codigo
    paso.value = 'exito'
  } else {
    mensajeError.value = res.mensaje
  }
}

const procesarUnirse = async () => {
  if (!formJugador.value.codigoInvitacion || !formJugador.value.nombreJugador) {
    mensajeError.value = 'Ingresa el código y tu nombre.'
    return
  }

  guardando.value = true
  mensajeError.value = ''

  const res = await equipoStore.unirsePorCodigo(formJugador.value)
  guardando.value = false

  if (res.exito) {
    paso.value = 'exito'
  } else {
    mensajeError.value = res.mensaje
  }
}

const copiarCodigo = () => {
  navigator.clipboard.writeText(codigoGenerado.value)
  alert('¡Código copiado al portapapeles!')
}
</script>

<template>
  <Dialog :open="modalAbierto">
    <DialogContent class="sm:max-w-[480px] bg-zinc-900 border-zinc-800 text-zinc-100">
      
      <!-- Mensaje de Error -->
      <div v-if="mensajeError" class="p-3 bg-destructive/15 border border-destructive/30 rounded-md text-destructive text-sm font-medium">
        {{ mensajeError }}
      </div>

      <!-- PASO 1: SELECCIÓN -->
      <template v-if="paso === 'seleccion'">
        <DialogHeader class="text-center">
          <DialogTitle class="text-2xl font-bold text-white">¡Bienvenido al Torneo!</DialogTitle>
          <DialogDescription class="text-zinc-400">
            Para continuar, dinos cuál será tu rol en el equipo.
          </DialogDescription>
        </DialogHeader>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
          <Card 
            @click="paso = 'formulario_capitan'"
            class="bg-zinc-950/50 border-zinc-800 hover:border-primary/50 hover:bg-zinc-800/50 transition-all cursor-pointer group"
          >
            <CardHeader class="items-center text-center p-4">
              <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Crown class="w-6 h-6" />
              </div>
              <CardTitle class="text-base text-zinc-100">Soy Capitán</CardTitle>
              <CardDescription class="text-xs text-zinc-400">
                Registra un equipo nuevo y comparte el código.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            @click="paso = 'formulario_jugador'"
            class="bg-zinc-950/50 border-zinc-800 hover:border-primary/50 hover:bg-zinc-800/50 transition-all cursor-pointer group"
          >
            <CardHeader class="items-center text-center p-4">
              <div class="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users class="w-6 h-6" />
              </div>
              <CardTitle class="text-base text-zinc-100">Soy Jugador</CardTitle>
              <CardDescription class="text-xs text-zinc-400">
                Tengo un código de invitación de mi capitán.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </template>

      <!-- PASO 2A: FORMULARIO CAPITÁN -->
      <template v-else-if="paso === 'formulario_capitan'">
        <DialogHeader>
          <DialogTitle class="text-xl text-white">Crear Nuevo Equipo</DialogTitle>
          <DialogDescription class="text-zinc-400">
            Ingresa los datos para registrar tu plantilla.
          </DialogDescription>
        </DialogHeader>
        
        <div class="space-y-4 my-2">
          <div class="space-y-2">
            <Label class="text-zinc-300">Nombre del Equipo *</Label>
            <Input v-model="formCapitan.nombreEquipo" placeholder="Ej: Real Deportivo" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>

          <div class="space-y-2">
            <Label class="text-zinc-300">URL del Escudo / Logo (Opcional)</Label>
            <Input v-model="formCapitan.urlEscudo" placeholder="https://ejemplo.com/escudo.png" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>

          <div class="space-y-2">
            <Label class="text-zinc-300">Tu Nombre Completo *</Label>
            <Input v-model="formCapitan.nombreJugador" placeholder="Ej: Carlos Pérez" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label class="text-zinc-300">Dorsal</Label>
              <Input v-model.number="formCapitan.dorsal" type="number" min="1" max="99" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
            </div>
            <div class="space-y-2">
              <Label class="text-zinc-300">Posición</Label>
              <Select v-model="formCapitan.posicion">
                <SelectTrigger class="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent class="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="Portero">Portero</SelectItem>
                  <SelectItem value="Defensa">Defensa</SelectItem>
                  <SelectItem value="Mediocampista">Mediocampista</SelectItem>
                  <SelectItem value="Delantero">Delantero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center pt-4 border-t border-zinc-800">
          <Button variant="ghost" size="sm" @click="paso = 'seleccion'">Atrás</Button>
          <Button class="font-bold" :disabled="guardando" @click="procesarCapitan">
            {{ guardando ? 'Guardando...' : 'Crear Equipo' }}
          </Button>
        </div>
      </template>

      <!-- PASO 2B: FORMULARIO UNIRSE POR CÓDIGO -->
      <template v-else-if="paso === 'formulario_jugador'">
        <DialogHeader>
          <DialogTitle class="text-xl text-white">Unirse a un Equipo</DialogTitle>
          <DialogDescription class="text-zinc-400">
            Ingresa el código proporcionado por tu capitán.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 my-2">
          <div class="space-y-2">
            <Label class="text-zinc-300">Código de Invitación (6 caracteres) *</Label>
            <Input v-model="formJugador.codigoInvitacion" placeholder="Ej: X8A3F2" maxlength="6" class="bg-zinc-950 border-zinc-800 text-amber-400 uppercase font-mono tracking-widest text-center" />
          </div>

          <div class="space-y-2">
            <Label class="text-zinc-300">Tu Nombre Completo *</Label>
            <Input v-model="formJugador.nombreJugador" placeholder="Ej: Andrés Gómez" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label class="text-zinc-300">Dorsal</Label>
              <Input v-model.number="formJugador.dorsal" type="number" min="1" max="99" class="bg-zinc-950 border-zinc-800 text-zinc-100" />
            </div>
            <div class="space-y-2">
              <Label class="text-zinc-300">Posición</Label>
              <Select v-model="formJugador.posicion">
                <SelectTrigger class="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent class="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="Portero">Portero</SelectItem>
                  <SelectItem value="Defensa">Defensa</SelectItem>
                  <SelectItem value="Mediocampista">Mediocampista</SelectItem>
                  <SelectItem value="Delantero">Delantero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center pt-4 border-t border-zinc-800">
          <Button variant="ghost" size="sm" @click="paso = 'seleccion'">Atrás</Button>
          <Button class="font-bold" :disabled="guardando" @click="procesarUnirse">
            {{ guardando ? 'Validando...' : 'Unirme' }}
          </Button>
        </div>
      </template>

      <!-- PASO 3: ÉXITO -->
<template v-else-if="paso === 'exito'">
  <!-- Si se creó un equipo como Capitán (Pendiente de Aprobación) -->
  <div v-if="esCapitanProcesado" class="text-center space-y-4 py-2">
    <div class="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
      <Clock class="w-7 h-7" />
    </div>
    <DialogTitle class="text-2xl font-bold text-white">¡Equipo Registrado!</DialogTitle>
    <DialogDescription class="text-zinc-400">
      Tu equipo <strong class="text-zinc-200">{{ formCapitan.nombreEquipo }}</strong> se ha registrado correctamente.
    </DialogDescription>

    <Card class="bg-zinc-950 border-zinc-800 p-4 my-2 text-left space-y-2">
      <div class="flex items-center gap-2 text-amber-400 text-sm font-semibold">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        Estado: En Revisión por el Administrador
      </div>
      <p class="text-xs text-zinc-400">
        Una vez que el administrador apruebe la solicitud, tu equipo quedará activado y podrás obtener tu código de invitación en el Dashboard para sumar jugadores.
      </p>
    </Card>

    <Button class="w-full font-bold mt-2" @click="emit('completado')">
      Ir al Dashboard
    </Button>
  </div>

  <!-- Si se unió como Jugador con Código (Aprobado de una vez) -->
  <div v-else class="text-center space-y-4 py-2">
    <div class="w-14 h-14 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto">
      <Check class="w-7 h-7" />
    </div>
    <DialogTitle class="text-2xl font-bold text-white">¡Bienvenido al Equipo!</DialogTitle>
    <DialogDescription class="text-zinc-400">
      Te has integrado exitosamente a la plantilla.
    </DialogDescription>

    <Button class="w-full font-bold mt-2" @click="emit('completado')">
      Entrar al Tablero
    </Button>
  </div>
</template>

    </DialogContent>
  </Dialog>
</template>