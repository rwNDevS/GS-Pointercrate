// backend-corregido.js

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.resolve("./public")));

// Cambia esta línea - usa el puerto que Render asigna o el que tú definas localmente
const PORT = process.env.PORT || 8040;

const demonsFile = './demons.json';
const cuentasFile = './cuentas.json';
const completacionesFile = './completaciones.json';

// --- Funciones Auxiliares ---
function leerArchivo(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`Advertencia: Archivo no encontrado en ${filePath}. Creando un archivo vacío.`);
            fs.writeFileSync(filePath, '[]', 'utf8');
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error(`Error leyendo ${filePath}:`, err);
        return [];
    }
}

function escribirArchivo(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error(`Error escribiendo ${filePath}:`, err);
        return false;
    }
}

function registrarCambioPosicion(demon, nuevaPosicion) {
    if (!demon.historialPosiciones) {
        demon.historialPosiciones = [];
    }
    const ultimaPosicion = demon.historialPosiciones.length > 0 ? demon.historialPosiciones[demon.historialPosiciones.length - 1].posicion : null;
    if (ultimaPosicion !== nuevaPosicion) {
        demon.historialPosiciones.push({
            posicion: nuevaPosicion,
            fecha: new Date().toISOString()
        });
    }
}

function calcularPuntos(posicion) {
    if (posicion > 30 || posicion < 1) {
        return 0;
    }
    const maxPoints = 100;
    const minPoints = 1;
    const decay = (maxPoints - minPoints) / 29;
    const points = maxPoints - (posicion - 1) * decay;
    return Math.max(minPoints, Math.round(points));
}

// --- Rutas Demonios ---
app.get('/api/demons', (req, res) => {
    console.log('GET /api/demons - Solicitado.');
    const demons = leerArchivo(demonsFile);
    res.json(demons);
});

app.get('/api/demons/:idNivel/historial', (req, res) => {
    const idNivel = req.params.idNivel;
    console.log(`GET /api/demons/${idNivel}/historial - Solicitado.`);
    const demons = leerArchivo(demonsFile);
    const demon = demons.find(d => d.idNivel === idNivel);
    if (!demon) {
        console.warn(`GET /api/demons/${idNivel}/historial - Demon no encontrado.`);
        return res.status(404).json({ error: 'Demon no encontrado' });
    }
    res.json(demon.historialPosiciones || []);
});

app.post('/api/demons', (req, res) => {
    const nuevoDemon = req.body;
    console.log('POST /api/demons - Solicitado para agregar nuevo demon:', nuevoDemon);
    if (!nuevoDemon || !nuevoDemon.name || !nuevoDemon.posicion || !nuevoDemon.idNivel) {
        console.error('POST /api/demons - Error: Datos incompletos.');
        return res.status(400).json({ error: 'Datos incompletos del demon' });
    }

    const demons = leerArchivo(demonsFile);
    if (demons.some(d => d.idNivel === nuevoDemon.idNivel)) {
        console.error(`POST /api/demons - Error: El demonio con idNivel ${nuevoDemon.idNivel} ya existe.`);
        return res.status(409).json({ error: 'El demonio con este ID de nivel ya existe' });
    }

    demons.forEach(demon => {
        if (demon.posicion >= nuevoDemon.posicion) {
            demon.posicion++;
            registrarCambioPosicion(demon, demon.posicion);
        }
    });

    nuevoDemon.historialPosiciones = [{
        posicion: nuevoDemon.posicion,
        fecha: new Date().toISOString()
    }];
    demons.push(nuevoDemon);
    demons.sort((a, b) => a.posicion - b.posicion);

    if (!escribirArchivo(demonsFile, demons)) {
        console.error('POST /api/demons - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error guardando demonio' });
    }

    console.log('POST /api/demons - Demon agregado exitosamente.');
    res.json({ success: true, message: 'Demon agregado exitosamente' });
});

