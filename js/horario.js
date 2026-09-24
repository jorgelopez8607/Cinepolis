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

let parsedMoviesData = [];

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('cinepolis_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const data = localStorage.getItem('cinepolis_movies');
    const roomRange = localStorage.getItem('cinepolis_rooms');

    if (!data) {
        window.location.href = 'index.html';
        return;
    }

    parsedMoviesData = JSON.parse(data);

    const activeRangeBadge = document.getElementById('active-range-badge');
    if (activeRangeBadge && roomRange) {
        activeRangeBadge.textContent = roomRange;
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', renderSchedule);
    }

    renderSchedule();
});

function getCurrentTimeInMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function renderSchedule() {
    const scheduleContainer = document.getElementById('schedule-container');
    const sortSelect = document.getElementById('sort-select');

    if (!scheduleContainer) return;

    const sortBy = sortSelect ? sortSelect.value : 'finish';
    const currentDeviceMinutes = getCurrentTimeInMinutes();

    let filtered = [...parsedMoviesData];

    filtered.sort((a, b) => {
        if (sortBy === 'start') return a.startMinutes - b.startMinutes;
        return a.finishMinutes - b.finishMinutes;
    });

    scheduleContainer.innerHTML = '';

    if (filtered.length === 0) {
        scheduleContainer.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center;">No hay funciones registradas.</p>';
        return;
    }

    filtered.forEach(item => {
        const isFinishedByTime = currentDeviceMinutes >= item.finishMinutes;
        const isCompleted = item.manualCompleted || isFinishedByTime;

        const card = document.createElement('div');
        card.className = `movie-card ${isCompleted ? 'completed' : ''}`;
        
        card.innerHTML = `
            <div class="card-top">
                <span class="room-number">SALA ${item.room}</span>
                <span class="format-tag">${item.format}</span>
                <button class="check-btn ${isCompleted ? 'active' : ''}" onclick="toggleCompleted('${item.id}')" title="Marcar/Desmarcar estado">
                    <i class="fa-solid fa-circle-check"></i>
                </button>
            </div>
            <div class="movie-title">${item.title}</div>
            <div class="time-info">
                <div class="time-item">
                    <span>INICIO</span>
                    <strong>${item.startTime}</strong>
                </div>
                <div class="time-item">
                    <span>TERMINA</span>
                    <strong>${item.finishTime}</strong>
                </div>
            </div>
            <button class="post-credits-btn" onclick="checkCredits('${item.title.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-film"></i> Ver Post-Créditos
            </button>
        `;
        scheduleContainer.appendChild(card);
    });
}

function toggleCompleted(itemId) {
    const item = parsedMoviesData.find(m => m.id === itemId);
    if (item) {
        item.manualCompleted = !item.manualCompleted;
        localStorage.setItem('cinepolis_movies', JSON.stringify(parsedMoviesData));
        renderSchedule();
    }
}

async function checkCredits(movieTitle) {
    const modal = document.getElementById('credits-modal');
    const titleElem = document.getElementById('modal-movie-title');
    const infoElem = document.getElementById('credits-info');

    titleElem.textContent = movieTitle;
    infoElem.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consultando en la nube...';
    modal.style.display = "flex";

    // 1. Limpiar el título removiendo etiquetas (Esp, Sub, 3D, XE, blah blah blah.) igual que en admin.js
    let cleanTitle = movieTitle
    .replace(/\s+(Esp|Sub|3D|XE)\b/gi, "")
    .replace(/\s+SP\b/gi, "")
    .trim();

    // 2. Generar la clave sanitizada para Firebase
    const movieKey = cleanTitle.replace(/[.#$/\[\]]/g, "_");

    try {
        const snapshot = await db.ref(`post_credits/${movieKey}`).once('value');
        const data = snapshot.val();

        if (data) {
            if (data.hasCredits) {
                infoElem.innerHTML = `
                    <div style="text-align: center;">
                        <i class="fa-solid fa-circle-check" style="color: #22c55e; font-size: 36px; margin-bottom: 10px;"></i>
                        <p><strong style="color: #22c55e; font-size: 18px;">SÍ TIENE POST-CRÉDITOS</strong></p>
                        <p style="font-size: 14px; margin-top: 8px;">Tiene <strong>${data.creditsCount}</strong> escena post.</p>
                    </div>
                `;
            } else {
                infoElem.innerHTML = `
                    <div style="text-align: center;">
                        <i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 36px; margin-bottom: 10px;"></i>
                        <p><strong style="color: #ef4444; font-size: 18px;">NO TIENE POST-CRÉDITOS</strong></p>
                        <p style="font-size: 12px; margin-top: 5px; color: var(--text-muted);"></p>
                    </div>
                `;
            }
        } else {
            infoElem.innerHTML = `
                <div style="text-align: center;">
                    <i class="fa-solid fa-circle-question" style="color: var(--accent-gold); font-size: 36px; margin-bottom: 10px;"></i>
                    <p><strong>SIN REGISTRO</strong></p>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 5px;">No se ha configurado la información de esta película en el admin.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
        infoElem.innerHTML = "Error al conectar con la base de datos.";
    }
}

function toggleTheme() {
    const htmlElem = document.documentElement;
    const currentTheme = htmlElem.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElem.setAttribute('data-theme', newTheme);
    localStorage.setItem('cinepolis_theme', newTheme);
}

document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('credits-modal').style.display = "none";
});

window.onclick = function(event) {
    const modal = document.getElementById('credits-modal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
};