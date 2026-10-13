<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEquipoStore, type Equipo } from '@/stores/equipos'
import { useTorneoStore } from '@/stores/torneos'
import { useUsuarioStore, type Usuario } from '@/stores/usuarios'
import { useToast } from '@/components/ui/toast/use-toast'
import { api } from '@/lib/axios'

const router = useRouter()
const authStore = useAuthStore()
const equiposStore = useEquipoStore()
const torneoStore = useTorneoStore()
const usuariosStore = useUsuarioStore()
const { toast } = useToast()

const cargando = ref(true)
const cargandoAccion = ref(false)

// Estados dinámicos para Árbitro y Jugador
const estadoTorneosArbitro = ref<Record<number, { pendientes: number; total: number }>>({})
const torneosDelEquipoJugador = ref<any[]>([])
const misEstadisticas = ref({
  goles: 0,
  partidos: 0,
  dorsal: 10
})

// Modos para Jugador sin equipo
const modoRegistroJugador = ref<'ninguno' | 'crear' | 'unirse'>('ninguno')
const formCapitan = ref({
  nombreEquipo: '',
  nombreJugador: '',
  dorsal: 10,
  posicion: 'Delantero'
})
const formUnirse = ref({
  codigoInvitacion: '',
  nombreJugador: '',
  dorsal: 7,
  posicion: 'Centrocampista'
})

// Detección de Roles
const rolUsuario = computed(() => authStore.usuario?.rol?.toLowerCase() || '')
const esAdmin = computed(() => rolUsuario.value === 'administrador' || rolUsuario.value === 'admin')
const esArbitro = computed(() => rolUsuario.value === 'arbitro')
const esJugador = computed(() => rolUsuario.value === 'jugador')

// 👑 ADMIN: Equipos Pendientes
const todosEquiposPendientes = computed(() => 
  equiposStore.equipos.filter(e => e.estado === 'Pendiente')
)
const ultimosCincoEquiposPendientes = computed(() => 
  todosEquiposPendientes.value.slice(0, 5)
)

// 👑 ADMIN: Jugadores / Usuarios Pendientes
const todosJugadoresPendientes = computed(() => 
  usuariosStore.usuarios.filter(u => u.estado === 'Pendiente' || u.estado === 'Suspendido')
)
const ultimosCincoJugadoresPendientes = computed(() => 
  todosJugadoresPendientes.value.slice(0, 5)
)

