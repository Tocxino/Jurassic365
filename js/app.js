// Jurassic 365 — lógica de la página

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const estado = {
  datos: null,        // respuesta completa de la API
  filtro: 'todos',
  categoria: 'final',
  abierto: null       // día abierto en el modal
};

const CATEGORIAS = [
  { clave: 'peligrosidad', nombre: 'Peligrosidad' },
  { clave: 'diseno', nombre: 'Diseño' },
  { clave: 'nombre', nombre: 'Nombre' }
];

const SILUETA = 'img/silueta-trex.svg';

/* ================= Utilidades ================= */

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function num(x, dec = 2) {
  if (x === null || x === undefined) return '–';
  return Number(x).toFixed(dec).replace(/\.?0+$/, '') || '0';
}

function fechaBonita(texto) {
  const [y, m, d] = texto.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return d + ' ' + meses[m - 1] + ' ' + y;
}

function imagen(d) {
  return d.imagen ? esc(d.imagen) : SILUETA;
}

function mostrarCarga(si) {
  $('#cargando').classList.toggle('oculto', !si);
}

let avisoTimer;
function aviso(texto, tipo = '') {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = 'aviso ' + tipo;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.add('oculto'), 3500);
}

function manejarError(err) {
  console.error(err);
  if (err.sesion) {
    API.olvidar();
    mostrarLogin('Tu sesión expiró. Vuelve a entrar.');
  } else {
    aviso(err.message, 'error');
  }
}

/* ================= Login ================= */

function mostrarLogin(mensaje = '') {
  $('#vista-app').classList.add('oculto');
  $('#vista-login').classList.remove('oculto');
  $('#login-error').textContent = mensaje;
  iniciarBotonGoogle();
}

function iniciarBotonGoogle() {
  if (!window.google || !google.accounts) {
    setTimeout(iniciarBotonGoogle, 200); // el script de Google aún no carga
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.CLIENT_ID,
    callback: async respuesta => {
      mostrarCarga(true);
      try {
        await API.login(respuesta.credential);
        await cargar();
      } catch (err) {
        $('#login-error').textContent = err.message;
      } finally {
        mostrarCarga(false);
      }
    }
  });
  google.accounts.id.renderButton($('#boton-google'), {
    theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'es'
  });
}

/* ================= Carga principal ================= */

async function cargar() {
  mostrarCarga(true);
  try {
    estado.datos = await API.dinos();
    $('#vista-login').classList.add('oculto');
    $('#vista-app').classList.remove('oculto');
    $('#nombre-usuario').textContent = estado.datos.usuario.nombre;
    pintarTodo();
  } catch (err) {
    manejarError(err);
  } finally {
    mostrarCarga(false);
  }
}

function pintarTodo() {
  $('#dia-actual').textContent = estado.datos.hoy;
  pintarHoy();
  pintarGaleria();
  pintarRanking();
  const pendientes = estado.datos.dinos.filter(d => !d.bloqueado && !d.miVoto).length;
  $('#n-pendientes').textContent = pendientes;
  if (estado.abierto) abrirDetalle(estado.abierto);
}

/* ================= Dino de hoy ================= */

function pintarHoy() {
  const d = estado.datos.dinos.find(x => x.esHoy);
  if (!d) { $('#hoy').innerHTML = ''; return; }
  $('#hoy').innerHTML = `
    <article class="hoy">
      <div class="hoy-img"><img src="${imagen(d)}" alt="${esc(d.nombre)}" onerror="this.src='${SILUETA}'"></div>
      <div class="hoy-info">
        <div class="etiqueta">Dino de hoy · #${d.dia}</div>
        <h2 class="hoy-nombre">${esc(d.nombre)}</h2>
        <div class="datos">
          <span>${esc(d.grupo)}</span><span>${esc(d.periodo)}</span>
          <span>${esc(d.dieta)}</span><span>${esc(d.tamano)}</span><span>${esc(d.region)}</span>
        </div>
        <p>${esc(d.descripcion)}</p>
        ${d.wikiUrl ? `<a class="wiki-link" href="${esc(d.wikiUrl)}" target="_blank" rel="noopener">Ver en Wikipedia ↗</a>` : ''}
        <div class="hoy-acciones">
          ${d.resumen
            ? `<div class="nota-grande">${num(d.resumen.final)}<small>provisional · ${d.resumen.nVotos} voto(s)</small></div>`
            : `<div class="nota-grande vacia">Sin votos aún</div>`}
          <button class="btn" onclick="abrirDetalle(${d.dia})">${d.miVoto ? 'Ver o cambiar mi voto' : 'Calificar'}</button>
        </div>
      </div>
    </article>`;
}

/* ================= Galería ================= */

