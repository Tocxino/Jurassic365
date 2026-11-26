// Todas las llamadas a la API de Apps Script pasan por aquí.
// Se usa Content-Type text/plain para que el navegador no haga la petición
// previa de CORS (Apps Script no la soporta).

const API = {
  token: localStorage.getItem('j365_token'),

  async llamar(accion, datos = {}) {
    const resp = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ accion, token: this.token }, datos))
    });
    if (!resp.ok) throw new Error('No se pudo conectar con el servidor (' + resp.status + ')');
    const json = await resp.json();
    if (!json.ok) {
      const err = new Error(json.error || 'Error desconocido');
      err.sesion = json.error === 'SESION';
      throw err;
    }
    return json;
  },

  async login(credential) {
    const r = await this.llamar('login', { credential });
    this.token = r.token;
    localStorage.setItem('j365_token', r.token);
    return r;
  },

  async logout() {
    try { await this.llamar('logout'); } catch (e) { /* da igual */ }
    this.olvidar();
  },

  olvidar() {
    this.token = null;
    localStorage.removeItem('j365_token');
  },

  dinos() {
    return this.llamar('dinos');
  },

  calificar(dia, peligrosidad, diseno, nombre) {
    return this.llamar('calificar', { dia, peligrosidad, diseno, nombre });
  }
};
