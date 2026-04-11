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
 * Inicializa el sistema de recorte.
 * Se llama una vez al arranque de la App.
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
    
    // Botones de rotación por si el usuario hizo la foto torcida
    if(btnRotateLeft) btnRotateLeft.onclick = () => cropper && cropper.rotate(-90);
    if(btnRotateRight) btnRotateRight.onclick = () => cropper && cropper.rotate(90);
};

/**
 * Abre el visor de recorte con una imagen dada.
 * @param {string} imageBase64 - La imagen cruda capturada por la cámara.
 * @returns {Promise<string|null>} - La imagen recortada en Base64 o null si cancela.
 */
export const startCropping = (imageBase64) => {
    return new Promise((resolve) => {
        if (!cropModal || !targetImg) return resolve(null);

        // Cargamos la imagen en el <img> del modal
        targetImg.src = imageBase64;

        // Limpieza de instancia previa si existiera
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        const onModalShown = () => {
            // Inicializar Cropper.js
            cropper = new Cropper(targetImg, {
                viewMode: 1, // Restringe el área de recorte al contenedor
                dragMode: 'move', // Permite mover la imagen
                autoCropArea: 0.8, // Selecciona el 80% inicial
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                initialAspectRatio: NaN, // Libre, para tiquets largos o anchos
                background: false
            });
            cropModalElement.removeEventListener('shown.bs.modal', onModalShown);
        };

        cropModalElement.addEventListener('shown.bs.modal', onModalShown);
        cropModal.show();

        // Manejador del botón "Listo"
        btnConfirm.onclick = () => {
            if (!cropper) return;

            // Extraemos el canvas recortado con una resolución decente
            const canvas = cropper.getCroppedCanvas({
                maxWidth: 1024,
                maxHeight: 1024,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            const croppedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            cropModal.hide();
            resolve(croppedBase64);
        };

        // Manejador de cancelación (el usuario cierra el modal)
        cropModalElement.addEventListener('hidden.bs.modal', () => {
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            // Si el promise sigue pendiente, resolvemos con null
            resolve(null);
        }, { once: true });
    });
};