function pintarGaleria() {
  let lista = estado.datos.dinos;
  if (estado.filtro === 'desbloqueados') lista = lista.filter(d => !d.bloqueado);
  if (estado.filtro === 'pendientes') lista = lista.filter(d => !d.bloqueado && !d.miVoto);

  if (!lista.length) {
    $('#galeria').innerHTML = '<p class="vacio">¡Nada pendiente! Ya calificaste todos los dinos desbloqueados.</p>';
    return;
  }

  $('#galeria').innerHTML = lista.map(d => {
    if (d.bloqueado) {
      return `
        <button class="tarjeta bloqueada" onclick="aviso('El dino #${d.dia} se desbloquea el ${fechaBonita(d.fecha)}')">
          <div class="tarjeta-img"><img src="${SILUETA}" alt=""><span class="interrogacion">?</span></div>
          <div class="tarjeta-pie">
            <span class="num">#${d.dia}</span>
            <span class="tarjeta-nombre">???</span>
            <span class="fecha">${fechaBonita(d.fecha)}</span>
          </div>
        </button>`;
    }
    const nota = d.resumen ? num(d.resumen.final) : '–';
    return `
      <button class="tarjeta ${d.esHoy ? 'es-hoy' : ''}" onclick="abrirDetalle(${d.dia})">
        <div class="tarjeta-img">
          <img src="${imagen(d)}" alt="${esc(d.nombre)}" loading="lazy" onerror="this.src='${SILUETA}'">
          <span class="nota ${d.resumen ? '' : 'sin'}">${nota}</span>
          ${!d.miVoto ? '<span class="falta">Te falta</span>' : ''}
        </div>
        <div class="tarjeta-pie">
          <span class="num">#${d.dia}${d.esHoy ? ' · HOY' : ''}</span>
          <span class="tarjeta-nombre">${esc(d.nombre)}</span>
          <span class="fecha">${fechaBonita(d.fecha)}</span>
        </div>
      </button>`;
  }).join('');
}

/* ================= Detalle y votación ================= */

function abrirDetalle(dia) {
  const d = estado.datos.dinos.find(x => x.dia === dia);
  if (!d || d.bloqueado) return;
  estado.abierto = dia;

  const resumen = d.resumen ? `
    <div class="resumen">
      <div class="resumen-final">
        <span>${d.esHoy ? 'Final provisional' : 'Calificación final'}</span>
        <strong>${num(d.resumen.final)}</strong>
        <small>${d.resumen.nVotos} de 4 votos</small>
      </div>
      ${CATEGORIAS.map(c => `
        <div class="barra-cat">
          <span>${c.nombre}</span>
          <div class="pista"><div class="relleno" style="width:${d.resumen[c.clave] * 10}%"></div></div>
          <strong>${num(d.resumen[c.clave])}</strong>
        </div>`).join('')}
    </div>` : '<p class="vacio">Todavía nadie califica este dino.</p>';

  const votos = d.votos.length ? `
    <table class="tabla-votos">
      <thead><tr><th>Quién</th><th>Peligrosidad</th><th>Diseño</th><th>Nombre</th><th>Promedio</th></tr></thead>
      <tbody>
        ${d.votos.map(v => `
          <tr class="${v.esMio ? 'mio' : ''}">
            <td>${esc(v.usuario)}${v.esMio ? ' (tú)' : ''}</td>
            <td>${num(v.peligrosidad)}</td><td>${num(v.diseno)}</td><td>${num(v.nombre)}</td>
            <td><strong>${num(v.promedio)}</strong></td>
          </tr>`).join('')}
      </tbody>
    </table>` : '';

  let formulario = '';
  if (d.puedeVotar) {
    const val = c => (d.miVoto ? d.miVoto[c] : 5);
    formulario = `
      <form class="voto" onsubmit="enviarVoto(event, ${d.dia})">
        <h3>${d.miVoto ? 'Cambiar mi voto' : 'Mi calificación'}</h3>
        ${CATEGORIAS.map(c => `
          <label class="deslizador">
            <span>${c.nombre}</span>
            <input type="range" min="1" max="10" step="0.01" value="${val(c.clave)}"
                   oninput="this.nextElementSibling.value = Number(this.value)">
            <input type="number" name="${c.clave}" min="1" max="10" step="0.01" value="${val(c.clave)}" required
                   oninput="this.previousElementSibling.value = this.value">
          </label>`).join('')}
        <p class="nota-voto">Del 1 al 10, puedes usar hasta 2 decimales (ej. 7.25). Escribe el número o mueve la barra.</p>
        <p class="nota-voto">${d.esHoy
          ? 'Puedes cambiar tu voto hasta las 23:59 de hoy.'
          : 'Este día ya cerró: tu voto quedará fijo y no se podrá cambiar.'}</p>
        <button class="btn" type="submit">Guardar calificación</button>
      </form>`;
  } else if (d.miVoto) {
    formulario = '<p class="nota-voto">Ya calificaste este día y quedó cerrado.</p>';
  }

  $('#modal-contenido').innerHTML = `
    <div class="detalle">
      <div class="detalle-img"><img src="${imagen(d)}" alt="${esc(d.nombre)}" onerror="this.src='${SILUETA}'"></div>
      <div class="detalle-info">
        <div class="etiqueta">#${d.dia} · ${fechaBonita(d.fecha)}${d.esHoy ? ' · HOY' : ''}</div>
        <h2>${esc(d.nombre)}</h2>
        <div class="datos">
          <span>${esc(d.grupo)}</span><span>${esc(d.periodo)}</span>
          <span>${esc(d.dieta)}</span><span>${esc(d.tamano)}</span><span>${esc(d.region)}</span>
        </div>
        <p>${esc(d.descripcion)}</p>
        ${d.wikiUrl ? `<a class="wiki-link" href="${esc(d.wikiUrl)}" target="_blank" rel="noopener">Ver en Wikipedia ↗</a>` : ''}
      </div>
    </div>
    ${d.info ? `
      <details class="info-wiki">
        <summary>Más información</summary>
        ${d.info.split('\n').map(p => `<p>${esc(p)}</p>`).join('')}
        <small>Fuente: Wikipedia, texto bajo licencia CC BY-SA.</small>
      </details>` : ''}
    ${resumen}
    ${votos}
    ${formulario}`;
  $('#modal').classList.remove('oculto');
}

