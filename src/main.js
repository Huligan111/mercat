/**
 * Controlador Principal (Orquestador).
 * Une la UI con el Escáner y la Lógica del Carrito.
 */
import './style.css'; 
import * as db from './storage.js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Swal from 'sweetalert2';

// Importamos los Módulos de Componentes Visuales Creados
import { initCartUI, renderCart } from './ui/cart.js';
import { initInventoryUI } from './ui/inventory.js';
import { initProductModalUI, setupModalForNew, openProductModalForEdit } from './ui/productModal.js';
import { initHistoryUI } from './ui/history.js';
import { initShoppingListUI } from './ui/shoppingList.js';

// Elementos de la entrada manual
const manualForm = document.getElementById('manual-form');
const manualBarcode = document.getElementById('manual-barcode');
const beepSound = document.getElementById('beep-sound');

// Instancia global del escaner
let html5QrcodeScanner = null;

const playSuccessSound = () => {
    if (beepSound) {
        beepSound.play().catch(e => console.log('Bloqueado temporalmente el audio', e));
    }
}

/**
 * Lógica Central: Qué pasa cuando se lee un código (ya sea por cámara o teclado)
 */
const handleBarcodeScanned = (decodedText) => {
    playSuccessSound();
    
    // Buscar si el producto existe
    const product = db.findProductByBarcode(decodedText);
    
    if (product) {
       // PASO POSITIVO: añadir y avisar bonito
       db.addToCart(product);
       renderCart();
       
       Swal.fire({
           title: product.name,
           html: `Añadido a <strong style="font-size: 1.8rem; display: block; margin-top: 10px; color: #198754;">${product.price.toFixed(2)} €</strong>`,
           icon: 'success',
           timer: 2000,
           timerProgressBar: true,
           showConfirmButton: false,
           backdrop: `rgba(0,0,0,0.5)`,
           position: 'center'
       });
       
       // Reanudar cámara sola
       setTimeout(() => resumeScanner(), 2000);
       
    } else {
       // PASO NEGATIVO: forzar modal creación
       setupModalForNew(decodedText);
    }
};

const resumeScanner = () => {
    if (html5QrcodeScanner) {
        try { html5QrcodeScanner.resume(); } catch (e) { /* silent fail si escanea archivo */ }
    }
};

const initCameraScanner = () => {
    try {
        // Vaciamos primero cualquier basura previa para prevenir el error 'removeChild on Node'
        document.getElementById('reader').innerHTML = '';

        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 }, 
            false
        );

        const onScanSuccess = (decodedText) => {
            try {
                if (html5QrcodeScanner) {
                    try { html5QrcodeScanner.pause(true); } catch(err) {} 
                }
                handleBarcodeScanned(decodedText);
            } catch (err) {
                const errMsg = err.message ? err.message : err;
                alert("Uy! Error al procesar: " + errMsg);
                resumeScanner();
            }
        };

        html5QrcodeScanner.render(onScanSuccess, () => {});
    } catch (error) {
        alert("Error inicializando la cámara: " + error.message);
    }
}

// Búsqueda Manual
if (manualForm) {
    manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = manualBarcode.value.trim();
        if (code !== "") {
            handleBarcodeScanned(code);
            manualBarcode.value = '';
        }
    });
}

// ARRANQUE (BOOTSTRAPPING DE LA APP)
window.addEventListener('load', () => {
    try {
        initCartUI();
        initInventoryUI(openProductModalForEdit);    // Inyectamos dependencia cruzada
        initProductModalUI(resumeScanner);           // Inyectamos función para despertar escáner
        initHistoryUI();                             // Registramos el Módulo del Historial (Chart.js y Modal)
        initShoppingListUI();                        // Registramos el Bloc de Notas Predictivo

        renderCart(); 
        initCameraScanner(); 
    } catch (e) {
        alert("Fallo crítico en el inicio: " + e.message);
    }
});
