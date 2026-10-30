import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPeriodoActual, getResumenIa, getSemestres, pCacheGetSync } from '../services/api';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, BookOpen, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState(null);
  const [iaText, setIaText] = useState('');
  const [loading, setLoading] = useState(true);
  const [iaLoading, setIaLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const navigate = useNavigate();

  const loadResumenIa = async (force = false) => {
    setIaLoading(true);
    try {
      const iaRes = await getResumenIa(force);
      setIaText(iaRes.resumen_ia || 'No se pudo cargar el análisis.');
    } catch {
      setIaText('No se pudo cargar el análisis del Asistente EduPredict.');
    } finally {
      setIaLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!data) setLoading(true); // Solo mostrar loader si es la primera vez
      try {
        const [sems, periodoRes] = await Promise.all([
          getSemestres(),
          getPeriodoActual(),
        ]);

        if (periodoRes && !periodoRes.error) {
          setData(periodoRes);
          setDisplayName(periodoRes.display_name || '');
        } else {
          const hasSems = sems?.semestres?.length > 0;
          if (!hasSems) navigate('/setup');
        }
      } catch {
        // ignorar
      } finally {
        setLoading(false);
      }

      // Cargar análisis IA en paralelo (no bloquea la pantalla)
      loadResumenIa();
    };

    init();
  }, [navigate]);

  if (loading) return (
    <div className="loader-container">
      <div className="loader"></div>
    </div>
  );

  const ramos = data?.ramos || [];
  const semestre = data?.semestre;

  const stats = {
    total: ramos.length,
    aprobados: ramos.filter(r => r.nivel === 5).length,
    encaminados: ramos.filter(r => r.nivel === 4).length,
    ajustados: ramos.filter(r => r.nivel === 3).length,
    riesgo: ramos.filter(r => r.nivel === 2).length,
    criticos: ramos.filter(r => r.nivel === 1).length,
  };

  const StatCard = ({ title, value, color, icon: Icon }) => (
    <div style={{
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: '16px',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: 'transform 0.15s ease',
    }}>
      <Icon size={26} color={color} strokeWidth={2} />
      <span style={{ fontSize: '26px', fontWeight: '800', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '11px', textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.2 }}>{title}</span>
    </div>
  );

  return (
    <div style={{ paddingTop: '20px' }}>
      {/* Saludo */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '28px' }}>Hola {displayName} 👋</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          {semestre
            ? `Estás en ${semestre.nombre} — ${ramos.length} ${ramos.length === 1 ? 'ramo' : 'ramos'} registrados`
            : 'Bienvenido a EduPredict'}
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      {ramos.length > 0 && (
        <>
          <h2 style={{ margin: '0 0 16px', fontSize: '17px' }}>Resumen del Período Actual</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '28px',
          }}>
            <StatCard title="Total" value={stats.total} color="var(--primary-color)" icon={BookOpen} />
            <StatCard title="Aprobados ✅" value={stats.aprobados} color="var(--level-5)" icon={CheckCircle} />
            <StatCard title="Encaminados 📈" value={stats.encaminados} color="var(--level-4)" icon={TrendingUp} />
            <StatCard title="Ajustados ⚠️" value={stats.ajustados} color="var(--level-3)" icon={AlertTriangle} />
            <StatCard title="En Riesgo 🚨" value={stats.riesgo} color="var(--level-2)" icon={AlertCircle} />
            <StatCard title="Reprobados ❌" value={stats.criticos} color="var(--level-1)" icon={XCircle} />
          </div>
        </>
      )}

      {/* Panel de análisis IA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#a855f7" />
          Análisis del Asistente EduPredict
        </h2>
        <button
          id="refresh-ia-button"
          onClick={() => loadResumenIa(true)}
          disabled={iaLoading}
          style={{
            background: 'none',
            border: '1px solid var(--card-border)',
            color: 'var(--text-secondary)',
            borderRadius: '8px',
            padding: '6px 10px',
            cursor: iaLoading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
          }}
          title="Regenerar análisis"
        >
          <RefreshCw
            size={14}
            style={{ animation: iaLoading ? 'spin 1s linear infinite' : 'none' }}
          />
          {iaLoading ? 'Analizando...' : 'Actualizar'}
        </button>
      </div>

      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(16, 12, 30, 0.7)',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Gradiente decorativo */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '120px', height: '120px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Badge del asistente */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 16px 0',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#a855f7' }}>
            Asistente EduPredict
          </span>
        </div>

        {/* Contenido del análisis */}
        <div style={{
          padding: '12px 16px 20px',
          color: '#e2e8f0',
          lineHeight: '1.75',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          minHeight: '80px',
        }}>
          {iaLoading && !iaText ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[0, 1, 2].map(dot => (
                  <div
                    key={dot}
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#a855f7',
                      animation: `pulse 1.2s ease-in-out ${dot * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
              Generando análisis inteligente de tu rendimiento...
            </div>
          ) : (
            iaText || 'Generando análisis inteligente de tu rendimiento...'
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
