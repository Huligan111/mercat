import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import Swal from 'sweetalert2';

let shoppingListModalElement, btnShoppingList, shoppingListModal;
let inputElement, suggestionsBox, itemsContainer, emptyMsg, btnClear;

/**
 * Inicializador principal del Módulo de Lista de Tareas (Shopping List).
 * Enlaza los eventos DOM, incluyendo el buscador predictivo y los atajos de teclado.
 */
export const initShoppingListUI = () => {
    shoppingListModalElement = document.getElementById('shoppingListModal');
    btnShoppingList = document.getElementById('btn-shopping-list');
    inputElement = document.getElementById('shopping-list-input');
    suggestionsBox = document.getElementById('shopping-list-suggestions');
    itemsContainer = document.getElementById('shopping-list-items');
    emptyMsg = document.getElementById('shopping-list-empty');
    btnClear = document.getElementById('btn-clear-shopping-list');

    if (btnShoppingList) {
        btnShoppingList.addEventListener('click', () => {
            if(!shoppingListModal) shoppingListModal = new bootstrap.Modal(shoppingListModalElement);
            renderShoppingList();
            shoppingListModal.show();
        });
    }

    if (inputElement) {
        inputElement.addEventListener('input', handlePredictiveSearch);
        
        // Atajo teclado: Enter para añadir Texto Libre Rápido
        inputElement.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                const text = inputElement.value.trim();
                if(text !== '') {
                    addFreeTextItem(text);
                }
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
             Swal.fire({
                title: '¿Limpiar el Bloc?',
                text: 'Se borrarán todos los apuntes actuales.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                confirmButtonText: 'Sí, vaciar',
                cancelButtonText: 'Cancelar'
             }).then((res) => {
                 if(res.isConfirmed) {
                     db.setShoppingList([]);
                     renderShoppingList();
                 }
             });
        });
    }

    // Delegación de eventos para tachar o borrar tareas manualmente
    if (itemsContainer) {
        itemsContainer.addEventListener('click', (e) => {
            const itemKey = e.target.closest('li')?.dataset.id;
            if(!itemKey) return;
            
            // Si pulsa el botón de borrar (X pequeñita a la derecha)
            if (e.target.closest('.btn-delete-task')) {
                e.stopPropagation(); // Para no disparar el check
                deleteItem(itemKey);
                return;
            }

            // Si pulsan el contenido principal de la tarea
            toggleItemManualStatus(itemKey);
        });
    }
};

/**
 * Gestiona el Input predictivo interrogando al Catálogo Local en milisegundos.
 */
const handlePredictiveSearch = (e) => {
    const query = e.target.value.toLowerCase().trim();
    suggestionsBox.innerHTML = '';
    
    if (query === '') {
        suggestionsBox.classList.add('d-none');
        return;
    }

    const catalog = db.getProductsDB();
    const matches = catalog.filter(p => 
        p.name.toLowerCase().includes(query) || p.barcode.includes(query)
    ).slice(0, 5); // Tope visual por diseño para no empujar la UI

    if (matches.length > 0) {
        suggestionsBox.classList.remove('d-none');
        matches.forEach(m => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            li.style.cursor = 'pointer';
            li.innerHTML = `
                <span><i class="bi bi-box-seam text-secondary me-2"></i> ${m.name}</span>
                <span class="badge bg-light text-dark shadow-sm border">${m.price.toFixed(2)}€</span>
            `;
            li.addEventListener('click', () => addCatalogItem(m));
            suggestionsBox.appendChild(li);
        });
    }
    
    // Siempre enseñamos el botón final de escape "Añadir como texto libre"
    suggestionsBox.classList.remove('d-none');
    const freeTextLi = document.createElement('li');
    freeTextLi.className = 'list-group-item list-group-item-action text-primary fw-bold';
    freeTextLi.style.cursor = 'pointer';
    freeTextLi.innerHTML = `<i class="bi bi-plus-circle me-1"></i> Añadir "${e.target.value}" sin catalogar`;
    freeTextLi.addEventListener('click', () => addFreeTextItem(e.target.value));
    suggestionsBox.appendChild(freeTextLi);
}

/**
 * Agrega un elemento directamente seleccionado desde el autocompletado (Catálogo).
 * Al ser un elemento catalogado, el sistema sabrá su código de barras y podrá auto-tacharlo.
 * @param {Object} product - Objeto del producto a añadir.
 */
const addCatalogItem = (product) => {
    const list = db.getShoppingList();
    list.push({
        id: Date.now().toString(),
        type: 'catalog',
        barcode: product.barcode,
        name: product.name,
        done: false
    });
    db.setShoppingList(list);
    
    inputElement.value = '';
    suggestionsBox.classList.add('d-none');
    renderShoppingList();
};

