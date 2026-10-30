import { useState, useEffect } from 'react';
import { filtrarRamos } from '../services/api';

export default function FilterDashboard() {
  const [filtro, setFiltro] = useState('');
  const [ramosPorPeriodo, setRamosPorPeriodo] = useState([]);
  const [loading, setLoading] = useState(false);

  const FILTROS = [
    { val: 'reprobados', label: 'Reprobados', range: '0.0 - 3.9', icon: '❌', color: '#ef4444' },
    { val: 'aprobados_bajos', label: 'Aprob. Bajos', range: '4.0 - 4.9', icon: '⚠️', color: '#f59e0b' },
    { val: 'aprobados_medios', label: 'Aprob. Medios', range: '5.0 - 6.9', icon: '✅', color: '#06b6d4' },
    { val: 'excelencia', label: 'Excelencia', range: '7.0', icon: '⭐', color: '#10b981' }
  ];

  useEffect(() => {
    if (!filtro) {
      setRamosPorPeriodo([]);
      return;
    }
    // Solo mostrar el loader si es la primera vez que filtramos
    if (ramosPorPeriodo.length === 0) setLoading(true);

    filtrarRamos(filtro)
      .then(res => setRamosPorPeriodo(res.ramos_por_periodo || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filtro]);

  // Contar total de ramos
  const totalRamos = ramosPorPeriodo.reduce((acc, p) => acc + p.ramos.length, 0);

  return (
    <div style={{ padding: '15px', color: 'white', minHeight: '100vh', background: '#0a0a1a', paddingBottom: '90px' }}>
      <div style={{ marginBottom: '25px', marginTop: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>Filtro Rendimiento</h1>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: '12px', marginTop: '4px' }}>Visualización de ramos por rango de desempeño.</p>
      </div>
      
      {/* Grilla de Filtros 2x2 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '12px', 
        marginBottom: '30px' 
      }}>
        {FILTROS.map(f => (
          <button
            key={f.val}
            onClick={() => setFiltro(f.val)}
            style={{
              padding: '16px 12px',
              borderRadius: '16px',
              background: filtro === f.val ? `linear-gradient(135deg, ${f.color}dd, ${f.color}88)` : 'rgba(255,255,255,0.03)',
              color: 'white',
              border: `1px solid ${filtro === f.val ? f.color : 'rgba(255,255,255,0.08)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: filtro === f.val ? `0 8px 24px ${f.color}30` : 'none',
              transform: filtro === f.val ? 'scale(1.02)' : 'scale(1)',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '22px', marginBottom: '8px' }}>{f.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: '800', textAlign: 'center' }}>{f.label}</span>
            <span style={{ fontSize: '9px', color: filtro === f.val ? 'rgba(255,255,255,0.8)' : 'rgba(148,163,184,0.5)', marginTop: '2px' }}>{f.range}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Resultados ({totalRamos})</h2>
        {filtro && (
          <button 
            onClick={() => setFiltro('')}
            style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '11px', fontWeight: '700' }}
          >
            Limpiar Filtro
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="loader"></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {ramosPorPeriodo.length === 0 ? (
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '20px', 
              padding: '40px 20px', 
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.1)'
            }}>
              <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: '13px', margin: 0 }}>
                {filtro ? 'No se encontraron ramos en este rango.' : 'Selecciona un rango de arriba para filtrar tus ramos.'}
              </p>
            </div>
          ) : (
            ramosPorPeriodo.map(periodo => (
              <div key={periodo.semestre_id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ 
                  padding: '10px 14px', 
                  background: periodo.es_actual ? 'rgba(34, 197, 94, 0.15)' : 'rgba(79, 70, 229, 0.1)', 
                  borderRadius: '12px',
                  borderLeft: `4px solid ${periodo.es_actual ? '#22c55e' : '#6366f1'}`,
                  border: periodo.es_actual ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: periodo.es_actual ? '0 4px 15px rgba(34, 197, 94, 0.1)' : 'none'
                }}>
                  <span style={{ fontSize: '14px' }}>{periodo.es_actual ? '🟢' : '📘'}</span>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '800', 
                    color: periodo.es_actual ? '#4ade80' : '#a5b4fc', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px' 
                  }}>
                    {periodo.semestre_nombre}
                  </span>
                  {periodo.es_actual && (
                    <span style={{ 
                      fontSize: '9px', 
                      background: '#22c55e', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '8px',
                      fontWeight: '900',
                      marginLeft: 'auto',
                      boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)',
                    }}>
                      ACTUAL
                    </span>
                  )}
                </div>

                {periodo.ramos.map(r => (
                  <div key={r.id} style={{ 
                    padding: '18px', 
                    borderRadius: '18px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.05)`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Barra de color lateral según nivel */}
                    <div style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      bottom: 0, 
                      width: '4px', 
                      background: `var(--level-${r.nivel})` 
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '800' }}>{r.nombre}</h4>
                        <p style={{ margin: 0, fontSize: '10px', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Estado Académico
                        </p>
                      </div>
                      <div className={`level-badge level-${r.nivel}`} style={{ fontSize: '10px', padding: '4px 10px' }}>
                        Nivel {r.nivel}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase' }}>Parcial</span>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{r.promedio_parcial}</div>
                        </div>
                        <div style={{ flex: 1, background: `color-mix(in srgb, var(--level-${r.nivel}) 15%, transparent)`, borderRadius: '12px', padding: '10px', textAlign: 'center', border: `1px solid color-mix(in srgb, var(--level-${r.nivel}) 20%, transparent)` }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: `var(--level-${r.nivel})`, textTransform: 'uppercase' }}>Final</span>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: `var(--level-${r.nivel})` }}>{r.promedio_final}</div>
                        </div>
                        {r.meta_promedio > 0 && (
                          <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', padding: '10px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' }}>Meta</span>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b' }}>{r.meta_promedio.toFixed(1)}</div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
