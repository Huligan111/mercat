/**
 * Controlador Principal de la Aplicación (Main App Controller)
 * Este archivo conecta la interfaz gráfica (HTML) con la lógica de negocio (storage.js)
 * y la detección de códigos de barras.
 */

// Importamos el archivo CSS directamente para que Vite lo procese e inyecte
import './style.css'; 

// Importar todo el módulo de almacenamiento bajo el nombre (alias) "db"
import * as db from './storage.js';

// Importar la clase nativa del escáner que instalamos vía NPM
import { Html5QrcodeScanner } from 'html5-qrcode';
// Importamos Bootstrap localmente para evitar fallos de conexión externa en móviles (CDN bloqueados)
import * as bootstrap from 'bootstrap';
// Importamos SweetAlert2 para notificaciones con animaciones fluidas
import Swal from 'sweetalert2';

// ==========================================
// REFERENCIAS AL DOM (DOCUMENT OBJECT MODEL)
// ==========================================
// Capturamos los elementos HTML una sola vez por rendimiento

// Elementos del carrito y total
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const emptyCartMsg = document.getElementById('empty-cart-msg');
const btnClearCart = document.getElementById('btn-clear-cart');

// Elementos de la entrada manual de código
const manualForm = document.getElementById('manual-form');
const manualBarcode = document.getElementById('manual-barcode');

// Elementos del Modal (Ventana emergente)
const newProductModalElement = document.getElementById('newProductModal');
// Se inicializará Modal más tarde, de forma segura
let newProductModal = null;
const newProductForm = document.getElementById('new-product-form');
const formBarcode = document.getElementById('form-barcode');
const formOriginalBarcode = document.getElementById('form-original-barcode'); // Oculto
const formName = document.getElementById('form-name');
const formPrice = document.getElementById('form-price');

// Titulos y botones dinámicos para reutilizar el modal de Crear/Editar
const modalIcon = document.getElementById('modal-icon');
const modalTitleText = document.getElementById('modal-title-text');
const modalHelpText = document.getElementById('modal-help-text');
const formSubmitText = document.getElementById('form-submit-text');

// Elementos del Modal de Inventario
const inventoryModalElement = document.getElementById('inventoryModal');
let inventoryModal = null;
const inventoryList = document.getElementById('inventory-list');
const emptyInventoryMsg = document.getElementById('empty-inventory-msg');
const btnInventory = document.getElementById('btn-inventory');
const inventorySearch = document.getElementById('inventory-search');

// Estado para diferenciar "Crear al escanear" de "Editar desde el Inventario"
let isEditingFromInventory = false;

// Sonido
const beepSound = document.getElementById('beep-sound');

// Escáner Global Variable
let html5QrcodeScanner = null;

// ==========================================
// FUNCIONES DE RENDERIZADO VISUAL
// ==========================================

/**
 * Función vital que pinta todo el contenido del carrito en la tabla HTML.
 * Se llama cada vez que añadimos, borramos o editamos un ítem.
 */
