# 🛒 Asistente de Compras (Mercat App)

Aplicación Web *Mobile-First* diseñada para llevar el control de tus compras en la tienda física o supermercado. Permite escanear códigos de barras, crear tu propio catálogo local de precios y llevar la suma total del carrito en tiempo real, todo sin necesidad de conexión externa o bases de datos complejas.

## ✨ Características Principales

*   **📷 Escáner de Cámara Inteligente**: Auto-arranca la cámara trasera al abrir la App sin pulsar nada. Controles integrados para **Detener/Iniciar**, **Cambiar cámara** (frontal ↔ trasera), **Escanear desde imagen** (galería) y **Linterna/Flash** (en Android). Pausa automática tras cada lectura para evitar duplicados.
*   **📲 Instalación Nativa (PWA)**: Descargable e instalable en la pantalla de inicio de dispositivos iOS/Android. Soporte 100% **Offline** (tu catálogo y la cámara seguirán funcionando en modo avión) y sistema *autoUpdate* silencioso.
*   **🥩 Escáner Avanzado de Frescos (GS1 Digital Link)**: Inteligencia inyectada para decodificar al vuelo URLs densas de códigos QR de supermercados (ej: etiquetas Mercadona). Extrae el GTIN puro, aísla el peso variable y sobreescribe dinámicamente tu importe exacto de caja.
*   **📷 Escáner de Tiquets Inteligente (Smart Scan)**: Sistema de recorte manual con `Cropper.js`. Encuadra tus tiquets físicos para que se vean limpios, rectos y sin fondos, simulando un escáner de documentos profesional.
*   **📈 Historial Visual & Análisis**: Guarda fotos de tus tiquets reales vinculadas a tus compras. Visualización premium con **Zoom Dinámico** (`panzoom`) y gestos táctiles para no perderte ni un detalle del tiquet original.
*   **📖 Centro de Ayuda Integrado**: Manual de usuario interactivo accesible desde la propia App. Guías visuales sobre escaneo, gestión de frescos, presupuestos y copias de seguridad para una curva de aprendizaje cero.
*   **💾 Almacenamiento Híbrido Avanzado**: Uso de `LocalStorage` para el catálogo rápido e **`IndexedDB`** para gestionar datos pesados (imágenes base64 comprimidas), garantizando que tu App nunca se ralentice.
*   **📝 Bloc de Notas con Dictado por Voz**: Crea tu lista de compra antes de salir de casa o sobre la marcha. Incluye un motor de **Reconocimiento de Voz** que entiende frases naturales. Di una palabra de activación (*añade, agrega, pon, necesito, compra, apunta…*) seguida de tus productos separados por **"y"** (ej: *"Añade pan y huevos y leche"*). Separa automáticamente los artículos y confirma la acción mediante **Síntesis de Voz**.
*   **🛒 Carrito Inteligente LIFO**: El último producto escaneado aparece siempre arriba del todo. Olvídate de hacer scroll para verificar el precio de lo que acabas de meter en la cesta.
*   **🚨 Cúpula de Presupuesto**: Márcate un tope de gasto al entrar al súper. La contabilidad pulsará en un rojo agresivo cuando traspases la barrera para proteger tus ahorros.
*   **🔎 Búsqueda Instantánea**: Busca en milisegundos entre tus productos guardados por código o nombre gracias al buscador dinámico *en vivo*.
*   **💻 Sincronización Bloc-Escáner**: El autocompletado localizará tus productos del Catálogo en tu lista de notas, ¡y según vayas pasándolos por la cámara se **tacharán automáticamente**!
*   **📱 Diseño 100% Mobile**: Botones grandes, footer congelado siempre visible, animaciones Bootstrap Native e interfaz limpia similar a una App Nativa. Incluye **bloqueo de orientación vertical (Portrait Lock)** para evitar rotaciones accidentales mientras escaneas en el supermercado.
*   **🤳 Captura Flexible**: ¿Se te olvidó hacer la foto al pagar? No hay problema. Puedes adjuntar la imagen de tu tiquet más tarde directamente desde el historial de gastos.
*   **🎨 Alertas Animadas Premium**: Integración de notificaciones sutiles con SweetAlert2.
*   **✏️ Gestión CRUD Total**: Edita nombres, altera precios si han subido/bajado o borra elementos del catálogo con un clic.
*   **📦 Backups Transparentes**: Sistema de Exportación e Importación inteligente. Descarga todo tu catálogo en formato abierto (`JSON`) y compártelo o fusiónalo con listas de otros familiares sin necesitar de bases de datos de terceros.

