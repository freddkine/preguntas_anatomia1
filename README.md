# ¿Cuánto sabes de anatomía?

Juego web de anatomía muscular con 40 preguntas disponibles y 20 preguntas por partida.

## Funciones

- Selecciona aleatoriamente una de dos preguntas por cada uno de los 20 grupos musculares.
- Mezcla el orden de las preguntas y de las alternativas.
- Cronómetro de 15 segundos por pregunta.
- Puntaje de 500 a 1.000 puntos por respuesta correcta según rapidez.
- Bloqueo de respuestas dobles y avance automático.
- Pantalla final con puntaje, respuestas correctas, precisión y tiempo promedio.
- Nueva partida con una combinación diferente.
- Sala local mediante código y sincronización entre pestañas del mismo navegador.
- Acceso docente para revisar y exportar el banco de preguntas. Clave inicial: `2026`.
- Diseño adaptable a computador, tableta y teléfono.

## Ejecutar localmente

Necesitas Node.js 18 o superior.

```bash
npm start
```

Abre `http://localhost:8000`.

## Probar la lógica

```bash
npm test
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todo el contenido de esta carpeta a la rama `main`.
3. En GitHub entra a **Settings → Pages**.
4. En **Build and deployment**, selecciona **GitHub Actions**.
5. El flujo incluido publicará automáticamente la carpeta `dist`.

No se requiere compilación ni instalar dependencias para GitHub Pages.

## Nota sobre el modo multijugador

La versión incluida funciona en tiempo real entre pestañas del mismo navegador mediante `BroadcastChannel` y `localStorage`. Esto permite demostrar y probar la sala sin servicios externos.

Para que jugadores ubicados en dispositivos o redes diferentes compartan una sala se necesita conectar un servicio en línea, por ejemplo Firebase, Supabase o un servidor WebSocket. El modo individual y todo el cuestionario funcionan completamente en GitHub Pages sin ese servicio.

## Estructura

```text
dist/assets/portada-anatomia.png  Portada original
dist/js/questions.js              Banco de 40 preguntas
dist/js/core.js                   Selección, mezcla y puntaje
dist/js/app.js                    Pantallas y funcionamiento del juego
tests/core.test.mjs               Pruebas automáticas
dist/index.html                   Entrada principal
dist/styles.css                   Diseño adaptable
```
