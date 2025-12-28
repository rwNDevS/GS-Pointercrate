const API_URL = 'http://localhost:8040/api';

let demons = [];

function getUsuarioActual() {
  return JSON.parse(localStorage.getItem('usuarioLogeado'));
}

function mostrarFormulario() {
  const usuario = getUsuarioActual();
  if (usuario && usuario.rol === 'admin') {
    const form = document.getElementById('demonForm');
    if (form) form.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  mostrarFormulario();
  await cargarDemons();
});

async function cargarDemons() {
  try {
    const res = await fetch(`${API_URL}/demons`);
    if (!res.ok) throw new Error('Error en la respuesta del servidor');
    demons = await res.json();
    renderList();
  } catch (err) {
    console.error('Error al cargar demons:', err);
    demons = [];
  }
}

document.getElementById('demonForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const usuario = getUsuarioActual();
  if (!usuario || usuario.rol !== 'admin') {
    alert('No tienes permiso para agregar demons');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const dificultad = document.getElementById('dificultad').value;
  const idNivel = document.getElementById('idNivel').value.trim();
  const creador = document.getElementById('creador').value.trim();
  const verificador = document.getElementById('verificador').value.trim();
  const posicion = parseInt(document.getElementById('posicion').value);

  if (!name || isNaN(posicion)) {
    alert('Por favor llena todos los campos correctamente');
    return;
  }

  const nuevoDemon = { posicion, name, idNivel, creador, verificador, dificultad };

  try {
    const res = await fetch(`${API_URL}/demons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoDemon)
    });

    if (!res.ok) throw new Error('No se pudo guardar');

    demons.push(nuevoDemon);
    demons.sort((a, b) => a.posicion - b.posicion);
    renderList();
    this.reset();
  } catch (err) {
    console.error('Error al guardar demon:', err);
  }
});

function renderList() {
  const tbody = document.getElementById('listaDemonios');
  if (!tbody) return;

  tbody.innerHTML = '';
  demons.forEach(demon => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${demon.posicion}</td>
      <td>${demon.name}</td>
      <td>${demon.idNivel}</td>
      <td>${demon.creador}</td>
      <td>${demon.verificador}</td>
      <td class="${demon.dificultad}">${demon.dificultad.charAt(0).toUpperCase() + demon.dificultad.slice(1)}</td>
    `;
    tbody.appendChild(tr);
  });
}
