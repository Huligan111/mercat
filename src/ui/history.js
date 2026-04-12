import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Swal from 'sweetalert2';
import panzoom from 'panzoom';
import { compressImage } from '../utils/imageProcessor.js';
import { startCropping } from './cropperUI.js';

/**
 * Punteros DOM para el Módulo de Historial
 */
let historyModalElement, btnHistory, chartModeSelect, canvasElement, receiptsList, emptyMsg;
let historyModal = null;
let viewTicketModal = null; // Nuevo modal visor de imagen
let panzoomInstance = null; // Instancia de zoom para el tiquet
let expenseChart = null; // Guardará la instancia viva del gráfico en memoria local

/**
 * Inicializa los eventos y enlaza los elementos UI para el Historial de Compras.
 * Esta función es orquestada desde main.js al cargar la primera vez la PWA.
 */
/**
 * Inicializa los eventos y enlaza los elementos UI para el Historial de Compras.
 * Configura la delegación de eventos para borrar tickets, ver fotos con zoom y añadir fotos nuevas.
 */
export const initHistoryUI = () => {
    historyModalElement = document.getElementById('historyModal');
    btnHistory = document.getElementById('btn-history');
    chartModeSelect = document.getElementById('chart-mode-select');
    canvasElement = document.getElementById('expenseChart');
    receiptsList = document.getElementById('receipts-list');
    emptyMsg = document.getElementById('empty-history-msg');

    // Apertura del Panel de Historial
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            if(!historyModal) historyModal = new bootstrap.Modal(historyModalElement);
            renderHistory();
            historyModal.show();
        });
    }

    // Cambio entre vista mensual y diaria de la gráfica
    if (chartModeSelect) {
        chartModeSelect.addEventListener('change', () => {
            renderChart(chartModeSelect.value);
        });
    }

    // Delegación de eventos para interacción con tickets individuales (Borrar, Ver Foto, Añadir Foto)
    if (receiptsList) {
        receiptsList.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete-ticket');
            const viewPhotoBtn = e.target.closest('.btn-view-photo');
            const addPhotoBtn = e.target.closest('.btn-add-photo');
            
            // Lógica de borrado de ticket
            if(deleteBtn) {
                e.stopPropagation();
                const ticketId = parseInt(deleteBtn.getAttribute('data-id'), 10);
                
                const { isConfirmed } = await Swal.fire({
                    title: '¿Destruir Ticket?',
                    text: 'Se eliminará del historial permanentemente.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Sí, borrar',
                    cancelButtonText: 'Cancelar'
                });

                if(isConfirmed) {
                    await db.deleteReceipt(ticketId);
                    renderHistory();
                }
            }

            // Lógica de visualización de foto con Zoom (Panzoom)
            if (viewPhotoBtn) {
                e.stopPropagation();
                const photoData = viewPhotoBtn.getAttribute('data-img');
                if (photoData) {
                    const viewerImg = document.getElementById('ticket-viewer-img');
                    const viewModalEl = document.getElementById('viewTicketModal');
                    if (viewerImg && viewModalEl) {
                        if(panzoomInstance) {
                            panzoomInstance.dispose();
                            panzoomInstance = null;
                        }

                        viewerImg.src = photoData;
                        
                        if(!viewTicketModal) {
                            viewTicketModal = new bootstrap.Modal(viewModalEl);
                            
                            // Limpieza profunda al cerrar
                            viewModalEl.addEventListener('hidden.bs.modal', () => {
                                if(panzoomInstance) {
                                    panzoomInstance.dispose();
                                    panzoomInstance = null;
                                }
                            });

                            // Cerrar al clickear si no hay zoom activo
                            viewerImg.addEventListener('click', () => {
                                if (panzoomInstance) {
                                    const transform = panzoomInstance.getTransform();
                                    if (Math.abs(transform.scale - 1) < 0.01) {
                                        viewTicketModal.hide();
                                    }
                                } else {
                                    viewTicketModal.hide();
                                }
                            });
                        }

                        viewTicketModal.show();

                        // Inicializamos Panzoom tras un breve retardo para asegurar que el modal está pintado
                        setTimeout(() => {
                            panzoomInstance = panzoom(viewerImg, {
                                maxZoom: 5,
                                minZoom: 1,
                                bounds: true,
                                boundsPadding: 0.1
                            });
                        }, 500);
                    }
                }
            }

            // Lógica para añadir foto a un ticket existente
            if (addPhotoBtn) {
                e.stopPropagation();
                const ticketId = parseInt(addPhotoBtn.getAttribute('data-id'), 10);
                const cameraInput = document.getElementById('ticket-camera-input');
                
                if (cameraInput) {
                    cameraInput.click();
                    cameraInput.onchange = async (event) => {
                        const file = event.target.files[0];
                        if (file) {
                            try {
                                const reader = new FileReader();
                                reader.readAsDataURL(file);
                                reader.onload = async (e) => {
                                    const rawBase64 = e.target.result;
                                    // Flujo de recorte manual
                                    const croppedBase64 = await startCropping(rawBase64);
                                    if(croppedBase64) {
                                        await db.updateReceiptImage(ticketId, croppedBase64);
                                        renderHistory();
                                        Swal.fire({
                                            title: '¡Escaneo Exitoso!',
                                            text: 'Tiquet actualizado perfectamente.',
                                            icon: 'success',
                                            timer: 1500,
                                            showConfirmButton: false
                                        });
                                    }
                                };
                            } catch (error) {
                                Swal.fire('Error', 'Problema al procesar la captura.', 'error');
                            }
                        }
                        cameraInput.value = '';
                    };
                }
            }
        });
    }
};

/**
 * Genera de forma visual toda la lista HTML cruzándola con el Local Storage.
 * Agrega el contenido del Acordeón para detallar ítems del ticket.
 */
export const renderHistory = async () => {
    const receipts = await db.getReceipts();
    
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
                <!-- Área Cajas: Precio + Foto? + Papelera -->
                <div class="d-flex align-items-center">
                    <span class="badge bg-success rounded-pill fs-6 shadow-sm me-2">${r.total.toFixed(2)} €</span>
                    
                    ${r.image ? `
                    <button class="btn btn-sm btn-outline-primary btn-view-photo shadow-sm me-2" data-img="${r.image}" title="Ver Foto del Tiquet">
                        <i class="bi bi-image"></i>
                    </button>
                    ` : `
                    <button class="btn btn-sm btn-outline-secondary btn-add-photo shadow-sm me-2" data-id="${r.id}" title="Añadir Foto">
                        <i class="bi bi-plus-circle"></i>
                    </button>
                    `}

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
const renderChart = async (mode) => {
    const receipts = await db.getReceipts();
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

    // Registramos el plugin de etiquetas para esta instancia
    Chart.register(ChartDataLabels);

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
            // MEJORA INTERACCIÓN: Modo índice para que baste con tocar la columna, no la barra exacta
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    beginAtZero: true,
                    // Añadimos margen arriba para que las etiquetas no se corten
                    grace: '15%',
                    ticks: {
                        callback: function(value) {
                            return value + '€';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: function(value) {
                        return value > 0 ? value.toFixed(2) + '€' : '';
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    color: '#198754', // Color verde para que haga juego
                    clip: false // Permite que se vea fuera del canvas si es necesario
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ' Total: ' + context.parsed.y.toFixed(2) + ' €';
                        }
                    }
                }
            }
        }
    });
};
