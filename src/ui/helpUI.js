import * as bootstrap from 'bootstrap';

/**
 * Controlador para el Centro de Ayuda Visual.
 * Gestiona la apertura y eventos del Manual del Usuario.
 */

let helpModal;

/**
 * Inicializa el Módulo de Ayuda.
 * Registra el evento de clic en el botón (?) de la cabecera para desplegar el manual.
 */
export const initHelpUI = () => {
    const btnHelp = document.getElementById('btn-help');
    const helpModalEl = document.getElementById('helpModal');

    if (btnHelp && helpModalEl) {
        // Instancia el modal de Bootstrap una sola vez
        helpModal = new bootstrap.Modal(helpModalEl);

        btnHelp.addEventListener('click', () => {
            helpModal.show();
        });
    }
};

/**
 * Permite abrir el manual desde otros módulos si es necesario.
 */
export const openManual = () => {
    if (helpModal) helpModal.show();
};
