<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

const router = useRouter()
const authStore = useAuthStore()

const vistaActual = ref('login')
const cargando = ref(false)
const form = ref({
  nombre: '',
  correo: '',
  contrasena: '',
  rolId: '1' // Shadcn Select usa strings por defecto
})

const manejarSubmit = async () => {
  if (!form.value.correo || !form.value.contrasena) return
  if (vistaActual.value === 'registro' && !form.value.nombre) return

  cargando.value = true
  try {
    authStore.errorAutenticacion = null;
    if (vistaActual.value === 'registro') {
      // Mapeamos los campos a lo que exige tu backend: "Clave" y "Rol"
      const rolesTexto: Record<number, string> = {
        1: 'Jugador',
        2: 'Arbitro'
        //3: 'Administrador'
      }

      const payloadRegistro = {
        nombre: form.value.nombre,
        correo: form.value.correo,
        clave: form.value.contrasena, // 👈 C# espera 'Clave'
        rol: rolesTexto[form.value.rolId] || 'Espectador' // 👈 C# espera 'Rol' en texto
      }

      await authStore.registrarUsuario(payloadRegistro)
      vistaActual.value = 'login'
      form.value.contrasena = '' 
    } else {
      // Para el login si tu backend usa 'Clave' en vez de 'contrasena', ajustarlo también en el store
      await authStore.iniciarSesion(form.value.correo, form.value.contrasena)
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('Error durante la autenticación:', error)
    if (error.response?.data?.Mensaje) {
      authStore.errorAutenticacion = error.response.data.Mensaje;
    } else {
      // Mensaje de respaldo por si el servidor está totalmente caído
      authStore.errorAutenticacion = 'Ocurrió un error inesperado. Revisa tu conexión.'; 
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans selection:bg-[#0FE25C] selection:text-black relative overflow-hidden">
    
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#0FE25C]/20 blur-[100px] rounded-full pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

    <div class="w-full max-w-[400px] bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] shadow-2xl p-8 relative z-10">
      
      <div class="text-center mb-8">
        <div class="w-16 h-16 mx-auto bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center mb-4 shadow-inner">
          <svg class="w-8 h-8 text-[#0FE25C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 class="text-2xl font-black italic tracking-tighter text-white">
          TORNEO<span class="text-[#0FE25C]">PRO</span>
        </h1>
      </div>

      <div class="flex p-1 mb-8 bg-zinc-950 rounded-2xl relative">
        <button 
          @click="vistaActual = 'login'"
          class="relative z-10 flex-1 py-3 text-sm font-bold transition-colors duration-300 rounded-xl"
          :class="vistaActual === 'login' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'"
        >
          Entrar
        </button>
        <button 
          @click="vistaActual = 'registro'"
          class="relative z-10 flex-1 py-3 text-sm font-bold transition-colors duration-300 rounded-xl"
          :class="vistaActual === 'registro' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'"
        >
          Registro
        </button>
        <div 
          class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#0FE25C] rounded-xl shadow-md transition-transform duration-300 ease-out"
          :class="vistaActual === 'registro' ? 'translate-x-[calc(100%+0px)]' : 'translate-x-0'"
        ></div>
      </div>

      <div v-if="authStore.errorAutenticacion" class="mb-6 p-3 text-sm text-red-400 bg-red-950/30 rounded-xl border border-red-900/50 text-center">
        {{ authStore.errorAutenticacion }}
      </div>

      <div class="relative min-h-[200px]">
        <transition name="app-slide" mode="out-in">
          <div :key="vistaActual" class="space-y-4">
            
            <div v-if="vistaActual === 'registro'" class="space-y-1.5">
              <label class="text-xs font-bold text-zinc-500 uppercase ml-2">Nombre</label>
              <input v-model="form.nombre" type="text" class="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 h-14 text-white focus:outline-none focus:border-[#0FE25C]/50 focus:ring-1 focus:ring-[#0FE25C] transition-all" placeholder="Tu nombre" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-zinc-500 uppercase ml-2">Correo</label>
              <input v-model="form.correo" type="email" class="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 h-14 text-white focus:outline-none focus:border-[#0FE25C]/50 focus:ring-1 focus:ring-[#0FE25C] transition-all" placeholder="admin@torneo.com" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-zinc-500 uppercase ml-2">Contraseña</label>
              <input v-model="form.contrasena" type="password" @keyup.enter="manejarSubmit" class="w-full bg-zinc-950/50 border border-white/5 rounded-2xl px-5 h-14 text-white focus:outline-none focus:border-[#0FE25C]/50 focus:ring-1 focus:ring-[#0FE25C] transition-all" placeholder="••••••••" />
            </div>

            <div v-if="vistaActual === 'registro'" class="space-y-1.5">
              <label class="text-xs font-bold text-zinc-500 uppercase ml-2">Rol</label>
              <Select v-model="form.rolId">
                <SelectTrigger class="w-full h-14 bg-zinc-950/50 border border-white/5 rounded-2xl px-5 text-white focus:ring-1 focus:ring-[#0FE25C] focus:border-[#0FE25C]/50 data-[state=open]:ring-[#0FE25C]">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent class="bg-zinc-900 border-zinc-800 text-white rounded-xl shadow-2xl">
                  <SelectGroup>
                    <SelectItem value="1" class="focus:bg-[#0FE25C]/20 focus:text-[#0FE25C] rounded-lg cursor-pointer">Jugador</SelectItem>
                    <SelectItem value="2" class="focus:bg-[#0FE25C]/20 focus:text-[#0FE25C] rounded-lg cursor-pointer">Arbitro</SelectItem>
                    <!-- <SelectItem value="3" class="focus:bg-[#0FE25C]/20 focus:text-[#0FE25C] rounded-lg cursor-pointer">Administrador</SelectItem> -->
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

          </div>
        </transition>
      </div>

      <button 
        @click="manejarSubmit" 
        :disabled="cargando" 
        class="w-full mt-8 bg-[#0FE25C] hover:bg-[#0FE25C]/80 text-black font-black text-lg py-4 rounded-2xl shadow-[0_0_20px_rgba(15,226,92,0.2)] transition-all active:scale-95 disabled:opacity-50"
      >
        {{ cargando ? 'Cargando...' : (vistaActual === 'registro' ? 'Crear Cuenta' : 'Acceder') }}
      </button>

    </div>
  </div>
</template>

<style scoped>
.app-slide-enter-active,
.app-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.app-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.app-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>