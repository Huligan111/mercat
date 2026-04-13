/**
 * Controlador Principal (Orquestador).
 * Une la UI con el Escáner y la Lógica del Carrito.
 */
import './style.css'; 
import 'cropperjs/dist/cropper.css';
import * as db from './storage.js';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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

// Instancia global del escaner (API de control directo, sin UI propia)
let html5QrcodeScanner = null;

/**
 * Reproduce el sonido de "beep" cuando una lectura es exitosa.
 * Se silencia automáticamente si el navegador bloquea el autoplay.
 */
const playSuccessSound = () => {
    if (beepSound) {
        beepSound.play().catch(e => console.log('Audio bloqueado por política del navegador', e));
    }
}

/**
 * Lógica Central: Procesa una cadena de texto (barcode) para identificar el producto.
 * Gestiona tanto códigos EAN-13 estándar como URLs GS1 Digital Link.
 * @param {string} decodedText - El código crudo leído por el sensor o teclado.
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

/**
 * Reanuda el flujo de video del escáner tras una pausa por lectura exitosa.
 */
const resumeScanner = () => {
    if (html5QrcodeScanner) {
        try { html5QrcodeScanner.resume(); } catch (e) { /* silencioso */ }
    }
};

/**
 * Configura e inicializa el escáner usando la API directa de Html5Qrcode.
 * Auto-arranca con la cámara trasera sin mostrar UI de selección.
 * Expone controles para detener, cambiar cámara y escanear desde imagen.
 */
const initCameraScanner = () => {
    try {
        document.getElementById('reader').innerHTML = '';

        html5QrcodeScanner = new Html5Qrcode("reader");

        let isScannerRunning = false;
        let currentFacingMode = "environment"; // Cámara trasera por defecto
        let isTorchOn = false;

        const scannerConfig = {
            fps: 20, // 20fps: punto óptimo velocidad/batería (sin experimentalFeatures el decode es JS puro)
            qrbox: 250,
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.DATA_MATRIX
            ]
        };

        // Actualiza el texto e icono del botón Detener/Iniciar
        const updateToggleBtn = () => {
            const btn = document.getElementById('btn-toggle-scanner');
            if (!btn) return;
            if (isScannerRunning) {
                btn.innerHTML = '<i class="bi bi-stop-circle"></i> Detener';
                btn.className = 'btn btn-sm btn-outline-danger rounded-pill px-3';
            } else {
                btn.innerHTML = '<i class="bi bi-play-circle"></i> Iniciar';
                btn.className = 'btn btn-sm btn-outline-success rounded-pill px-3';
            }
        };

        const onScanSuccess = (decodedText) => {
            try {
                try { html5QrcodeScanner.pause(true); } catch(err) {}
                handleBarcodeScanned(decodedText);
            } catch (err) {
                alert("Error al procesar: " + (err.message || err));
                resumeScanner();
            }
        };

        // Arranca la cámara con el facingMode indicado
        const startCamera = (facingMode) => {
            currentFacingMode = facingMode;
            return html5QrcodeScanner.start(
                { facingMode },
                scannerConfig,
                onScanSuccess,
                () => {} // fallos de lectura: silencioso
            ).then(() => {
                isScannerRunning = true;
                updateToggleBtn();
                // Comprobar si el dispositivo soporta linterna y mostrar el botón
                try {
                    const capabilities = html5QrcodeScanner.getRunningTrackCapabilities();
                    const torchBtn = document.getElementById('btn-toggle-torch');
                    if (capabilities && capabilities.torch && torchBtn) {
                        torchBtn.classList.remove('d-none');
                    }
                } catch(e) { /* linterna no soportada */ }
            }).catch(err => {
                console.warn('Error al arrancar cámara:', err);
                isScannerRunning = false;
                updateToggleBtn();
            });
        };

        // Detiene la cámara limpiamente
        const stopCamera = async () => {
            if (isScannerRunning) {
                try { await html5QrcodeScanner.stop(); } catch(e) {}
                isScannerRunning = false;
                isTorchOn = false;
                updateToggleBtn();
                // Ocultar y resetear el botón de linterna
                const torchBtn = document.getElementById('btn-toggle-torch');
                if (torchBtn) {
                    torchBtn.classList.add('d-none');
                    torchBtn.classList.remove('btn-warning');
                    torchBtn.classList.add('btn-outline-warning');
                    torchBtn.innerHTML = '<i class="bi bi-lightbulb"></i> Flash';
                }
            }
        };

        // --- Arranque automático con cámara trasera ---
        startCamera("environment").catch(() => startCamera("user"));

        // --- Botón: Detener / Iniciar ---
        document.getElementById('btn-toggle-scanner')?.addEventListener('click', async () => {
            if (isScannerRunning) {
                await stopCamera();
            } else {
                await startCamera(currentFacingMode);
            }
        });

        // --- Botón: Cambiar Cámara (frontal ↔ trasera) ---
        document.getElementById('btn-switch-camera')?.addEventListener('click', async () => {
            await stopCamera();
            const newFacing = currentFacingMode === "environment" ? "user" : "environment";
            await startCamera(newFacing);
        });

        // --- Botón: Linterna / Flash ---
        document.getElementById('btn-toggle-torch')?.addEventListener('click', async () => {
            if (!isScannerRunning) return;
            isTorchOn = !isTorchOn;
            try {
                await html5QrcodeScanner.applyVideoConstraints({
                    advanced: [{ torch: isTorchOn }]
                });
                const btn = document.getElementById('btn-toggle-torch');
                if (btn) {
                    if (isTorchOn) {
                        btn.innerHTML = '<i class="bi bi-lightbulb-fill"></i> Flash ON';
                        btn.classList.remove('btn-outline-warning');
                        btn.classList.add('btn-warning');
                    } else {
                        btn.innerHTML = '<i class="bi bi-lightbulb"></i> Flash';
                        btn.classList.remove('btn-warning');
                        btn.classList.add('btn-outline-warning');
                    }
                }
            } catch(e) {
                console.warn('Linterna no disponible:', e);
                isTorchOn = !isTorchOn; // revertir si falla
            }
        });

        // --- Input: Escanear desde Imagen (Galería / Archivo) ---
        document.getElementById('btn-scan-image-file')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await stopCamera();
            try {
                const result = await html5QrcodeScanner.scanFile(file, false);
                handleBarcodeScanned(result);
            } catch (err) {
                Swal.fire({
                    title: 'No encontrado',
                    text: 'No se pudo leer ningún código en esa imagen.',
                    icon: 'warning',
                    timer: 2500,
                    showConfirmButton: false
                });
            } finally {
                // Reiniciamos cámara tras el escaneo de imagen
                await startCamera(currentFacingMode);
                e.target.value = ''; // Reset input para poder volver a usar el mismo archivo
            }
        });

    } catch (error) {
        alert("Error inicializando la cámara: " + error.message);
    }
};



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
