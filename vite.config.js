import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // 'base' hace que las rutas de los archivos sean relativas (./) en lugar de absolutas (/)
  // Esto arregla la pantalla en blanco o la rotura de Javascript en GitHub Pages.
  base: './',
  plugins: [
    // Este plugin nos genera un certificado HTTPS temporal ('Localhost' y IPs Locales).
    // Es obligatorio para que sistemas móviles como iOS o Android no bloqueen la cámara.
    basicSsl()
  ]
});
