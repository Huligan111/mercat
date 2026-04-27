import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // 'base' hace que las rutas de los archivos sean relativas (./) en lugar de absolutas (/)
  // Esto arregla la pantalla en blanco o la rotura de Javascript en GitHub Pages.
  base: './',
  plugins: [
    // Este plugin nos genera un certificado HTTPS temporal ('Localhost' y IPs Locales).
    // Es obligatorio para que sistemas móviles como iOS o Android no bloqueen la cámara.
    basicSsl(),
    
    // Configuración mágica de la Aplicación Instalable (PWA)
    VitePWA({
      registerType: 'autoUpdate', // Se actualizará sola de fondo cuando detecte código nuevo
      devOptions: {
        enabled: true // Nos permite testear la instalación nativa incluso en nuestro servidor localhost local
      },
      manifest: {
        name: 'Mercat App',
        short_name: 'Mercat',
        description: 'Tu asistente de compras de supermercado.',
        theme_color: '#ffffff',
        background_color: '#f8f9fa',
        display: 'standalone',
        orientation: 'portrait', // Bloquea la rotación en modo App instalada
        icons: [
          {
            src: 'icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Separa las librerías pesadas en fragmentos únicos para no saturar a Vite con advertencias de 500kB
        manualChunks: {
          'vendor-scanner': ['html5-qrcode'],
          'vendor-bootstrap': ['bootstrap'],
          'vendor-sweetalert': ['sweetalert2']
        }
      }
    }
  }
});
