import { useState } from 'react';
import { calcularAcademicos } from '../utils/academicUtils';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function LivePreview({ nombre, notas, examen, meta_promedio }) {
  const [expanded, setExpanded] = useState(false);
  const { promedioParcial, promedioFinal, nivelInfo } = calcularAcademicos(notas, examen, meta_promedio);
  
  const hasData = (notas || []).some(n => n.nota);

  return (
    <>
      {/* Botón Flotante (Circle Indicador) */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'fixed',
          top: '110px',
          right: '25px',
          width: '64px',
          height: '64px',
          background: nivelInfo.bg,
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9000, // Debajo de MessageBanner (9999) pero sobre el resto
          boxShadow: `0 8px 30px ${nivelInfo.border.replace('0.4', '0.3')}`,
          border: `2px solid ${nivelInfo.border}`,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: expanded ? 'scale(0.9) rotate(180deg)' : 'scale(1) rotate(0deg)'
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: '900', color: 'white', lineHeight: 1 }}>
          {hasData ? promedioFinal.toFixed(1) : '—'}
        </div>
        <div style={{ fontSize: '8px', fontWeight: '800', color: 'white', marginTop: '2px', opacity: 0.8 }}>
          {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </div>
        
        {/* Pulse Effect if status is critical */}
        {hasData && promedioFinal < 4.0 && (
          <div style={{
            position: 'absolute',
            inset: '-4px',
            border: `2px solid ${nivelInfo.color}`,
            borderRadius: '50%',
            animation: 'pulseRing 1.5s infinite'
          }} />
        )}
      </div>

      {/* Panel Expandido (Overlay) */}
      {expanded && (
        <div 
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 8999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: nivelInfo.bg,
              width: '100%',
              maxWidth: '360px',
              borderRadius: '28px',
              padding: '28px',
              color: 'white',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: `1px solid ${nivelInfo.border}`,
              animation: 'slideUpExpand 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '900', margin: 0 }}>
                {nombre || 'Asignatura'}
              </h2>
              <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                Nivel {nivelInfo.label}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.6, marginBottom: '6px' }}>PARCIAL</div>
                <div style={{ fontSize: '28px', fontWeight: '900' }}>{hasData ? promedioParcial.toFixed(1) : '—'}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.6, marginBottom: '6px' }}>FINAL</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: promedioFinal >= 4.0 ? '#4ade80' : '#fca5a5' }}>
                  {hasData ? promedioFinal.toFixed(1) : '—'}
                </div>
              </div>
            </div>

            {meta_promedio && (
              <div style={{ 
                background: 'rgba(251, 191, 36, 0.15)', 
                borderRadius: '16px', 
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#fcd34d' }}>META</span>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#fcd34d' }}>{parseFloat(meta_promedio).toFixed(1)}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(notas || []).map((n, i) => n.porcentaje > 0 && (
                <div key={i} style={{ 
                  fontSize: '10px', 
                  fontWeight: '700', 
                  background: 'rgba(0,0,0,0.25)', 
                  padding: '6px 10px', 
                  borderRadius: '10px',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {n.nota ? parseFloat(n.nota).toFixed(1) : '⏳'} ({n.porcentaje}%)
                </div>
              ))}
            </div>

            <button 
              onClick={() => setExpanded(false)}
              style={{
                marginTop: '28px',
                width: '100%',
                background: 'white',
                color: 'black',
                border: 'none',
                borderRadius: '16px',
                padding: '14px',
                fontWeight: '900',
                fontSize: '14px'
              }}
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpExpand {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
