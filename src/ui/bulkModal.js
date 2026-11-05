/**
 * Módulo de la Interfaz de Usuario para Productos a Granel (Peso).
 * Permite calcular de forma ágil el precio de frutas, verduras, legumbres, etc.,
 * introduciendo precio por kilo (€/kg) y peso (en kg o gramos).
 * Incluye dictado por voz interactivo con Web Speech API en cada uno de sus campos.
 */

import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import Swal from 'sweetalert2';

// Diccionario de números hablados en castellano
const SPANISH_NUMBER_WORDS = {
    'cero': 0, 'medio': 0.5, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
    'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
    'dieciseis': 16, 'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
    'veinte': 20, 'veintiuno': 21, 'veintiún': 21, 'veintiun': 21, 'veintidos': 22, 'veintidós': 22,
    'veintitres': 23, 'veintitrés': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiseis': 26, 'veintiséis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70,
    'ochenta': 80, 'noventa': 90,
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
    'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
    'setecientos': 700, 'ochocientos': 800, 'novecientos': 900
};

/**
 * Convierte una frase de texto que expresa números en palabras a valor numérico flotante.
 * Ej: "uno con noventa y nueve" -> 1.99
 * @param {string} phrase 
 * @returns {number}
 */
const wordsToNumber = (phrase) => {
    const tokens = phrase.toLowerCase()
        .replace(/[,.]/g, '')
        .split(/\s+/)
        .filter(t => t !== 'y' && t !== 'de');

    let total = 0;
    for (const word of tokens) {
        if (/^\d+(\.\d+)?$/.test(word)) {
            total += parseFloat(word);
        } else if (SPANISH_NUMBER_WORDS[word] !== undefined) {
            total += SPANISH_NUMBER_WORDS[word];
        }
    }
    return total;
};

/**
 * Parsea el precio dictado por voz en español.
 * Soporta "1,99", "uno con noventa y nueve", "dos euros", "80 céntimos", etc.
 * @param {string} rawTranscript 
 * @returns {number|null}
 */
export const parseVoicePrice = (rawTranscript) => {
    let t = rawTranscript.toLowerCase().trim();
    t = t.replace(/\beuros?\b/g, '').trim();

    // Caso céntimos (ej. "80 céntimos", "noventa centimos")
    if (t.includes('céntimo') || t.includes('centimo')) {
        const centsText = t.replace(/\bc[eé]ntimos?\b/g, '').trim();
        const num = parseFloat(centsText) || wordsToNumber(centsText);
        if (num > 0) return parseFloat((num / 100).toFixed(2));
    }

    // Caso dígitos directos con coma o punto (ej. "1,99" o "1.99")
    const digitMatch = t.match(/(\d+)[,\.](\d+)/);
    if (digitMatch) {
        return parseFloat(`${digitMatch[1]}.${digitMatch[2]}`);
    }

    // Caso dígito solo (ej. "2")
    const singleDigit = t.match(/\b(\d+)\b/);
    if (singleDigit) {
        return parseFloat(singleDigit[1]);
    }

    // Caso "X con Y" o "X coma Y" o "X punto Y"
    const splitRegex = /\b(con|coma|punto)\b/;
    if (splitRegex.test(t)) {
        const parts = t.split(splitRegex);
        const integerPart = wordsToNumber(parts[0]);
        const decimalStr = parts[2].trim();
        let decimalPart = wordsToNumber(decimalStr);
        if (decimalPart < 10 && decimalStr.length === 1) {
            decimalPart = decimalPart * 10;
        }
        return parseFloat(`${integerPart}.${decimalPart}`);
    }

    // Número completo en palabras (ej. "dos")
    const wordsNum = wordsToNumber(t);
    return wordsNum > 0 ? wordsNum : null;
};

/**
 * Parsea el peso dictado por voz en español, reconociendo si el usuario menciona kilos o gramos.
 * Ej: "cuatrocientos gramos", "un kilo y medio", "1 con 25", "750g".
 * @param {string} rawTranscript 
 * @returns {{ value: number, unit: 'kg'|'g' }|null}
 */