function cerrarDetalle() {
  estado.abierto = null;
  $('#modal').classList.add('oculto');
}

async function enviarVoto(evento, dia) {
  evento.preventDefault();
  const f = evento.target;
  const d = estado.datos.dinos.find(x => x.dia === dia);
  const valores = ['peligrosidad', 'diseno', 'nombre'].map(k => Number(f[k].value));
  if (valores.some(v => !(v >= 1 && v <= 10) || Math.abs(v * 100 - Math.round(v * 100)) > 1e-6)) {
    aviso('Cada calificación va del 1 al 10 con máximo 2 decimales', 'error');
    return;
  }
  if (!d.esHoy && !confirm('Este día ya cerró. Tu voto quedará fijo. ¿Guardar?')) return;

  mostrarCarga(true);
  try {
    estado.datos = await API.calificar(
      dia, valores[0], valores[1], valores[2]
    );
    pintarTodo();
    aviso('¡Calificación guardada!', 'ok');
  } catch (err) {
    manejarError(err);
  } finally {
    mostrarCarga(false);
  }
}

/* ================= Ranking ================= */

function pintarRanking() {
  const cat = estado.categoria;
  const lista = estado.datos.dinos
    .filter(d => !d.bloqueado && d.resumen)
    .sort((a, b) => b.resumen[cat] - a.resumen[cat] || b.resumen.final - a.resumen.final);

  if (!lista.length) {
    $('#ranking').innerHTML = '<p class="vacio">Aún no hay dinos calificados.</p>';
    return;
  }

  $('#ranking').innerHTML = lista.map((d, i) => `
    <li class="fila-ranking" onclick="abrirDetalle(${d.dia})">
      <span class="pos ${i < 3 ? 'podio p' + (i + 1) : ''}">${i + 1}</span>
      <img src="${imagen(d)}" alt="" loading="lazy" onerror="this.src='${SILUETA}'">
      <div class="r-info">
        <strong>${esc(d.nombre)}</strong>
        <small>#${d.dia} · ${d.resumen.nVotos} voto(s)${d.esHoy ? ' · provisional' : ''}</small>
      </div>
      <span class="r-nota">${num(d.resumen[cat])}</span>
    </li>`).join('');
}

/* ================= Cuenta regresiva ================= */

function iniciarCuentaRegresiva() {
  setInterval(() => {
    // Hora actual en Ciudad de México
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONFIG.ZONA_HORARIA, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date());
    const v = t => Number(partes.find(p => p.type === t).value);
    const restante = 86400 - ((v('hour') % 24) * 3600 + v('minute') * 60 + v('second'));
    const h = String(Math.floor(restante / 3600)).padStart(2, '0');
    const m = String(Math.floor((restante % 3600) / 60)).padStart(2, '0');
    const s = String(restante % 60).padStart(2, '0');
    $('#cuenta-regresiva').textContent = `${h}:${m}:${s}`;
    if (restante <= 1 && estado.datos) setTimeout(cargar, 3000); // nuevo día: recargar
  }, 1000);
}

/* ================= Eventos ================= */

$$('.tab').forEach(b => b.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.toggle('activo', x === b));
  $('#tab-galeria').classList.toggle('oculto', b.dataset.tab !== 'galeria');
  $('#tab-ranking').classList.toggle('oculto', b.dataset.tab !== 'ranking');
}));

$$('.filtro').forEach(b => b.addEventListener('click', () => {
  $$('.filtro').forEach(x => x.classList.toggle('activo', x === b));
  estado.filtro = b.dataset.filtro;
  pintarGaleria();
}));

$$('.cat').forEach(b => b.addEventListener('click', () => {
  $$('.cat').forEach(x => x.classList.toggle('activo', x === b));
  estado.categoria = b.dataset.cat;
  pintarRanking();
}));

$('.modal-cerrar').addEventListener('click', cerrarDetalle);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarDetalle(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarDetalle(); });

$('#btn-salir').addEventListener('click', async () => {
  await API.logout();
  if (window.google) google.accounts.id.disableAutoSelect();
  mostrarLogin();
});

/* ================= Arranque ================= */

iniciarCuentaRegresiva();
if (API.token) cargar(); else mostrarLogin();