// Carga Inicial
onMounted(async () => {
  cargando.value = true
  try {
    const tareas: Promise<any>[] = [
      torneoStore.obtenerTorneos(),
      equiposStore.obtenerEquipos()
    ]

    if (esAdmin.value) {
      tareas.push(usuariosStore.obtenerUsuarios())
    }

    await Promise.all(tareas)

    // ==============================================================
    // ⚽ LÓGICA DINÁMICA DE JUGADOR (TORNEO REAL Y GOLES REALES)
    // ==============================================================
    if (esJugador.value && authStore.usuario?.id) {
      await equiposStore.verificarPerfilJugador(authStore.usuario.id)
      
      if (equiposStore.miPerfil?.tieneEquipo) {
        // 1. Identificamos el equipo del jugador
        const miClub = (equiposStore.equipos || []).find(
          (e: any) => e.nombre === equiposStore.miPerfil.equipo
        )
        const miClubId = miClub?.id

        // 2. Buscamos la ficha del jugador para obtener su ID y dorsal
        let miJugadorId: number | null = null
        try {
          const respJugadores = await api.get('/api/v1/jugadores')
          const todosLosJugadores = respJugadores.data || []
          const miFicha = todosLosJugadores.find((j: any) => 
            (miClubId && j.equipoId === miClubId) &&
            (j.nombreCompleto?.toLowerCase() === authStore.usuario?.nombre?.toLowerCase() || j.usuarioId === authStore.usuario?.id)
          )
          if (miFicha) {
            miJugadorId = miFicha.id
            misEstadisticas.value.dorsal = miFicha.dorsal || 10
          }
        } catch (e) {
          console.error("Error al buscar ficha de jugador:", e)
        }

        // 3. Revisamos en qué torneos está REALMENTE inscrito su club
        const torneosDondeParticipa: any[] = []
        let totalGoles = 0
        let totalPartidosJugados = 0

        for (const t of torneoStore.torneos) {
          try {
            // Verificamos equipos inscritos de este torneo
            const respEquipos = await api.get(`/api/v1/torneos/${t.id}/equipos`)
            const inscritos = respEquipos.data || []
            const estaInscrito = inscritos.some((e: any) => e.id === miClubId || e.nombre === equiposStore.miPerfil.equipo)

            if (estaInscrito) {
              torneosDondeParticipa.push(t)

              // 4. Calculamos sus goles reales en este torneo
              try {
                await torneoStore.obtenerTopGoleadores(t.id)
                if (torneoStore.topGoleadores) {
                  const misGoles = torneoStore.topGoleadores.find((g: any) => 
                    g.jugadorId === miJugadorId || 
                    g.nombreCompleto?.toLowerCase() === authStore.usuario?.nombre?.toLowerCase()
                  )
                  if (misGoles) {
                    totalGoles += misGoles.goles || 0
                  }
                }

                // 5. Calculamos partidos que ha disputado su club en este torneo
                const fixture = await torneoStore.obtenerFixture(t.id)
                if (fixture && Array.isArray(fixture)) {
                  fixture.forEach((jornada: any) => {
                    if (jornada.partidos) {
                      jornada.partidos.forEach((p: any) => {
                        const clubJugo = (p.equipoLocalId === miClubId || p.equipoVisitanteId === miClubId)
                        const partidoTerminado = (p.golesLocal !== null && p.golesVisitante !== null)
                        if (clubJugo && partidoTerminado) {
                          totalPartidosJugados++
                        }
                      })
                    }
                  })
                }
              } catch (e) {
                console.error(`Error al calcular goles del torneo ${t.id}:`, e)
              }
            }
          } catch (e) {
            console.error(`Error al verificar inscripción en torneo ${t.id}:`, e)
          }
        }

        torneosDelEquipoJugador.value = torneosDondeParticipa
        misEstadisticas.value.goles = totalGoles
        misEstadisticas.value.partidos = totalPartidosJugados
      }
    }

    // ==============================================================
    // ⚖️ LÓGICA DE ÁRBITRO
    // ==============================================================
    if (esArbitro.value) {
      for (const t of torneoStore.torneos) {
        try {
          const fixture = await torneoStore.obtenerFixture(t.id)
          let partidosSinResultado = 0
          let totalPartidos = 0

          if (fixture && Array.isArray(fixture)) {
            fixture.forEach(j => {
              if (j.partidos) {
                totalPartidos += j.partidos.length
                partidosSinResultado += j.partidos.filter((p: any) => p.golesLocal === null || p.golesVisitante === null).length
              }
            })
          }
          estadoTorneosArbitro.value[t.id] = { pendientes: partidosSinResultado, total: totalPartidos }
        } catch {
          estadoTorneosArbitro.value[t.id] = { pendientes: 0, total: 0 }
        }
      }
    }
  } catch (error) {
    console.error('Error al inicializar dashboard:', error)
  } finally {
    cargando.value = false
  }
})

// Acciones Rápidas del Administrador
const aprobarEquipo = async (equipo: Equipo) => {
  cargandoAccion.value = true
  const exito = await equiposStore.cambiarEstadoEquipo(equipo.id, 'Aprobado')
  cargandoAccion.value = false
  if (exito) {
    toast({ title: '¡Equipo Aprobado!', description: `"${equipo.nombre}" ya puede competir.` })
  }
}

const rechazarEquipo = async (equipo: Equipo) => {
  if (!confirm(`¿Rechazar a "${equipo.nombre}"?`)) return
  cargandoAccion.value = true
  const exito = await equiposStore.cambiarEstadoEquipo(equipo.id, 'Rechazado')
  cargandoAccion.value = false
  if (exito) {
    toast({ title: 'Solicitud rechazada', description: `"${equipo.nombre}" fue rechazado.`, variant: 'destructive' })
  }
}

