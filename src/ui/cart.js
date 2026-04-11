/**
 * Módulo de la Interfaz de Usuario (UI) para el Carrito de Compras.
 * Se encarga de pintar la tabla dinámica con los productos escaneados,
 * calcular los totales y asignar eventos a los botones (+, -, Borrar).
 */

import * as db from '../storage.js';
import Swal from 'sweetalert2';
import { syncAutoStrikethrough } from './shoppingList.js';

// Referencias al DOM (Almacenadas a nivel de módulo por rendimiento)
let cartItemsContainer, cartTotalElement, emptyCartMsg, btnClearCart, btnCheckout;
let btnSetBudget, budgetDisplay, budgetAmountDisplay;
let currentCartTotal = 0; // Guardará en RAM la suma para cuando el usuario presione Finalizar Compra

/**
 * Inicializador principal del UI del Carrito.
 * Atrapa los elementos del DOM solo una vez cuando la app arranca.
 */
export const initCartUI = () => {
    cartItemsContainer = document.getElementById('cart-items');
    cartTotalElement = document.getElementById('cart-total');
    emptyCartMsg = document.getElementById('empty-cart-msg');
    btnClearCart = document.getElementById('btn-clear-cart');
    btnCheckout = document.getElementById('btn-checkout');
    btnSetBudget = document.getElementById('btn-set-budget');
    budgetDisplay = document.getElementById('budget-display');
    budgetAmountDisplay = document.getElementById('budget-amount');

    // Manejador del Sistema de Presupuestos (Pregunta al usuario y activa el techo de gasto)
    if (btnSetBudget) {
        btnSetBudget.addEventListener('click', () => {
            Swal.fire({
                title: 'Presupuesto Máximo',
                text: '¿Cuánto quieres gastar como máximo en esta compra? (El total pitará si te pasas. Usa 0 para desactivar)',
                input: 'number',
                inputAttributes: { min: 0, step: 1 },
                inputValue: db.getBudget() || '',
                showCancelButton: true,
                confirmButtonColor: '#0d6efd',
                confirmButtonText: 'Fijar Límite',
                cancelButtonText: 'Cancelar'
            }).then(result => {
                if(result.isConfirmed) {
                    const limit = parseFloat(result.value) || 0;
                    db.setBudget(limit);
                    
                    // Forzar repintado inmediato para que el Footer reaccione y decida si debe latir en rojo
                    renderCart(); 
                    
                    if (limit > 0) {
                        Swal.fire({ 
                            title: '¡Vigilando!', 
                            text: `Avisaremos si cruzas la barrera de los ${limit}€`, 
                            icon: 'success', 
                            timer: 2000, 
                            showConfirmButton: false 
                        });
                    }
                }
            });
        });
    }

    // Asignamos el evento al botón general de "Vaciar Carrito"
    if (btnClearCart) {
        btnClearCart.addEventListener('click', () => {
            const cart = db.getCart();
            // Prevención: Si no hay items, no preguntamos nada para evitar molestos pop-ups innecesarios.
            if (cart.length === 0) return; 
            
            // Lanzamos un modal elegante con efecto visual oscurecido para pedir confirmación
            Swal.fire({
              title: '¿Vaciar Lista?',
              text: "Se eliminarán todos los elementos escaneados de esta compra.",
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#dc3545', // Código CSS de nuestro rojo Bootstrap
              cancelButtonColor: '#6c757d',
              confirmButtonText: 'Sí, vaciar',
              cancelButtonText: 'Cancelar',
              backdrop: `rgba(0,0,0,0.5)`
            }).then((result) => {
              if (result.isConfirmed) {
                  // Si el usuario acepta, llamamos a la capa de datos (storage) y repintamos
                  db.clearCart();
                  renderCart();
                  
                  // Notificación final rápida
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
    }

    // Nuevo manejador de evento para el Checkout protegido con Confirmación Visual Cuidada y Prevención de Tareas
    if (btnCheckout) {
        btnCheckout.addEventListener('click', () => {
            const cart = db.getCart();
            if (cart.length === 0) return;

            // Verificamos el Ángel de la Guarda (Lista de Tareas Inteligente)
            const shoppingList = db.getShoppingList();
            const pendingItems = shoppingList.filter(item => !item.done);
            
            let warningHtml = '';
            if (pendingItems.length > 0) {
                 const names = pendingItems.map(i => `<li>${i.name}</li>`).join('');
                 warningHtml = `<div class="alert alert-danger text-start mt-3 border-0 shadow-sm" style="font-size: 0.9rem;">
                                   <strong><i class="bi bi-exclamation-triangle"></i> ¡ATENCIÓN!</strong> Tienes apuntes sin tachar:
                                   <ul class="mb-0 mt-1 pl-3">${names}</ul>
                                </div>`;
            }

            Swal.fire({
                title: '¿Compra Finalizada?',
                html: `Se guardará en el Historial tu ticket por importe de <strong>${currentCartTotal.toFixed(2)}€</strong> y se limpiará el carro.
                       ${warningHtml}`,
                icon: pendingItems.length > 0 ? 'warning' : 'question',
                showCancelButton: true,
                confirmButtonColor: pendingItems.length > 0 ? '#dc3545' : '#198754', // Uso del Rojo si hay peligro, o Verde si todo OK
                cancelButtonColor: '#6c757d',
                confirmButtonText: pendingItems.length > 0 ? 'Ignorar y Pagar' : 'Finalizar y Pagar',
                cancelButtonText: 'Cancelar',
                backdrop: `rgba(0,0,0,0.7)` 
            }).then((result) => {
                if(result.isConfirmed) {
                    // Guardamos el recibo (Ticket) mandándole la Inyección al Storage
                    db.saveReceipt(currentCartTotal, cart);
                    
                    // Limpiamos Carro permanentemente
                    db.clearCart();
                    
                    // Preguntamos amablemente si purgamos la lista pre-vuelo también
                    if(shoppingList.length > 0) {
                         Swal.fire({
                              title: '¡Compra Registrada!',
                              text: '¿Quieres que vacíe por completo también tu Bloc de Notas para la próxima vez?',
                              icon: 'question',
                              showCancelButton: true,
                              confirmButtonText: 'Sí, limpiar Bloc',
                              cancelButtonText: 'Mantener Bloc'
                         }).then(r => {
                              if(r.isConfirmed) db.setShoppingList([]); // Limpiamos tabla
                              renderCart();
                         });
                    } else {
                        renderCart();
                        Swal.fire({
                            title: '¡Guardado!',
                            text: 'El ticket contable se generó y ya es visible en gráficas.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                }
            });
        });
    }
};

/**
 * Función vital que renderiza visualmente toda la información de la cesta en la tabla HTML.
 * Debe ser invocada siempre que el carrito sufra cualquier mutación (añadir, quitar, sumar cantidad).
 */
export const renderCart = () => {
    if (!cartItemsContainer) return; // Seguridad: no hacer nada si el HTML falló
    
    const cart = db.getCart();
    
    // Limpiamos todo el interior de la tabla antes de reconstruirla (para evitar duplicados)
    cartItemsContainer.innerHTML = '';
    
    let totalAcumulado = 0; // Acumulador matemático global del coste

    // Gestión del Estado Vacío: Ocultamos tabla y mostramos mensaje amigable
    if (cart.length === 0) {
        emptyCartMsg.style.display = 'block';
        cartTotalElement.textContent = '0.00 €';
        return;
    } else {
        emptyCartMsg.style.display = 'none';
    }

    // Iteramos por la matriz del array guardado en localStorage
    cart.forEach(item => {
        // Multiplicamos el coste unitario por la cantidad para el subtotal de fila
        const itemSubtotal = item.price * item.quantity;
        totalAcumulado += itemSubtotal;
        
        // Creamos dinámicamente un tag HTML <tr> (Fila de tabla)
        const tr = document.createElement('tr');
        
        // Usamos plantillas literales para inyectar variables en el string de HTML
        tr.innerHTML = `
            <td class="ps-3 fw-medium align-middle">
                ${item.name}
            </td>
            <td class="text-center align-middle py-3">
                <!-- Selectores de cantidad con diseño botonera tipo "Controlador" -->
                <div class="btn-group btn-group-sm mb-2" role="group" style="box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <button type="button" class="btn btn-outline-primary btn-decrease" data-id="${item.uniqueId || item.barcode}">-</button>
                    <!-- El número intermedio no es clicleable (disabled) solo tiene función visual -->
                    <button type="button" class="btn btn-outline-primary fw-bold" disabled style="color: black;">${item.quantity}</button>
                    <button type="button" class="btn btn-outline-primary btn-increase" data-id="${item.uniqueId || item.barcode}">+</button>
                </div>
                <!-- Mini etiqueta verde para recordar el precio original de la unidad -->
                <div class="fw-bold text-success fs-5">
                    ${item.price.toFixed(2)}€
                </div>
            </td>
            <td class="text-end fw-bold align-middle fs-6">
                <!-- Muestra del subtotal redondeado a 2 decimales para evitar errores de coma flotante -->
                ${itemSubtotal.toFixed(2)}€
            </td>
            <td class="align-middle">
                <!-- Botón eliminar sin bordes y color suave para no ensuciar la visual -->
                <button class="btn btn-sm text-danger btn-delete border-0" data-id="${item.uniqueId || item.barcode}">
                    <i class="bi bi-trash3 fs-5"></i>
                </button>
            </td>
        `;
        // Lo anclamos físicamente a nuestro contenedor en el DOM
        cartItemsContainer.appendChild(tr);
    });

    // Actualizamos el sumatorio global que irá en la parte inferior adhesiva de la app (footer)
    cartTotalElement.textContent = `${totalAcumulado.toFixed(2)} €`;
    currentCartTotal = totalAcumulado; // Metemos la cantidad final en Caché para que btnCheckout pueda leerla
    
    // --- Lógica del Presupuesto Máximo (Animación visual de Peligro) ---
    const currentBudget = db.getBudget();
    if (currentBudget > 0 && budgetDisplay && budgetAmountDisplay) {
        // Enseñar rótulo pequeñito de 'Max: X€'
        budgetDisplay.classList.remove('d-none');
        budgetAmountDisplay.textContent = currentBudget;
        
        if (totalAcumulado > currentBudget) {
            // [CRÍTICO] Presupuesto superado: Cambiar clase inerte azul por animación 'latido' roja
            cartTotalElement.classList.remove('text-primary');
            cartTotalElement.classList.add('budget-warning');
        } else {
            // [SEGURO] Presupuesto bajo control: Volver al azul corporativo Bootstrap
            cartTotalElement.classList.remove('budget-warning');
            cartTotalElement.classList.add('text-primary');
        }
    } else {
        // [DESACTIVADO] El usuario no ha fijado límites
        if (budgetDisplay) budgetDisplay.classList.add('d-none');
        cartTotalElement.classList.remove('budget-warning');
        cartTotalElement.classList.add('text-primary');
    }
    
    // Inyección de escuchas de eventos (Vital ya que los botones son recreados de 0 en el HTML de arriba)
    attachCartButtonListeners();

    // Auto-Strikethrough: Activamos el cruce con la DB de Notas Locales silenciosamente
    syncAutoStrikethrough(cart);
};

/**
 * Función interna para unir clics de ratón/pantalla a los botones dinámicos.
 * Al usar '.forEach' nos aseguramos de que TODO icono de 'Restar' actúe sobre SU propio producto 
 * usando el atributo 'data-barcode'
 */
const attachCartButtonListeners = () => {
    // Escucha para restar cantidad
    document.querySelectorAll('.btn-decrease').forEach(btn => {
        btn.addEventListener('click', (e) => {
            db.decreaseQuantity(e.target.dataset.id);
            renderCart(); // Forzamos refresco gráfico tras descontar
        });
    });

    // Escucha para sumar cantidad
    document.querySelectorAll('.btn-increase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            db.increaseQuantity(e.target.dataset.id);
            renderCart(); // Forzamos refresco gráfico
        });
    });

    // Escucha para eliminar la fila entera de un plumazo
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Buscamos el origen del botón más cercano resolviendo el problema de hacer tap en el icono basura
            const itemId = e.target.closest('button').dataset.id;
            db.removeFromCart(itemId);
            renderCart(); 
        });
    });
};
