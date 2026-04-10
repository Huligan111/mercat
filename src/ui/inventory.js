/**
 * Módulo de la Interfaz de Usuario (UI) para el Inventario o "Mi Catálogo Local".
 * Permite visualizar el total de la base de datos almacenada en memoria, buscar 
 * activamente utilizando expresiones e inyectar ventanas para editarlos si es necesario.
 */

import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import { renderCart } from './cart.js'; // Necesitamos repintar el cart si borramos un producto del catálogo

// Patrón avanzado: 'Dependency Injection'.
// Guardamos una variable que contendrá una ruta hacia el modalEditar (de productModal.js)
// Para que se puedan abrir sin crear dependencias mutuas circulares (error de compilación).
let editProductCallback = null;

// Punteros al DOM (Se cargan en init)
let inventoryModalElement, inventoryList, emptyInventoryMsg, btnInventory, inventorySearch;
let inventoryModal = null; // Guardará la instancia nativa de la ventana Modal de Bootstrap

/**
 * Función inicial para enlazar los HTML
 * @param {Function} onEditProduct - El callback proveniente del módulo Modal.
 */
export const initInventoryUI = (onEditProduct) => {
    editProductCallback = onEditProduct; // Acoplamos la función

    inventoryModalElement = document.getElementById('inventoryModal');
    inventoryList = document.getElementById('inventory-list');
    emptyInventoryMsg = document.getElementById('empty-inventory-msg');
    btnInventory = document.getElementById('btn-inventory');
    inventorySearch = document.getElementById('inventory-search');

    // Listener para Abrir la ventana emergente gigante del "Inventario"
    if (btnInventory) {
        btnInventory.addEventListener('click', () => {
            // Reusamos la variable Modal si existe, si no, lo fabricamos sobre la marcha
            if(!inventoryModal) inventoryModal = new bootstrap.Modal(inventoryModalElement);
            
            // Cada vez que se abre, limpiamos cualquier búsqueda antigua para mayor comodidad
            if(inventorySearch) inventorySearch.value = ''; 
            
            renderInventory(); // Repintamos listado íntegro
            inventoryModal.show(); // Desplegamos animación de entrada
        });
    }

    // Buscador "En Tiempo Real"
    if(inventorySearch) {
        // 'input' se dispara no al pulsar enter, si no letra por letra (Instant Search)
        inventorySearch.addEventListener('input', (e) => {
            // Mandamos lo que ha tecleado el usuario para que renderInventory actúe
            renderInventory(e.target.value);
        });
    }
};

/**
 * Dibuja el catálogo completo filtrando si es necesario.
 * @param {string} searchTerm - Texto introducido a filtrar por código o nombre (Opcional, defecto='')
 */
export const renderInventory = (searchTerm = '') => {
    if (!inventoryList) return; // Seguro de ejecución
    
    // Solicitamos copia de toda la DB
    let products = db.getProductsDB();
    inventoryList.innerHTML = '';
    
    // Mecánica central de Filtro en Vivo
    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase(); // Homologamos todo a minúsculas
        products = products.filter(p => 
            p.barcode.toLowerCase().includes(term) || // Busca matches en los dígitos del código
            p.name.toLowerCase().includes(term)       // O busca matches en la descripción
        );
    }
    
    // Gestión del placeholder (si no hay resultados tras filtro O de forma normal)
    if (products.length === 0) {
        emptyInventoryMsg.classList.remove('d-none');
    } else {
        emptyInventoryMsg.classList.add('d-none'); // Quita la clase (display: none) de Bootstrap
        
        products.forEach(p => {
            const div = document.createElement('div');
            // Clases de utilidad Bootstrap para flexbox y sombreado estético
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
                    <!-- Borrado severo permanente rojo oscuro para máxima distinción visual -->
                    <button class="btn btn-outline-danger btn-delete-product" data-barcode="${p.barcode}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            inventoryList.appendChild(div);
        });
        
        // --- Asignación de Lógica en Botones Recién Inyectados ---

        // 1. Lógica para botón Borrar (del Inventario General)
        document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('button').dataset.barcode;
                // Usamos ventana Confirm nativa (clásica JavaScript y muy veloz)
                if(confirm('¿Eliminar producto del catálogo permanentemente?')) {
                    db.deleteProduct(code); // Borrado de LocalStorage
                    db.removeFromCart(code); // Cascada: Si lo borras del inventario, tienes que borrarlo del carrito activo
                    
                    renderCart(); // Actualizamos UI carro
                    renderInventory(); // Actualizamos UI modal inventario
                }
            });
        });

        // 2. Lógica para botón Editar
        document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('button').dataset.barcode;
                const prod = db.findProductByBarcode(code); // Coge datos actuales antes de editar
                
                if(prod) {
                    // Cierra amablemente y suave el modal gigante de catálogo
                    if(inventoryModal) inventoryModal.hide();
                    
                    // Inyecta los datos llamando al módulo modal (a través del callback inyectado en línea 11)
                    if(editProductCallback) editProductCallback(prod);
                }
            });
        });
    }
};

/**
 * Función auxiliar para permitir re-abrir modal general cómodamente 
 * una vez termines de editar un producto para evitar que te sientas "desorientado".
 */
export const showInventoryModal = () => {
    if(inventoryModal) inventoryModal.show();
}
