/**
 * Módulo de Almacenamiento (Storage Module)
 * Gestiona todas las interacciones con el LocalStorage del navegador.
 * Este módulo actúa como nuestra "Base de Datos" sin necesidad de un backend.
 * Está programado utilizando ESModules (export) y funciones flecha modernas.
 */

// --- CLAVES PARA LOCALSTORAGE ---
// Utilizamos constantes para evitar errores tipográficos al buscar las claves en la memoria.
const PRODUCTS_KEY = 'mercat_products_db';
const CART_KEY = 'mercat_active_cart';
const RECEIPTS_KEY = 'mercat_receipts_history';
const BUDGET_KEY = 'mercat_budget';
const SHOPPING_LIST_KEY = 'mercat_shopping_list';

// --- CONFIGURACIÓN INDEXEDDB (Para almacenamiento pesado de fotos) ---
const IDB_NAME = 'MercatDB';
const IDB_STORE = 'receipts';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

/**
 * Función genérica de flecha para obtener datos de LocalStorage.
 * @param {string} key - La clave donde están guardados los datos.
 * @param {any} defaultValue - El valor por defecto si no existen datos.
 * @returns {any} Los datos parseados o el valor por defecto.
 */
const getStorage = (key, defaultValue) => {
    try {
        const item = localStorage.getItem(key);
        // Si hay algo, lo parseamos de string JSON a un objeto/array de JS. Si no, retornamos por defecto.
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error leyendo ${key} de LocalStorage:`, error);
        return defaultValue;
    }
};

/**
 * Función genérica para guardar datos en LocalStorage.
 * @param {string} key - La clave donde guardar.
 * @param {any} data - Los datos (arrays/objetos) a guardar.
 */
const setStorage = (key, data) => {
    try {
        // Convertimos el objeto de JS a un string JSON para poder almacenarlo en LocalStorage.
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error guardando ${key} en LocalStorage:`, error);
    }
};

// ==========================================
// GESTIÓN DE LA BASE DE DATOS DE PRODUCTOS
// ==========================================

/**
 * Obtiene todos los productos registrados previamente.
 * @returns {Array} Un array de objetos de productos.
 */
export const getProductsDB = () => getStorage(PRODUCTS_KEY, []);

/**
 * Busca un producto en la base local por su código de barras.
 * Utiliza el método moderno `.find()` de los arrays.
 * @param {string} barcode - Código de barras a buscar.
 * @returns {Object|undefined} El producto si existe, o undefined.
 */
export const findProductByBarcode = (barcode) => {
    const products = getProductsDB();
    return products.find(product => product.barcode === barcode);
};

/**
 * Guarda o actualiza un producto en la "Base de Datos" del LocalStorage.
 * Admite reemplazo si se cambia el código de barras original durante la edición.
 * @param {Object} product - El producto a guardar {barcode, name, price}
 * @param {string} oldBarcode - (Opcional) El código de barras original antes de modificar
 */
export const saveOrUpdateProduct = (product, oldBarcode = null) => {
    let products = getProductsDB();
    
    // Si estamos editando y han cambiado el código de barras, eliminamos el viejo para no duplicar
    if (oldBarcode && oldBarcode !== product.barcode) {
        products = products.filter(p => p.barcode !== oldBarcode);
    }
    
    // Comprobamos si el producto a guardar ya existe
    const index = products.findIndex(p => p.barcode === product.barcode);
    if (index > -1) {
        // Si existe, lo sobre-escribimos (Actualiza precio/nombre)
        products[index] = product;
    } else {
        // Instancia completamente nueva
        products.push(product);
    }
    
    // Sobrescribimos el LocalStorage con el nuevo array completo
    setStorage(PRODUCTS_KEY, products);
};

/**
 * Elimina un producto definitivamente de la Base de Datos Local
 * @param {string} barcode 
 */
export const deleteProduct = (barcode) => {
    let products = getProductsDB();
    products = products.filter(p => p.barcode !== barcode);
    setStorage(PRODUCTS_KEY, products);
};

/**
 * Fusiona un array de productos importados con la Base de Datos actual.
 * Si el producto existe, actualiza su precio/nombre. Si no, lo crea nuevo.
 * @param {Array} importedArray - Lista de productos proveniente de un archivo JSON
 * @returns {number} La cantidad de productos fusionados/añadidos exitosamente
 */
export const importProducts = (importedArray) => {
    let products = getProductsDB();
    let mergeCount = 0;
    
    if(!Array.isArray(importedArray)) return 0; // Escudo protector contra archivos corruptos

    importedArray.forEach(importedProd => {
        // Validación básica de integridad (Garantiza que no importemos basura)
        if(importedProd && importedProd.barcode && importedProd.name !== undefined) {
            
            // Forzamos numérico el precio por precaución
            const safeProduct = {
                barcode: String(importedProd.barcode),
                name: String(importedProd.name),
                price: parseFloat(importedProd.price) || 0
            };

            const index = products.findIndex(p => p.barcode === safeProduct.barcode);
            if (index > -1) {
                products[index] = safeProduct; // Actualiza registro
            } else {
                products.push(safeProduct); // Añade registro nuevo
            }
            mergeCount++;
        }
    });

    setStorage(PRODUCTS_KEY, products); // Guardamos lista entera permanentemente
    return mergeCount;
};

// ==========================================
// GESTIÓN DEL CARRITO DE LA COMPRA (ACTIVE CART)
// ==========================================

/**
 * Obtiene el estado actual del carrito de la compra.
 * @returns {Array} Array con los items actuales del carrito.
 */
export const getCart = () => getStorage(CART_KEY, []);

/**
 * Guarda el estado actual del carrito en LocalStorage.
 * @param {Array} cart - El carrito completo a guardar.
 */