export const parseVoiceWeight = (rawTranscript) => {
    let t = rawTranscript.toLowerCase().trim();
    let detectedUnit = null;

    if (/\b(gramos?|g)\b/.test(t)) {
        detectedUnit = 'g';
        t = t.replace(/\b(gramos?|g)\b/g, '').trim();
    } else if (/\b(kilos?|kg|kilo)\b/.test(t)) {
        detectedUnit = 'kg';
        t = t.replace(/\b(kilos?|kg|kilo)\b/g, '').trim();
    }

    // Casos especiales comunes en compras
    if (t.includes('medio') && !t.includes('un kilo')) {
        return { value: detectedUnit === 'g' ? 500 : 0.5, unit: detectedUnit || 'kg' };
    }
    if (t.includes('un kilo y medio') || t.includes('1 y medio')) {
        return { value: 1.5, unit: 'kg' };
    }
    if (t.includes('cuarto')) {
        return { value: detectedUnit === 'g' ? 250 : 0.25, unit: detectedUnit || 'kg' };
    }

    // Dígito decimal directo tipo "1,25" o "1.25"
    const digitMatch = t.match(/(\d+)[,\.](\d+)/);
    if (digitMatch) {
        const val = parseFloat(`${digitMatch[1]}.${digitMatch[2]}`);
        return { value: val, unit: detectedUnit || (val > 20 ? 'g' : 'kg') };
    }

    // Dígito entero directo tipo "450" o "2"
    const singleDigit = t.match(/\b(\d+)\b/);
    if (singleDigit) {
        const val = parseFloat(singleDigit[1]);
        return { value: val, unit: detectedUnit || (val >= 50 ? 'g' : 'kg') };
    }

    // "X con Y"
    const splitRegex = /\b(con|coma|punto)\b/;
    if (splitRegex.test(t)) {
        const parts = t.split(splitRegex);
        const integerPart = wordsToNumber(parts[0]);
        const decimalPart = wordsToNumber(parts[2]);
        const val = parseFloat(`${integerPart}.${decimalPart}`);
        return { value: val, unit: detectedUnit || 'kg' };
    }

    // Palabras completas
    const wordsNum = wordsToNumber(t);
    if (wordsNum > 0) {
        return { value: wordsNum, unit: detectedUnit || (wordsNum >= 50 ? 'g' : 'kg') };
    }

    return null;
};

// Variables DOM del Módulo
let bulkModalElement = null;
let bulkModal = null;
let btnOpenBulkModal = null;
let bulkForm = null;
let nameInput = null;
let priceKgInput = null;
let weightInput = null;
let unitKgRadio = null;
let unitGRadio = null;
let unitLabel = null;
let calculatedTotalDisplay = null;
let calculationDetailDisplay = null;

// Botones de micrófono
let btnVoiceName = null;
let btnVoicePrice = null;
let btnVoiceWeight = null;
let activeVoiceBtn = null;

// Reconocimiento de Voz nativo
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.continuous = false;
}

/**
 * Detiene cualquier sesión de reconocimiento de voz activa y apaga las animaciones de botón.
 */
const stopVoiceSession = () => {
    if (activeVoiceBtn) {
        activeVoiceBtn.classList.remove('btn-voice-active');
        activeVoiceBtn = null;
    }
    if (recognition) {
        try {
            recognition.stop();
        } catch (_) {}
    }
};

/**
 * Inicia el reconocimiento de voz para un botón específico con su callback de procesado.
 * @param {HTMLElement} btn 
 * @param {Function} onResult 
 */
const startVoiceForButton = (btn, onResult) => {
    if (!SpeechRecognition) {
        Swal.fire('Dictado no disponible', 'Tu navegador no tiene activado el reconocimiento por voz.', 'info');
        return;
    }

    if (activeVoiceBtn === btn) {
        stopVoiceSession();
        return;
    }

    stopVoiceSession();

    try {
        activeVoiceBtn = btn;
        btn.classList.add('btn-voice-active');

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
            stopVoiceSession();
        };

        recognition.onend = () => {
            stopVoiceSession();
        };

        recognition.onerror = (e) => {
            console.warn("Error en dictado por voz:", e.error);
            stopVoiceSession();
        };

        recognition.start();
    } catch (err) {
        console.error("Fallo al iniciar micrófono:", err);
        stopVoiceSession();
    }
};

