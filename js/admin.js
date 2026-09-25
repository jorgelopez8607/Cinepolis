import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('admin-drop-area');
    const pdfInput = document.getElementById('admin-pdf-file');
    const fileLabel = document.getElementById('admin-file-label');
    const container = document.getElementById('movies-list-container');
    const fileStatus = document.getElementById('file-status');
    const deleteBtn = document.getElementById('delete-schedule-btn');

    if (dropArea && pdfInput) {
        dropArea.addEventListener('click', () => pdfInput.click());
    }

    if (pdfInput) {
        pdfInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            
            const file = e.target.files[0];
            if (fileLabel) fileLabel.textContent = file.name;
            if (fileStatus) {
                fileStatus.style.color = "#aaa";
                fileStatus.textContent = "Procesando PDF y subiendo a Firebase...";
            }

            try {
                // 1. Extraer funciones completas del PDF
                const funciones = await parseCinepolisPDF(file);

                if (!funciones || funciones.length === 0) {
                    if (fileStatus) {
                        fileStatus.style.color = "#ef4444";
                        fileStatus.textContent = "No se encontraron funciones en el PDF.";
                    }
                    return;
                }

                // 2. Guardar en Firebase Realtime Database
                await set(ref(db, 'horario_activo'), {
                    fechaActualizacion: new Date().toLocaleString(),
                    totalFunciones: funciones.length,
                    funciones: funciones
                });

                if (fileStatus) {
                    fileStatus.style.color = "#22c55e";
                    fileStatus.textContent = `¡Éxito! Se publicaron ${funciones.length} funciones en Firebase.`;
                }

                // 3. Extraer títulos para post-créditos
                const titles = await extractTitlesFromPDF(file);
                if (container && titles.length > 0) {
                    container.innerHTML = '';
                    
                    const snapshot = await get(ref(db, 'post_credits'));
                    const existingData = snapshot.val() || {};

                    titles.forEach((title, index) => {
                        const movieKey = title.replace(/[.#$/\[\]]/g, "_");
                        const savedItem = existingData[movieKey] || {};
                        const hasCredits = savedItem.hasCredits === true;
                        const count = savedItem.creditsCount || 1;

                        const card = document.createElement('div');
                        card.className = 'movie-card';
                        card.style.cssText = 'padding: 15px; border: 1px solid #333; border-radius: 10px; background: #1e1e1e; margin-bottom: 12px;';
                        
                        card.innerHTML = `
                            <div style="font-weight: bold; font-size: 16px; margin-bottom: 12px;">${title}</div>
                            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 10px;">
                                <span>¿Tiene post-créditos?</span>
                                <label><input type="radio" name="has_credits_${index}" value="no" ${!hasCredits ? 'checked' : ''}> No</label>
                                <label><input type="radio" name="has_credits_${index}" value="yes" ${hasCredits ? 'checked' : ''}> Sí</label>
                            </div>
                            <div id="count-container-${index}" style="display: ${hasCredits ? 'flex' : 'none'}; align-items: center; gap: 10px; margin-bottom: 15px;">
                                <span>¿Cuántas escenas?</span>
                                <input type="number" id="count_${index}" min="1" max="5" value="${count}" style="width: 70px; padding: 6px; text-align: center; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #fff;">
                            </div>
                            <button type="button" class="btn-primary save-btn" style="width: 100%; padding: 10px; border-radius: 6px; cursor: pointer;">Guardar Post-Créditos</button>
                        `;

                        const radios = card.querySelectorAll(`input[name="has_credits_${index}"]`);
                        radios.forEach(radio => {
                            radio.addEventListener('change', (ev) => {
                                const countContainer = card.querySelector(`#count-container-${index}`);
                                if (countContainer) {
                                    countContainer.style.display = ev.target.value === 'yes' ? 'flex' : 'none';
                                }
                            });
                        });

                        const saveBtn = card.querySelector('.save-btn');
                        saveBtn.addEventListener('click', async () => {
                            const isYes = card.querySelector(`input[name="has_credits_${index}"]:checked`).value === 'yes';
                            const countInput = card.querySelector(`#count_${index}`);
                            const creditsCount = isYes && countInput ? parseInt(countInput.value, 10) : 0;
                            
                            await set(ref(db, `post_credits/${movieKey}`), {
                                title: title,
                                hasCredits: isYes,
                                creditsCount: creditsCount
                            });
                            alert(`Guardado post-créditos para: ${title}`);
                        });

                        container.appendChild(card);
                    });
                }

            } catch (error) {
                console.error("Error al procesar/subir PDF:", error);
                if (fileStatus) {
                    fileStatus.style.color = "#ef4444";
                    fileStatus.textContent = "Error al subir datos a Firebase.";
                }
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', borrarHorarioActivo);
    }
});

export async function borrarHorarioActivo() {
    try {
        await remove(ref(db, 'horario_activo'));
        
        const container = document.getElementById('movies-list-container');
        const fileLabel = document.getElementById('admin-file-label');
        const fileStatus = document.getElementById('file-status');
        const pdfInput = document.getElementById('admin-pdf-file');

        if (container) container.innerHTML = '';
        if (fileLabel) fileLabel.textContent = 'Haz clic aquí para seleccionar el PDF';
        if (pdfInput) pdfInput.value = '';
        if (fileStatus) {
            fileStatus.style.color = "#aaa";
            fileStatus.textContent = "Horario eliminado correctamente de Firebase.";
        }

        alert("El horario activo ha sido eliminado de Firebase.");
    } catch (error) {
        console.error("Error al borrar horario de Firebase:", error);
        alert("Error al borrar el horario.");
    }
}
window.borrarHorarioActivo = borrarHorarioActivo;

async function parseCinepolisPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allTokens = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const sortedItems = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > 5) return yDiff;
            return a.transform[4] - b.transform[4];
        });

        const pageTokens = sortedItems
            .map(item => item.str.trim())
            .filter(str => str.length > 0);
        
        allTokens = allTokens.concat(pageTokens);
    }

    const functionsList = [];
    const roomRegex = /^SALA\s+(\d+)$/i;
    const timeRegex = /^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i;

    let idCounter = 0;
    let currentRoom = null;

    for (let i = 0; i < allTokens.length; i++) {
        const token = allTokens[i];
        
        const roomMatch = token.match(roomRegex);
        if (roomMatch) {
            currentRoom = parseInt(roomMatch[1], 10);
            continue;
        }

        if (currentRoom && timeRegex.test(token)) {
            const startTime = token;
            let finishTime = "";
            let idx = i + 1;

            while (idx < allTokens.length && idx < i + 6) {
                if (timeRegex.test(allTokens[idx])) {
                    finishTime = allTokens[idx];
                    break;
                }
                idx++;
            }

            if (finishTime) {
                i = idx;
                let status = "Abierto";
                let titleTokens = [];
                let format = "DEFAULT";

                let searchIdx = i + 1;
                while (searchIdx < allTokens.length && searchIdx < i + 15) {
                    const nextToken = allTokens[searchIdx];

                    if (roomRegex.test(nextToken) || timeRegex.test(nextToken)) break;

                    if (/^(Programa|de|Proyección|por|Hora|Comienzo|Función|SS002|v\.|ReportFiles|visProjSch\.rpt|Vista|Entertainment|Solutions|Ltd|CINEPOLIS|EL|ROSARIO|\d+\/\d+|\d+\/\d+\/\d+|©)$/i.test(nextToken) || nextToken.includes("D:\\") || nextToken.includes(".rpt")) {
                        searchIdx++;
                        continue;
                    }

                    if (nextToken === "Abierto" || nextToken === "Cerrado") {
                        status = nextToken;
                    } else if (nextToken === "DEFAULT" || /^(2D|3D|XE|4DX|VIP|MACRO|SUB)$/i.test(nextToken)) {
                        format = nextToken;
                    } else if (nextToken !== "|" && nextToken !== "-") {
                        titleTokens.push(nextToken);
                    }
                    searchIdx++;
                }

                let fullTitle = titleTokens.join(" ").trim()
                                     .replace(/Programa de Proyección.*$/i, '')
                                     .replace(/D:\\.*$/i, '')
                                     .replace(/©.*$/i, '')
                                     .replace(/\d{1,2}\/\d{1,2}\/\d{4}.*$/i, '')
                                     .trim();

                if (fullTitle) {
                    idCounter++;
                    functionsList.push({
                        id: `fn_${idCounter}`,
                        room: currentRoom,
                        startTime: startTime,
                        endTime: finishTime,
                        finishTime: finishTime,
                        status: status,
                        title: fullTitle,
                        format: format
                    });
                }
            }
        }
    }

    return functionsList;
}

