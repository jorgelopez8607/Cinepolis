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

let allFunctions = [];
let selectedFunctionIndex = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const minRoom = parseInt(urlParams.get('min'), 10) || 1;
    const maxRoom = parseInt(urlParams.get('max'), 10) || 20;

    const badge = document.getElementById('active-range-badge');
    if (badge) {
        badge.textContent = `Salas ${minRoom} - ${maxRoom}`;
    }

    const scheduleContainer = document.getElementById('schedule-container');
    const bannerContainer = document.getElementById('delay-banner-container');
    const sortSelect = document.getElementById('sort-select');

    // 1. Cargar y restaurar preferencia de ordenamiento desde localStorage
    const savedSort = localStorage.getItem('cinepolis_sort_preference');
    if (savedSort && sortSelect) {
        sortSelect.value = savedSort;
    }

    // 2. Escuchar cambios en el selector de ordenamiento
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            localStorage.setItem('cinepolis_sort_preference', sortSelect.value);
            sortAndRender();
        });
    }

    function addMinutesToTimeStr(timeStr, minsToAdd) {
        if (!timeStr || !minsToAdd) return timeStr;
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return timeStr;

        let hours = parseInt(match[1], 10);
        let minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        let totalMins = hours * 60 + minutes + minsToAdd;

        let newHours = Math.floor(totalMins / 60) % 24;
        let newMins = totalMins % 60;

        let newPeriod = newHours >= 12 ? "PM" : "AM";
        let displayHours = newHours % 12;
        if (displayHours === 0) displayHours = 12;

        let displayMins = newMins < 10 ? `0${newMins}` : `${newMins}`;

        return `${displayHours}:${displayMins} ${newPeriod}`;
    }

    function getCinematicMinutes(timeStr) {
        if (!timeStr) return 0;
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return 0;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();

        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        let total = hours * 60 + minutes;
        if (hours < 8) total += 24 * 60;

        return total;
    }

    function renderBannersAndSchedule(functions) {
        if (!scheduleContainer) return;
        scheduleContainer.innerHTML = '';
        if (bannerContainer) bannerContainer.innerHTML = '';

        // 1. Mapear desfases por Sala
        const roomDelays = {};
        allFunctions.forEach(fn => {
            const roomNum = parseInt(fn.room || fn.sala, 10);
            if (fn.is_desfasada && fn.desfase_minutos > 0) {
                roomDelays[roomNum] = Math.max(roomDelays[roomNum] || 0, fn.desfase_minutos);
            }
        });

        // 2. Renderizar SIEMPRE el Recordatorio superior y los banners de desfase si los hay
        if (bannerContainer) {
            // Recordatorio permanente
            const reminderBox = document.createElement('div');
            reminderBox.className = 'delay-reminder-note';
            reminderBox.innerHTML = `
                <i class="fa-solid fa-clock" style="color: #60a5fa;"></i>
                <span><strong>Recordatorio:</strong> Procura estar afuera de la sala 10 minutos antes de la hora ajustada.</span>
            `;
            bannerContainer.appendChild(reminderBox);

            // Banners individuales por sala desfasada
            const activeRooms = Object.keys(roomDelays).map(r => parseInt(r, 10)).filter(r => r >= minRoom && r <= maxRoom);
            activeRooms.forEach(rNum => {
                const delayMins = roomDelays[rNum];
                const banner = document.createElement('div');
                banner.className = 'delay-alert-banner';
                banner.innerHTML = `
                    <div class="delay-banner-info">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 18px;"></i>
                        <span>Sala (${rNum}) tiene un desfase de ${delayMins} minutos</span>
                    </div>
                    <button class="btn-cancel-delay" onclick="clearRoomDelay(${rNum})" title="Cancelar desfase y regresar al horario original">
                        <i class="fa-solid fa-rotate-left"></i> Cancelar
                    </button>
                `;
                bannerContainer.appendChild(banner);
            });
        }

        if (!functions || functions.length === 0) {
            scheduleContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">
                    <i class="fa-solid fa-calendar-xmark" style="font-size: 48px; margin-bottom: 15px; display: block; color: #555;"></i>
                    <p style="font-size: 18px; font-weight: 500;">No hay horarios activos publicados en la nube.</p>
                </div>
            `;
            return;
        }

        // 3. Renderizar Tarjetas
        functions.forEach((item) => {
            const indexInDb = item._originalIndex;
            const sala = item.room || item.sala || 'N/A';
            const roomNum = parseInt(sala, 10);
            const titulo = item.title || item.titulo || 'Sin Título';

            const originalHoraInicio = item.startTime || item.horaInicio || '--:--';
            const originalHoraFin = item.endTime || item.finishTime || item.horaFin || '--:--';

            // Atributos separados e independientes
            const estado = item.estado_funcion || 'normal';
            const isDesfasada = Boolean(item.is_desfasada);
            const limpiadaPor = item.limpiada_por || '';
            const isCleaned = Boolean(limpiadaPor);

            const roomDelay = roomDelays[roomNum] || 0;
            const isRoomDesfasada = roomDelay > 0;

            const adjustedHoraInicio = isRoomDesfasada ? addMinutesToTimeStr(originalHoraInicio, roomDelay) : originalHoraInicio;
            const adjustedHoraFin = isRoomDesfasada ? addMinutesToTimeStr(originalHoraFin, roomDelay) : originalHoraFin;

            const cardClasses = [
                'movie-card',
                estado !== 'normal' ? 'status-' + estado : '',
                isRoomDesfasada ? 'has-delay' : '',
                isCleaned ? 'is-cleaned' : ''
            ].filter(Boolean).join(' ');

            const card = document.createElement('div');
            card.className = cardClasses;

            card.innerHTML = `
                <div class="card-top">
                    <span class="room-number">
                        SALA ${sala}
                        ${isRoomDesfasada ? `<span class="delay-badge">+${roomDelay} MIN DESFASE</span>` : ''}
                        ${estado === 'cancelada' ? `<span class="delay-badge" style="background:#ef4444; color:#fff;">CANCELADA</span>` : ''}
                        ${isCleaned ? `<span class="clean-badge"><i class="fa-solid fa-broom"></i> ${limpiadaPor}</span>` : ''}
                    </span>
                    <div class="card-actions">
                        <!-- 1. Palomita (Terminó Bien) -->
                        <button class="action-btn btn-ok ${estado === 'completada' ? 'active' : ''}" 
                                onclick="toggleStatus(${indexInDb}, 'completada')" 
                                title="Función terminada bien">
                            <i class="fa-solid fa-check"></i>
                        </button>

                        <!-- 2. Escoba (Limpieza independiente) -->
                        <button class="action-btn btn-clean ${isCleaned ? 'active' : ''}" 
                                onclick="handleCleanButtonClick(${indexInDb}, ${isCleaned})" 
                                title="Registrar limpieza de sala">
                            <i class="fa-solid fa-broom"></i>
                        </button>

                        <!-- 3. Flecha (Desfase independiente) -->
                        <button class="action-btn btn-delay ${isDesfasada ? 'active' : ''}" 
                                onclick="handleDelayButtonClick(${indexInDb}, ${isDesfasada})" 
                                title="Registrar/Quitar desfase de minutos">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </button>

                        <!-- 4. X (Cancelar) -->
                        <button class="action-btn btn-cancel ${estado === 'cancelada' ? 'active' : ''}" 
                                onclick="toggleStatus(${indexInDb}, 'cancelada')" 
                                title="Cancelar función">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <h3 class="movie-title">${titulo}</h3>
                <div class="time-info">
                    <div class="time-item">
                        <span>HORA INICIAR</span>
                        <strong>${adjustedHoraInicio}</strong>
                        ${isRoomDesfasada ? `<span class="time-adjusted">(Orig: ${originalHoraInicio})</span>` : ''}
                    </div>
                    <div class="time-item">
                        <span>HORA TERMINAR</span>
                        <strong>${adjustedHoraFin}</strong>
                        ${isRoomDesfasada ? `<span class="time-adjusted">(Orig: ${originalHoraFin})</span>` : ''}
                    </div>
                </div>
            `;
            scheduleContainer.appendChild(card);
        });
    }

    function sortAndRender() {
        const sortBy = sortSelect ? sortSelect.value : 'start';

        const filteredFunctions = allFunctions
            .map((fn, idx) => ({ ...fn, _originalIndex: idx }))
            .filter(fn => {
                const roomNum = parseInt(fn.room || fn.sala, 10);
                return roomNum >= minRoom && roomNum <= maxRoom;
            });

        filteredFunctions.sort((a, b) => {
            const timeA = sortBy === 'finish' ? (a.endTime || a.finishTime) : a.startTime;
            const timeB = sortBy === 'finish' ? (b.endTime || b.finishTime) : b.startTime;

            return getCinematicMinutes(timeA) - getCinematicMinutes(timeB);
        });

        renderBannersAndSchedule(filteredFunctions);
    }

    // Escuchar Firebase en tiempo real
    db.ref('horario_activo/funciones').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allFunctions = Array.isArray(data) ? data : Object.values(data);
        } else {
            allFunctions = [];
        }
        sortAndRender();
    });
});

window.clearRoomDelay = function(roomNumber) {
    const updates = {};
    allFunctions.forEach((fn, idx) => {
        const rNum = parseInt(fn.room || fn.sala, 10);
        if (rNum === roomNumber) {
            updates[`horario_activo/funciones/${idx}/is_desfasada`] = false;
            updates[`horario_activo/funciones/${idx}/desfase_minutos`] = 0;
        }
    });

    if (Object.keys(updates).length > 0) {
        db.ref().update(updates);
    }
};

window.toggleStatus = function(index, statusTarget) {
    if (index === null || index === undefined) return;
    const current = allFunctions[index]?.estado_funcion || 'normal';
    const newStatus = (current === statusTarget) ? 'normal' : statusTarget;

    db.ref(`horario_activo/funciones/${index}`).update({
        estado_funcion: newStatus
    });
};

window.handleCleanButtonClick = function(index, isCleaned) {
    if (isCleaned) {
        db.ref(`horario_activo/funciones/${index}`).update({
            limpiada_por: ''
        });
    } else {
        openCleanModal(index);
    }
};

window.openCleanModal = function(index) {
    selectedFunctionIndex = index;
    const input = document.getElementById('cleaner-name-input');
    if (input) input.value = '';
    document.getElementById('clean-modal').classList.remove('hidden');
    setTimeout(() => input && input.focus(), 100);
};

window.closeCleanModal = function() {
    selectedFunctionIndex = null;
    document.getElementById('clean-modal').classList.add('hidden');
};

window.confirmClean = function() {
    const input = document.getElementById('cleaner-name-input');
    const name = input ? input.value.trim() : '';

    if (!name) {
        alert("Por favor escribe quién limpió la sala.");
        return;
    }

    if (selectedFunctionIndex !== null) {
        db.ref(`horario_activo/funciones/${selectedFunctionIndex}`).update({
            limpiada_por: name
        });
    }

    closeCleanModal();
};

window.handleDelayButtonClick = function(index, isDesfasada) {
    if (isDesfasada) {
        db.ref(`horario_activo/funciones/${index}`).update({
            is_desfasada: false,
            desfase_minutos: 0
        });
    } else {
        openDelayModal(index);
    }
};

window.openDelayModal = function(index) {
    selectedFunctionIndex = index;
    const input = document.getElementById('delay-minutes-input');
    if (input) input.value = '';
    document.getElementById('delay-modal').classList.remove('hidden');
    setTimeout(() => input && input.focus(), 100);
};

window.closeDelayModal = function() {
    selectedFunctionIndex = null;
    document.getElementById('delay-modal').classList.add('hidden');
};

window.confirmDelay = function() {
    const input = document.getElementById('delay-minutes-input');
    const minutes = parseInt(input.value, 10);

    if (isNaN(minutes) || minutes <= 0) {
        alert("Por favor ingresa una cantidad de minutos válida.");
        return;
    }

    if (selectedFunctionIndex !== null) {
        db.ref(`horario_activo/funciones/${selectedFunctionIndex}`).update({
            is_desfasada: true,
            desfase_minutos: minutes
        });
    }

    closeDelayModal();
};

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
}