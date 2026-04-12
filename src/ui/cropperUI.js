import Cropper from 'cropperjs';
import * as bootstrap from 'bootstrap';

/**
 * Controlador de la UI para el sistema de recorte (Escáner Manual).
 * Permite al usuario encuadrar el tiquet físico antes de guardarlo.
 */

let cropper = null;
let cropModal = null;
let cropModalElement = null;
let targetImg = null;
let btnConfirm = null;
let btnRotateLeft = null;
let btnRotateRight = null;

/**
 * Inicializa los elementos del DOM y configura los controles básicos de rotación.
 * Se instancia al inicio de la aplicación para dejar el Modal listo en memoria.
 */
export const initCropperUI = () => {
    cropModalElement = document.getElementById('cropTicketModal');
    targetImg = document.getElementById('cropper-target-img');
    btnConfirm = document.getElementById('btn-crop-confirm');
    btnRotateLeft = document.getElementById('btn-crop-rotate-left');
    btnRotateRight = document.getElementById('btn-crop-rotate-right');

    if (cropModalElement) {
        cropModal = new bootstrap.Modal(cropModalElement);
    }
    
    // Asignación de rotación (Útil si el móvil guardó la foto en horizontal)
    if(btnRotateLeft) btnRotateLeft.onclick = () => cropper && cropper.rotate(-90);
    if(btnRotateRight) btnRotateRight.onclick = () => cropper && cropper.rotate(90);
};

/**
 * Orquestador del flujo de recorte.
 * Abre un modal interactivo que permite al usuario ajustar el tiquet.
 * @param {string} imageBase64 - Imagen cruda capturada por el sensor de la cámara.
 * @returns {Promise<string|null>} - Retorna la imagen optimizada (JPEG base64) o null si se cancela.
 */
export const startCropping = (imageBase64) => {
    return new Promise((resolve) => {
        if (!cropModal || !targetImg) return resolve(null);

        // Carga de la imagen en el contenedor temporal
        targetImg.src = imageBase64;

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        const onModalShown = () => {
            // Inicializar Cropper.js con parámetros de alta precisión y UX móvil
            cropper = new Cropper(targetImg, {
                viewMode: 1,         // Confinar a la caja del contenedor
                dragMode: 'move',    // Permitir desplazar la imagen bajo el marco
                autoCropArea: 0.8,   // Selección automática generosa
                restore: false,
                guides: true,        // Guías visuales para encuadrar tiquet
                center: true,        // Indicador de centro
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                initialAspectRatio: NaN, // Formato libre (el tiquet puede ser muy largo)
                background: false
            });
            cropModalElement.removeEventListener('shown.bs.modal', onModalShown);
        };

        cropModalElement.addEventListener('shown.bs.modal', onModalShown);
        cropModal.show();

        // Confirmación y Procesado
        btnConfirm.onclick = () => {
            if (!cropper) return;

            // Generación de la imagen final optimizada
            // Limitamos a 1024px para no saturar IndexedDB ni la RAM en dispositivos humildes.
            const canvas = cropper.getCroppedCanvas({
                maxWidth: 1024,
                maxHeight: 1024,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            // Conversión a JPEG con compresión del 80% para equilibrio peso/calidad
            const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            cropModal.hide();
            resolve(croppedBase64);
        };

        // Salida segura (Cancelar o cerrar modal)
        cropModalElement.addEventListener('hidden.bs.modal', () => {
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            resolve(null);
        }, { once: true });
    });
};