async function extractTitlesFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const titlesSet = new Set();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const linesMap = {};
        
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5] / 4) * 4;
            if (!linesMap[y]) linesMap[y] = [];
            linesMap[y].push(item);
        });

        const sortedY = Object.keys(linesMap).sort((a, b) => b - a);

        sortedY.forEach(y => {
            const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineText = lineItems.map(i => i.str).join(" ").trim();

            if (!lineText || lineText.includes("Programa de Proyección") || lineText.includes("Showing Sessions") || lineText.includes("Vista Entertainment") || lineText.includes("ReportFiles") || /^\d+\/\d+$/.test(lineText)) {
                return;
            }

            let statusMatch = lineText.match(/(?:Abierto|Cerrado)\s+(.+)/i);
            let rawTitle = "";

            if (statusMatch && statusMatch[1]) {
                rawTitle = statusMatch[1].trim();
            } else if (/Re\s+Rápido/i.test(lineText)) {
                const reMatch = lineText.match(/(Re\s+Rápido[^\d]+)/i);
                if (reMatch) rawTitle = reMatch[1].trim();
            }

            if (rawTitle) {
                let cleanTitle = rawTitle.split(/\bDEFAULT\b/i)[0].trim()
                    .replace(/\s+\b(Esp|Sub|SP|2D|3D|XE|4DX|VIP|MACRO|DIGITAL|ATMOS|SJ|DOB|SUB|DIG|IMAX)\b$/gi, "")
                    .replace(/\s+/g, " ")
                    .trim();

                cleanTitle = cleanTitle.replace(/^[\-\:\.]+|[\-\:\.]+$|\(\s*\)/g, "").trim();

                if (cleanTitle.length > 2) {
                    titlesSet.add(cleanTitle);
                }
            }
        });
    }

    return Array.from(titlesSet);
}