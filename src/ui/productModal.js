/**
 * Módulo de la Interfaz de Formulario (Modal Nuevo/Editar Producto).
 * Arquitectura Dual: Contiene lógica que camufla y cambia la apariencia visual de 
 * UNA sola ventana para hacer que luzca como "Nuevo Producto" o como "Editar Producto" 
 * reduciendo considerablemente la huella HTML y DOM (reusabilidad avanzada).
 */

import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import { renderCart } from './cart.js';
import { renderInventory, showInventoryModal } from './inventory.js';

// Nomenclatura DOM de Elementos del Formulario
let newProductModalElement, newProductForm;
let formBarcode, formOriginalBarcode, formName, formPrice;
// Nomenclatura DOM Decorativa (Iconos, Títulos)
let modalIcon, modalTitleText, modalHelpText, formSubmitText;

let newProductModal = null; // Instancia global en este file para el Componente Bootstrap

// Interruptor maestro: dicta si el submit hace un "Create" puro o hace un "Update".
export let isEditingFromInventory = false; 

// Sistema Callback: Cuando cerramos un formulario, tal vez necesitamos "Reanudar"
// la cámara en el controlador principal. Esto lo conecta silenciosamente.
let onCloseCallback = null;

/**
 * Inicializador seguro. Mapea todos los elementos y configura el "submit".
 */
export const initProductModalUI = (onClose) => {
    // Almacena la orden de arrancar de nuevo el escáner (viene inyectado desde main.js)
    onCloseCallback = onClose;

    // Asignación referencial
    newProductModalElement = document.getElementById('newProductModal');
    newProductForm = document.getElementById('new-product-form');
    formBarcode = document.getElementById('form-barcode');
    
    // NOTA: formOriginalBarcode es un input type="hidden" vital en arquitecturas web
    // para recordar qué estamos editando si el usuario decide cambiar el propio ID visible (código de barras).
    formOriginalBarcode = document.getElementById('form-original-barcode');
    
    formName = document.getElementById('form-name');
    formPrice = document.getElementById('form-price');

    // Cambiadores estéticos dinámicos
    modalIcon = document.getElementById('modal-icon');
    modalTitleText = document.getElementById('modal-title-text');
    modalHelpText = document.getElementById('modal-help-text');
    formSubmitText = document.getElementById('form-submit-text');

    // Evento Bootstrap Nativo (`hidden.bs.modal`) cuando el modal ha terminado su animación CSS de desvanecimiento "Cierre".
    if (newProductModalElement) {
        newProductModalElement.addEventListener('hidden.bs.modal', event => {
            if (onCloseCallback) onCloseCallback();
        });
    }

    // Interceptamos el "Guardar", quitando su comportamiento de enviar a otra web (HTTP POST real).
    if (newProductForm) {
        newProductForm.addEventListener('submit', handleSaveNewProduct);
    }
};

/**
 * Mutabilidad visual a "Modo: Creador" (Cuando la cámara escanea algo virgen/desconocido)
 * @param {string} barcodeText - Dígitos puros descubiertos por la cámara.
 * @param {number|null} injectedPrice - Si el código era un QR de charcutería, viene con precio impuesto.
 */
export const setupModalForNew = (barcodeText, injectedPrice = null) => {
    isEditingFromInventory = false; // Interruptor: MODO CREATE
    
    // 1. Camuflaje Front-end (Textos, iconos e instrucciones adaptadas)
    modalTitleText.textContent = "Nuevo Producto";
    modalIcon.className = "bi bi-plus-circle";
    modalHelpText.textContent = "El código de barras no se encuentra. Añádelo y se guardará para siempre.";
    formSubmitText.textContent = "Guardar y Añadir a la lista";
    
    // 2. Limpieza de Formularios (Descartar todo residuo de edición anterior)
    formOriginalBarcode.value = '';
    // Pegar el código que leyó la cámara para ahorrar tipado manual
    if (formBarcode) formBarcode.value = barcodeText; 
    if (formName) formName.value = '';
    // Pegar el precio solo si ha venido inyectado por la báscula/QR
    if (formPrice) formPrice.value = injectedPrice !== null ? injectedPrice : '';

    showModal();
};

/**
 * Mutabilidad visual a "Modo: Edición" (Cuando se usa el Lapicito azul)
 * @param {Object} product - La estructura JS pura del producto de nuestra base de datos.
 */
export const openProductModalForEdit = (product) => {
    isEditingFromInventory = true; // Interruptor: MODO UPDATE
    
    // 1. Camuflaje Front-end 
    modalTitleText.textContent = "Editar Producto";
    modalIcon.className = "bi bi-pencil-square";
    modalHelpText.textContent = "Modifica los valores. Si corriges el código de barras, se actualizará el registro.";
    formSubmitText.textContent = "Guardar Cambios";
    
    // 2. Re-hidratación (Rellenar inputs con lo viejo)
    // El "Escondido" que recuerda la identidad base:
    formOriginalBarcode.value = product.barcode; 
    // Los inputs manipulables físicos:
    formBarcode.value = product.barcode;
    formName.value = product.name;
    formPrice.value = product.price;
    
    showModal();
};

// Pequeño Wrapper Helper
const showModal = () => {
    if (!newProductModal) {
        newProductModal = new bootstrap.Modal(newProductModalElement);
    }
    newProductModal.show();
};

/**
 * El centro neurálgico del almacenamiento lógico que se dispara al enviar confirmación.
 */
const handleSaveNewProduct = (event) => {
    // 1. IMPORTANTE: Evita recargar / flashear la pantalla perdiendo la aplicación.
    event.preventDefault(); 
    
    // 2. Construcción de Modelo / Objeto
    const newProduct = {
        barcode: formBarcode.value.trim(),
        name: formName.value.trim(),
        price: parseFloat(formPrice.value) // Convierte "2,5" a 2.5 numérico utilizable en sumas
    };
    
    // 3. Escribir metadatos (Base Local). 
    // Pasa el id fantasma (formOriginalBarcode.value) por si cambió su código, para borrar el antiguo.
    db.saveOrUpdateProduct(newProduct, formOriginalBarcode.value || null);
    
    // 4. Lógica Derivada del Modo
    if (!isEditingFromInventory) {
       // A) Si fue escaneo nuevo de producto directo. Querremos meter la 1º unidad al carrito de compra real.
       db.addToCart(newProduct);
    } else {
       // B) Si estás editando, el producto puede estar ya listado en el medio del Carrito (y ahora vale distinto).
       // Truco Lógico: "Perseguirlo" en el Carrito para actualizarle visualmente su nuevo precio sin alterar su 'cantidad' actual!!
       let cart = db.getCart();
       const existingCartItem = cart.find(i => i.barcode === formOriginalBarcode.value || i.barcode === newProduct.barcode);
       if(existingCartItem) {
           existingCartItem.barcode = newProduct.barcode;
           existingCartItem.name = newProduct.name;
           existingCartItem.price = newProduct.price; // ¡El Carrito pasa ahora a sumar con el precio nuevo mágico!
           db.saveCart(cart); // Persistimos
       }
    }
    
    // 5. Cierre y Repintado
    if (newProductModal) newProductModal.hide(); // Pliega la solapa
    renderCart(); // Asegura el total recalcularlo
    
    // Extras de confort para fluidez visual: 
    // Si usaste la edición, quiere decir que estabas mirando el Inventario de fondo...
    if(isEditingFromInventory) {
        showInventoryModal(); // Se lo abrimos de nuevo amablemente
        renderInventory();    // ¡Repintado para que vea su nuevo precio reluciendo!
    }
};
