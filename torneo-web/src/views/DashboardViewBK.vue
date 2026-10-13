<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEquipoStore } from '@/stores/equipos'
import { useAuthStore } from '@/stores/auth'
import ModalOnboardingJugador from '@/components/ModalOnboardingJugador.vue'

// (OJO: Veo que usas Card, Badge, Button, Shield, Crown, Check, Copy en el template pero no están importados. 
// Asumo que los tienes registrados globalmente. Si te da error de que no existen, hay que importarlos).

const equipoStore = useEquipoStore()
const authStore = useAuthStore()
const mostrarModal = ref(false)
const copiado = ref(false) // Faltaba definir esta variable para el botón de copiar

onMounted(async () => {
  console.log('🔍 Usuario actual en AuthStore:', authStore.usuario)
  
  // 1. Buscamos el rol en todas sus posibles variantes de .NET
  const u = authStore.usuario
  const rolEncontrado = u?.rol || u?.Rol || u?.role || u?.Role
  
  // 2. Ahora sí lo pasamos a minúsculas de forma segura
  const rolActual = rolEncontrado ? String(rolEncontrado).toLowerCase() : null
  console.log('🔍 Rol detectado:', rolActual)

  if (rolActual === 'jugador') {
    const perfil = await equipoStore.verificarPerfilJugador()
    console.log('🔍 Respuesta de Perfil Jugador:', perfil)

    if (perfil && !perfil.tieneEquipo) {
      console.log('🚀 Desplegando modal de onboarding...')
      mostrarModal.value = true
    }
  } else {
    console.log('ℹ️ No es rol Jugador o el usuario aún no está cargado.')
  }
})

const finalizarOnboarding = () => {
  mostrarModal.value = false
}

const copiarCodigo = async () => {
  if (equipoStore.miPerfil?.codigoInvitacion) {
    await navigator.clipboard.writeText(equipoStore.miPerfil.codigoInvitacion)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2000)
  }
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    
    <!-- Cabecera -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-white">Tablero Privado 📊</h1>
      <p class="text-zinc-400 text-sm mt-1">Bienvenido al panel general del Torneo.</p>
    </div>

    <!-- Tarjeta de Estado del Equipo (Shadcn-UI) -->
    <Card v-if="equipoStore.miPerfil?.tieneEquipo" class="bg-zinc-950/50 border-zinc-800 text-zinc-100 max-w-md">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
        <div class="space-y-1">
          <CardTitle class="text-xl font-bold text-white flex items-center gap-2">
            <Shield class="w-5 h-5 text-primary" />
            {{ equipoStore.miPerfil.equipo }}
          </CardTitle>
          <CardDescription class="text-zinc-400 text-xs">
            Información de tu equipo registrado
          </CardDescription>
        </div>

        <Badge 
          variant="outline" 
          :class="equipoStore.miPerfil.esCapitan 
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' 
            : 'border-blue-500/30 bg-blue-500/10 text-blue-400'"
        >
          <Crown v-if="equipoStore.miPerfil.esCapitan" class="w-3 h-3 mr-1" />
          {{ equipoStore.miPerfil.esCapitan ? 'Capitán' : 'Jugador' }}
        </Badge>
      </CardHeader>

      <CardContent v-if="equipoStore.miPerfil.esCapitan" class="pt-3 border-t border-zinc-800/80">
        <div class="space-y-2">
          <span class="text-xs text-zinc-400 font-medium">Código de Invitación</span>
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-lg font-bold text-amber-400 tracking-widest text-center">
              {{ equipoStore.miPerfil.codigoInvitacion }}
            </div>
            <Button size="icon" variant="outline" class="border-zinc-800 hover:bg-zinc-800 text-zinc-300" @click="copiarCodigo">
              <Check v-if="copiado" class="w-4 h-4 text-emerald-400" />
              <Copy v-else class="w-4 h-4" />
            </Button>
          </div>
          <p class="text-xs text-zinc-500">Pásale este código a tus compañeros para que se sumen.</p>
        </div>
      </CardContent>
    </Card>

    <!-- Modal de Onboarding -->
    <ModalOnboardingJugador 
      v-if="mostrarModal" 
      @completado="finalizarOnboarding" 
    />

  </div>
</template>