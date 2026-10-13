# ⚽ CopaApp - Sistema Integral de Gestión de Torneos Deportivos

> **Plataforma Web Full-Stack & PWA** para la administración federativa de torneos de fútbol amateur y semi-profesional, control de plantillas, asignación de arbitraje oficial y actas digitales de partidos en tiempo real y offline.

---

## 🏛️ Arquitectura del Sistema

El sistema implementa una arquitectura moderna de separación de responsabilidades:

┌─────────────────────────────────────────┐
                       │      Cliente SPA / PWA (Vue 3)          │
                       │  Composition API + Pinia + Shadcn UI    │
                       │     Modo Offline con LocalForage        │
                       └────────────────────┬────────────────────┘
                                            │ REST API (JSON / JWT)
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │      Backend API (.NET 8 C#)            │
                       │     Clean Architecture / DDD            │
                       │  Controllers ➔ Services ➔ Repositories  │
                       └────────────────────┬────────────────────┘
                                            │ Entity Framework Core
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │       Base de Datos Relacional          │
                       │ (Torneos, Equipos, Jugadores, Partidos) │
                       └─────────────────────────────────────────┘

### 1. Backend: .NET 8 Web API (Clean Architecture)
* **Domain Layer:** Entidades de negocio (`Torneo`, `Equipo`, `Jugador`, `Partido`, `Gol`, `Usuario`).
* **Application Layer:** Servicios modulares de negocio, validaciones preventivas y DTOs tipados.
* **Infrastructure Layer:** Entity Framework Core, Repositorios con patrón desacoplado y migraciones de esquema.
* **API Layer:** Controladores RESTful securizados con `[Authorize]` y tokens JWT Bearer.

### 2. Frontend: Vue 3 PWA (Single Page Application)
* **Framework:** Vue 3 con Single File Components (`.vue`) y sintaxis `<script setup lang="ts">`.
* **Diseño y Componentes:** Tailwind CSS con componentes modulares de **Shadcn-UI** (Dialogs, Selects, Toasts, Tables, Badges).
* **Gestión de Estado:** Stores reactivos con **Pinia** (`torneos`, `equipos`, `jugadores`, `usuarios`, `auth`).
* **Offline-First PWA:** Detección de conectividad en tiempo real (`window.onLine`), almacenamiento local en IndexedDB con `LocalForage` y cola de sincronización.

---

## 🛡️ Matriz de Control de Acceso (RBAC)

| Funcionalidad / Módulo | 👑 Administrador | ⚖️ Árbitro Oficial | ⚽ Jugador / Capitán |
| :--- | :---: | :---: | :---: |
| Crear y Editar Torneos | ✅ | ❌ | ❌ |
| Asignar Árbitro a Torneo | ✅ | ❌ | ❌ |
| Generar Fixtures (Liga / Llaves) | ✅ | ❌ | ❌ |
| Inscribir / Dar de Baja Clubes | ✅ | ❌ | ❌ |
| Aprobar / Suspender Usuarios y Clubes | ✅ | ❌ | ❌ |
| Directorio General de Jugadores | ✅ | ❌ | ❌ |
| Ver Torneos Asignados | Todos | Solo Asignados | Solo donde compite su club |
| Cargar Marcador y Acta de Partido | ✅ | ✅ | ❌ (Solo lectura) |
| Cerrar Acta (`Finalizado`) | ✅ | ✅ | ❌ |
| Plantilla Oficial de su Club | ❌ | ❌ | ✅ (Exclusiva) |
| Fundar Club / Invitar por Código | ❌ | ❌ | ✅ (Capitán) |

---

## ⚡ Formatos de Competición Soportados

1. **🏆 Formato Liga (Todos contra todos):**
   * Algoritmo Round-Robin para generación equitativa de localías y jornadas.
   * Vista de fixture estilo **Premier League** con carrusel por fechas (`< Fecha X >`).
   * Tabla general de posiciones calculada en tiempo real (PJ, PG, PE, PP, GF, GC, DG, Pts).
2. **⚔️ Formato Llaves (Eliminación directa):**
   * Algoritmo de Bracket simétrico (árbol binario de potencia de 2: 4, 8, 16, 32 equipos).
   * Cuadro interactivo estilo **Champions League** con escudos oficiales, resaltado del ganador y desempate por penales `(PEN)`.
   * Conexión automática del ganador hacia el partido de la siguiente ronda.

---

## 🚀 Puesta en Marcha en Entorno Local

### Prerrequisitos
* [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
* [Node.js 18+](https://nodejs.org/) y npm

### 1. Iniciar el Backend (.NET 8)
```bash
# Entrar a la carpeta de la API
cd TorneoFutbol.API

# Aplicar las migraciones a la base de datos
dotnet ef database update

# Ejecutar el servidor backend (Puerto 7101 / 5000)
dotnet run


### 2. Iniciar el Frontend (Vue 3)

# Entrar a la carpeta web
cd torneo-web

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev

##La aplicación estará disponible en http://localhost:5173.