export const saveCart = (cart) => setStorage(CART_KEY, cart);

/**
 * Añade un producto al carrito. Si ya existe, incrementa su cantidad.
 * IMPORTANTE: Si es de precio variable (charcutería), ocupa fila separada.
 * @param {Object} product - El producto que leemos del scanner o formulario.
 */
export const addToCart = (product) => {
    const cart = getCart(); // Obtenemos la lista actual
    
    // Asignación de ID Único: Si es Variable se firma criptográficamente para no mezclarse
    const itemUniqueId = product.isVariablePrice 
        ? `${product.barcode}_${Date.now()}`
        : product.barcode;
    
    // Buscamos coincidencia estricta
    const existingItem = cart.find(item => item.uniqueId === itemUniqueId);
    
    if (existingItem && !product.isVariablePrice) {
        // Si existe y es normal, sumamos 1 a la pila
        existingItem.quantity += 1;
    } else {
        // En caso contrario (Nuevo o Variable), creamos fila virgen
        cart.push({ ...product, uniqueId: itemUniqueId, quantity: 1 });
    }
    
    saveCart(cart);
};

/**
 * Aumenta la cantidad explícitamente en el carrito
 * @param {string} uniqueId 
 */
export const increaseQuantity = (uniqueId) => {
    const cart = getCart();
    const item = cart.find(item => item.uniqueId === uniqueId);
    if(item) {
        item.quantity += 1;
        saveCart(cart);
    }
}

/**
 * Elimina completamente una fila del carrito.
 * @param {string} uniqueId - ID primario a eliminar.
 */
export const removeFromCart = (uniqueId) => {
    let cart = getCart();
    cart = cart.filter(item => item.uniqueId !== uniqueId);
    saveCart(cart);
};

/**
 * Disminuye la cantidad de una fila. Si llega a 0, se elimina automáticamente.
 * @param {string} uniqueId - ID primario de la fila.
 */
export const decreaseQuantity = (uniqueId) => {
    let cart = getCart();
    const itemIndex = cart.findIndex(item => item.uniqueId === uniqueId);
    
    if (itemIndex > -1) {
        cart[itemIndex].quantity -= 1;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    saveCart(cart);
};

/**
 * Vacía el carrito por completo simulando pagar la compra.
 */
export const clearCart = () => setStorage(CART_KEY, []);

// ==========================================
// GESTIÓN DEL HISTORIAL DE COMPRAS (TICKETS)
// ==========================================

/**
 * Migra los tickets del antiguo LocalStorage al nuevo IndexedDB.
 * Se ejecuta una sola vez al cargar la App.
 */
export const migrateReceiptsToIDB = async () => {
    const oldReceipts = getStorage(RECEIPTS_KEY, null);
    if (oldReceipts && Array.isArray(oldReceipts)) {
        console.log("Migrando tickets a IndexedDB...");
        for (const r of oldReceipts) {
            await saveReceipt(r.total, r.items, null, r.id, r.date);
        }
        localStorage.removeItem(RECEIPTS_KEY); // Limpiamos rastro
        console.log("Migración completada.");
    }
};

/**
 * Obtiene el historial completo de compras guardadas (Desde IndexedDB).
 * @returns {Promise<Array>} Array con todos los tickets históricos.
 */
export const getReceipts = async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, 'readonly');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Guarda un ticket en memoria tras finalizar compra.
 * @param {number} totalAmount - Total de la compra en euros
 * @param {Array} items - Los elementos comprados
 * @param {string|null} image - Foto del tiquet en Base64 (opcional)
 */
export const saveReceipt = async (totalAmount, items, image = null, forceId = null, forceDate = null) => {
    const db = await openDB();
    const newReceipt = {
        id: forceId || Date.now(),
        date: forceDate || new Date().toISOString(),
        total: totalAmount,
        itemsCount: items.length,
        items: items,
        image: image // ¡Aquí guardamos la foto comprimida!
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, 'readwrite');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.put(newReceipt);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Actualiza la imagen de un ticket ya existente.
 * @param {number} ticketId - ID primordial del ticket
 * @param {string} imageBase64 - Nueva imagen comprimida
 */
export const updateReceiptImage = async (ticketId, imageBase64) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, 'readwrite');
        const store = transaction.objectStore(IDB_STORE);
        
        // Buscamos el original
        const getRequest = store.get(ticketId);
        
        getRequest.onsuccess = () => {
            const ticket = getRequest.result;
            if (ticket) {
                // Inyectamos la foto y sobreescribimos
                ticket.image = imageBase64;
                const putRequest = store.put(ticket);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error("Ticket no localizado"));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

/**
 * Elimina definitivamente un ticket del Historial de Compras.
 * @param {number} ticketId - El Timestamp o ID exacto del ticket a exterminar 
 */
export const deleteReceipt = async (ticketId) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, 'readwrite');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.delete(ticketId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// ==========================================
// GESTIÓN DEL LÍMITE PRESUPUESTARIO
// ==========================================

/**
 * Recupera el Presupuesto Límite guardado en base de datos.
 * @returns {number} Cantidad límite (0 si no se ha configurado ninguno)
 */
export const getBudget = () => {
    const data = getStorage(BUDGET_KEY);
    return data ? parseFloat(data) : 0;
};

/**
 * Fija un techo máximo de gasto para el usuario.
 * @param {number} amount - Euros netos límite.
 */
export const setBudget = (amount) => {
    setStorage(BUDGET_KEY, amount);
};

// ==========================================
// GESTIÓN DE LA LISTA DE LA COMPRA (PRE-VUELO)
// ==========================================

export const getShoppingList = () => getStorage(SHOPPING_LIST_KEY, []);

export const setShoppingList = (list) => setStorage(SHOPPING_LIST_KEY, list);

