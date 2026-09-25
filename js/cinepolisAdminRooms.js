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

// Inicialización global compatible
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    const uploadSection = document.getElementById('upload-section');
    const activeSection = document.getElementById('active-schedule-section');
    const dropArea = document.getElementById('admin-drop-area');
    const pdfInput = document.getElementById('pdf-input');
    const fileLabel = document.getElementById('file-label');
    const btnUpload = document.getElementById('btn-upload');
    const btnDelete = document.getElementById('btn-delete-schedule');

    let selectedFile = null;

    checkCurrentSchedule();

    function checkCurrentSchedule() {
        db.ref('horario_activo/funciones').once('value', (snapshot) => {
            const currentData = snapshot.val();
            if (currentData && currentData.length > 0) {
                if (uploadSection) uploadSection.classList.add('hidden');
                if (activeSection) activeSection.classList.remove('hidden');
            } else {
                if (uploadSection) uploadSection.classList.remove('hidden');
                if (activeSection) activeSection.classList.add('hidden');
                if (btnUpload) btnUpload.disabled = true;
                if (pdfInput) pdfInput.value = '';
                if (fileLabel) fileLabel.textContent = 'Haz clic aquí o arrastra tu archivo PDF';
            }
        });
    }

    if (dropArea && pdfInput) {
        dropArea.addEventListener('click', () => pdfInput.click());
        
        pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFile = e.target.files[0];
                if (fileLabel) fileLabel.innerHTML = `Archivo seleccionado: <strong>${selectedFile.name}</strong>`;
                if (btnUpload) btnUpload.disabled = false;
            } else {
                selectedFile = null;
                if (btnUpload) btnUpload.disabled = true;
                if (fileLabel) fileLabel.textContent = 'Haz clic aquí o arrastra tu archivo PDF';
            }
        });
    }

    if (btnUpload) {
        btnUpload.addEventListener('click', async () => {
            if (!selectedFile) return;

            btnUpload.disabled = true;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a Firebase...';

            try {
                const functionsList = await parseCinepolisPDF(selectedFile);

                if (functionsList && functionsList.length > 0) {
                    await db.ref('horario_activo').set({
                        fechaActualizacion: new Date().toLocaleString(),
                        totalFunciones: functionsList.length,
                        funciones: functionsList
                    });

                    alert('¡Horario publicado con éxito en Firebase!');
                    checkCurrentSchedule();
                } else {
                    alert('No se pudieron extraer funciones del PDF.');
                    btnUpload.disabled = false;
                }
            } catch (error) {
                console.error("Error al publicar:", error);
                alert('Ocurrió un error al subir el horario a Firebase.');
                btnUpload.disabled = false;
            } finally {
                btnUpload.innerHTML = '<i class="fa-solid fa-upload"></i> Publicar Horario';
            }
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que deseas borrar el horario actual de Firebase?')) {
                try {
                    await db.ref('horario_activo').remove();
                    alert('Horario borrado de Firebase.');
                    checkCurrentSchedule();
                } catch (error) {
                    console.error("Error al borrar:", error);
                    alert("Error al eliminar el horario.");
                }
            }
        });
    }
});

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