// RUTA PATCH: Actualiza la posición de un demonio existente
app.patch('/api/demons/:idNivel/posicion', (req, res) => {
    const idNivel = req.params.idNivel;
    const { nuevaPosicion } = req.body;
    console.log(`PATCH /api/demons/${idNivel}/posicion - Solicitado para mover a la posición ${nuevaPosicion}.`);

    if (typeof nuevaPosicion !== 'number' || nuevaPosicion <= 0) {
        console.error(`PATCH /api/demons/${idNivel}/posicion - Error: Posición inválida.`);
        return res.status(400).json({ error: 'La nuevaPosicion debe ser un número entero positivo' });
    }

    const demons = leerArchivo(demonsFile);
    const demonIndex = demons.findIndex(d => d.idNivel === idNivel);
    if (demonIndex === -1) {
        console.warn(`PATCH /api/demons/${idNivel}/posicion - Demon no encontrado.`);
        return res.status(404).json({ error: 'Demon no encontrado' });
    }

    const demonActualizado = demons[demonIndex];
    const posicionAnterior = demonActualizado.posicion;
    if (posicionAnterior === nuevaPosicion) {
        console.log(`PATCH /api/demons/${idNivel}/posicion - La posición no ha cambiado.`);
        return res.json({ success: true, message: 'La posición no ha cambiado' });
    }

    demonActualizado.posicion = nuevaPosicion;
    registrarCambioPosicion(demonActualizado, nuevaPosicion);

    demons.forEach(demon => {
        if (demon.idNivel === idNivel) return;
        if (posicionAnterior < nuevaPosicion) {
            if (demon.posicion > posicionAnterior && demon.posicion <= nuevaPosicion) {
                demon.posicion--;
                registrarCambioPosicion(demon, demon.posicion);
            }
        } else {
            if (demon.posicion < posicionAnterior && demon.posicion >= nuevaPosicion) {
                demon.posicion++;
                registrarCambioPosicion(demon, demon.posicion);
            }
        }
    });

    demons.sort((a, b) => a.posicion - b.posicion);

    if (!escribirArchivo(demonsFile, demons)) {
        console.error('PATCH /api/demons/posicion - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error al actualizar la posición' });
    }

    console.log(`PATCH /api/demons/${idNivel}/posicion - Posición actualizada correctamente.`);
    res.json({ success: true, message: 'Posición actualizada correctamente' });
});

// NUEVA RUTA: Editar un demonio completo (sin cambiar posición)
app.patch('/api/demons/:idNivel', (req, res) => {
    const idNivel = req.params.idNivel;
    const { name, creador, verificador, dificultad } = req.body;
    console.log(`PATCH /api/demons/${idNivel} - Solicitado para editar demon.`);

    const demons = leerArchivo(demonsFile);
    const demonIndex = demons.findIndex(d => d.idNivel === idNivel);
    if (demonIndex === -1) {
        console.warn(`PATCH /api/demons/${idNivel} - Demon no encontrado.`);
        return res.status(404).json({ error: 'Demon no encontrado' });
    }

    const demon = demons[demonIndex];
    if (name) demon.name = name;
    if (creador) demon.creador = creador;
    if (verificador) demon.verificador = verificador;
    if (dificultad) demon.dificultad = dificultad;

    if (!escribirArchivo(demonsFile, demons)) {
        console.error('PATCH /api/demons - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error al actualizar demonio' });
    }

    console.log(`PATCH /api/demons/${idNivel} - Demon actualizado correctamente.`);
    res.json({ success: true, message: 'Demon actualizado correctamente', demon });
});

app.delete('/api/demons/:idNivel', (req, res) => {
    const idNivel = req.params.idNivel;
    console.log(`DELETE /api/demons/${idNivel} - Solicitado.`);
    let demons = leerArchivo(demonsFile);
    const eliminado = demons.find(d => d.idNivel === idNivel);
    if (!eliminado) {
        console.warn(`DELETE /api/demons/${idNivel} - Demon no encontrado.`);
        return res.status(404).json({ error: 'Demon no encontrado' });
    }

    const posicionEliminada = eliminado.posicion;
    demons = demons.filter(d => d.idNivel !== idNivel);

    demons.forEach(demon => {
        if (demon.posicion > posicionEliminada) {
            demon.posicion--;
            registrarCambioPosicion(demon, demon.posicion);
        }
    });

    if (!escribirArchivo(demonsFile, demons)) {
        console.error('DELETE /api/demons/ - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error al eliminar demonio' });
    }

    console.log(`DELETE /api/demons/${idNivel} - Demon eliminado exitosamente.`);
    res.json({ success: true });
});

