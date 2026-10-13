import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/axios'

export interface CrearJugadorDto {
  equipoId: number;
  nombreCompleto: string;
  posicion: string;
  dorsal: number;
}

export interface Jugador {
  id: number;
  equipoId: number;
  nombreCompleto: string;
  posicion: string;
  dorsal: number;
  // Opcional: si tu backend devuelve el objeto Equipo anidado, puedes incluirlo aquí.
}

export const useJugadorStore = defineStore('jugador', () => {
  const jugadores = ref<Jugador[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // --- NUEVO: Obtener la lista de jugadores ---
  const obtenerJugadores = async () => {
    loading.value = true;
    try {
      const response = await api.get<Jugador[]>('/api/v1/jugadores');
      jugadores.value = response.data;
    } catch (err: any) {
      console.error("Error al cargar jugadores:", err);
    } finally {
      loading.value = false;
    }
  }

  const crearJugador = async (nuevoJugador: CrearJugadorDto): Promise<boolean> => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post<Jugador>('/api/v1/jugadores', nuevoJugador);
      jugadores.value.push(response.data);
      return true;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Error al crear el jugador';
      return false;
    } finally {
      loading.value = false;
    }
  }

  // --- NUEVO: Eliminar un jugador ---
  const eliminarJugador = async (id: number): Promise<boolean> => {
    if (!confirm('¿Estás seguro de que deseas eliminar este jugador?')) return false;
    
    try {
      await api.delete(`/api/v1/jugadores/${id}`);
      // Lo quitamos de la lista en memoria para que la tabla se actualice al instante
      jugadores.value = jugadores.value.filter(j => j.id !== id);
      return true;
    } catch (err) {
      console.error("Error al eliminar jugador:", err);
      return false;
    }
  }

  // Asegúrate de retornar obtenerJugadores al final
  return { 
    jugadores, 
    loading, 
    error, 
    crearJugador,
    obtenerJugadores,
    eliminarJugador // <-- NUEVO
  }
})