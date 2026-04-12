/**
 * Controlador Principal (Orquestador).
 * Une la UI con el Escáner y la Lógica del Carrito.
 */
import './style.css'; 
import 'cropperjs/dist/cropper.css';
import * as db from './storage.js';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Swal from 'sweetalert2';

// Importamos los Módulos de Componentes Visuales Creados
import { initCartUI, renderCart } from './ui/cart.js';
import { initInventoryUI } from './ui/inventory.js';
import { initProductModalUI, setupModalForNew, openProductModalForEdit } from './ui/productModal.js';
import { initHistoryUI } from './ui/history.js';
import { initShoppingListUI } from './ui/shoppingList.js';
import { initCropperUI } from './ui/cropperUI.js';
import { initHelpUI } from './ui/helpUI.js';

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
    
    let searchBarcode = decodedText;
    let injectedPrice = null;

    // MAGIA: Interceptor de GS1 Digital Link (QRs de peso variable tipo Mercadona)
    // Ej: https://qrtrack.mercadona.es/01/08436581961300/...&3922=00415
    if (decodedText.startsWith('http') && decodedText.includes('/01/')) {
        // 1. Extraer el GTIN (Código de Barras)
        const gtinMatch = decodedText.match(/\/01\/(\d+)/);
        if (gtinMatch && gtinMatch[1]) {
            let gtin = gtinMatch[1];
            // Estándar: Convertir GTIN-14 a EAN-13 retirando el 0 inicial
            if (gtin.length === 14 && gtin.startsWith('0')) {
                searchBarcode = gtin.substring(1);
            } else {
                searchBarcode = gtin;
            }
        }

        // 2. Extraer el Precio Específico de la bandeja (3922 indica importe con 2 decimales)
        const priceMatch = decodedText.match(/3922=(\d+)/);
        if (priceMatch && priceMatch[1]) {
            injectedPrice = parseInt(priceMatch[1], 10) / 100; // Ej: 00574 -> 5.74€
        }
    }

    // Buscar si el producto existe con la cadena de EAN13 limpia
    let product = db.findProductByBarcode(searchBarcode);
    
    if (product) {
       // PASO POSITIVO: Clona y Modifica el precio si viene inyectado por QR Dinámico
       if (injectedPrice !== null) {
           product = { ...product }; // Clon profundo rápido
           product.price = injectedPrice;
           product.isVariablePrice = true; // Flag para que el carrito lo divida en fila propia
       }

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
       // PASO NEGATIVO: forzar modal creación con EAN-13 limpio y precio pre-rellenado (si existe)
       // Se envía injectedPrice si fue descubierto en el QR!
       setupModalForNew(searchBarcode, injectedPrice);
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
            { 
                fps: 30, // TRIPLE de velocidad de muestreo. Consume más batería pero caza al vuelo.
                qrbox: 250, 
                aspectRatio: 1.0,
                // Limitamos a los formatos de Súper (EAN) y Charcutería (QR) para que la CPU no pierda el tiempo buscando códigos espaciales o cajas de Amazon (Code128)
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.DATA_MATRIX // Por si algún súper europeo los usa
                ],
                // Activar acelerador nativo: Usa los Servicios de Google Play Vision en Android en vez de la CPU simulada!
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            }, 
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

        // --- TRADUCTOR DINÁMICO DE LA LIBRERÍA (UX Premium en Español) ---
        const translateScannerUI = () => {
            const translations = {
                "Request Camera Permissions": "Solicitar Permisos de Cámara",
                "Scan an Image File": "Escanear Archivo de Imagen",
                "Scan using camera directly": "Usar cámara directamente",
                "Stop Scanning": "Detener Escaneo",
                "Start Scanning": "Iniciar Escaneo",
                "Select Camera": "Seleccionar Cámara",
            };

            const elements = document.querySelectorAll('#reader button, #reader a, #reader span, #reader label');
            elements.forEach(el => {
                const text = el.innerText.trim();
                if (translations[text]) {
                    el.innerText = translations[text];
                }
            });
        };

        // Observamos cambios en el lector para traducir botones que aparecen/desaparecen
        const observer = new MutationObserver(translateScannerUI);
        observer.observe(document.getElementById('reader'), { childList: true, subtree: true });
        
        // Ejecución inicial por si ya estuviera pintado
        setTimeout(translateScannerUI, 100);

    } catch (error) {
        alert("Error inicializando la cámara: " + error.message);
    }
}

// Búsqueda Manual Avanzada (Predictiva)
const manualSuggestions = document.getElementById('manual-suggestions');

// 1. Envío clásico (darle al Enter)
if (manualForm) {
    manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = manualBarcode.value.trim();
        if (code !== "") {
            handleBarcodeScanned(code);
            manualBarcode.value = '';
            if (manualSuggestions) manualSuggestions.classList.add('d-none');
        }
    });
}

// 2. Lógica Predictiva (Auto-completado en vivo)
if (manualBarcode && manualSuggestions) {
    manualBarcode.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length === 0) {
            manualSuggestions.classList.add('d-none');
            return;
        }

        const allProducts = db.getProductsDB();
        const matches = allProducts.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.barcode.includes(query)
        ).slice(0, 6); // Limite razonable

        if (matches.length > 0) {
            manualSuggestions.innerHTML = matches.map(match => `
                <li class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" style="cursor: pointer;" data-barcode="${match.barcode}">
                    <div>
                        <div class="fw-bold">${match.name}</div>
                        <small class="text-muted"><i class="bi bi-upc"></i> ${match.barcode}</small>
                    </div>
                    <span class="badge bg-success rounded-pill">${match.price.toFixed(2)}€</span>
                </li>
            `).join('');
            manualSuggestions.classList.remove('d-none');
        } else {
            manualSuggestions.innerHTML = `
                <li class="list-group-item text-muted text-center" style="pointer-events: none;">
                    <i class="bi bi-box-seam"></i> Producto no catalogado
                </li>
            `;
            manualSuggestions.classList.remove('d-none');
        }
    });

    // Delegación de clic sobre un elemento dropeado
    manualSuggestions.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-barcode]');
        if (li) {
            const barcodeSelected = li.dataset.barcode;
            handleBarcodeScanned(barcodeSelected); // Simula escaneo!
            manualBarcode.value = '';
            manualSuggestions.classList.add('d-none');
        }
    });

    // Auto-plegado al clickear fuera (UX)
    document.addEventListener('click', (e) => {
        if (!manualBarcode.contains(e.target) && !manualSuggestions.contains(e.target)) {
            manualSuggestions.classList.add('d-none');
        }
    });
}

// ARRANQUE (BOOTSTRAPPING DE LA APP)
window.addEventListener('load', async () => {
    try {
        // 1. Migración de datos pesados (LocalStorage -> IndexedDB)
        await db.migrateReceiptsToIDB();

        initCartUI();
        initInventoryUI(openProductModalForEdit, setupModalForNew);    // Inyectamos dependencias cruzadas (Editar y Añadir)
        initProductModalUI(resumeScanner);           // Inyectamos función para despertar escáner
        initHistoryUI();                             // Registramos el Módulo del Historial (Chart.js y Modal)
        initShoppingListUI();                        // Registramos el Bloc de Notas Predictivo
        initCropperUI();                             // Registramos el Escáner de Tiquets (Recorte)
        initHelpUI();                                // Registramos el Centro de Ayuda Visual

        renderCart(); 
        initCameraScanner(); 
    } catch (e) {
        alert("Fallo crítico en el inicio: " + e.message);
    }
});