const renderCart = () => {
    // Obtenemos el listado del localStorage
    const cart = db.getCart();
    
    // Vaciamos el contenedor primero antes de pintar
    cartItemsContainer.innerHTML = '';
    
    let totalAcumulado = 0; // Variable para calcular la suma de todos

    // Verificar si está vacío para mostrar mensaje
    if (cart.length === 0) {
        emptyCartMsg.style.display = 'block';
        cartTotalElement.textContent = '0.00 €';
        return;
    } else {
        emptyCartMsg.style.display = 'none';
    }

    // Usamos .forEach() moderno para itinerar y pintar cada producto
    cart.forEach(item => {
        // Calculamos el subtotal de este ítem
        const itemSubtotal = item.price * item.quantity;
        totalAcumulado += itemSubtotal;
        
        // Creamos una fila (tr) de tabla
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3 fw-medium align-middle">
                ${item.name}
            </td>
            <td class="text-center align-middle py-3">
                <div class="btn-group btn-group-sm mb-2" role="group" style="box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <button type="button" class="btn btn-outline-primary btn-decrease" data-barcode="${item.barcode}">-</button>
                    <button type="button" class="btn btn-outline-primary fw-bold" disabled style="color: black;">${item.quantity}</button>
                    <button type="button" class="btn btn-outline-primary btn-increase" data-barcode="${item.barcode}">+</button>
                </div>
                <div class="fw-bold text-success fs-5">
                    ${item.price.toFixed(2)}€
                </div>
            </td>
            <td class="text-end fw-bold align-middle fs-6">
                ${itemSubtotal.toFixed(2)}€
            </td>
            <td class="align-middle">
                <!-- Botón eliminar sin bordes y color suave -->
                <button class="btn btn-sm text-danger btn-delete border-0" data-barcode="${item.barcode}">
                    <i class="bi bi-trash3 fs-5"></i>
                </button>
            </td>
        `;
        cartItemsContainer.appendChild(tr);
    });

    // Actualizar el UI del Total del carrito
    cartTotalElement.textContent = `${totalAcumulado.toFixed(2)} €`;
    
    // Refrescar los listeners en los botones creados dinámicamente
    attachCartButtonListeners();
};

/**
 * Dibuja el inventario en el Modal
 * @param {string} searchTerm Filtro dinámico
 */
const renderInventory = (searchTerm = '') => {
    let products = db.getProductsDB();
    inventoryList.innerHTML = '';
    
    // Filtrado por código o nombre excluyendo mayúsculas/minúsculas
    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        products = products.filter(p => 
            p.barcode.toLowerCase().includes(term) || 
            p.name.toLowerCase().includes(term)
        );
    }
    
    if (products.length === 0) {
        emptyInventoryMsg.classList.remove('d-none');
    } else {
        emptyInventoryMsg.classList.add('d-none');
        
        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'list-group-item d-flex justify-content-between align-items-center py-3';
            div.innerHTML = `
                <div>
                    <h6 class="mb-0 fw-bold">${p.name}</h6>
                    <small class="text-muted"><i class="bi bi-upc"></i> ${p.barcode}</small><br>
                    <span class="badge bg-success rounded-pill">${p.price.toFixed(2)} €</span>
                </div>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-edit-product" data-barcode="${p.barcode}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-delete-product" data-barcode="${p.barcode}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            inventoryList.appendChild(div);
        });
        
        // Listeners para los botones creados
        document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('button').dataset.barcode;
                if(confirm('¿Eliminar producto del catálogo permanentemente?')) {
                    db.deleteProduct(code);
                    // También quitarlo del carrito si estaba!
                    db.removeFromCart(code);
                    renderCart();
                    renderInventory();
                }
            });
        });

        document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('button').dataset.barcode;
                const prod = db.findProductByBarcode(code);
                if(prod) {
                    // Cerrar inventario y abrir edición
                    if(inventoryModal) inventoryModal.hide();
                    openProductModalForEdit(prod);
                }
            });
        });
    }
}

/**
 * Función para Configurar el Modal como "NUEVO"
 */
const setupModalForNew = (barcodeText) => {
    isEditingFromInventory = false;
    modalTitleText.textContent = "Nuevo Producto";
    modalIcon.className = "bi bi-plus-circle";
    modalHelpText.textContent = "El código de barras no se encuentra. Añádelo y se guardará para siempre.";
    formSubmitText.textContent = "Guardar y Añadir a la lista";
    
    // Limpieza
    formOriginalBarcode.value = '';
    if (formBarcode) formBarcode.value = barcodeText;
    if (formName) formName.value = '';
    if (formPrice) formPrice.value = '';
}

/**
 * Función para Configurar el Modal como "EDITAR"
 */
const openProductModalForEdit = (product) => {
    isEditingFromInventory = true;
    modalTitleText.textContent = "Editar Producto";
    modalIcon.className = "bi bi-pencil-square";
    modalHelpText.textContent = "Modifica los valores. Si corriges el código de barras, se actualizará el registro.";
    formSubmitText.textContent = "Guardar Cambios";
    
    // Rellenamos
    formOriginalBarcode.value = product.barcode;
    formBarcode.value = product.barcode;
    formName.value = product.name;
    formPrice.value = product.price;
    
    if (!newProductModal) newProductModal = new bootstrap.Modal(newProductModalElement);
    newProductModal.show();
}

