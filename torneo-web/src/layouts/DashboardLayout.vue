<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { LayoutDashboard, Trophy, Shield, ChevronLeft, ChevronRight, Menu, LogOut, Bell, Wifi, WifiOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useNotificacionesStore } from '@/stores/notificaciones'
import { useToast } from '@/components/ui/toast/use-toast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

const router = useRouter()
const authStore = useAuthStore()
const notificaciones = useNotificacionesStore()
const { toast } = useToast()

const isCollapsed = ref(false)
const isOnline = ref(navigator.onLine)

// Detectar si el usuario es Administrador para el menú
const esAdmin = computed(() => {
  const rol = authStore.usuario?.rol?.toLowerCase()
  return rol === 'administrador' || rol === 'admin'
})

const esJugador = computed(() => {
  return authStore.usuario?.rol?.toLowerCase() === 'jugador'
})

// Iniciales del usuario para el avatar
const inicialesUsuario = computed(() => {
  const nombre = authStore.usuario?.nombre || 'US'
  const partes = nombre.trim().split(' ')
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase()
  }
  return nombre.slice(0, 2).toUpperCase()
})

// Manejo de eventos de red
const actualizarEstadoRed = () => {
  const estadoAnterior = isOnline.value
  isOnline.value = navigator.onLine

  if (!isOnline.value && estadoAnterior) {
    toast({
      title: 'Sin conexión a internet',
      description: 'Has pasado a modo Offline. Las acciones se guardarán localmente.',
      variant: 'destructive'
    })
  } else if (isOnline.value && !estadoAnterior) {
    toast({
      title: '¡Conexión restablecida!',
      description: 'Sincronizando los datos con el servidor...'
    })
  }
}

onMounted(() => {
  window.addEventListener('online', actualizarEstadoRed)
  window.addEventListener('offline', actualizarEstadoRed)
})

onUnmounted(() => {
  window.removeEventListener('online', actualizarEstadoRed)
  window.removeEventListener('offline', actualizarEstadoRed)
})

