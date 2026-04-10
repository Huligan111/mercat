# 🛒 Asistente de Compras (Mercat App)

Aplicación Web *Mobile-First* diseñada para llevar el control de tus compras en la tienda física o supermercado. Permite escanear códigos de barras, crear tu propio catálogo local de precios y llevar la suma total del carrito en tiempo real, todo sin necesidad de conexión externa o bases de datos complejas.

## ✨ Características Principales

*   **📷 Escáner de Códigos de Barras Intencional**: Lector integrado súper rápido. Pausa automática al detectar productos para que no se vuelva loco leyendo el mismo producto.
*   **📲 Instalación Nativa (PWA)**: Descargable e instalable en la pantalla de inicio de dispositivos iOS/Android. Soporte 100% **Offline** (tu catálogo y la cámara seguirán funcionando en modo avión) y sistema *autoUpdate* silencioso.
*   **💾 Inventario Local-First**: Todo lo que escaneas se guarda de por vida en la memoria de tu móvil (LocalStorage) sin bases de datos ajenas.
*   **📝 Bloc de Notas Predictivo (Shopping List)**: Crea tu lista de compra antes de salir de casa. El autocompletado localizará tus productos del Catálogo, ¡y según vayas pasándolos por la cámara se **tacharán automáticamente** de la lista!
*   **🚨 Cúpula de Presupuesto**: Márcate un tope de gasto al entrar al súper. La contabilidad pulsará en un rojo agresivo cuando traspases la barrera para proteger tus ahorros.
*   **🔎 Búsqueda Instantánea**: Busca milisegundos entre tus productos guardados por código o nombre gracias al buscador dinámico *en vivo*.
*   **📱 Diseño 100% Mobile**: Botones grandes, footer congelado siempre visible, animaciones Bootstrap Native e interfaz limpia similar a una AppStore final.
*   **🎨 Alertas Animadas Premium**: Integración de notificaciones sutiles con SweetAlert2.
*   **✏️ Gestión CRUD Total**: Edita nombres, altera precios si han subido/bajado o borra elementos del catálogo con un clic.
*   **📦 Backups Transparentes**: Sistema de Exportación e Importación inteligente. Descarga todo tu catálogo en formato abierto (`JSON`) y compártelo o fusiónalo con listas de otros familiares sin necesitar de bases de datos de terceros.

## 🛠 Tecnologías Utilizadas

*   **[Vite](https://vitejs.dev/)** - Entorno de desarrollo para modernizar el flujo de trabajo JS con *Hot-Reload*.
*   **Vanilla JS (ES6+)** - Sin pesados frameworks. Diseño funcional y modular usando ESModules.
*   **[Bootstrap 5](https://getbootstrap.com/)** - Instalado nativamente e importado vía Node para garantizar rendimiento incluso sin internet. Icons y modales incluidos.
*   **[html5-qrcode](https://github.com/mebjas/html5-qrcode)** - Librería para el escáner de códigos usando la cámara del dispositivo móvil.
*   **[SweetAlert2](https://sweetalert2.github.io/)** - Alertas y cuadros de diálogo animados premium.
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