/**
 * Reproducción de sonido y limpieza pequeña
 */
const playSuccessSound = () => {
    if (beepSound) {
        // Forzar el Play y silenciar posibles errores en navegadores restrictivos
        beepSound.play().catch(e => console.log('Bloqueado temporalmente el audio', e));
    }
}

// ==========================================
// MANEJADORES DE LOGICA PRINCIPAL
// ==========================================

/**
 * Función que se ejecuta cada vez que el escaner detecta un código O manualmente lo procesamos.
 * @param {string} decodedText - El código de barras escaneado (ej. "84123456789")
 */
const handleBarcodeScanned = (decodedText) => {
    playSuccessSound(); // Pequeño efecto sonoro
    
    // Paso 1: Buscar si el producto ya existe en nuestro "Catálogo Local"
    const product = db.findProductByBarcode(decodedText);
    
    if (product) {
       // PASO POSITIVO: Sí existe en la BD local. Lo añadimos al carrito.
       db.addToCart(product);
       renderCart(); // Refrescamos pantalla
       
       // Ventana flotante "Dulce" (SweetAlert) con HTML inyectado
       Swal.fire({
           title: product.name,
           html: `Añadido a <strong style="font-size: 1.8rem; display: block; margin-top: 10px; color: #198754;">${product.price.toFixed(2)} €</strong>`,
           icon: 'success',
           timer: 2000,
           timerProgressBar: true,
           showConfirmButton: false,
           backdrop: `rgba(0,0,0,0.5)`, // Oscurece sutilmente el fondo
           position: 'center'
       });
       
       // Si fue un éxito, reanudamos el escáner automáticamente tras 2 segundos.
       setTimeout(() => {
           if (html5QrcodeScanner) {
               try {
                   html5QrcodeScanner.resume();
               } catch (e) { /* silenciar si ya corría */ }
           }
       }, 2000);
       
    } else {
       // PASO NEGATIVO: No existe en la base. Mostramos formulario modal.
       // Dejamos la cámara pausada hasta que cierre el modal.
       
       setupModalForNew(decodedText);
       
       // Abrir el componente Bootstrap asegurándonos que esté inicializado
       if (!newProductModal) {
           // Instanciamos el modal usando el módulo interno de Bootstrap
           newProductModal = new bootstrap.Modal(newProductModalElement);
       }
       newProductModal.show();
    }
};

/**
 * Evento: Al guardar un producto nuevo en el Modal.
 */
const handleSaveNewProduct = (event) => {
    event.preventDefault(); // Prevenir el refresco de página del "submit" nativo de HTML
    
    // Recolectar datos y transformar precio a formato Decimal.
    const newProduct = {
        barcode: formBarcode.value.trim(),
        name: formName.value.trim(),
        price: parseFloat(formPrice.value)
    };
    
    // Guardar o Actualizar en Base de Datos permanente
    db.saveOrUpdateProduct(newProduct, formOriginalBarcode.value || null);
    
    if (!isEditingFromInventory) {
       // Si venimos del escaner (creando), lo metemos directo al carrito
       db.addToCart(newProduct);
    } else {
       // Si estábamos editando, debemos actualizar su precio/nombre en el carrito activo si lo hubiera
       // (Estrategia sencilla: recalcular el carrito. O más fácil: limpiar y volver a agregar, pero 
       // mantengamoslo simple: actualizamos el item visualmente)
       let cart = db.getCart();
       const existingCartItem = cart.find(i => i.barcode === formOriginalBarcode.value || i.barcode === newProduct.barcode);
       if(existingCartItem) {
           existingCartItem.barcode = newProduct.barcode;
           existingCartItem.name = newProduct.name;
           existingCartItem.price = newProduct.price;
           db.saveCart(cart);
       }
    }
    
    // Plegar UI
    newProductModal.hide();
    renderCart();
    // Limpiar barra manual
    manualBarcode.value = ''; 
    
    // Si era edición abrir de nuevo el inventario para confort
    if(isEditingFromInventory) {
        if(inventoryModal) inventoryModal.show();
        renderInventory();
    }
};