const ejecutarCierreSesion = async () => {
  await authStore.cerrarSesion()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex w-full bg-zinc-950 text-zinc-100">
    
    <!-- SIDEBAR -->
    <aside 
      :class="[
        'transition-all duration-300 ease-in-out bg-zinc-900 border-r border-zinc-800 hidden md:flex flex-col relative',
        isCollapsed ? 'w-20' : 'w-64'
      ]"
    >
      <!-- Botón para colapsar -->
      <button 
        @click="isCollapsed = !isCollapsed"
        class="absolute -right-3.5 top-6 bg-zinc-800 border border-zinc-700 rounded-full p-1.5 text-zinc-400 shadow-md hover:text-primary hover:border-primary/50 hover:bg-zinc-900 hover:scale-110 transition-all z-20"
      >
        <ChevronRight v-if="isCollapsed" class="w-4 h-4" />
        <ChevronLeft v-else class="w-4 h-4" />
      </button>

      <!-- Logo -->
      <div class="p-6 flex items-center overflow-hidden h-20">
        <div class="flex items-center gap-2 min-w-max">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground shadow-sm shadow-primary/20">
            C
          </div>
          <div v-if="!isCollapsed" class="transition-opacity duration-300">
            <h1 class="text-xl font-bold tracking-tight text-zinc-100">Copa<span class="text-primary">App</span></h1>
            <p class="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{{ authStore.usuario?.rol || 'Panel' }}</p>
          </div>
        </div>
      </div>

      <!-- Navegación con RBAC -->
      <nav class="flex-1 px-4 space-y-2 mt-2 overflow-hidden">
        <router-link to="/" class="nav-item">
          <LayoutDashboard class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">Panel de Control</span>
        </router-link>
        
        <router-link to="/torneos" class="nav-item">
          <Trophy class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">Torneos</span>
        </router-link>

        <router-link to="/equipos" class="nav-item">
          <Shield class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">Equipos</span>
        </router-link>

        <router-link  v-if="esAdmin || esJugador" to="/jugador" class="nav-item">
          <Shield class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">
            {{ esAdmin ? 'Directorio Jugadores' : 'Mi Plantilla' }}
          </span>
        </router-link>
        
        <!-- Enlace a Usuarios: Solo visible para Administrador -->
        <router-link v-if="esAdmin" to="/usuarios" class="nav-item">
          <Shield class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">Usuarios</span>
        </router-link>
      </nav>

      <!-- Perfil Usuario Real -->
      <div class="p-4 border-t border-zinc-800 mt-auto overflow-hidden">
        <div class="flex items-center gap-3 min-w-max">
          <div class="w-10 h-10 rounded-full bg-zinc-950 flex items-center justify-center text-primary font-bold border border-zinc-800 text-sm">
            {{ inicialesUsuario }}
          </div>
          <div v-if="!isCollapsed" class="overflow-hidden max-w-[140px]">
            <p class="text-sm font-medium text-zinc-200 truncate">{{ authStore.usuario?.nombre || 'Usuario' }}</p>
            <p class="text-xs text-zinc-500 truncate">{{ authStore.usuario?.correo || authStore.usuario?.rol || '' }}</p>
          </div>
        </div>
        <button 
          @click="ejecutarCierreSesion"
          class="flex items-center w-full px-3 py-2.5 mt-2 rounded-lg transition-all duration-200 text-zinc-400 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 border border-transparent"
        >
          <LogOut class="w-5 h-5 min-w-[20px]" />
          <span v-if="!isCollapsed" class="ml-3 text-sm font-medium whitespace-nowrap">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <!-- Contenido Principal -->
    <main class="flex-1 flex flex-col min-h-screen min-w-0 bg-zinc-950">
      <header class="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center px-6 justify-between sticky top-0 z-10">
        <div class="flex items-center gap-4">
          <button @click="isCollapsed = !isCollapsed" class="md:hidden text-zinc-400 hover:text-primary transition-colors">
            <Menu class="w-6 h-6" />
          </button>
          <h2 class="text-sm font-medium text-zinc-400 hidden sm:block">Sistema de Gestión Deportiva</h2>
        </div>
        
        <!-- Contenedor derecho: Píldora de Red + Campanita + Versión -->
        <div class="flex items-center gap-3">
          
          <!-- 🟢 / 🔴 INDICADOR DINÁMICO DE RED -->
          <div 
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300',
              isOnline 
                ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' 
                : 'bg-red-950/60 border-red-500/50 text-red-400 animate-pulse'
            ]"
          >
            <Wifi v-if="isOnline" class="w-3.5 h-3.5 text-emerald-400" />
            <WifiOff v-else class="w-3.5 h-3.5 text-red-400" />
            <span>{{ isOnline ? 'En línea' : 'Modo Offline' }}</span>
          </div>

          <!-- COMPONENTE CAMPANITA -->
          <Popover @update:open="(isOpen) => isOpen && notificaciones.marcarComoLeidas()">
            <PopoverTrigger as-child>
              <Button variant="ghost" size="icon" class="relative hover:bg-zinc-800 h-8 w-8">
                <Bell class="h-4 w-4 text-zinc-300" />
                <span 
                  v-if="notificaciones.noLeidas > 0" 
                  class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm"
                >
                  {{ notificaciones.noLeidas }}
                </span>
              </Button>
            </PopoverTrigger>
            
            <PopoverContent class="w-80 bg-zinc-900 border-zinc-800 text-zinc-100 p-0 shadow-lg mr-4" align="end">
              <div class="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
                <h4 class="font-semibold text-sm text-white">Notificaciones de Red</h4>
                <span class="text-xs text-zinc-500">Historial local</span>
              </div>
              
              <div class="max-h-72 overflow-y-auto p-2 space-y-2">
                <div v-if="notificaciones.alertas.length === 0" class="p-4 text-center text-sm text-zinc-500">
                  No hay sincronizaciones recientes.
                </div>
                
                <div 
                  v-for="(alerta, index) in notificaciones.alertas" 
                  :key="index"
                  class="rounded-md bg-zinc-950/50 p-3 text-sm text-zinc-300 border border-zinc-800/50 flex gap-3 items-start"
                >
                  <div class="mt-1 h-2 w-2 rounded-full bg-green-500 flex-shrink-0"></div>
                  <p class="leading-tight">{{ alerta }}</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <span class="text-xs border border-zinc-800 px-2 py-1 rounded-md bg-zinc-900 text-zinc-400">v1.0</span>
        </div>
      </header>

      <!-- Área de Vistas -->
      <div class="p-6 flex-1 overflow-auto">
        <RouterView /> 
      </div>
    </main>

  </div>
</template>

<style scoped>
.nav-item {
  @apply flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100;
}
.router-link-active {
  @apply bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:text-primary;
}
</style>