// --- Rutas Cuentas ---
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    console.log(`POST /api/login - Intento de login para el usuario: ${username}.`);
    if (!username || !password) {
        console.error('POST /api/login - Error: Datos incompletos.');
        return res.status(400).json({ error: 'Datos incompletos de cuenta.' });
    }

    const accounts = leerArchivo(cuentasFile);
    const account = accounts.find(c => c.usuario === username && c.contraseña === password);

    if (account) {
        // Verificar si la cuenta está baneada
        if (account.banned) {
            console.warn(`POST /api/login - Usuario baneado: ${username}.`);
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta al administrador.' });
        }
        console.log(`POST /api/login - Login exitoso para el usuario: ${username}.`);
        return res.status(200).json({ usuario: account.usuario, rol: account.rol });
    } else {
        console.warn(`POST /api/login - Login fallido para el usuario: ${username}.`);
        return res.status(403).json({ error: 'Usuario o contraseña incorrecto' });
    }
});

app.post('/api/cuentas', (req, res) => {
    const { usuario, contraseña, rol } = req.body;
    console.log(`POST /api/cuentas - Solicitud de registro para el usuario: ${usuario}.`);
    if (!usuario || !contraseña || !rol) {
        console.error('POST /api/cuentas - Error: Datos incompletos.');
        return res.status(400).json({ error: 'Datos incompletos de cuenta' });
    }

    const cuentas = leerArchivo(cuentasFile);
    if (cuentas.find(c => c.usuario === usuario)) {
        console.warn(`POST /api/cuentas - Error: El usuario ${usuario} ya existe.`);
        return res.status(409).json({ success: false, message: 'Usuario ya existe' });
    }

    cuentas.push({ usuario, contraseña, rol, banned: false });
    if (!escribirArchivo(cuentasFile, cuentas)) {
        console.error('POST /api/cuentas - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error guardando cuenta' });
    }

    console.log(`POST /api/cuentas - Cuenta para ${usuario} creada exitosamente.`);
    res.status(201).json({ success: true });
});

// NUEVA RUTA: Obtener todas las cuentas (solo admin)
app.get('/api/cuentas', (req, res) => {
    console.log('GET /api/cuentas - Solicitado.');
    const cuentas = leerArchivo(cuentasFile);
    // Ocultar contraseñas
    const cuentasSinPass = cuentas.map(c => ({
        usuario: c.usuario,
        rol: c.rol,
        banned: c.banned || false
    }));
    res.json(cuentasSinPass);
});

// NUEVA RUTA: Banear/Desbanear usuario
app.patch('/api/cuentas/:usuario/ban', (req, res) => {
    const usuario = req.params.usuario;
    const { banned } = req.body;
    console.log(`PATCH /api/cuentas/${usuario}/ban - Solicitado cambiar estado ban a: ${banned}.`);

    if (typeof banned !== 'boolean') {
        console.error(`PATCH /api/cuentas/${usuario}/ban - Error: banned debe ser boolean.`);
        return res.status(400).json({ error: 'El campo banned debe ser true o false' });
    }

    const cuentas = leerArchivo(cuentasFile);
    const cuentaIndex = cuentas.findIndex(c => c.usuario === usuario);
    if (cuentaIndex === -1) {
        console.warn(`PATCH /api/cuentas/${usuario}/ban - Usuario no encontrado.`);
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    cuentas[cuentaIndex].banned = banned;

    if (!escribirArchivo(cuentasFile, cuentas)) {
        console.error('PATCH /api/cuentas/ban - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error al actualizar estado de ban' });
    }

    console.log(`PATCH /api/cuentas/${usuario}/ban - Estado actualizado correctamente.`);
    res.json({ success: true, message: `Usuario ${banned ? 'baneado' : 'desbaneado'} correctamente` });
});

