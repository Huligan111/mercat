/**
 * Módulo de la Interfaz de Usuario para Productos a Granel (Peso).
 * Permite calcular de forma ágil el precio de frutas, verduras, legumbres, etc.,
 * introduciendo precio por kilo (€/kg) y peso (en kg o gramos).
 * Incluye dictado por voz interactivo con Web Speech API en cada uno de sus campos.
 */

import * as db from '../storage.js';
import * as bootstrap from 'bootstrap';
import Swal from 'sweetalert2';

// Diccionario de números hablados en castellano con soporte para miles y variaciones fonéticas
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
    'cien': 100, 'ciento': 100,
    'dosciento': 200, 'doscientos': 200,
    'treciento': 300, 'trecientos': 300, 'tresciento': 300, 'trescientos': 300,
    'cuatrociento': 400, 'cuatrocientos': 400,
    'quiniento': 500, 'quinientos': 500,
    'seisciento': 600, 'seiscientos': 600,
    'seteciento': 700, 'setecientos': 700,
    'ochociento': 800, 'ochocientos': 800,
    'noveciento': 900, 'novecientos': 900,
    'mil': 1000
};

const simpleWordsToNumber = (tokens) => {
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
 * Convierte una frase de texto que expresa números en palabras a valor numérico flotante.
 * Maneja miles y composiciones: "mil trescientos" -> 1300, "uno con noventa y nueve" -> 1.99.
 * @param {string} phrase 
 * @returns {number}
 */
const wordsToNumber = (phrase) => {
    if (!phrase) return 0;
    const cleaned = phrase.trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
        return parseFloat(cleaned);
    }

    const tokens = phrase.toLowerCase()
        .replace(/[,.]/g, ' ')
        .split(/\s+/)
        .filter(t => t && t !== 'y' && t !== 'de');

    if (tokens.includes('mil')) {
        const milIndex = tokens.indexOf('mil');
        const beforeMil = tokens.slice(0, milIndex);
        const afterMil = tokens.slice(milIndex + 1);

        const thousands = beforeMil.length === 0 ? 1 : simpleWordsToNumber(beforeMil);
        const remainder = simpleWordsToNumber(afterMil);
        return (thousands || 1) * 1000 + remainder;
    }

    return simpleWordsToNumber(tokens);
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
    const singleDigit = t.match(/^(\d+)$/);
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
 * Parsea el peso dictado por voz en español, reconociendo combinaciones de kilos y gramos.
 * Soporta:
 * - "Un kilo trecientos ochenta y dos" / "1 kilo 382" -> 1.382 kg
 * - "1.382 kg" / "1,382 kilos" -> 1.382 kg
 * - "Mil trecientos gramos" / "mil trescientos" -> 1300 g (o 1.382 kg si está en modo kg)
 * - "Un kilo y medio" -> 1.5 kg, "kilo y cuarto" -> 1.25 kg
 * - "450 gramos" -> 450 g
 * - "1 con 35" / "1.35" -> 1.35 kg
 * @param {string} rawTranscript 
 * @param {'kg'|'g'} [preferredUnit='kg'] - Unidad activa en la interfaz al momento de dictar
 * @returns {{ value: number, unit: 'kg'|'g' }|null}
 */
export const parseVoiceWeight = (rawTranscript, preferredUnit = 'kg') => {
    if (!rawTranscript) return null;
    let t = rawTranscript.toLowerCase().trim();

    // 1. Detección explícita de unidades mencionadas
    const hasGrams = /\b(gramos?|grs?|gr|g)\b/.test(t);
    const hasKilos = /\b(kilos?|kgs?|kg|kilo)\b/.test(t);

    // 2. Expresiones idiomáticas habituales en peso
    if (t.includes('kilo y medio') || t.includes('un kilo y medio') || t.includes('1 y medio')) {
        return { value: 1.5, unit: 'kg' };
    }
    if (t.includes('medio kilo')) {
        return { value: 0.5, unit: 'kg' };
    }
    if (t.includes('cuarto de kilo') || t.includes('un cuarto')) {
        return { value: 0.25, unit: 'kg' };
    }
    if (t.includes('tres cuartos')) {
        return { value: 0.75, unit: 'kg' };
    }

    // 3. Dígito decimal directo formateado por el motor de voz (Ej: "1,382 kg", "1.382 kilos", "1.382", "1,382")
    const directDecimalMatch = t.match(/(\d+)[,\.](\d+)/);
    if (directDecimalMatch) {
        const intPart = parseInt(directDecimalMatch[1], 10);
        const decPartStr = directDecimalMatch[2];
        const val = parseFloat(`${intPart}.${decPartStr}`);

        if (hasGrams && !hasKilos) {
            return { value: val, unit: 'g' };
        }
        if (hasKilos || val < 50) {
            return { value: val, unit: 'kg' };
        }
        return { value: val, unit: 'g' };
    }

    // 4. Patrón compuesto Kilos + Gramos (Ej: "un kilo trescientos ochenta y dos", "1 kilo y 382 gramos", "2 kilos 400")
    if (hasKilos) {
        const parts = t.split(/\b(?:kilos?|kgs?|kg)\b/);
        const beforeKilo = parts[0].trim();
        let afterKilo = parts[1] ? parts[1].trim() : '';

        // Limpiar conectores y palabras de gramos
        afterKilo = afterKilo.replace(/\b(gramos?|grs?|gr|g|y|con)\b/g, ' ').trim();

        const kiloAmount = beforeKilo ? wordsToNumber(beforeKilo) : 1;
        const validKilo = kiloAmount > 0 ? kiloAmount : 1;

        if (afterKilo) {
            if (afterKilo.includes('medio')) {
                return { value: validKilo + 0.5, unit: 'kg' };
            }
            if (afterKilo.includes('tres cuartos')) {
                return { value: validKilo + 0.75, unit: 'kg' };
            }
            if (afterKilo.includes('cuarto')) {
                return { value: validKilo + 0.25, unit: 'kg' };
            }

            const remainderNum = wordsToNumber(afterKilo);
            if (remainderNum > 0) {
                let gramsInKg = 0;
                if (remainderNum >= 100) {
                    gramsInKg = remainderNum / 1000;
                } else if (remainderNum >= 10) {
                    gramsInKg = remainderNum / 100;
                } else {
                    gramsInKg = remainderNum / 10;
                }
                const totalVal = validKilo + gramsInKg;
                return { value: parseFloat(totalVal.toFixed(3)), unit: 'kg' };
            }
        }

        return { value: validKilo, unit: 'kg' };
    }

    // 5. Formato "X con Y" o "X coma Y" o "X punto Y" (Ej: "uno con trescientos ochenta y dos")
    const splitRegex = /\b(con|coma|punto)\b/;
    if (splitRegex.test(t)) {
        const p = t.split(splitRegex);
        const intPart = wordsToNumber(p[0]);
        const decStr = p[2].replace(/\b(kilos?|kg|gramos?|g)\b/g, '').trim();
        const decVal = wordsToNumber(decStr);

        let finalVal = 0;
        if (decVal >= 100) {
            finalVal = intPart + (decVal / 1000);
        } else if (decVal >= 10) {
            finalVal = intPart + (decVal / 100);
        } else {
            finalVal = intPart + (decVal / 10);
        }

        const unit = (hasGrams && !hasKilos) ? 'g' : 'kg';
        return { value: parseFloat(finalVal.toFixed(3)), unit };
    }

    // 6. Limpieza de palabras de unidad para parsear el número plano
    t = t.replace(/\b(gramos?|grs?|gr|g|kilos?|kgs?|kg)\b/g, '').trim();

    // 7. Número plano en palabras o dígitos (Ej: "mil trescientos ochenta y dos", "400", "trescientos")
    const plainNum = wordsToNumber(t);
    if (plainNum > 0) {
        if (hasGrams) {
            return { value: plainNum, unit: 'g' };
        }
        if (hasKilos) {
            return { value: plainNum, unit: 'kg' };
        }
        // Si no especificó unidad pero está en modo kg y el número es de miles (ej: 1382), interpretar como 1.382 kg
        if (plainNum >= 1000 && preferredUnit === 'kg') {
            return { value: parseFloat((plainNum / 1000).toFixed(3)), unit: 'kg' };
        }
        if (plainNum < 50) {
            return { value: plainNum, unit: 'kg' };
        }
        return { value: plainNum, unit: preferredUnit === 'kg' ? 'kg' : 'g' };
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

    const priceKg = parseFloat(String(priceKgInput.value).replace(',', '.')) || 0;
    const rawWeight = parseFloat(String(weightInput.value).replace(',', '.')) || 0;
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
                const currentUnit = (unitGRadio && unitGRadio.checked) ? 'g' : 'kg';
                const parsedWeight = parseVoiceWeight(transcript, currentUnit);
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
                        text: `Se escuchó: "${transcript}". Intenta decir por ejemplo "un kilo trescientos ochenta y dos" o "cuatrocientos gramos".`,
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
            const priceKg = parseFloat(String(priceKgInput?.value).replace(',', '.')) || 0;
            const rawWeight = parseFloat(String(weightInput?.value).replace(',', '.')) || 0;
            const isGrams = unitGRadio && unitGRadio.checked;

            if (priceKg <= 0 || rawWeight <= 0) {
                Swal.fire('Datos incompletos', 'Introduce un precio por kilo y un peso válidos.', 'warning');
                return;
            }

            const weightInKg = isGrams ? rawWeight / 1000 : rawWeight;
            const total = parseFloat((priceKg * weightInKg).toFixed(2));
            const weightText = isGrams ? `${rawWeight} g` : `${weightInKg.toFixed(3).replace(/\.?0+$/, '')} kg`;

            const bulkItem = {
                barcode: `granel_${Date.now()}`,
                name: `${name} (${weightText} × ${priceKg.toFixed(2)} €/kg)`,
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
