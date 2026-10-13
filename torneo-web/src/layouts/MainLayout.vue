<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const salir = async () => {
  await authStore.cerrarSesion()
  router.push('/login')
}
</script>

<template>
  <div class="layout-container">
    <!-- BARRA DE NAVEGACIÓN (Se verá en todas las pantallas protegidas) -->
    <header class="navbar">
      <div class="logo">
        ⚽ TorneoApp
      </div>
      <nav class="nav-links">
        <!-- Usamos RouterLink para navegar sin recargar la página -->
        <RouterLink to="/dashboard" class="link">Dashboard</RouterLink>
        <RouterLink to="/torneos" class="link">Torneos</RouterLink>
        <RouterLink to="/equipos" class="link">Equipos</RouterLink>
        <RouterLink to="/usuarios" class="link">Gestión de Usuarios</RouterLink>
      </nav>
      <div class="user-actions">
        <button @click="salir" class="btn-logout">Cerrar Sesión</button>
      </div>
    </header>

    <!-- AQUÍ SE DIBUJARÁN LAS PANTALLAS (Dashboard, Torneos, etc.) -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* Estilos básicos para que el menú luzca bien */
.layout-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1a1a1a; /* Color oscuro tipo dashboard */
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.link {
  color: #ccc;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.link:hover, .router-link-active {
  color: #42b883; /* Verde característico de Vue */
}

.btn-logout {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-logout:hover {
  background-color: #c82333;
}

.main-content {
  flex: 1;
  padding: 2rem;
  background-color: #f8f9fa; /* Fondo clarito para el contenido */
  color: #333;
}
</style>