## 🛠 Tecnologías Utilizadas

*   **[Vite](https://vitejs.dev/)** - Entorno de desarrollo para modernizar el flujo de trabajo JS con *Hot-Reload*.
*   **Vanilla JS (ES6+)** - Sin pesados frameworks. Diseño funcional y modular usando ESModules.
*   **[Bootstrap 5](https://getbootstrap.com/)** - Instalado nativamente e importado vía Node para garantizar rendimiento incluso sin internet. Icons y modales incluidos.
*   **[html5-qrcode](https://github.com/mebjas/html5-qrcode)** - Librería para el escáner de códigos usando la cámara del dispositivo móvil.
*   **[SweetAlert2](https://sweetalert2.github.io/)** - Alertas y cuadros de diálogo animados premium.
*   **[Cropper.js](https://fengyuanchen.github.io/cropperjs/)** - Motor de recorte y encuadre de tiquets para el sistema de escaneado.
*   **[Panzoom](https://github.com/anvaka/panzoom)** - Librería de control de gestos para habilitar zoom y paneo en fotos de tiquets.
*   **IndexedDB** - Motor de base de datos asíncrona en el navegador para almacenamiento ilimitado de imágenes locales.
*   **vite-plugin-pwa** - Inyección de Service Workers y Manifiestos para habilitar las características nativas y offline.

## 🚀 Instalación y Despliegue Local

1.  **Clona o descarga este repositorio.**
2.  Abre la terminal en la carpeta principal del proyecto y asegúrate de tener [Node.js](https://nodejs.org/es/) instalado.
3.  Instala las dependencias necesarias:
    ```bash
    npm install
    ```
4.  Inicia el servidor local:
    ```bash
    npm run dev
    ```

### ⚠️ Pruebas con Teléfono Móvil (HTTPS Obligatorio)

Los navegadores móviles más modernos como Safari (iOS) o Chrome (Android) **restringen radicalmente** el uso de la cámara por temas de seguridad, exigen protocolo de seguridad segura. 

Para poder probar esta aplicación desde tu teléfono compartiendo la red del ordenador, esta aplicación viene configurada con el plugin `@vitejs/plugin-basic-ssl`.

Cuando levantes `npm run dev`, verás unas "URLs". Presta atención a la de *Network*.
Abrirás desde el móvil algo similar a: `https://192.168.1.XX:5173`. Tu navegador advertirá sobre los certificados SSL locales (es normal), haz clic en **"Continuar"** u **"Opciones Avanzadas -> Aceptar los riesgos"** para que te conceda permisos de cámara sin rechistar.

## 📂 Archivos y Estructura

*   `src/main.js`: Controlador Principal (Orquestador de arranque). Une la intefaz con la librería del escáner centralizando los eventos globales.
*   `src/ui/*` (`cart.js`, `inventory.js`, `productModal.js`): Módulos de componentes visuales compartimentados. Facilitan el mantenimiento profundo dividiendo las lógicas HTML.
*   `src/storage.js`: Librería abstracta de persistencia. Funciones para crear, leer y actualizar el inventario y carrito frente a la base de datos `LocalStorage`.
*   `src/style.css`: Estilado de las tarjetas Bootstrap, corrección de inputs de números para móviles y rediseño de las cajas fuertes predeterminadas del lector QR.
*   `index.html`: La Interfaz del Usuario.
*   `vite.config.js`: La configuración SSL básica para exponer en red local.
