# 🛒 Asistente de Compras (Mercat App)

Aplicación Web *Mobile-First* diseñada para llevar el control de tus compras en la tienda física o supermercado. Permite escanear códigos de barras, crear tu propio catálogo local de precios y llevar la suma total del carrito en tiempo real, todo sin necesidad de conexión externa o bases de datos complejas.

## ✨ Características Principales

*   **📷 Escáner de Códigos de Barras Intencional**: Lector integrado súper rápido. Pausa automática al detectar productos para que no se vuelva loco leyendo el mismo producto.
*   **💾 Inventario Local-First**: Todo lo que escaneas se guarda de por vida en la memoria de tu móvil (LocalStorage).
*   **🔎 Búsqueda Instantánea**: Busca milisegundos entre tus productos guardados por código o nombre gracias al buscador dinámico *en vivo*.
*   **📱 Diseño 100% Mobile**: Botones grandes, footer congelado siempre visible, animaciones Bootstrap Native e interfaz limpia similar a una aplicación descargada típica de la App Store.
*   **🎨 Alertas Animadas Premium**: Integración de notificaciones sutiles (SweetAlert2) durante el proceso de compra.
*   **✏️ Gestión CRUD Total**: Edita nombres, modifica precios de tus productos si han subido/bajado o borra elementos viejos del catálogo con un clic.

## 🛠 Tecnologías Utilizadas

*   **[Vite](https://vitejs.dev/)** - Entorno de desarrollo para modernizar el flujo de trabajo JS con *Hot-Reload*.
*   **Vanilla JS (ES6+)** - Sin pesados frameworks. Diseño funcional y modular usando ESModules.
*   **[Bootstrap 5](https://getbootstrap.com/)** - Instalado nativamente e importado vía Node para garantizar rendimiento incluso sin internet. Icons y modales incluidos.
*   **[html5-qrcode](https://github.com/mebjas/html5-qrcode)** - Librería para el escáner de códigos usando la cámara del dispositivo móvil.
*   **[SweetAlert2](https://sweetalert2.github.io/)** - Alertas y cuadros de diálogo animados premium.

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

*   `src/main.js`: Lógica principal de UI, interacción de cámara, eventos y componentes *SweetAlert*.
*   `src/storage.js`: Librería abstracta de persistencia. Funciones para crear, leer y actualizar el inventario y carrito frente a la base de datos `LocalStorage`.
*   `src/style.css`: Estilado de las tarjetas Bootstrap, corrección de inputs de números para móviles y rediseño de las cajas fuertes predeterminadas del lector QR.
*   `index.html`: La Interfaz del Usuario.
*   `vite.config.js`: La configuración SSL básica para exponer en red local.
