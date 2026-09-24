async function parseCinepolisPDF(file, minRoom, maxRoom) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allTokens = [];

    // 1. Extraer todos los tokens ORDENADOS por su posición en la página (de arriba a abajo, de izquierda a derecha)
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Ordenar ítems visualmente: Primero por Y (vertical descendente) y luego por X (horizontal ascendente)
        const sortedItems = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // Coordenada Y
            if (Math.abs(yDiff) > 5) { // Si están en líneas verticales distintas
                return yDiff;
            }
            return a.transform[4] - b.transform[4]; // Coordenada X (misma línea)
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

    // 2. Recorrer los tokens procesando las funciones en orden real
    for (let i = 0; i < allTokens.length; i++) {
        const token = allTokens[i];
        
        // Comprobar si el token es una SALA (ej. "SALA 2")
        const roomMatch = token.match(roomRegex);
        if (roomMatch) {
            currentRoom = parseInt(roomMatch[1], 10);
            continue;
        }

        // Si la sala está en el rango y encontramos la HORA DE INICIO
        if (currentRoom && currentRoom >= minRoom && currentRoom <= maxRoom && timeRegex.test(token)) {
            const startTime = token; // Primera hora detectada: INICIO (ej. 11:20AM)
            
            // Buscar la HORA DE TÉRMINO en los siguientes tokens
            let finishTime = "";
            let idx = i + 1;

            while (idx < allTokens.length && idx < i + 6) {
                if (timeRegex.test(allTokens[idx])) {
                    finishTime = allTokens[idx]; // Segunda hora detectada: TÉRMINO (ej. 1:48PM)
                    break;
                }
                idx++;
            }

            if (finishTime) {
                i = idx; // Avanzar índice a la hora de término

                let status = "Abierto";
                let movieTitle = "";
                let format = "DEFAULT";

                // Capturar Estado, Título y Formato
                let searchIdx = i + 1;
                while (searchIdx < allTokens.length && searchIdx < i + 8) {
                    const nextToken = allTokens[searchIdx];

                    if (roomRegex.test(nextToken) || timeRegex.test(nextToken)) {
                        break;
                    }

                    if (nextToken === "Abierto" || nextToken === "Cerrado") {
                        status = nextToken;
                    } else if (nextToken === "DEFAULT" || /^(2D|3D|XE|4DX|VIP|MACRO|SUB)$/i.test(nextToken)) {
                        format = nextToken;
                    } else if (!movieTitle && nextToken.length > 2) {
                        movieTitle = nextToken;
                    }
                    searchIdx++;
                }

                if (movieTitle) {
                    idCounter++;
                    functionsList.push({
                        id: `fn_${idCounter}`,
                        room: currentRoom,
                        startTime: startTime,
                        finishTime: finishTime,
                        status: status,
                        title: movieTitle,
                        format: format,
                        startMinutes: convertTimeToMinutes(startTime),
                        finishMinutes: convertTimeToMinutes(finishTime),
                        manualCompleted: false
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

    // Regla de jornada cinematográfica (10:00 AM a 1:00 AM del día siguiente)
    if (hours < 10) {
        totalMinutes += 24 * 60;
    }

    return totalMinutes;
}