/**
 * Recalcula el precio final del producto a granel en tiempo real.
 */
const recalculateBulkTotal = () => {
    if (!priceKgInput || !weightInput || !calculatedTotalDisplay) return;

    const priceKg = parseFloat(priceKgInput.value) || 0;
    const rawWeight = parseFloat(weightInput.value) || 0;
    const isGrams = unitGRadio && unitGRadio.checked;

    if (priceKg > 0 && rawWeight > 0) {
        const weightInKg = isGrams ? rawWeight / 1000 : rawWeight;
        const total = priceKg * weightInKg;
        calculatedTotalDisplay.textContent = `${total.toFixed(2)} €`;

        if (calculationDetailDisplay) {
            if (isGrams) {
                calculationDetailDisplay.textContent = `${rawWeight} g (${weightInKg.toFixed(3)} kg) × ${priceKg.toFixed(2)} €/kg`;
            } else {
                calculationDetailDisplay.textContent = `${weightInKg.toFixed(3)} kg × ${priceKg.toFixed(2)} €/kg`;
            }
        }
    } else {
        calculatedTotalDisplay.textContent = '0.00 €';
        if (calculationDetailDisplay) {
            calculationDetailDisplay.textContent = 'Introduce precio y peso para calcular';
        }
    }
};

/**
 * Inicializa la interfaz y controladores de eventos para la Calculadora a Granel.
 * @param {Function} onCartUpdated - Callback invocado al añadir un producto (para repintar el carrito).
 */
