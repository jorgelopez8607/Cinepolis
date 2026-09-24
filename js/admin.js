const firebaseConfig = {
    apiKey: "AIzaSyCE1AtQJwVbE2cxccyJDIbqjHuxv_du98E",
    authDomain: "cinepolis-app-48551.firebaseapp.com",
    databaseURL: "https://cinepolis-app-48551-default-rtdb.firebaseio.com",
    projectId: "cinepolis-app-48551",
    storageBucket: "cinepolis-app-48551.firebasestorage.app",
    messagingSenderId: "922713120380",
    appId: "1:922713120380:web:be4d9ba6f029f48581b3f9",
    measurementId: "G-4JZ2D6QYGT"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('cinepolis_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const dropArea = document.getElementById('admin-drop-area');
    const pdfInput = document.getElementById('admin-pdf-file');
    const fileLabel = document.getElementById('admin-file-label');
    const container = document.getElementById('movies-list-container');
    const fileStatus = document.getElementById('file-status');

    if (dropArea && pdfInput) {
        dropArea.addEventListener('click', () => pdfInput.click());
    }

    if (pdfInput) {
        pdfInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            
            const file = e.target.files[0];
            if (fileLabel) fileLabel.textContent = file.name;
            fileStatus.style.color = "var(--text-muted, #aaa)";
            fileStatus.textContent = "Procesando PDF, por favor espera...";

            try {
                const titles = await extractTitlesFromPDF(file);
                
                if (!titles || titles.length === 0) {
                    fileStatus.style.color = "#ef4444";
                    fileStatus.textContent = "No se detectaron películas en el PDF.";
                    container.innerHTML = '';
                    return;
                }

                container.innerHTML = '';
                
                // Consultar Firebase para pre-cargar la configuración previa
                const snapshot = await db.ref('post_credits').once('value');
                const existingData = snapshot.val() || {};

                titles.forEach((title, index) => {
                    const movieKey = title.replace(/[.#$/\[\]]/g, "_");
                    const savedItem = existingData[movieKey] || {};
                    
                    const hasCredits = savedItem.hasCredits === true;
                    const count = savedItem.creditsCount || 1;

                    const card = document.createElement('div');
                    card.className = 'movie-card';
                    card.style.cssText = 'padding: 15px; border: 1px solid var(--card-border, #333); border-radius: 10px; background: var(--card-bg, #1e1e1e); margin-bottom: 12px;';
                    
                    card.innerHTML = `
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 12px; color: var(--text-primary);">${title}</div>
                        
                        <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 10px;">
                            <span style="font-size: 14px; color: var(--text-muted);">¿Tiene post-créditos?</span>
                            <label style="cursor: pointer;">
                                <input type="radio" name="has_credits_${index}" value="no" ${!hasCredits ? 'checked' : ''}> No
                            </label>
                            <label style="cursor: pointer;">
                                <input type="radio" name="has_credits_${index}" value="yes" ${hasCredits ? 'checked' : ''}> Sí
                            </label>
                        </div>

                        <div id="count-container-${index}" style="display: ${hasCredits ? 'flex' : 'none'}; align-items: center; gap: 10px; margin-top: 10px; margin-bottom: 15px;">
                            <span style="font-size: 14px; color: var(--text-muted);">¿Cuántas escenas?</span>
                            <input type="number" id="count_${index}" min="1" max="5" value="${count}" style="width: 70px; padding: 6px; text-align: center; border-radius: 6px; border: 1px solid var(--card-border, #444); background: var(--input-bg, #2a2a2a); color: var(--text-primary); font-size: 15px;">
                        </div>

                        <button type="button" class="btn-primary save-btn" style="width: 100%; padding: 10px; border-radius: 6px; cursor: pointer;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Guardar en la Nube
                        </button>
                    `;

                    // Manejo del visor del input numérico
                    const radios = card.querySelectorAll(`input[name="has_credits_${index}"]`);
                    radios.forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            const countContainer = card.querySelector(`#count-container-${index}`);
                            if (countContainer) {
                                countContainer.style.display = e.target.value === 'yes' ? 'flex' : 'none';
                            }
                        });
                    });

                    // Evento dinámico de guardado (soluciona fallos en la última tarjeta o caracteres especiales)
                    const saveBtn = card.querySelector('.save-btn');
                    saveBtn.addEventListener('click', () => {
                        const isYes = card.querySelector(`input[name="has_credits_${index}"]:checked`).value === 'yes';
                        const countInput = card.querySelector(`#count_${index}`);
                        const creditsCount = isYes && countInput ? parseInt(countInput.value, 10) : 0;
                        
                        saveSingleMovie(saveBtn, title, movieKey, isYes, creditsCount);
                    });

                    container.appendChild(card);
                });

                fileStatus.style.color = "#22c55e";
                fileStatus.textContent = `¡Listo! Se detectaron ${titles.length} películas únicas.`;

            } catch (error) {
                console.error("Error al procesar el PDF:", error);
                fileStatus.style.color = "#ef4444";
                fileStatus.textContent = "Error al leer el archivo PDF.";
            }
        });
    }
});