// ==========================================
// INICIAR EL ESCÁNER DE CÁMARA (Librería Externa)
// ==========================================
const initCameraScanner = () => {
    try {
        // Configuración del objeto escáner
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 }, 
            /* verbose= */ false
        );

        // Callback en caso de exito al escanear
        const onScanSuccess = (decodedText, decodedResult) => {
            try {
                if (html5QrcodeScanner) {
                    html5QrcodeScanner.pause(true);
                }
                // Delegamos la logica
                handleBarcodeScanned(decodedText);
            } catch (err) {
                alert("Uy! Error al procesar: " + err.message);
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
            }
        };

        // Renderizamos el widget de cámara en el div con id "reader"
        html5QrcodeScanner.render(onScanSuccess, (err) => { /* silencioso */ });
    } catch (error) {
        alert("Error inicializando la cámara: " + error.message);
    }
}

// ==========================================
// ASIGNACION DE EVENTOS DE BOTONERA Y FLUJO
// ==========================================

/**
 * Función para añadir listeners de clic a los botones dinámicos del listado de carrito.
 * Es crucial usar "Event Delegation" o re-aplicarlos como hacemos aquí cada que pintamos.
 */
const attachCartButtonListeners = () => {
    // Capturamos todos los botones recién inyectados
    document.querySelectorAll('.btn-decrease').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // "dataset.barcode" accede al valor data-barcode del HTML
            db.decreaseQuantity(e.target.dataset.barcode);
            renderCart();
        });
    });

    document.querySelectorAll('.btn-increase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            db.increaseQuantity(e.target.dataset.barcode);
            renderCart();
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Buscamos el boton más cercano en caso de haber hecho click en el ícono svg
            const barCode = e.target.closest('button').dataset.barcode;
            db.removeFromCart(barCode);
            renderCart();
        });
    });
};

// Evento: Al intentar meter código manualmente con fallo de cámara
manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = manualBarcode.value.trim();
    if (code !== "") {
        handleBarcodeScanned(code);
        manualBarcode.value = ''; // limpiar
    }
});

// Evento Modal Bootstrap: "Cerrar modalidad y reaunudar escáner"
newProductModalElement.addEventListener('hidden.bs.modal', event => {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.resume(); // reactivamos la camara
    }
});

// Guardado del Modal
newProductForm.addEventListener('submit', handleSaveNewProduct);

// Abre el inventario
btnInventory.addEventListener('click', () => {
    if(!inventoryModal) inventoryModal = new bootstrap.Modal(inventoryModalElement);
    inventorySearch.value = ''; // Limpiamos barra al abrir
    renderInventory();
    inventoryModal.show();
});

// Buscador en directo dentro del inventario
if(inventorySearch) {
    inventorySearch.addEventListener('input', (e) => {
        renderInventory(e.target.value);
    });
}

// Botón rojo: Vaciar toda la cesta de compra actual
btnClearCart.addEventListener('click', () => {
    const cart = db.getCart();
    if(cart.length === 0) return; // No hacer nada si ya está vacío
    
    // Preguntar con SweetAlert para que sea bonito y seguro
    Swal.fire({
      title: '¿Vaciar Lista?',
      text: "Se eliminarán todos los elementos escaneados de esta compra.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545', // Rojo
      cancelButtonColor: '#6c757d',  // Gris
      confirmButtonText: 'Sí, vaciar',
      cancelButtonText: 'Cancelar',
      backdrop: `rgba(0,0,0,0.5)`
    }).then((result) => {
      if (result.isConfirmed) {
          db.clearCart();
          renderCart();
          // Alertar de éxito
          Swal.fire({
              title: 'Vaciada',
              text: 'Tu cesta está limpia otra vez.',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
          });
      }
    });
});

// ==========================================
// ARRANQUE (BOOTSTRAPPING DE LA APP)
// ==========================================
// Sustituimos DOMContentLoaded por un load total para garantizar 
// que todos los scripts importados se hayan parseado.
window.addEventListener('load', () => {
    try {
        renderCart(); 
        initCameraScanner(); 
    } catch (e) {
        alert("Fallo crítico en el inicio: " + e.message);
    }
});
