# Publicar la app en GitHub Pages e instalarla en el móvil (paso a paso)

Necesitas dos archivos, que están en la carpeta `publicar-github-pages/`: **`index.html`** (la aplicación entera) y **`sw.js`** (un ayudante pequeño para que funcione sin conexión). No hay que instalar nada en el ordenador.

## A. Crear la cuenta y publicar por primera vez (15 minutos)

1. Entra en `https://github.com` y pulsa **Sign up**. Usa un nombre de usuario sin datos personales (por ejemplo `cuaderno-familia`). Confirma el correo que te llega.
2. Arriba a la derecha pulsa el **+** y elige **New repository**.
3. En *Repository name* escribe `cuaderno`. Deja **Public** marcado. Marca *Add a README file*. Pulsa **Create repository**.
4. Dentro del repositorio pulsa **Add file → Upload files**. Arrastra `index.html` y `sw.js` a la zona de subida. Abajo pulsa **Commit changes**.
5. Pulsa la pestaña **Settings** (arriba a la derecha) y, en el menú de la izquierda, **Pages**.
6. En *Build and deployment → Source* elige **Deploy from a branch**. En *Branch* elige `main` y `/ (root)`. Pulsa **Save**.
7. Espera uno o dos minutos y recarga la página. Verás *Your site is live at* `https://TU-USUARIO.github.io/cuaderno/`. Esa es la dirección de la app. Guárdala.

Privacidad: el archivo publicado es visible para quien tenga la dirección, pero **no contiene ningún dato del niño**: los datos se guardan en el móvil de quien registra. Por eso en la app conviene usar solo iniciales y activar el PIN (Más → Datos y copias → Acceso con PIN).

## B. Instalar en el móvil

- **iPhone (Safari):** abre la dirección en Safari → botón Compartir (cuadrado con flecha) → **Añadir a pantalla de inicio** → Añadir. Ábrela siempre desde ese icono, no desde Safari, para que los datos queden siempre en el mismo sitio.
- **Android (Chrome):** abre la dirección → menú ⋮ → **Añadir a pantalla de inicio** o **Instalar aplicación**.
- **Ordenador:** abre la dirección en el navegador y guárdala en marcadores.

Cada aparato tiene su propio almacén. Se ponen al día entre sí con **Datos y copias → Exportar copia completa** en uno e **Importar y fusionar** en el otro (nunca se pierde nada: se unen los registros y, si uno existe en los dos, gana el más reciente).

## C. Publicar una versión nueva

1. Entra en `https://github.com/TU-USUARIO/cuaderno`.
2. **Add file → Upload files**, arrastra el nuevo `index.html` (y `sw.js` si ha cambiado) y pulsa **Commit changes**.
3. Espera uno o dos minutos. En el móvil cierra la app del todo y vuelve a abrirla (si no ves la versión nueva, abre la dirección en Safari/Chrome, recarga, y vuelve al icono). La versión se ve en Más → Datos y copias.

Los datos no se tocan al publicar una versión nueva. Aun así, exporta una copia antes de actualizar.

## D. Rutina de copias

- **Cada día o dos (quien registra):** Más → Datos y copias → **Exportar copia completa** → enviar por WhatsApp, correo o Drive.
- **Al recibirla:** abrir la app en el ordenador → Datos y copias → **Importar y fusionar** → elegir el archivo.
- **Semanal:** Datos y copias → **Exportar informe para IA** (última semana) → subirlo al proyecto de análisis de Claude.
- La pantalla de datos avisa en rojo si han pasado más de dos días sin exportar.
