document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('cinepolis_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const pdfFileInput = document.getElementById('pdf-file');
    const fileNameDisplay = document.getElementById('file-name');
    const btnProcess = document.getElementById('btn-process');
    const setupForm = document.getElementById('setup-form');

    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                fileNameDisplay.textContent = `Archivo: ${file.name}`;
                btnProcess.disabled = false;
            } else {
                fileNameDisplay.textContent = '';
                btnProcess.disabled = true;
            }
        });
    }

    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const file = pdfFileInput.files[0];
            const roomMin = parseInt(document.getElementById('room-min').value, 10);
            const roomMax = parseInt(document.getElementById('room-max').value, 10);

            if (!file) return;

            btnProcess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leyendo PDF...';
            btnProcess.disabled = true;

            try {
                const parsedMoviesData = await parseCinepolisPDF(file, roomMin, roomMax);

                localStorage.setItem('cinepolis_movies', JSON.stringify(parsedMoviesData));
                localStorage.setItem('cinepolis_rooms', `Salas ${roomMin} - ${roomMax}`);

                window.location.href = 'horario.html';
            } catch (error) {
                alert('Error al procesar el archivo PDF. Asegúrate de seleccionar el reporte de Vista.');
                console.error(error);
            } finally {
                btnProcess.innerHTML = '<i class="fa-solid fa-gears"></i> Cargar y Leer PDF';
                btnProcess.disabled = false;
            }
        });
    }
});

function toggleTheme() {
    const htmlElem = document.documentElement;
    const currentTheme = htmlElem.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElem.setAttribute('data-theme', newTheme);
    localStorage.setItem('cinepolis_theme', newTheme);
}