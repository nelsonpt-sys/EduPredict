import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  getSemestres, 
  getPeriodoActual, 
  setLimitePeriodo, 
  crearRamo, 
  editarRamo 
} from '../services/api';
import { Plus, Trash2, Save, ArrowLeft, Settings } from 'lucide-react';
import MessageBanner from '../components/MessageBanner';
import LivePreview from '../components/LivePreview';
import { calcularAcademicos } from '../utils/academicUtils';

export default function CourseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); 
  
  const [semestres, setSemestres] = useState([]);
  const [semestreId, setSemestreId] = useState('');
  const [nombre, setNombre] = useState('');
  const [notas, setNotas] = useState([{ nota: '', porcentaje: '' }]);
  const [examen, setExamen] = useState({ nota: '', porcentaje: '' });
  const [meta, setMeta] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Calcula el estado académico en vivo para los estilos reactivos
  const { nivelInfo } = calcularAcademicos(notas, examen, meta);

  useEffect(() => {
    async function load() {
      try {
        const sems = await getSemestres();
        const allSems = sems.semestres || [];
        setSemestres(allSems);
        
        if(!isEditing) {
          const actual = sems.semestres.find(s => s.es_actual);
          if (actual) {
            setSemestreId(actual.id);
            if (actual.limite_ramos === null) setShowLimitModal(true);
          }
        } else {
          // En lugar de buscar en bucle, intentamos obtener el periodo actual primero
          // o el backend debería proveer un endpoint de "get_ramo_detail"
          // Por ahora, optimizamos pidiendo solo el del semestre probable o todos en paralelo
          const periodsData = await Promise.all(
            sems.semestres.map(s => getPeriodoActual(s.id))
          );
          
          let found = null;
          periodsData.forEach((data, index) => {
            const r = data.ramos?.find(x => x.id === parseInt(id));
            if (r) {
              found = r;
              setSemestreId(sems.semestres[index].id);
            }
          });
          if (found) {
            setNombre(found.nombre);
            const normalizedNotas = (found.notas || []).map(n => ({
              nota: (n.nota === null || n.nota === 0) ? '' : n.nota,
              porcentaje: (n.porcentaje === null) ? '' : n.porcentaje
            }));
            setNotas(normalizedNotas.length > 0 ? normalizedNotas : [{ nota: '', porcentaje: '' }]);
            setExamen({
              nota: (found.examen && found.examen.nota !== null && found.examen.nota !== 0) ? found.examen.nota : '',
              porcentaje: (found.examen && found.examen.porcentaje !== null) ? found.examen.porcentaje : ''
            });
            setMeta(found.meta_promedio === null ? '' : found.meta_promedio);
            setBloqueado(found.bloqueado);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEditing]);

  // Auto-cerrar mensaje después de 3 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handlePeriodChange = (e) => {
    const newId = e.target.value;
    setSemestreId(newId);
    const selected = semestres.find(s => s.id === parseInt(newId));
    if (selected && selected.limite_ramos === null) {
      setShowLimitModal(true);
    }
    setMessage(null);
  };

  const handleSetLimitValue = async (val) => {
    try {
      await setLimitePeriodo(semestreId, val);
      const updatedSems = await getSemestres();
      setSemestres(updatedSems.semestres);
      setShowLimitModal(false);
      setMessage({ type: 'success', text: `Límite de ${val} ramos para este ${selected.tipo_periodo} definido.` });
    } catch (e) {
      alert("Error guardando límite: " + e.message);
    }
  };

  const handleAddNota = () => setNotas([...notas, { nota: '', porcentaje: '' }]);
  
  const handleNotaChange = (index, field, val) => {
    const newNotas = [...notas];
    // Permitir cadenas vacías para que el usuario pueda borrar campos
    newNotas[index][field] = val;
    setNotas(newNotas);
  };
  
  const handleRemoveNota = (index) => {
    const newNotas = notas.filter((_, i) => i !== index);
    setNotas(newNotas.length ? newNotas : [{ nota: '', porcentaje: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(bloqueado) return;

    const selectedSem = semestres.find(s => s.id === parseInt(semestreId));
    if (selectedSem && selectedSem.limite_ramos === null) {
      setShowLimitModal(true);
      return;
    }

    setSaving(true);
    setMessage(null);
    
    const parsedNotas = notas.map(n => ({
      nota: (n.nota === '' || n.nota === null) ? null : parseFloat(n.nota),
      porcentaje: (n.porcentaje === '' || n.porcentaje === null) ? null : parseFloat(n.porcentaje)
    })).filter(n => n.nota !== null || n.porcentaje !== null);
    
    const parsedExamen = {
      nota: (examen.nota === '' || examen.nota === null) ? null : parseFloat(examen.nota),
      porcentaje: (examen.porcentaje === '' || examen.porcentaje === null) ? null : parseFloat(examen.porcentaje)
    };
    
    const payload = {
      semestre_id: semestreId,
      nombre,
      notas: parsedNotas,
      examen: parsedExamen,
      meta_promedio: meta === '' ? null : parseFloat(meta)
    };

    try {
      if (isEditing) {
        await editarRamo(id, payload);
        setMessage({ type: 'success', text: 'Ramo actualizado correctamente.' });
        // En edición NO redirigimos, permitimos al usuario seguir ajustando
      } else {
        await crearRamo(payload);
        setMessage({ type: 'success', text: 'Ramo creado exitosamente. ¡Puedes agregar otro!' });
        setNombre('');
        setNotas([{ nota: '', porcentaje: '' }]);
        setExamen({ nota: '', porcentaje: '' });
        setMeta('');
        const updatedSems = await getSemestres();
        setSemestres(updatedSems.semestres || []);
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  const currentSem = semestres.find(s => s.id === parseInt(semestreId));

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px', 
        marginBottom: '28px',
        background: nivelInfo.bg,
        margin: '-20px -20px 28px -20px',
        padding: '30px 20px',
        borderRadius: '0 0 32px 32px',
        boxShadow: `0 10px 30px ${nivelInfo.border.replace('0.4', '0.1')}`,
        borderBottom: `1px solid ${nivelInfo.border}`,
        transition: 'all 0.5s ease'
      }}>
        <button onClick={() => navigate('/period')} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '50%', backdropFilter: 'blur(5px)' }}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '900', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            {isEditing ? 'Editar Ramo' : 'Nuevo Ramo'}
          </h1>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '4px' }}>
            Nivel {nivelInfo.label}
          </div>
        </div>
      </div>

      <LivePreview 
        nombre={nombre}
        notas={notas}
        examen={examen}
        meta_promedio={meta}
      />

      <MessageBanner 
        type={message?.type} 
        message={message?.text} 
        onClose={() => setMessage(null)} 
      />

      <div className="glass-card" style={{ padding: '24px', position: 'relative', zIndex: 1 }}>
        {bloqueado && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px', fontWeight: '700', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            🔒 Este ramo está bloqueado porque el período ya fue cerrado.
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <label className="label-form">Período Académico</label>
          <select 
            className="input-base" 
            value={semestreId} 
            onChange={handlePeriodChange}
            disabled={isEditing || bloqueado}
            style={{ marginBottom: '24px' }}
          >
            {semestres
              .filter(s => {
                const actual = semestres.find(x => x.es_actual);
                const isUnderCurrent = s.orden <= (actual?.orden || 99);
                const notCompleted = !s.completado_periodo;
                const hasSpace = s.limite_ramos === null || s.ramos_count < s.limite_ramos;
                if (isEditing && s.id === parseInt(semestreId)) return true;
                return isUnderCurrent && notCompleted && hasSpace;
              })
              .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)
            }
          </select>

          <label className="label-form">Nombre del Ramo</label>
          <input 
            type="text" 
            className="input-base" 
            value={nombre} 
            onChange={e => { setNombre(e.target.value); setMessage(null); }} 
            required 
            disabled={bloqueado}
            placeholder="Ej. Cálculo I"
            style={{ marginBottom: '24px' }}
          />

          <h3 style={{ marginTop: '10px', marginBottom: '15px', fontSize: '15px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Evaluaciones Parciales
            {!bloqueado && <button type="button" onClick={handleAddNota} style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', padding: '6px', borderRadius: '10px' }}><Plus size={20}/></button>}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {notas.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1.5 }}>
                   <input 
                    type="number" step="0.1" max="7" placeholder="Nota" className="input-base" style={{ marginBottom: 0 }}
                    value={n.nota} onChange={e => { handleNotaChange(i, 'nota', e.target.value); setMessage(null); }} disabled={bloqueado}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input 
                    type="number" step="1" max="100" placeholder="%" className="input-base" style={{ marginBottom: 0 }}
                    value={n.porcentaje} onChange={e => { handleNotaChange(i, 'porcentaje', e.target.value); setMessage(null); }} disabled={bloqueado}
                  />
                </div>
                {!bloqueado && (
                  <button type="button" onClick={() => handleRemoveNota(i)} style={{ background: 'none', border: 'none', color: '#fca5a5', opacity: 0.6, padding: '5px' }}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <h3 style={{ marginBottom: '15px', fontSize: '15px', fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>Examen (Opcional)</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ flex: 1.5 }}>
              <input 
                type="number" step="0.1" max="7" placeholder="Nota" className="input-base" style={{ marginBottom: 0 }}
                value={examen.nota} onChange={e => { setExamen({...examen, nota: e.target.value}); setMessage(null); }} disabled={bloqueado}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="number" step="1" max="100" placeholder="%" className="input-base" style={{ marginBottom: 0 }}
                value={examen.porcentaje} onChange={e => { setExamen({...examen, porcentaje: e.target.value}); setMessage(null); }} disabled={bloqueado}
              />
            </div>
            <div style={{ width: '28px' }}></div>
          </div>

          <label className="label-form">Meta de Promedio</label>
          <input 
            type="number" step="0.1" max="7" placeholder="Promedio objetivo (ej. 4.0)" className="input-base" 
            value={meta} onChange={e => { setMeta(e.target.value); setMessage(null); }} disabled={bloqueado}
            style={{ marginBottom: '32px' }}
          />

          {!bloqueado && (
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ 
                background: nivelInfo.bg, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                padding: '18px', 
                borderRadius: '18px', 
                fontSize: '17px', 
                fontWeight: '900', 
                boxShadow: `0 8px 30px ${nivelInfo.border.replace('0.4', '0.15')}`,
                border: `1px solid ${nivelInfo.border}`,
                transition: 'all 0.5s ease'
              }} 
              disabled={saving}
            >
              <Save size={20} />
              {saving ? 'Guardando...' : (isEditing ? 'Actualizar Ramo' : 'Guardar Ramo')}
            </button>
          )}
        </form>
      </div>

      {/* Limit Modal */}
      {showLimitModal && (
        <div className="overlay-blur" style={{ zIndex: 1000 }} onClick={() => setShowLimitModal(false)}>
          <div className="modal-premium" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)' }}>
              <Settings size={28} color="white" />
            </div>
            <h5 style={{ color: 'white', fontWeight: '900', fontSize: '18px', marginBottom: '8px' }}>
              ¿Límite de ramos para este {currentSem?.tipo_periodo}?
            </h5>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.4', marginBottom: '20px' }}>
              Define cuántos ramos tienes en este período ({currentSem?.nombre}) para validarlo correctamente.
            </p>
            
            <div className="limit-btn-grid" style={{ marginBottom: '20px' }}>
              {Array.from({ length: currentSem?.max_ramos || 8 }).map((_, i) => (
                <button key={i+1} className="btn-limit-num" onClick={() => handleSetLimitValue(i+1)}>{i+1}</button>
              ))}
            </div>
            
            <button 
              className="btn-secondary" 
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: '12px', width: '100%' }}
              onClick={() => setShowLimitModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