const habilitarUsuario = async (usuario: Usuario) => {
  cargandoAccion.value = true
  const exito = await usuariosStore.cambiarEstadoUsuario(usuario.id, 'Aprobado')
  cargandoAccion.value = false
  if (exito) {
    toast({ title: '¡Usuario Aprobado!', description: `"${usuario.nombre}" fue habilitado en la liga.` })
  }
}

const rechazarUsuario = async (usuario: Usuario) => {
  if (!confirm(`¿Suspender acceso a "${usuario.nombre}"?`)) return
  cargandoAccion.value = true
  const exito = await usuariosStore.cambiarEstadoUsuario(usuario.id, 'Suspendido')
  cargandoAccion.value = false
  if (exito) {
    toast({ title: 'Usuario Suspendido', description: `La cuenta de "${usuario.nombre}" fue suspendida.`, variant: 'destructive' })
  }
}

// Acciones para Jugador
const registrarComoCapitan = async () => {
  if (!formCapitan.value.nombreEquipo.trim() || !formCapitan.value.nombreJugador.trim()) {
    return toast({ title: 'Atención', description: 'Por favor completa todos los campos.', variant: 'destructive' })
  }
  cargandoAccion.value = true
  const exito = await equiposStore.crearComoCapitan(formCapitan.value, authStore.usuario.id)
  cargandoAccion.value = false
  if (exito) {
    toast({ title: '¡Club Fundado!', description: 'Tu solicitud fue enviada al administrador.' })
    modoRegistroJugador.value = 'ninguno'
    await equiposStore.verificarPerfilJugador(authStore.usuario.id)
  }
}

const unirseAEquipo = async () => {
  if (!formUnirse.value.codigoInvitacion.trim() || !formUnirse.value.nombreJugador.trim()) {
    return toast({ title: 'Atención', description: 'Ingresa el código y tu nombre.', variant: 'destructive' })
  }
  cargandoAccion.value = true
  const resultado = await equiposStore.unirsePorCodigo({
    ...formUnirse.value,
    codigoInvitacion: formUnirse.value.codigoInvitacion.toUpperCase()
  }, authStore.usuario.id)
  cargandoAccion.value = false

  if (resultado.exito) {
    toast({ title: '¡Fichaje Completado!', description: `Te has unido a ${resultado.equipoNombre}.` })
    modoRegistroJugador.value = 'ninguno'
    await equiposStore.verificarPerfilJugador(authStore.usuario.id)
  } else {
    toast({ title: 'No se pudo unir', description: resultado.mensaje || 'Código no válido.', variant: 'destructive' })
  }
}

const copiarCodigo = (codigo: string) => {
  navigator.clipboard.writeText(codigo)
  toast({ title: 'Copiado', description: `Código copiado: ${codigo}` })
}

const compartirWhatsApp = (codigo: string, equipo: string) => {
  const mensaje = encodeURIComponent(`¡Únete a nuestro club "${equipo}"! Ingresa a la plataforma y usa este código de invitación: ${codigo}`)
  window.open(`https://api.whatsapp.com/send?text=${mensaje}`, '_blank')
}
</script>

