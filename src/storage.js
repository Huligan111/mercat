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
 * @param {Object} product - El producto que leemos del scanner o formulario.
 */
export const addToCart = (product) => {
    const cart = getCart(); // Obtenemos la lista actual
    
    // Buscamos si este producto ya ha sido añadido al carrito previamente
    const existingItem = cart.find(item => item.barcode === product.barcode);
    
    if (existingItem) {
        // Si existe, modificamos el objeto original sumando 1 a la cantidad de ese item
        existingItem.quantity += 1;
    } else {
        // Si no existe, lo metemos en el carrito con cantidad inicial 1
        // Usamos el "spread operator" (...) Moderno de JS para crear un nuevo objeto combinando propiedades
        cart.push({ ...product, quantity: 1 });
    }
    
    // Guardamos el carrito actualizado permanentemente
    saveCart(cart);
};

/**
 * Aumenta la cantidad explícitamente en el carrito
 * @param {string} barcode 
 */
export const increaseQuantity = (barcode) => {
    const cart = getCart();
    const item = cart.find(item => item.barcode === barcode);
    if(item) {
        item.quantity += 1;
        saveCart(cart);
    }
}

/**
 * Elimina completamente un producto del carrito, sin importar la cantidad.
 * Utiliza el método moderno `.filter()` para quitarlo de forma inmutable y elegante.
 * @param {string} barcode - Código de barras del producto a eliminar.
 */
export const removeFromCart = (barcode) => {
    let cart = getCart();
    // Filtramos para quedarnos con todos los productos MENOS el que queremos eliminar
    cart = cart.filter(item => item.barcode !== barcode);
    saveCart(cart);
};

/**
 * Disminuye la cantidad de un producto. Si llega a 0, se elimina automáticamente.
 * @param {string} barcode - Código de barras del producto.
 */
export const decreaseQuantity = (barcode) => {
    let cart = getCart();
    // Obtenemos el índice exacto en el array usando findIndex
    const itemIndex = cart.findIndex(item => item.barcode === barcode);
    
    if (itemIndex > -1) {
        cart[itemIndex].quantity -= 1;
        // Si la cantidad baja a cero, lo quitamos completamente de la lista usando splice
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1); // Splice remueve 1 unidad desde la posición itemIndex
        }
    }
    saveCart(cart);
};

/**
 * Vacía el carrito por completo simulando pagar la compra.
 */
export const clearCart = () => setStorage(CART_KEY, []);
