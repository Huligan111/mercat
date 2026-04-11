/**
 * Utilidad para el procesamiento y compresión de imágenes en el cliente.
 * Evita saturar el almacenamiento guardando versiones minificadas de los tiquets.
 */

/**
 * Recibe un objeto File (de un input) y devuelve una cadena Base64 optimizada.
 * @param {File} file - El archivo capturado por la cámara.
 * @param {number} maxWidth - Ancho máximo permitido (default 800px).
 * @returns {Promise<string>} - Resolv con el string base64 de la imagen JPEG.
 */
export const compressImage = (file, maxWidth = 800) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // Cálculo de proporciones
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                // Dibujado en Canvas para compresión hardware
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Exportación a JPEG con calidad 0.6 (equilibrio peso/lectura)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
