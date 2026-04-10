/**
 * Módulo de la Interfaz de Usuario (UI) para el Inventario o "Mi Catálogo Local".
 * Permite visualizar el total de la base de datos almacenada en memoria, buscar 
 * activamente utilizando expresiones e inyectar ventanas para editarlos si es necesario.
 */

import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import { renderCart } from './cart.js'; // Necesitamos repintar el cart si borramos un producto del catálogo
import Swal from 'sweetalert2';

// Patrón avanzado: 'Dependency Injection'.
// Guardamos una variable que contendrá una ruta hacia el modalEditar (de productModal.js)
// Para que se puedan abrir sin crear dependencias mutuas circulares (error de compilación).
let editProductCallback = null;

// Punteros al DOM (Se cargan en init)
let inventoryModalElement, inventoryList, emptyInventoryMsg, btnInventory, inventorySearch;
let btnExport, btnImport; 
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
    btnExport = document.getElementById('btn-export-catalog');
    btnImport = document.getElementById('btn-import-catalog');

    if (btnExport) {
        btnExport.addEventListener('click', handleExportCatalog);
    }
    
    if (btnImport) {
        btnImport.addEventListener('change', handleImportCatalog);
    }

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

// --- LÓGICA DE EXPORTACIÓN E IMPORTACIÓN ---

/**
 * Descarga la memoria local (LocalStorage) física a un archivo plano JSON utilizable portátilmente.
 */
const handleExportCatalog = () => {
    const products = db.getProductsDB();
    if(products.length === 0) {
        Swal.fire('Catálogo Vacío', 'Aún no tienes productos escaneados.', 'info');
        return;
    }

    // Convertimos la memoria a texto crudo (JSON) de forma espaciada y bonita (indentación = 2 espacios)
    const dataStr = JSON.stringify(products, null, 2);
    
    // Fabricamos un objeto tipo "Archivo Textual" flotante en memoria (Blob API del Navegador)
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Truco clásico web: Creamos un enlace <a> falso, le damos la url temporal, auto-clic invisible y lo borramos
    const a = document.createElement('a');
    a.href = url;
    // Le pones el título al archivo añadiéndole la fecha de hoy para diferenciar backups. (ej. mercat_catalog_2026-10-14.json)
    a.download = `mercat_catalog_${new Date().toISOString().slice(0,10)}.json`; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url); // Limpiamos memoria ram destruyendo la URL flotante
};

/**
 * Recibe un archivo JSON desde el input de PC/Móvil del usuario y lo lee asíncronamente para fusionarlo.
 */
const handleImportCatalog = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // FileReader es una API nativa de JavaScript que permite leer las entrañas de los archivos locales del móvil
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            // Intentamos descifrar (parse) el texto asumiendo que es un JSON puro
            const importedData = JSON.parse(e.target.result);
            
            if(!Array.isArray(importedData)) throw new Error("Formato alienígena no soportado.");

            // Dialogo de Alta Seguridad. Evita machaques no intencionados.
            Swal.fire({
                title: '¿Fusionar Catálogos?',
                text: `Se han detectado ${importedData.length} productos en la copia de seguridad. Se actualizarán los precios coincidentes y se añadirán los nuevos. ¡Tus productos propios no se borrarán!`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#0d6efd',
                confirmButtonText: 'Sí, fusionar e importar'
            }).then((result) => {
                if(result.isConfirmed) {
                    // Llamamos a la lógica interna que construimos en storage.js
                    const mergedCount = db.importProducts(importedData);
                    
                    renderInventory(); // Repintamos la ventana del modal que el usuario ya tiene abierta
                    renderCart();      // IMPORTANTÍSIMO: Si importé la BD de mi hermano y la leche que estaba en mi carro ahora es más barata, refrescamos el importe total global!
                    
                    Swal.fire('Copia Desplegada', `Se han asimilado ${mergedCount} productos correctamente a tu móvil.`, 'success');
                }
                event.target.value = ''; // Limpiar la huella del File Explorer. Así el usuario podrá subir el mismo archivo otra vez si lo borra.
            });

        } catch (error) {
            Swal.fire('Error de Lectura', 'El archivo está corrupto o no pertenece a Mercat App.', 'error');
            event.target.value = ''; // Limpiamos incluso en caso de error
        }
    };
    // Desencadena la lectura del archivo a texto por fin
    reader.readAsText(file);
};
