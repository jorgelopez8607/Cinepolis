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

// Inicialización global compatible de Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    const btnCinepolito = document.getElementById('btn-cinepolito');
    const btnAdmin = document.getElementById('btn-admin');
    const roleSelection = document.querySelector('.role-selection');
    const hallsSection = document.getElementById('halls-section');
    const noScheduleMessage = document.getElementById('no-schedule-message');
    const authModal = document.getElementById('auth-modal');

    // Clic en Cinepolito
    btnCinepolito.addEventListener('click', () => {
        roleSelection.classList.add('hidden');

        // Consultar directamente a Firebase
        db.ref('horario_activo/funciones').once('value', (snapshot) => {
            const data = snapshot.val();
            const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);

            if (hasData) {
                hallsSection.classList.remove('hidden');
            } else {
                noScheduleMessage.classList.remove('hidden');
            }
        }).catch((error) => {
            console.error("Error al consultar Firebase:", error);
            noScheduleMessage.classList.remove('hidden');
        });
    });

    // Clic en Admin
    btnAdmin.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('admin-password').focus();
        }, 100);
    });
});

function validatePassword(e) {
    e.preventDefault();
    const passInput = document.getElementById('admin-password');
    const errorMsg = document.getElementById('auth-error');

    if (passInput.value === 'Cine2026.') {
        window.location.href = 'cinepolisAdminRooms.html';
    } else {
        errorMsg.classList.remove('hidden');
        passInput.value = '';
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('auth-modal');
    const errorMsg = document.getElementById('auth-error');
    document.getElementById('admin-password').value = '';
    errorMsg.classList.add('hidden');
    authModal.classList.add('hidden');
}

function selectHall(minRoom, maxRoom) {
    window.location.href = `horario.html?min=${minRoom}&max=${maxRoom}`;
}

function resetView() {
    document.querySelector('.role-selection').classList.remove('hidden');
    document.getElementById('halls-section').classList.add('hidden');
    document.getElementById('no-schedule-message').classList.add('hidden');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
}