/**
 * Agrega una anotación libre cuando el usuario presiona Enter o escoge "Añadir sin catalogar".
 * Estos elementos requieren tachado manual táctil (Click).
 * @param {string} text - El texto introducido por el usuario.
 */
const addFreeTextItem = (text) => {
    const list = db.getShoppingList();
    list.push({
        id: Date.now().toString(),
        type: 'freetext',
        name: text,
        done: false
    });
    db.setShoppingList(list);
    
    inputElement.value = '';
    suggestionsBox.classList.add('d-none');
    renderShoppingList();
};

/**
 * Alterna (Toggle) el estado matemático de la tarea entre Pendiente (false) y Realizada (true).
 * Utilizado por el Auto-Strikethrough y los Clics manuales en el bloc.
 * @param {string} id - Identificador único Timestamp de la tarea.
 */
const toggleItemManualStatus = (id) => {
    const list = db.getShoppingList();
    const item = list.find(i => i.id === id);
    if(item) {
        item.done = !item.done; // Invertir Estado Matemático
        db.setShoppingList(list);
        renderShoppingList();
    }
};

/**
 * Borra una tarea de la lista definitivamente (Icono de la Cruz).
 * @param {string} id - Identificador único de la tarea a eliminar.
 */
const deleteItem = (id) => {
    let list = db.getShoppingList();
    list = list.filter(i => i.id !== id);
    db.setShoppingList(list);
    renderShoppingList();
};

/**
 * Renderiza visualmente la lista de tareas en el HTML, aplicando estilos
 * grises u opacos dependiendo de su estado matemático `done`.
 */
export const renderShoppingList = () => {
    if(!itemsContainer) return;
    const list = db.getShoppingList();
    
    itemsContainer.innerHTML = '';
    
    if (list.length === 0) {
        emptyMsg.classList.remove('d-none');
        return;
    } else {
        emptyMsg.classList.add('d-none');
    }

    list.forEach(item => {
        const li = document.createElement('li');
        li.dataset.id = item.id;
        
        let iconHtml = '';
        let decorationClass = '';
        let bgColor = '';

        if(item.done) {
            iconHtml = `<i class="bi bi-check-circle-fill text-success fs-5 me-3"></i>`;
            decorationClass = 'text-decoration-line-through text-muted';
            bgColor = 'bg-light';
        } else {
            iconHtml = `<i class="bi bi-circle text-secondary fs-5 me-3"></i>`;
            decorationClass = 'fw-bold text-dark';
            bgColor = 'bg-white';
        }

        const tagBadge = item.type === 'catalog' 
            ? `<span class="badge bg-secondary ms-2 opacity-50 fw-normal border" style="font-size: 0.65rem;">Catálogo</span>` 
            : ``;

        li.className = `list-group-item d-flex justify-content-between align-items-center ${bgColor}`;
        li.style.cursor = 'pointer';

        li.innerHTML = `
            <div class="d-flex align-items-center w-100">
                ${iconHtml}
                <div class="flex-grow-1 ${decorationClass}">
                    ${item.name} ${tagBadge}
                </div>
                <button class="btn btn-sm text-secondary btn-delete-task opacity-50 px-2" title="Quitar Apunte">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `;
        itemsContainer.appendChild(li);
    });
};

/**
 * Ojo Crítico: Esta función cruza el universo del 'Carrito' con el de la 'Lista'.
 * @param {Array} cart - Arrays de objetos subidos al carrito de la compra actual
 */
export const syncAutoStrikethrough = (cart) => {
    let list = db.getShoppingList();
    let hasChanges = false;

    list.forEach(listItem => {
        if (listItem.type === 'catalog') {
            // El usuario ha metido al carro el código de barras exacto que pre-ajustó en la lista
            const inCart = cart.some(cartItem => cartItem.barcode === listItem.barcode);
            if (inCart && !listItem.done) {
                listItem.done = true; // Ta-chan! Techamos el item autmático
                hasChanges = true;
            } else if (!inCart && listItem.done) {
                 // Si lo retira del carro, el item de la lista debe despintarse para volver a estar "Pendiente"
                 listItem.done = false;
                 hasChanges = true;
            }
        }
        // Los Textos Libres ('freetext') ignoran el Auto-Strikethrough para proteger la experiencia del usuario (lo pulsan manualmente si lo ven).
    });

    if (hasChanges) {
        db.setShoppingList(list);
        if(itemsContainer) renderShoppingList(); // Re-render solo si mutó algo en background
    }
};
