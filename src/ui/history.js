import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import Chart from 'chart.js/auto';
import Swal from 'sweetalert2';

/**
 * Punteros DOM para el Módulo de Historial
 */
let historyModalElement, btnHistory, chartModeSelect, canvasElement, receiptsList, emptyMsg;
let historyModal = null;
let expenseChart = null; // Guardará la instancia viva del gráfico en memoria local

/**
 * Inicializa los eventos y enlaza los elementos UI para el Historial de Compras.
 * Esta función es orquestada desde main.js al cargar la primera vez la PWA.
 */
export const initHistoryUI = () => {
    historyModalElement = document.getElementById('historyModal');
    btnHistory = document.getElementById('btn-history');
    chartModeSelect = document.getElementById('chart-mode-select');
    canvasElement = document.getElementById('expenseChart');
    receiptsList = document.getElementById('receipts-list');
    emptyMsg = document.getElementById('empty-history-msg');

    // Apertura del Panel
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            if(!historyModal) historyModal = new bootstrap.Modal(historyModalElement);
            renderHistory();
            historyModal.show();
        });
    }

    // Toggle de la Gráfica (Mensual/Diario)
    if (chartModeSelect) {
        chartModeSelect.addEventListener('change', () => {
            renderChart(chartModeSelect.value); // Repintar gráfica al cambiar la opción
        });
    }

    // Delegación de eventos para el botón 'Borrar Ticket' (Papelera)
    // Permite que la papelera funcione incluso si los tickets se han generado "al vuelo" dinámicamente en el DOM.
    if (receiptsList) {
        receiptsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-ticket');
            
            if(deleteBtn) {
                e.stopPropagation(); // Vital: Evitamos que Bootstrap expanda el Acordeón visualmente al pinchar en la basura

                const ticketId = parseInt(deleteBtn.getAttribute('data-id'), 10);
                
                // Confirmación visual blindada
                Swal.fire({
                    title: '¿Destruir Ticket?',
                    text: 'Se eliminará del historial permanentemente.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Sí, borrar',
                    cancelButtonText: 'Cancelar'
                }).then((res) => {
                    if(res.isConfirmed) {
                        db.deleteReceipt(ticketId);
                        renderHistory(); // Refrescar UI (Desaparecerá el bloque y bajará el gráfico)
                    }
                });
            }
        });
    }
};

/**
 * Genera de forma visual toda la lista HTML cruzándola con el Local Storage.
 * Agrega el contenido del Acordeón para detallar ítems del ticket.
 */
export const renderHistory = () => {
    const receipts = db.getReceipts();
    
    if(receipts.length === 0) {
        emptyMsg.classList.remove('d-none');
        receiptsList.innerHTML = '';
        if(expenseChart) expenseChart.destroy();
        return;
    } else {
        emptyMsg.classList.add('d-none');
    }

    // Renderizar lista (Orden descendente por fecha)
    receiptsList.innerHTML = '';
    const sorted = [...receipts].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    // Mostramos solo los últimos 15 tickets para no sobrecargar el dom
    sorted.slice(0, 15).forEach(r => { 
        const dateObj = new Date(r.date);
        const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
        
        const div = document.createElement('div');
        div.className = 'list-group-item p-0'; 
        
        let itemsHTML = '';
        // Si el ticket guarda el array de artículos, lo desgranamos en una mini lista interna
        if (r.items && Array.isArray(r.items)) {
            itemsHTML = `<ul class="list-group list-group-flush border-top small">`;
            r.items.forEach(item => {
                itemsHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center bg-light text-secondary">
                        <span class="text-truncate" style="max-width: 60%;"><i class="bi bi-caret-right text-muted"></i> ${item.name}</span>
                        <span>
                            <span class="badge bg-secondary me-2">${item.quantity}x</span>
                            ${(item.price * item.quantity).toFixed(2)} €
                        </span>
                    </li>
                `;
            });
            itemsHTML += `</ul>`;
        } else {
            itemsHTML = `<div class="p-3 text-muted small text-center">Detalle de existencias no disponible.</div>`;
        }

        const collapseId = `collapse-ticket-${r.id}`;

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center p-3" 
                 data-bs-toggle="collapse" 
                 data-bs-target="#${collapseId}" 
                 aria-expanded="false" 
                 aria-controls="${collapseId}" 
                 style="cursor: pointer; transition: background-color 0.2s;"
                 onmouseover="this.style.backgroundColor='#f8f9fa'"
                 onmouseout="this.style.backgroundColor='transparent'">
                <div>
                    <h6 class="mb-0 fw-bold">Ticket <small class="text-muted fw-normal">#${r.id.toString().slice(-4)}</small></h6>
                    <small class="text-muted"><i class="bi bi-calendar"></i> ${dateStr}</small><br>
                    <small class="text-primary mt-1 d-inline-block" style="text-decoration: underline dotted;"><i class="bi bi-eye"></i> Ver ${r.itemsCount} productos</small>
                </div>
                <!-- Área Cajas: Precio + Papelera -->
                <div class="d-flex align-items-center">
                    <span class="badge bg-success rounded-pill fs-6 shadow-sm me-3">${r.total.toFixed(2)} €</span>
                    <button class="btn btn-sm btn-outline-danger btn-delete-ticket shadow-sm" data-id="${r.id}" title="Eliminar Ticket">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            
            <!-- Interior Oculto: Expandible vía Bootstrap -->
            <div id="${collapseId}" class="collapse">
                ${itemsHTML}
            </div>
        `;
        receiptsList.appendChild(div);
    });

    renderChart(chartModeSelect.value);
};

/**
 * Carga e inyecta la Gráfica de Negocio Chart.js dentro del Canvas.
 * Destruye la previa en memoria si la hay para evitar el famoso bug de WebGL.
 * @param {string} mode - 'meses' o 'dias' para alternar filtrado de cálculos
 */
const renderChart = (mode) => {
    const receipts = db.getReceipts();
    if(receipts.length === 0) return;

    let labels = [];
    let dataSets = [];

    const now = new Date();

    if(mode === 'meses') {
        const year = now.getFullYear();
        const monthlyTotals = new Array(12).fill(0);
        
        receipts.forEach(r => {
            const d = new Date(r.date);
            if(d.getFullYear() === year) {
                monthlyTotals[d.getMonth()] += r.total;
            }
        });

        labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        dataSets = monthlyTotals;

    } else {
        const month = now.getMonth();
        const year = now.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const dailyTotals = new Array(daysInMonth).fill(0);
        labels = Array.from({length: daysInMonth}, (_, i) => `${i + 1}`);

        receipts.forEach(r => {
            const d = new Date(r.date);
            if(d.getFullYear() === year && d.getMonth() === month) {
                dailyTotals[d.getDate() - 1] += r.total;
            }
        });
        
        dataSets = dailyTotals;
    }

    if(expenseChart) {
        expenseChart.destroy();
    }

    expenseChart = new Chart(canvasElement, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto (€)',
                data: dataSets,
                backgroundColor: 'rgba(25, 135, 84, 0.5)', // Color Verde success con transparencia
                borderColor: 'rgba(25, 135, 84, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '€';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
};