export const initBulkModalUI = (onCartUpdated) => {
    bulkModalElement = document.getElementById('bulkProductModal');
    btnOpenBulkModal = document.getElementById('btn-open-bulk-modal');
    bulkForm = document.getElementById('bulk-product-form');
    nameInput = document.getElementById('bulk-name');
    priceKgInput = document.getElementById('bulk-price-kg');
    weightInput = document.getElementById('bulk-weight');
    unitKgRadio = document.getElementById('bulk-unit-kg');
    unitGRadio = document.getElementById('bulk-unit-g');
    unitLabel = document.getElementById('bulk-unit-label');
    calculatedTotalDisplay = document.getElementById('bulk-calculated-total');
    calculationDetailDisplay = document.getElementById('bulk-calculation-detail');

    btnVoiceName = document.getElementById('btn-voice-bulk-name');
    btnVoicePrice = document.getElementById('btn-voice-bulk-price');
    btnVoiceWeight = document.getElementById('btn-voice-bulk-weight');

    if (!bulkModalElement) return;

    // Apertura del Modal
    if (btnOpenBulkModal) {
        btnOpenBulkModal.addEventListener('click', () => {
            if (!bulkModal) bulkModal = new bootstrap.Modal(bulkModalElement);

            // Reseteo limpio al abrir
            if (bulkForm) bulkForm.reset();
            if (unitKgRadio) unitKgRadio.checked = true;
            if (unitLabel) unitLabel.textContent = 'kg';
            if (weightInput) weightInput.placeholder = 'Ej. 1.250';
            recalculateBulkTotal();

            bulkModal.show();
        });
    }

    // Detener micrófono al cerrar el modal si estaba encendido
    bulkModalElement.addEventListener('hidden.bs.modal', () => {
        stopVoiceSession();
    });

    // Conmutador de Unidad (kg / g)
    if (unitKgRadio) {
        unitKgRadio.addEventListener('change', () => {
            if (unitLabel) unitLabel.textContent = 'kg';
            if (weightInput) weightInput.placeholder = 'Ej. 1.250';
            recalculateBulkTotal();
        });
    }

    if (unitGRadio) {
        unitGRadio.addEventListener('change', () => {
            if (unitLabel) unitLabel.textContent = 'g';
            if (weightInput) weightInput.placeholder = 'Ej. 450';
            recalculateBulkTotal();
        });
    }

    // Recálculo reactivo al teclear
    if (priceKgInput) {
        priceKgInput.addEventListener('input', recalculateBulkTotal);
    }
    if (weightInput) {
        weightInput.addEventListener('input', recalculateBulkTotal);
    }

    // 🎙️ Micrófono 1: Nombre del Producto
    if (btnVoiceName) {
        btnVoiceName.addEventListener('click', () => {
            startVoiceForButton(btnVoiceName, (transcript) => {
                if (!transcript) return;
                const formattedName = transcript.trim().charAt(0).toUpperCase() + transcript.trim().slice(1);
                if (nameInput) nameInput.value = formattedName;
            });
        });
    }

    // 🎙️ Micrófono 2: Precio por Kilo (€/kg)
    if (btnVoicePrice) {
        btnVoicePrice.addEventListener('click', () => {
            startVoiceForButton(btnVoicePrice, (transcript) => {
                const parsedPrice = parseVoicePrice(transcript);
                if (parsedPrice !== null && priceKgInput) {
                    priceKgInput.value = parsedPrice.toFixed(2);
                    recalculateBulkTotal();
                } else {
                    Swal.fire({
                        title: 'No se entendió el precio',
                        text: `Se escuchó: "${transcript}". Intenta decir por ejemplo "uno con noventa y nueve" o "dos euros".`,
                        icon: 'info',
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            });
        });
    }

    // 🎙️ Micrófono 3: Peso (kg o g)
    if (btnVoiceWeight) {
        btnVoiceWeight.addEventListener('click', () => {
            startVoiceForButton(btnVoiceWeight, (transcript) => {
                const parsedWeight = parseVoiceWeight(transcript);
                if (parsedWeight !== null && weightInput) {
                    // Cambiar la unidad activa si el usuario mencionó gramos o kilos
                    if (parsedWeight.unit === 'g' && unitGRadio) {
                        unitGRadio.checked = true;
                        if (unitLabel) unitLabel.textContent = 'g';
                    } else if (parsedWeight.unit === 'kg' && unitKgRadio) {
                        unitKgRadio.checked = true;
                        if (unitLabel) unitLabel.textContent = 'kg';
                    }

                    weightInput.value = parsedWeight.value;
                    recalculateBulkTotal();
                } else {
                    Swal.fire({
                        title: 'No se entendió el peso',
                        text: `Se escuchó: "${transcript}". Intenta decir por ejemplo "un kilo y medio" o "cuatrocientos gramos".`,
                        icon: 'info',
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            });
        });
    }

    // Formulario Submit: Añadir producto a la cesta
    if (bulkForm) {
        bulkForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = (nameInput?.value || '').trim() || 'Producto a Granel';
            const priceKg = parseFloat(priceKgInput?.value) || 0;
            const rawWeight = parseFloat(weightInput?.value) || 0;
            const isGrams = unitGRadio && unitGRadio.checked;

            if (priceKg <= 0 || rawWeight <= 0) {
                Swal.fire('Datos incompletos', 'Introduce un precio por kilo y un peso válidos.', 'warning');
                return;
            }

            const weightInKg = isGrams ? rawWeight / 1000 : rawWeight;
            const total = parseFloat((priceKg * weightInKg).toFixed(2));
            const weightText = isGrams ? `${rawWeight}g` : `${weightInKg.toFixed(2).replace(/\.?0+$/, '')}kg`;

            const bulkItem = {
                barcode: `granel_${Date.now()}`,
                name: `${name} (${weightText} @ ${priceKg.toFixed(2)}€/kg)`,
                price: total,
                quantity: 1,
                isVariablePrice: true,
                isBulk: true
            };

            db.addToCart(bulkItem);

            if (bulkModal) bulkModal.hide();

            if (onCartUpdated) onCartUpdated();

            Swal.fire({
                title: '¡Añadido a la Cesta!',
                html: `<strong>${bulkItem.name}</strong><br><span class="badge bg-success fs-6 mt-2">+ ${total.toFixed(2)} €</span>`,
                icon: 'success',
                timer: 1600,
                showConfirmButton: false
            });
        });
    }
};
