import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    // Este plugin nos genera un certificado HTTPS temporal ('Localhost' y IPs Locales).
    // Es obligatorio para que sistemas móviles como iOS o Android no bloqueen la cámara.
    basicSsl()
  ]
});
