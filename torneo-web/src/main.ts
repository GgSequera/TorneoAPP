import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nueva versión disponible de la PWA')
  },
  onOfflineReady() {
    console.log('Aplicación lista para funcionar Offline')
  },
})

const iniciarApp = () => {
  const app = createApp(App)

  // 1. Instalamos Pinia
  app.use(createPinia())

  // 2. Encendemos el Router
  app.use(router)
  
  // 3. Dibujamos la app (App.vue se encargará de verificar la sesión en su onMounted)
  app.mount('#app')
}

iniciarApp()