// --- Rutas Completaciones ---
app.get('/api/completaciones', (req, res) => {
    console.log('GET /api/completaciones - Solicitado.');
    const completaciones = leerArchivo(completacionesFile);
    res.json(completaciones);
});

app.post('/api/completaciones', (req, res) => {
    const nueva = req.body;
    console.log('POST /api/completaciones - Solicitado para agregar completación:', nueva);
    if (!nueva || !nueva.usuario || !nueva.nivel || !nueva.prueba) {
        console.error('POST /api/completaciones - Error: Datos incompletos.');
        return res.status(400).json({ error: 'Datos incompletos en completación' });
    }

    const completaciones = leerArchivo(completacionesFile);
    const id = Date.now().toString();
    completaciones.push({ ...nueva, estado: 'pendiente', id });
    if (!escribirArchivo(completacionesFile, completaciones)) {
        console.error('POST /api/completaciones - Error al guardar en el archivo.');
        return res.status(500).json({ error: 'Error guardando completación' });
    }

    console.log('POST /api/completaciones - Completación agregada exitosamente.');
    res.json({ success: true });
});

app.patch('/api/completaciones/:id', (req, res) => {
    const id = req.params.id;
    const { estado } = req.body;
    console.log(`PATCH /api/completaciones/${id} - Solicitud de actualización a estado: ${estado}.`);

    if (!['aprobado', 'rechazado'].includes(estado)) {
        console.error(`PATCH /api/completaciones/${id} - Error: Estado inválido.`);
        return res.status(400).json({ error: 'Estado inválido' });
    }

    const completaciones = leerArchivo(completacionesFile);
    const index = completaciones.findIndex(c => c.id === id);
    if (index === -1) {
        console.warn(`PATCH /api/completaciones/${id} - Completación no encontrada.`);
        return res.status(404).json({ error: 'Completación no encontrada' });
    }

    if (estado === 'aprobado' && completaciones[index].estado !== 'aprobado') {
        const demons = leerArchivo(demonsFile);
        const demonAprobado = demons.find(d => d.name === completaciones[index].nivel);
        if (demonAprobado) {
            completaciones[index].posicionAlCompletar = demonAprobado.posicion;
        }
    }
    completaciones[index].estado = estado;

    if (!escribirArchivo(completacionesFile, completaciones)) {
        console.error(`PATCH /api/completaciones/${id} - Error al guardar en el archivo.`);
        return res.status(500).json({ error: 'No se pudo actualizar la completación' });
    }

    console.log(`PATCH /api/completaciones/${id} - Completación actualizada a estado: ${estado}.`);
    res.json({ success: true });
});

// --- RUTA PARA EL RANKING TOP ---
app.get('/api/top', (req, res) => {
    console.log('GET /api/top - Solicitado.');
    const demons = leerArchivo(demonsFile);
    const completaciones = leerArchivo(completacionesFile);
    const demonMap = {};
    demons.forEach(d => {
        demonMap[d.name] = d;
    });

    const usuarios = {};
    completaciones.forEach(c => {
        if (c.estado !== 'aprobado') return;
        const posicionParaPuntos = c.posicionAlCompletar || (demonMap[c.nivel] ? demonMap[c.nivel].posicion : null);
        if (!posicionParaPuntos) {
            console.warn(`Advertencia: No se encontró la posición para el nivel ${c.nivel} del usuario ${c.usuario}.`);
            return;
        }
        const puntos = calcularPuntos(posicionParaPuntos);
        if (!usuarios[c.usuario]) {
            usuarios[c.usuario] = { puntos: 0, completaciones: 0 };
        }
        usuarios[c.usuario].puntos += puntos;
        usuarios[c.usuario].completaciones++;
    });

    const ranking = Object.entries(usuarios)
        .map(([usuario, data]) => ({ usuario, ...data }))
        .sort((a, b) => b.puntos - a.puntos || b.completaciones - a.completaciones);

    res.json(ranking);
});

// Al final, cambia esta línea también:
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
