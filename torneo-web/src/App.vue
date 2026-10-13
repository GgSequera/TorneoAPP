<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/auth' // <-- 1. Importamos tu store
import { Toaster } from '@/components/ui/toast'
import {procesarCola} from '@/lib/syncQueue'
//import DashboardLayout from '@/layouts/DashboardLayout.vue'

const authStore = useAuthStore() // <-- 2. Inicializamos el store

onMounted(async () => {
  try {
    // 1. Primero: Pedimos la cookie CSRF al arrancar la app
    await api.get('/api/v1/auth/csrf')
    
    // 2. Segundo: Preguntamos al backend si hay una sesión viva (para cuando presiones F5)
    //await authStore.verificarSesion()
    if (navigator.onLine) {
      await procesarCola()
    }
  } catch (error) {
    console.error('Error inicializando la aplicación:', error)
  }
})
</script>
<template>
    <RouterView />
    <Toaster />
</template>