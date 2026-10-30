import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupPeriodos, getSemestres } from '../services/api';
import { 
  Calendar, Zap, Clock, Box, 
  ChevronRight, ChevronLeft, Rocket, 
  Settings, CheckCircle2 
} from 'lucide-react';

export default function SetupInitial() {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState('semestre');
  const [cantidad, setCantidad] = useState('');
  const [actual, setActual] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSemestres().then(data => {
      if (data.semestres && data.semestres.length > 0) {
        navigate('/');
      }
    }).catch(console.error);
  }, [navigate]);

  const TIPOS = [
    { id: 'semestre', label: 'Semestre', labelAdj: 'Semestral', desc: 'Máx 10 Períodos · Máx 8 Ramos', icon: <Box size={24} />, max: 10, maxRamos: 8 },
    { id: 'trimestre', label: 'Trimestre', labelAdj: 'Trimestral', desc: 'Máx 15 Períodos · Máx 6 Ramos', icon: <Calendar size={24} />, max: 15, maxRamos: 6 },
    { id: 'bimestre', label: 'Bimestre', labelAdj: 'Bimestral', desc: 'Máx 24 Períodos · Máx 5 Ramos', icon: <Zap size={24} />, max: 24, maxRamos: 5 },
    { id: 'cuatrimestre', label: 'Cuatrimestre', labelAdj: 'Cuatrimestral', desc: 'Máx 12 Períodos · Máx 7 Ramos', icon: <Clock size={24} />, max: 12, maxRamos: 7 }
  ];

  const currentTipo = TIPOS.find(t => t.id === tipo);

  const handleFinish = async () => {
    if (!cantidad || !actual) return;
    setLoading(true);
    try {
      await setupPeriodos(tipo, parseInt(cantidad), parseInt(actual));
      navigate('/');
    } catch (e) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '20px', 
      background: 'radial-gradient(circle at top right, rgba(79, 70, 229, 0.1), transparent)',
      color: 'white'
    }}>
      {/* Header Section */}
      <div style={{ marginTop: '30px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)', marginBottom: '10px' }}>
          <Settings size={22} className="animate-spin-slow" />
          <span style={{ fontWeight: '900', letterSpacing: '2px', fontSize: '12px' }}>CONFIGURACIÓN INICIAL</span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, lineHeight: 1.1 }}>
          Bienvenido a <span style={{ color: 'var(--primary-color)' }}>EduPredict</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '10px', fontSize: '15px' }}>
          Solo necesitamos hacer esto una vez para conocer tu carrera.
        </p>
      </div>

      {/* Progress Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
        {[1, 2, 3].map(s => (
          <div 
            key={s} 
            style={{ 
              flex: 1, 
              height: '4px', 
              borderRadius: '2px', 
              background: s <= step ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
              transition: 'all 0.4s ease'
            }} 
          />
        ))}
      </div>

      <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <div style={{ background: 'var(--primary-color)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900' }}>1</div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>¿Cómo se organiza tu carrera?</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {TIPOS.map(t => (
                <div 
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  style={{
                    padding: '24px 15px',
                    borderRadius: '24px',
                    border: `2px solid ${tipo === t.id ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)'}`,
                    background: tipo === t.id ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    transform: tipo === t.id ? 'scale(1.03)' : 'scale(1)',
                    position: 'relative',
                    textAlign: 'center'
                  }}
                >
                  {tipo === t.id && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', color: 'var(--primary-color)' }}>
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                  <div style={{ color: tipo === t.id ? 'var(--primary-color)' : 'var(--text-secondary)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                    {t.icon}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>{t.label}</h4>
                  <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>{t.desc}</p>
                </div>
              ))}
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '30px', height: '56px', borderRadius: '18px' }}
              onClick={() => setStep(2)}
            >
              Confirmar Sistema <ChevronRight size={18} style={{ marginLeft: '10px' }} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <div style={{ background: 'var(--primary-color)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900' }}>2</div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>¿Cuántos {currentTipo.label.toLowerCase()}s tiene tu carrera?</h2>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <select 
                className="input-base" 
                style={{ height: '64px', border: 'none', background: 'transparent', fontSize: '17px', fontWeight: '600' }}
                value={cantidad}
                onChange={e => {
                  setCantidad(e.target.value);
                  setActual(''); // Reset actual when total changes
                }}
              >
                <option value="">Selecciona cantidad</option>
                {Array.from({ length: currentTipo.max }).map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} {currentTipo.label.toLowerCase()}s</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, height: '56px' }} 
                onClick={() => setStep(1)}
              >
                Atrás
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 2, height: '56px' }}
                disabled={!cantidad}
                onClick={() => setStep(3)}
              >
                Siguiente <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <div style={{ background: 'var(--primary-color)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900' }}>3</div>
              <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>¿En qué {currentTipo.label.toLowerCase()} estás actualmente?</h2>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <select 
                className="input-base" 
                style={{ height: '64px', border: 'none', background: 'transparent', fontSize: '17px', fontWeight: '600' }}
                value={actual}
                onChange={e => setActual(e.target.value)}
              >
                <option value="">{cantidad ? 'Selecciona actual' : 'Primero elige la cantidad total'}</option>
                {Array.from({ length: parseInt(cantidad || 0) }).map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}° {currentTipo.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, height: '56px' }} 
                onClick={() => setStep(2)}
              >
                Atrás
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 2, height: '56px', display: 'flex', gap: '10px' }}
                disabled={!actual || loading}
                onClick={handleFinish}
              >
                {loading ? 'Configurando...' : (
                  <>¡Comenzar con EduPredict! <Rocket size={20} /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
