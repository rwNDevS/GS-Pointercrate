const API_URL = 'https://pointcrate.purriau.com'; // Cambia si subes el backend

// Devuelve el usuario logeado (guardado en localStorage solo como sesión)
function getUsuarioActual() {
  return JSON.parse(localStorage.getItem('usuarioLogeado'));
}

// Intenta iniciar sesión
async function loginUsuario() {
  const usuario = document.getElementById('loginUsuario').value.trim();
  const contraseña = document.getElementById('loginContraseña').value.trim();

  try {
    // Pide todas las cuentas al backend
    const res = await fetch(`${API_URL}/cuentas`);
    if (!res.ok) throw new Error('Error en la respuesta del servidor');

    const cuentas = await res.json();

    // Busca la cuenta que coincida con usuario y contraseña
    const cuenta = cuentas.find(c => c.usuario === usuario && c.contraseña === contraseña);

    if (cuenta) {
      // Guarda sesión en localStorage
      localStorage.setItem('usuarioLogeado', JSON.stringify(cuenta));
      alert(`Bienvenido ${cuenta.usuario} (${cuenta.rol})`);
      if(typeof mostrarFormulario === 'function') mostrarFormulario(); // Asegura que exista la función antes de llamar
    } else {
      alert('Usuario o contraseña incorrectos');
    }
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    alert('Error de conexión con el servidor');
  }
}

// Cierra sesión
function logoutUsuario() {
  localStorage.removeItem('usuarioLogeado');
  alert('Sesión cerrada');
  const demonForm = document.getElementById('demonForm');
  if (demonForm) demonForm.style.display = 'none';
}

// Registra nuevo usuario normal
async function registrarUsuario(usuario, contraseña) {
  try {
    const res = await fetch(`${API_URL}/cuentas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contraseña, rol: 'user' })
    });

    if (!res.ok) throw new Error('Error en la respuesta al registrar');

    const data = await res.json();

    if (data.success) {
      alert('Cuenta creada correctamente');
      return true;
    } else {
      alert('Ese usuario ya existe');
      return false;
    }
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    alert('Error de conexión al registrar');
    return false;
  }
}

