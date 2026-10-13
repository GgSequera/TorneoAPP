import { defineStore } from 'pinia'

export const useNotificacionesStore = defineStore('notificaciones', {
  state: () => ({
    alertas: [] as string[],
    noLeidas: 0
  }),
  actions: {
    agregarNotificacion(mensaje: string) {
      this.alertas.unshift(mensaje) // Lo pone de primero
      this.noLeidas++
    },
    marcarComoLeidas() {
      this.noLeidas = 0
    }
  }
})