// Guardado individual en Firebase seguro
async function saveSingleMovie(btn, title, movieKey, hasCredits, count) {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    const movieData = {
        title: title,
        hasCredits: hasCredits,
        creditsCount: count
    };

    try {
        await db.ref(`post_credits/${movieKey}`).set(movieData);
        btn.style.background = "#22c55e";
        btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Actualizado!';
        setTimeout(() => {
            btn.style.background = '';
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error("Error en Firebase:", error);
        alert('Error al guardar en Firebase.');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function extractTitlesFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const titlesSet = new Set();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const linesMap = {};
        
        // Agrupar con margen de tolerancia vertical de 4px
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5] / 4) * 4;
            if (!linesMap[y]) linesMap[y] = [];
            linesMap[y].push(item);
        });

        const sortedY = Object.keys(linesMap).sort((a, b) => b - a);

        sortedY.forEach(y => {
            const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineText = lineItems.map(i => i.str).join(" ").trim();

            if (
                !lineText ||
                lineText.includes("Programa de Proyección") ||
                lineText.includes("Showing Sessions") ||
                lineText.includes("Vista Entertainment") ||
                lineText.includes("ReportFiles") ||
                /^\d+\/\d+$/.test(lineText)
            ) {
                return;
            }

            // 1. Coincidencia principal buscando el estado Abierto/Cerrado
            let statusMatch = lineText.match(/(?:Abierto|Cerrado)\s+(.+)/i);
            let rawTitle = "";

            if (statusMatch && statusMatch[1]) {
                rawTitle = statusMatch[1].trim();
            } else if (/Re\s+Rápido/i.test(lineText)) {
                // 2. Regla de respaldo explícita si la línea contiene "Re Rápido"
                const reMatch = lineText.match(/(Re\s+Rápido[^\d]+)/i);
                if (reMatch) rawTitle = reMatch[1].trim();
            }

            if (rawTitle) {
                // Cortar desde DEFAULT o desde horas de proyección si existen en el renglón
                let cleanTitle = rawTitle.split(/\bDEFAULT\b/i)[0].trim();

                // Quitar sufijos de formato, idioma o siglas de sala (incluyendo SJ, DOB, SUB, etc.) al FINAL de la cadena
                cleanTitle = cleanTitle
                    .replace(/\s+\b(Esp|Sub|SP|2D|3D|XE|4DX|VIP|MACRO|DIGITAL|ATMOS|SJ|DOB|SUB|DIG|IMAX)\b$/gi, "")
                    .replace(/\s+\b(Esp|Sub|SP|2D|3D|XE|4DX|VIP|MACRO|DIGITAL|ATMOS|SJ|DOB|SUB|DIG|IMAX)\b$/gi, "")
                    .replace(/\s+/g, " ")
                    .trim();

                // Limpieza de bordes y guiones sueltos
                cleanTitle = cleanTitle.replace(/^[\-\:\.]+|[\-\:\.]+$|\(\s*\)/g, "").trim();

                if (cleanTitle.length > 2) {
                    titlesSet.add(cleanTitle);
                }
            }
        });
    }

    return Array.from(titlesSet);
}

function toggleTheme() {
    const htmlElem = document.documentElement;
    const currentTheme = htmlElem.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElem.setAttribute('data-theme', newTheme);
    localStorage.setItem('cinepolis_theme', newTheme);
}