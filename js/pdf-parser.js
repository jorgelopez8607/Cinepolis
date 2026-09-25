async function parseCinepolisPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allTokens = [];

    // 1. Extraer y ordenar tokens visualmente por coordenadas (Y descendente, X ascendente)
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const sortedItems = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > 5) {
                return yDiff;
            }
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

    // 2. Procesar tokens para extraes datos
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

                    // Si encontramos la siguiente sala u otra hora, terminamos de leer esta función
                    if (roomRegex.test(nextToken) || timeRegex.test(nextToken)) {
                        break;
                    }

                    // Ignorar textos basura del pie de página de Vista
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

                let fullTitle = titleTokens.join(" ").trim();

                // Limpieza de seguridad adicional para expresiones de fecha/ruta que vengan unidas
                fullTitle = fullTitle.replace(/Programa de Proyección.*$/i, '')
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
                        format: format,
                        startMinutes: convertTimeToMinutes(startTime),
                        finishMinutes: convertTimeToMinutes(finishTime)
                    });
                }
            }
        }
    }

    return functionsList;
}

function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    let totalMinutes = hours * 60 + minutes;

    if (hours < 8) {
        totalMinutes += 24 * 60;
    }

    return totalMinutes;
}