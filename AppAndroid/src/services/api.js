// ──────────────────────────────────────────────────────
// DETECCIÓN DE ENTORNO
// ──────────────────────────────────────────────────────
const isNative = typeof window !== 'undefined' &&
  window.Capacitor?.isNativePlatform?.() === true;

const PRODUCTION_URL = 'https://edupredictwebapp-backend-9m2j.onrender.com';
const BACKEND = PRODUCTION_URL; 
const API_URL = `${BACKEND}/api/movil`;

// Cache en memoria para la sesión actual
const cache = {
  semestres: null,
  resumenIa: null,
};

// Helper para peticiones JSON a la API protegida
async function fetchApi(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('edupredict_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Token ${token}`;

  const options = {
    method,
    headers,
    credentials: 'include',
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

// AUTH
export const checkSessionStatus = () => fetchApi('/session_status/');
export const login = async (username, password) => {
  const data = await fetchApi('/login/', 'POST', { username, password });
  if (data.token) localStorage.setItem('edupredict_token', data.token);
  return data;
};
export const register = async (username, password) => {
  const data = await fetchApi('/registro/', 'POST', { username, password });
  if (data.token) localStorage.setItem('edupredict_token', data.token);
  return data;
};
export const logout = async () => {
  const data = await fetchApi('/logout/', 'POST');
  localStorage.removeItem('edupredict_token');
  return data;
};
export const googleAuth = async (token) => {
  const data = await fetchApi('/google_auth/', 'POST', { token });
  if (data.token) localStorage.setItem('edupredict_token', data.token);
  return data;
};
export const actualizarPerfil = (display_name) => fetchApi('/actualizar_perfil/', 'POST', { display_name });

// PERÍODOS / SEMESTRES
export const getSemestres = async () => {
  if (cache.semestres) return cache.semestres;
  const data = await fetchApi('/semestres/');
  cache.semestres = data;
  return data;
};
export const setupPeriodos = (tipo_periodo, cantidad, periodo_actual) =>
  fetchApi('/setup_periodos/', 'POST', { tipo_periodo, cantidad, periodo_actual });

export const getPeriodoActual = async (semestre_id = null) => {
  return fetchApi(semestre_id ? `/periodo_actual/?semestre_id=${semestre_id}` : '/periodo_actual/');
};

export const avanzarPeriodo = () => fetchApi('/avanzar_periodo/', 'POST');
export const cerrarPeriodoAnterior = (semestre_id) =>
  fetchApi('/cerrar_periodo_anterior/', 'POST', { semestre_id });
export const setLimitePeriodo = (semestre_id, limite) =>
  fetchApi('/set_limite_periodo/', 'POST', { semestre_id, limite });

// RAMOS
export const crearRamo = (data) => fetchApi('/crear_ramo/', 'POST', data);
export const editarRamo = (id, data) => fetchApi(`/editar_ramo/${id}/`, 'POST', data);
export const eliminarRamo = (id) => fetchApi(`/eliminar_ramo/${id}/`, 'POST');
export const marcarCompletado = (id) => fetchApi(`/marcar_completado_ramo/${id}/`, 'POST');

// IA — VISION
export const scanHorario = (image_base64) => fetchApi('/scan_horario/', 'POST', { image_base64 });
export const crearRamosMasivo = (semestre_id, ramos_names) => fetchApi('/crear_ramos_masivo/', 'POST', { semestre_id, ramos_names });

// IA — RESUMEN Y CHAT
export const getResumenIa = async (force = false) => {
  const endpoint = force ? '/resumen_ia/?force=1' : '/resumen_ia/';
  return fetchApi(endpoint);
};

export const sendChatMessage = async (mensaje, historial, contexto = {}) => {
  return fetchApi('_chat/', 'POST', { mensaje, historial, ...contexto });
};

// ESTADÍSTICAS Y FILTROS
export const getEstadisticas = (s1, s2) => fetchApi(`/estadisticas/?semestre1=${s1}&semestre2=${s2}`);
export const filtrarRamos = (rango) => fetchApi(`/filtrar_ramos/?rango=${rango}`);

// Mock para no romper componentes que ya lo importan
export const pCacheGetSync = () => null;