<template>
  <div class="space-y-8">
    <!-- BANNER HERO DE TEMPORADA -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl border border-emerald-500/20">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="space-y-2">
          <div class="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            Temporada Oficial 2026
          </div>
          <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Hola, {{ authStore.usuario?.nombre || 'Deportista' }} 👋
          </h1>
          <p class="text-sm text-slate-300 max-w-xl">
            Panel táctico oficial para la gestión, seguimiento de partidos y estadísticas del torneo.
          </p>
        </div>

        <div class="bg-black/30 backdrop-blur-md rounded-xl p-3 border border-white/10 text-right">
          <span class="block text-[10px] uppercase font-bold text-slate-400">Rol en Sesión</span>
          <span class="text-sm font-black text-emerald-400 uppercase tracking-wider">{{ authStore.usuario?.rol || 'Invitado' }}</span>
        </div>
      </div>
    </div>

    <!-- Indicador de Carga -->
    <div v-if="cargando" class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="mt-4 text-sm font-medium text-muted-foreground">Sincronizando competiciones...</span>
    </div>

    <div v-else class="space-y-8">
      <!-- ============================================================== -->
      <!-- 👑 PANEL 1: ADMINISTRADOR                                      -->
      <!-- ============================================================== -->
      <div v-if="esAdmin" class="space-y-8">
        <!-- KPIS PRINCIPALES -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <span class="text-xs font-bold text-muted-foreground uppercase">Torneos</span>
            <div class="text-3xl font-black text-foreground mt-1">{{ torneoStore.torneos.length }}</div>
            <button @click="router.push('/torneos')" class="text-xs font-bold text-emerald-600 hover:underline mt-2 block">Ver torneos &rarr;</button>
          </div>
          <div class="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <span class="text-xs font-bold text-muted-foreground uppercase">Clubes Activos</span>
            <div class="text-3xl font-black text-foreground mt-1">{{ equiposStore.equipos.filter(e => e.estado === 'Aprobado').length }}</div>
            <button @click="router.push('/equipos')" class="text-xs font-bold text-emerald-600 hover:underline mt-2 block">Ver catálogo &rarr;</button>
          </div>
          <div class="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <span class="text-xs font-bold text-muted-foreground uppercase">Equipos Pendientes</span>
            <div class="text-3xl font-black text-amber-600 mt-1">{{ todosEquiposPendientes.length }}</div>
            <span class="text-xs text-muted-foreground mt-2 block">Por autorizar</span>
          </div>
          <div class="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <span class="text-xs font-bold text-muted-foreground uppercase">Jugadores por Aprobar</span>
            <div class="text-3xl font-black text-blue-600 mt-1">{{ todosJugadoresPendientes.length }}</div>
            <button @click="router.push('/usuarios')" class="text-xs font-bold text-blue-600 hover:underline mt-2 block">Ver usuarios &rarr;</button>
          </div>
        </div>

        <!-- DOS BANDEJAS EN PARALELO: EQUIPOS Y JUGADORES PENDIENTES -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- LISTA 1: ÚLTIMOS 5 EQUIPOS PENDIENTES -->
          <div class="rounded-2xl border border-amber-500/30 bg-card p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xl">🛡️</span>
                <h3 class="font-bold text-foreground text-base">Equipos en Espera (Últimos 5)</h3>
              </div>
              <button @click="router.push('/equipos')" class="text-xs font-bold text-amber-600 hover:underline">
                Ver todos ({{ todosEquiposPendientes.length }}) &rarr;
              </button>
            </div>

            <div v-if="ultimosCincoEquiposPendientes.length === 0" class="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              ✓ No hay solicitudes de equipos pendientes.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="equipo in ultimosCincoEquiposPendientes"
                :key="equipo.id"
                class="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-background flex items-center justify-center border font-bold text-xs">⚽</div>
                  <div>
                    <h4 class="font-bold text-xs text-foreground">{{ equipo.nombre }}</h4>
                    <span class="text-[10px] text-muted-foreground font-mono">Código: {{ equipo.codigoInvitacion }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button @click="aprobarEquipo(equipo)" :disabled="cargandoAccion" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold shadow-sm">
                    ✓ Aprobar
                  </button>
                  <button @click="rechazarEquipo(equipo)" :disabled="cargandoAccion" class="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white text-xs px-2 py-1.5 rounded-lg font-bold">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- LISTA 2: ÚLTIMOS 5 JUGADORES/USUARIOS PENDIENTES -->
          <div class="rounded-2xl border border-blue-500/30 bg-card p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xl">🏃</span>
                <h3 class="font-bold text-foreground text-base">Jugadores por Habilitar (Últimos 5)</h3>
              </div>
              <button @click="router.push('/usuarios')" class="text-xs font-bold text-blue-600 hover:underline">
                Ver todos ({{ todosJugadoresPendientes.length }}) &rarr;
              </button>
            </div>

            <div v-if="ultimosCincoJugadoresPendientes.length === 0" class="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              ✓ No hay jugadores esperando aprobación.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="user in ultimosCincoJugadoresPendientes"
                :key="user.id"
                class="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                    {{ user.nombre.slice(0, 2) }}
                  </div>
                  <div>
                    <h4 class="font-bold text-xs text-foreground">{{ user.nombre }}</h4>
                    <span class="text-[10px] text-muted-foreground">{{ user.correo }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button @click="habilitarUsuario(user)" :disabled="cargandoAccion" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold shadow-sm">
                    ✓ Habilitar
                  </button>
                  <button @click="rechazarUsuario(user)" :disabled="cargandoAccion" class="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white text-xs px-2 py-1.5 rounded-lg font-bold">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ⚽ PANEL 2: JUGADOR                                            -->
      <!-- ============================================================== -->
      <div v-else-if="esJugador" class="space-y-6">
        <!-- 2A. SI EL JUGADOR TIENE EQUIPO -->
        <div v-if="equiposStore.miPerfil?.tieneEquipo" class="space-y-6">
          <!-- FICHA PRO TIPO EA SPORTS -->
          <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 p-6 sm:p-8 text-white shadow-2xl">
            <div class="absolute -right-6 -bottom-10 text-[180px] font-black text-white/5 select-none pointer-events-none font-mono">
              {{ misEstadisticas.dorsal }}
            </div>

            <div class="relative z-10 space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <span class="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">Ficha Oficial del Club</span>
                  <h2 class="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">{{ equiposStore.miPerfil.equipo }}</h2>
                </div>

                <div class="flex items-center gap-3">
                  <span
                    v-if="equiposStore.miPerfil.esCapitan"
                    class="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg"
                  >
                    ★ Capitán de Escuadra
                  </span>
                  <span v-else class="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white">
                    Jugador Oficial
                  </span>
                </div>
              </div>

              <!-- CÓDIGO DE CONVOCATORIA (COMPARTIR POR WHATSAPP) -->
              <div
                v-if="equiposStore.miPerfil.esCapitan && equiposStore.miPerfil.codigoInvitacion"
                class="rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <span>🎟️</span> Código de Convocatoria para tu Plantilla
                  </h3>
                  <p class="text-xs text-slate-300 mt-0.5">Comparte con tus compañeros para que se sumen al equipo.</p>
                </div>

                <div class="flex items-center gap-2">
                  <span class="font-mono text-2xl font-black tracking-widest text-emerald-400 bg-black/60 px-4 py-2 rounded-xl border border-emerald-500/40">
                    {{ equiposStore.miPerfil.codigoInvitacion }}
                  </span>
                  <button @click="copiarCodigo(equiposStore.miPerfil.codigoInvitacion)" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10">
                    Copiar
                  </button>
                  <button @click="compartirWhatsApp(equiposStore.miPerfil.codigoInvitacion, equiposStore.miPerfil.equipo || '')" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md">
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ESTADÍSTICAS DEL JUGADOR + TORNEO ACTIVO -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- TARJETA: ESTADÍSTICAS INDIVIDUALES REALES -->
            <div class="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-base text-foreground flex items-center gap-2">
                  <span>📊</span> Mis Estadísticas de Temporada
                </h3>
                <span class="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-full">Dorsal #{{ misEstadisticas.dorsal }}</span>
              </div>

              <div class="grid grid-cols-2 gap-4 pt-2">
                <div class="bg-muted/40 rounded-xl p-4 text-center border border-border">
                  <span class="text-3xl">⚽</span>
                  <div class="text-3xl font-black text-emerald-600 mt-1">{{ misEstadisticas.goles }}</div>
                  <span class="text-xs text-muted-foreground font-semibold uppercase">Goles Anotados</span>
                </div>
                <div class="bg-muted/40 rounded-xl p-4 text-center border border-border">
                  <span class="text-3xl">👟</span>
                  <div class="text-3xl font-black text-foreground mt-1">{{ misEstadisticas.partidos }}</div>
                  <span class="text-xs text-muted-foreground font-semibold uppercase">Partidos Jugados</span>
                </div>
              </div>
            </div>

            <!-- TARJETA: TORNEO REAL EN EL QUE COMPITE -->
            <div class="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-base text-foreground flex items-center gap-2">
                  <span>🏆</span> Torneo en Competencia
                </h3>
                <span v-if="torneosDelEquipoJugador.length > 0" class="text-xs font-bold text-emerald-600">En Curso</span>
              </div>

              <!-- SI SU EQUIPO ESTÁ INSCRITO EN UN TORNEO REAL -->
              <div v-if="torneosDelEquipoJugador.length > 0" class="space-y-3 pt-2">
                <div
                  v-for="torneo in torneosDelEquipoJugador.slice(0, 1)"
                  :key="torneo.id"
                  class="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-3"
                >
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="font-bold text-sm text-foreground">{{ torneo.nombre }}</h4>
                      <p class="text-xs text-muted-foreground">Formato: {{ torneo.formato }}</p>
                    </div>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Inscrito
                    </span>
                  </div>
                  <button
                    @click="router.push(`/torneos/${torneo.id}`)"
                    class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition"
                  >
                    Ver Tabla y Próximo Partido &rarr;
                  </button>
                </div>
              </div>

              <!-- SI SU EQUIPO AÚN NO HA SIDO INSCRITO POR EL ADMIN -->
              <div v-else class="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-xl space-y-2">
                <span class="text-2xl block">⏳</span>
                <p class="font-semibold text-foreground">Tu club aún no ha sido inscrito en un torneo oficial.</p>
                <p>El administrador de la liga debe inscribir a tu club para que aparezcas en el fixture.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 2B. SI NO TIENE EQUIPO (ONBOARDING) -->
        <div v-else class="space-y-6">
          <div class="text-center space-y-2 max-w-lg mx-auto">
            <h2 class="text-2xl font-black text-foreground">Elige tu destino futbolístico</h2>
            <p class="text-xs text-muted-foreground">Para jugar necesitas estar en un equipo. Puedes fundar tu propio club como Capitán o unirte a uno existente con un código.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div
              @click="modoRegistroJugador = 'crear'"
              :class="['cursor-pointer rounded-3xl border p-6 text-center space-y-4 transition', modoRegistroJugador === 'crear' ? 'border-emerald-500 bg-emerald-500/5' : 'bg-card border-border hover:border-emerald-500/40']"
            >
              <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-3xl mx-auto">👑</div>
              <h3 class="font-black text-lg text-foreground">Fundar mi propio Club</h3>
              <p class="text-xs text-muted-foreground">Sé el Capitán de tu escuadra e invita a tus amigos con un código.</p>
              <span class="inline-block text-xs font-bold text-emerald-600">Fundar como Capitán &rarr;</span>
            </div>

            <div
              @click="modoRegistroJugador = 'unirse'"
              :class="['cursor-pointer rounded-3xl border p-6 text-center space-y-4 transition', modoRegistroJugador === 'unirse' ? 'border-blue-500 bg-blue-500/5' : 'bg-card border-border hover:border-blue-500/40']"
            >
              <div class="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-3xl mx-auto">⚡</div>
              <h3 class="font-black text-lg text-foreground">Fichar por un Equipo</h3>
              <p class="text-xs text-muted-foreground">Ingresa el código de 6 caracteres que te dio tu capitán para incorporarte.</p>
              <span class="inline-block text-xs font-bold text-blue-600">Ingresar código &rarr;</span>
            </div>
          </div>

          <div v-if="modoRegistroJugador === 'crear'" class="rounded-2xl border border-border bg-card p-6 shadow-lg max-w-lg mx-auto space-y-4">
            <h3 class="font-bold text-base text-foreground">Fundar Club (Capitán)</h3>
            <div class="space-y-3 text-xs">
              <input v-model="formCapitan.nombreEquipo" type="text" placeholder="Nombre del Equipo" class="w-full rounded-lg border p-2.5 bg-background" />
              <input v-model="formCapitan.nombreJugador" type="text" placeholder="Tu Nombre Completo" class="w-full rounded-lg border p-2.5 bg-background" />
              <div class="grid grid-cols-2 gap-3">
                <input v-model.number="formCapitan.dorsal" type="number" min="1" max="99" placeholder="Dorsal" class="w-full rounded-lg border p-2.5 bg-background" />
                <select v-model="formCapitan.posicion" class="w-full rounded-lg border p-2.5 bg-background">
                  <option>Portero</option><option>Defensa</option><option>Centrocampista</option><option>Delantero</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t">
              <button @click="modoRegistroJugador = 'ninguno'" class="text-xs px-3 py-2 text-muted-foreground">Cancelar</button>
              <button @click="registrarComoCapitan" :disabled="cargandoAccion" class="text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Crear Equipo</button>
            </div>
          </div>

          <div v-if="modoRegistroJugador === 'unirse'" class="rounded-2xl border border-border bg-card p-6 shadow-lg max-w-lg mx-auto space-y-4">
            <h3 class="font-bold text-base text-foreground">Unirse por Código</h3>
            <div class="space-y-3 text-xs">
              <input v-model="formUnirse.codigoInvitacion" maxlength="6" type="text" placeholder="Código (ej. B9E468)" class="w-full rounded-lg border p-2.5 bg-background uppercase font-mono tracking-widest text-center font-bold" />
              <input v-model="formUnirse.nombreJugador" type="text" placeholder="Tu Nombre de Jugador" class="w-full rounded-lg border p-2.5 bg-background" />
              <div class="grid grid-cols-2 gap-3">
                <input v-model.number="formUnirse.dorsal" type="number" min="1" max="99" placeholder="Dorsal" class="w-full rounded-lg border p-2.5 bg-background" />
                <select v-model="formUnirse.posicion" class="w-full rounded-lg border p-2.5 bg-background">
                  <option>Portero</option><option>Defensa</option><option>Centrocampista</option><option>Delantero</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t">
              <button @click="modoRegistroJugador = 'ninguno'" class="text-xs px-3 py-2 text-muted-foreground">Cancelar</button>
              <button @click="unirseAEquipo" :disabled="cargandoAccion" class="text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Unirse</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- ⚖️ PANEL 3: ÁRBITRO                                            -->
      <!-- ============================================================== -->
      <div v-else-if="esArbitro" class="space-y-6">
        <div class="rounded-2xl border border-border bg-card p-6 shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl font-bold">⏱️</div>
            <div>
              <h2 class="text-lg font-bold text-foreground">Panel Oficial de Arbitraje</h2>
              <p class="text-xs text-muted-foreground">Monitoreo de partidos y carga de actas arbitrales.</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="torneo in torneoStore.torneos"
            :key="torneo.id"
            class="rounded-2xl border border-border bg-card p-5 space-y-4 hover:shadow-lg transition"
          >
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-bold text-foreground text-base">{{ torneo.nombre }}</h4>
                <p class="text-xs text-muted-foreground">Formato: {{ torneo.formato }}</p>
              </div>

              <span
                v-if="estadoTorneosArbitro[torneo.id]?.pendientes > 0"
                class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-sm animate-pulse"
              >
                {{ estadoTorneosArbitro[torneo.id].pendientes }} por jugar
              </span>
              <span
                v-else-if="estadoTorneosArbitro[torneo.id]?.total > 0 && estadoTorneosArbitro[torneo.id]?.pendientes === 0"
                class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ✓ Jornadas al día
              </span>
              <span
                v-else
                class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
              >
                Sin fixture
              </span>
            </div>

            <button
              v-if="estadoTorneosArbitro[torneo.id]?.pendientes > 0"
              @click="router.push(`/torneos/${torneo.id}`)"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5"
            >
              <span>⚡</span> Cargar Marcadores Pendientes &rarr;
            </button>
            <button
              v-else
              @click="router.push(`/torneos/${torneo.id}`)"
              class="w-full bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-border"
            >
              Consultar Actas del Torneo &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>