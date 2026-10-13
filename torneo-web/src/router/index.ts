import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useAuthStore } from '@/stores/auth'
// @ts-ignore
import DashboardLayout from '@/layouts/DashboardLayout.vue' // <-- 1. Importamos el NUEVO layout
import TorneosView from '@/views/TorneosView.vue'
import EquiposView from '@/views/EquiposView.vue'
import JugadoresView from '@/views/JugadoresView.vue'
import UsuariosView from '@/views/UsuariosView.vue'
import TorneoDetalle from '@/views/TorneoDetalle.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { 
      path: '/login', 
      name: 'login', 
      component: LoginView 
    },
    {
      path: '/',
      component: DashboardLayout, // <-- 2. Usamos el layout oscuro para estas rutas
      meta: { requiresAuth: true },
      children: [
        { 
          path: '', 
          redirect: '/dashboard' // Si entran a la raíz, los manda al dashboard
        },
        { 
          path: 'dashboard', 
          name: 'dashboard', 
          component: DashboardView 
        },
        { 
          path: 'torneos', 
          name: 'torneos', 
          component: TorneosView 
        },
        { 
          path: 'equipos', // Sin la barra "/"
          name: 'equipos', 
          component: EquiposView 
        },
        {
          path: 'torneos/:id', // 3. Metimos el detalle aquí adentro
          name: 'torneo-detalle',
          component: TorneoDetalle
        },

        {
          path: 'jugador',
          name: 'jugador',
          // Usamos Lazy Loading (importación dinámica) para mejorar el rendimiento
          component: JugadoresView 
          // Si tienes validación de rutas para usuarios logueados, podrías agregar meta: { requiresAuth: true }
        },
        { 
          path: 'usuarios', 
          name: 'usuarios',
          component: UsuariosView,
          // meta: { requiresAuth: true } // Activa esto si usas guards para proteger rutas
        }
      ]
    }
  ]
})


// Guardián de rutas (Interceptor de navegación)
router.beforeEach(async (to, _from) => {
  const authStore = useAuthStore()
  
  // 1. Verificamos qué sabe Pinia en este momento
  let estaLogueado = authStore.estaAutenticado()

  // 2. Si Pinia no recuerda la sesión (ej. tras un F5), intentamos recuperarla usando la cookie
  if (!estaLogueado) {
    estaLogueado = await authStore.verificarSesion()
  }

  const requiereAutenticacion = to.meta.requiresAuth

  // 3. Ahora sí tomamos la decisión con la información real
  if (requiereAutenticacion && !estaLogueado) {
    return '/login'
  }
  
  if (to.path === '/login' && estaLogueado) {
    return '/dashboard'
  }
  
  return true
})

export default router