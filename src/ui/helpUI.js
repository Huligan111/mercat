import * as bootstrap from 'bootstrap';

/**
 * Controlador para el Centro de Ayuda Visual.
 * Gestiona la apertura y eventos del Manual del Usuario.
 */

let helpModal;

export const initHelpUI = () => {
    const btnHelp = document.getElementById('btn-help');
    const helpModalEl = document.getElementById('helpModal');

    if (btnHelp && helpModalEl) {
        // Inicializar el Modal de Bootstrap
        helpModal = new bootstrap.Modal(helpModalEl);

        // Evento al pulsar el icono de interrogación
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
