import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getSemestres, 
  getPeriodoActual, 
  setLimitePeriodo, 
  avanzarPeriodo, 
  getResumenIa, 
  eliminarRamo, 
  marcarCompletado,
  cerrarPeriodoAnterior,
  pCacheGetSync 
} from '../services/api';
import { 
  Settings, 
  Check, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  Lock, 
  MapPin, 
  Star, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw,
  Camera as CameraIcon
} from 'lucide-react';

import ScannerModal from '../components/ScannerModal';

export default function MyPeriod() {
  const [semestres, setSemestres] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const loadData = async (targetId = null) => {
    setLoading(true);
    
    try {
      // Peticiones en paralelo para mayor velocidad
      const [sems, periodData] = await Promise.all([
        getSemestres(),
        getPeriodoActual(targetId)
      ]);

      const allSems = sems.semestres || [];
      setSemestres(allSems);
      setData(periodData);
      setSelectedId(periodData.semestre.id);

      // Si es el periodo actual y no tiene limite, mostrar modal
      if (periodData.semestre.es_actual && !periodData.semestre.limite_ramos && periodData.ramos.length === 0) {
        setShowLimitModal(true);
      } else {
        setShowLimitModal(false);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetLimitValue = async (val) => {
    setShowLimitModal(false);
    await setLimitePeriodo(selectedId, val);
    loadData(selectedId);
  };

  const handleSetLimite = () => {
    setShowLimitModal(true);
  };

  const handleAvanzar = async () => {
    if(window.confirm('¿Cerrar este periodo y avanzar al siguiente?')) {
      await avanzarPeriodo();
      loadData();
    }
  };

  const handleCerrarAnterior = async (id) => {
    if(window.confirm('¿Cerrar este periodo y marcarlo como completado?')) {
      await cerrarPeriodoAnterior(id);
      loadData(id);
    }
  };

  const handleToggle = async (id) => {
    await marcarCompletado(id);
    loadData(selectedId);
  };

  const handleDel = async (id) => {
    if(window.confirm('¿Eliminar ramo?')) {
      await eliminarRamo(id);
      loadData(selectedId);
    }
  };

  if (loading && !data) return <div className="loader-container"><div className="loader"></div></div>;

  const { semestre, ramos } = data || {};
  
  // Lógica de Cierre
  const tieneLimite = semestre?.limite_ramos !== null;
  const ramosCompletos = ramos?.length >= semestre?.limite_ramos;
  const todosCompletados = ramos?.length > 0 && ramos.every(r => r.completado);
  const puedeCerrar = tieneLimite && ramosCompletos && todosCompletados;

  const getCardClass = (nivel) => {
    switch(nivel) {
      case 5: return 'ramo-d5-mobile';
      case 4: return 'ramo-d4-mobile';
      case 3: return 'ramo-d3-mobile';
      case 2: return 'ramo-d2-mobile';
      default: return 'ramo-d1-mobile';
    }
  };

  const getNivelText = (nivel) => {
    switch(nivel) {
      case 5: return 'Aprobado ✅';
      case 4: return 'Bien encaminado 📈';
      case 3: return 'Ajustado ⚠️';
      case 2: return 'En riesgo 🚨';
      default: return 'Reprobado ❌';
    }
  };

  const getStatusIcon = (nivel) => {
    if (nivel >= 4) return <CheckCircle2 size={14} />;
    if (nivel === 3) return <AlertTriangle size={14} />;
    return <AlertTriangle size={14} />;
  };

  const renderEvaluations = (ramo) => {
    const notas = ramo.notas || [];
    const examen = ramo.examen || {};
    const allItems = [...notas];
    if (examen?.porcentaje > 0) allItems.push({ ...examen, isExamen: true });
    
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', width: '100%' }}>
        {allItems.map((n, i) => (
          <div key={i} className={`nota-tag ${(!n.nota || n.nota === 0) ? 'pending' : ''}`} style={{ flex: 1 }}>
            <div style={{ fontSize: '14px' }}>
              {n.isExamen && '📝'}
              {(!n.nota || n.nota === 0) ? '⌛' : parseFloat(n.nota).toFixed(1)}
            </div>
            <div style={{ opacity: 0.5, fontSize: '9px', fontWeight: 'bold' }}>{n.porcentaje}%</div>
          </div>
        ))}
      </div>
    );
  };

  const renderProgressBar = (ramo) => {
    const meta = parseFloat(ramo.meta_promedio) || 7.0;
    const final = parseFloat(ramo.promedio_final) || 0;
    const progress = Math.min((final / meta) * 100, 100);
    
    return (
      <div style={{ marginBottom: '16px' }}>
        <div className="meta-progress-container">
          <div className="meta-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
          <span>0</span>
          <span>Meta {meta.toFixed(1)}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingTop: '10px' }}>
      <div className="text-center" style={{ marginBottom: '10px' }}>
         <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
           Mi Espacio Académico — <span style={{ color: 'var(--active-color)' }}>{semestre?.nombre}</span>
         </h1>
         <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', marginTop: '8px' }}>
            {semestre?.es_actual ? <><MapPin size={14} fill="#22c55e" /> Período Actual</> : <><Check size={14} /> Período Revisado</>}
         </div>
      </div>
      
      {/* Timeline Navigation */}
      <div className="glass-card" style={{ padding: '20px 15px', marginBottom: '25px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)' }}>TU PROGRESO ACADÉMICO</span>
        </div>
        
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          alignItems: 'center',
          padding: '10px 0 30px 0',
          scrollbarWidth: 'none',
          gap: '0'
        }}>
          {semestres.map((s, index) => {
            const isSelected = s.id === selectedId;
            const isCompleted = s.completado_periodo;
            const isActual = s.es_actual;
            const isPending = !isCompleted && !isActual && s.orden < (semestres.find(x => x.es_actual)?.orden || 99);
            const isLocked = s.orden > (semestres.find(x => x.es_actual)?.orden || 0);

            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    onClick={() => !isLocked && loadData(s.id)}
                    className={`timeline-dot ${isCompleted ? 'completed' : isActual ? 'current' : isPending ? 'pending' : isLocked ? 'locked' : ''}`}
                    style={{
                       outline: isSelected ? '3px solid rgba(255,255,255,0.3)' : 'none',
                       outlineOffset: '3px'
                    }}
                  >
                    {isLocked ? <Lock size={16} /> : isCompleted ? <Check size={18} /> : s.orden}
                  </div>
                  
                  <div style={{ 
                    position: 'absolute', 
                    top: '52px', 
                    textAlign: 'center',
                    width: '70px',
                    fontSize: '9px', 
                    fontWeight: isSelected ? '900' : '700',
                    color: isActual ? '#34d399' : isCompleted ? '#a5b4fc' : isPending ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                    lineHeight: '1.2'
                  }}>
                    {s.nombre.toUpperCase()}
                  </div>
                </div>

                {index < semestres.length - 1 && (
                  <div style={{
                    width: '35px',
                    height: '2px',
                    background: s.completado_periodo ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.05)',
                    margin: '0 5px'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {puedeCerrar && !semestre.completado_periodo && (
        <div className="banner-success-period">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'white', marginBottom: '4px' }}>¡Todos los ramos completados!</h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>Ya puedes cerrar este {semestre.tipo_periodo.charAt(0).toUpperCase() + semestre.tipo_periodo.slice(1)} y avanzar al siguiente.</p>
          <button 
            className="btn-avanzar-premium"
            onClick={semestre.es_actual ? handleAvanzar : () => handleCerrarAnterior(semestre.id)}
          >
            {semestre.es_actual ? `Cerrar ${semestre.tipo_periodo} y avanzar al siguiente` : 'Cerrar periodo y marcar completado'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {ramos?.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(99,102,241,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Lock size={28} color="rgba(99,102,241,0.4)" />
            </div>
            <h5 style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800', marginBottom: '4px' }}>No hay ramos en este {semestre?.tipo_periodo}</h5>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }}>Agrega un ramo usando el menú lateral o el botón de abajo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <button 
                className="btn-primary" 
                style={{ width: 'auto', padding: '12px 24px', borderRadius: '22px' }}
                onClick={() => tieneLimite ? navigate('/create-course') : setShowLimitModal(true)}
              >
                + Crear primer ramo
              </button>
              
              <button 
                onClick={() => setShowScanner(true)}
                className="btn-secondary flex items-center justify-center gap-2"
                style={{ width: 'auto', padding: '12px 24px', borderRadius: '22px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <CameraIcon size={18} /> Escanear Horario con IA
              </button>
            </div>
          </div>
        ) : (
          ramos?.map(r => (
            <div key={r.id} className={`ramo-card-mobile ${getCardClass(r.nivel)}`}>
              <div className="nivel-stripe" />
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="level-badge" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {getStatusIcon(r.nivel)} Nivel {r.nivel} · {getNivelText(r.nivel)}
                    </div>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>{r.nombre}</h4>
                  </div>
                  {r.meta_promedio && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                      <Star size={12} fill="#fcd34d" /> Meta {parseFloat(r.meta_promedio).toFixed(1)}
                    </div>
                  )}
                </div>

                {renderEvaluations(r)}
                {renderProgressBar(r)}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <div className="stat-box-mobile">
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px' }}>PARCIAL</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'white' }}>{r.promedio_parcial || '-'}</div>
                  </div>
                  <div className="stat-box-mobile special">
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px' }}>FINAL</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: 'white' }}>{r.promedio_final || '-'}</div>
                  </div>
                  {r.meta_promedio && (
                    <div className="stat-box-mobile" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(245, 158, 11, 0.6)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '4px' }}>META</div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#fcd34d' }}>{parseFloat(r.meta_promedio).toFixed(1)}</div>
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '12px' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => navigate(`/edit-course/${r.id}`)} className="btn-action ramo-btn-edit">
                      <Edit2 size={16} /> Editar
                    </button>
                    <button onClick={() => handleDel(r.id)} className="btn-action ramo-btn-delete">
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                  
                  {!r.bloqueado && (
                    <button 
                      onClick={() => handleToggle(r.id)} 
                      className="btn-action btn-action-complete"
                      style={{ 
                        width: '100%', 
                        background: r.completado ? 'rgba(34, 197, 94, 0.15)' : undefined, 
                        color: r.completado ? '#22c55e' : undefined, 
                        borderColor: r.completado ? '#22c55e44' : 'transparent',
                        borderRadius: '12px'
                      }}
                    >
                      {r.completado ? <><RotateCcw size={18} /> Descompletar</> : <><Check size={18} /> Marcar como completado</>}
                    </button>
                  )}
                  {r.bloqueado && (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>
                      🔒 Período archivado — Solo lectura
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {ramos?.length > 0 && ramos?.length < (semestre?.max_ramos || 99) && (
           <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
             <button 
                className="btn-primary" 
                style={{ width: '100%', padding: '14px', borderRadius: '16px' }}
                onClick={() => navigate('/create-course')}
              >
                + Agregar otro ramo
              </button>
              <button 
                onClick={() => setShowScanner(true)}
                className="btn-secondary flex items-center justify-center gap-2"
                style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <CameraIcon size={18} /> Escanear Horario con IA
              </button>
           </div>
        )}
      </div>
      
      {/* Limit Modal */}
      {showLimitModal && (
        <div className="overlay-blur" onClick={() => setShowLimitModal(false)}>
          <div className="modal-premium" onClick={e => e.stopPropagation()}>
            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3)' }}>
              <Settings size={28} color="white" />
            </div>
            <h5 style={{ color: 'white', fontWeight: '900', fontSize: '18px', marginBottom: '8px' }}>¿Cuántos ramos tienes en tu {semestre?.tipo_periodo} actual?</h5>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.4' }}>
              Esto nos ayuda a mostrarte el límite correcto para este período. <br/>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>Si no defines el límite ahora, no podrás agregar ramos.</span>
            </p>
            
            <div className="limit-btn-grid">
              {Array.from({ length: semestre?.max_ramos || 8 }).map((_, i) => (
                <button key={i+1} className="btn-limit-num" onClick={() => handleSetLimitValue(i+1)}>{i+1}</button>
              ))}
            </div>
            
            <button 
              className="btn-secondary" 
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}
              onClick={() => setShowLimitModal(false)}
            >
              Saltar por ahora (no podrás agregar ramos)
            </button>
          </div>
        </div>
      )}

      <ScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        currentSemestreId={selectedId}
        onRamosCreated={() => loadData(selectedId)}
      />

    </div>
  );
}
