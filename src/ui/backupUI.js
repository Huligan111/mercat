/**
 * Módulo de la Interfaz de Usuario para Copias de Seguridad Totales (Backup & Restore).
 * Gestiona la exportación e importación de la base de datos completa:
 * Catálogo, Historial con fotos de tiquets en Base64, Presupuesto y Lista de la compra.
 */

import * as db from '../storage.js';
import Swal from 'sweetalert2';

/**
 * Descarga una copia de seguridad total en formato JSON con fotos incluidas.
 */
export const handleExportFullBackup = async () => {
    try {
        Swal.fire({
            title: 'Generando Copia Total...',
            text: 'Empaquetando catálogo, historial y fotos de tiquets...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const backupData = await db.getFullBackupData();

        const productsCount = backupData.products ? backupData.products.length : 0;
        const receiptsCount = backupData.receipts ? backupData.receipts.length : 0;
        const photosCount = backupData.receipts ? backupData.receipts.filter(r => r.image).length : 0;

        if (productsCount === 0 && receiptsCount === 0) {
            Swal.fire('Sin Datos', 'Aún no tienes productos ni compras guardadas para exportar.', 'info');
            return;
        }

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `mercat_backup_total_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        Swal.fire({
            title: '¡Copia Completa Creada!',
            html: `Se ha descargado el archivo con éxito:<br>
                   📦 <strong>${productsCount}</strong> productos en catálogo<br>
                   🧾 <strong>${receiptsCount}</strong> compras en historial<br>
                   📸 <strong>${photosCount}</strong> fotos de tiquets respaldadas`,
            icon: 'success'
        });
    } catch (error) {
        console.error("Error al exportar copia total:", error);
        Swal.fire('Error', 'No se pudo generar la copia de seguridad: ' + error.message, 'error');
    }
};

/**
 * Lee un archivo JSON de respaldo total y restaura todo el estado de la aplicación.
 * @param {Event} event - Evento del input de archivo
 * @param {Function} onRestored - Callback para refrescar vistas (renderCart, renderInventory, renderHistory)
 */
export const handleImportFullBackup = (event, onRestored) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            // Verificación si es backup total o catálogo simple
            const isFullBackup = importedData && importedData.type === 'mercat_full_backup';
            const productsInFile = isFullBackup ? (importedData.products?.length || 0) : (Array.isArray(importedData) ? importedData.length : 0);
            const receiptsInFile = isFullBackup ? (importedData.receipts?.length || 0) : 0;

            const confirmResult = await Swal.fire({
                title: '¿Restaurar Copia Total?',
                html: `Se detectaron en el archivo:<br>
                       📦 <strong>${productsInFile}</strong> productos<br>
                       🧾 <strong>${receiptsInFile}</strong> tickets de compra con fotos.<br><br>
                       <small class="text-muted">Los datos actuales se actualizarán y conservarán los registros.</small>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#198754',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, Restaurar Todo',
                cancelButtonText: 'Cancelar'
            });

            if (!confirmResult.isConfirmed) {
                event.target.value = '';
                return;
            }

            Swal.fire({
                title: 'Restaurando Datos...',
                text: 'Guardando productos e imágenes en IndexedDB...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const result = await db.restoreFullBackupData(importedData);

            if (onRestored) {
                await onRestored();
            }

            Swal.fire({
                title: '¡Restauración Completa!',
                html: `Se han restaurado correctamente:<br>
                       📦 <strong>${result.productsCount}</strong> productos<br>
                       🧾 <strong>${result.receiptsCount}</strong> compras históricas con fotos.`,
                icon: 'success'
            });
        } catch (err) {
            console.error("Error al importar copia total:", err);
            Swal.fire('Error en Archivo', 'El archivo no tiene un formato válido o está dañado.', 'error');
        } finally {
            event.target.value = ''; // Limpiar input para permitir seleccionar el mismo archivo de nuevo
        }
    };

    reader.onerror = () => {
        Swal.fire('Error', 'No se pudo leer el archivo seleccionado.', 'error');
        event.target.value = '';
    };

    reader.readAsText(file);
};

/**
 * Inicializa los eventos de los botones de copia completa en el DOM.
 * @param {Function} onRestored - Callback para refrescar UI
 */
export const initBackupUI = (onRestored) => {
    // Botones en modal Inventario
    const btnExportInv = document.getElementById('btn-export-full-backup');
    const inputImportInv = document.getElementById('btn-import-full-backup');

    // Botones en modal Historial
    const btnExportHist = document.getElementById('btn-export-full-history');
    const inputImportHist = document.getElementById('btn-import-full-history');

    if (btnExportInv) {
        btnExportInv.addEventListener('click', handleExportFullBackup);
    }
    if (btnExportHist) {
        btnExportHist.addEventListener('click', handleExportFullBackup);
    }

    if (inputImportInv) {
        inputImportInv.addEventListener('change', (e) => handleImportFullBackup(e, onRestored));
    }
    if (inputImportHist) {
        inputImportHist.addEventListener('change', (e) => handleImportFullBackup(e, onRestored));
    }
};
