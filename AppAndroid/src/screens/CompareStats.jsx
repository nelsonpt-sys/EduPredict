import { useState, useEffect } from 'react';
import { getSemestres, getEstadisticas, pCacheGetSync } from '../services/api';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Trophy, TrendingUp, Scale, Target, Hash, AlertCircle } from 'lucide-react';

export default function CompareStats() {
  const [semestres, setSemestres] = useState([]);
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    getSemestres()
      .then(res => {
        setSemestres(res.semestres || []);
      })
      .catch(err => {
        console.error("Error cargando periodos:", err);
        setError("Error al conectar con el servidor.");
      });
  }, []);

  const toFix = (val, dec = 1) => {
    const num = Number(val);
    if (isNaN(num)) return "0.0";
    return num.toFixed(dec);
  };

  const getLevelColor = (prom) => {
    const p = Number(prom);
    if (p >= 5.5) return '#10b981';
    if (p >= 4.0) return '#4f46e5';
    return '#ef4444';
  };

  const calculateStats = (p1, p2, ramos1Raw, ramos2Raw, m1, m2) => {
    console.log("--- SINCRONIZANDO CON MÉTRICAS DEL BACKEND ---");
    
    // El ganador se decide por el promedio pre-calculado en el servidor
    const winner = Number(m1.promedio) >= Number(m2.promedio) ? 1 : 2;

    const maxPos = Math.max(ramos1Raw.length, ramos2Raw.length);
    const posData = Array.from({ length: maxPos }).map((_, i) => ({
      name: `Pos. ${i+1}`,
      s1: ramos1Raw[i] ? Number(ramos1Raw[i].promedio_final) : null,
      s2: ramos2Raw[i] ? Number(ramos2Raw[i].promedio_final) : null
    }));

    const radarData = [
      { subject: 'Prom. Gral.', s1: Number(m1.promedio), s2: Number(m2.promedio) },
      { subject: 'Nota Máx.', s1: Number(m1.max), s2: Number(m2.max) },
      { subject: 'Nota Mín.', s1: Number(m1.min), s2: Number(m2.min) },
      { subject: '% Aprobados', s1: Number(m1.aprobados), s2: Number(m2.aprobados) },
      { subject: 'Consistencia', s1: Number(m1.consistencia), s2: Number(m2.consistencia) }
    ];

    setAnalysis({
      p1, p2, 
      avg1: Number(m1.promedio), avg2: Number(m2.promedio), 
      winner, posData, radarData,
      countAprob1: m1.count || 0,
      countAprob2: m2.count || 0,
      list1: ramos1Raw,
      list2: ramos2Raw
    });
  };

  const handleCompare = async () => {
    if(s1 && s2 && s1 !== s2) {
      // Si ya tenemos un análisis previo, no mostramos el loader central para evitar parpadeos
      if (!analysis) setLoading(true); 
      setError(null);
      
      try {
        const res = await getEstadisticas(s1, s2);
        
        const p1Obj = semestres.find(s => s.id === parseInt(s1));
        const p2Obj = semestres.find(s => s.id === parseInt(s2));

        if (!p1Obj || !p2Obj) {
          setError("Periodos no encontrados localmente.");
          return;
        }

        if (!res.metrics_s1 || !res.metrics_s2) {
          setError("Error: El servidor no envió las métricas.");
          return;
        }

        calculateStats(
          p1Obj, p2Obj, 
          res.ramos_semestre1 || [], 
          res.ramos_semestre2 || [],
          res.metrics_s1,
          res.metrics_s2
        );
      } catch (e) {
        setError(`Error: ${e.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: '15px', minHeight: '100vh', background: '#0a0a1a', paddingBottom: '100px', color: 'white' }}>
      <div style={{ marginBottom: '25px', marginTop: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>Estadísticas</h1>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: '12px', marginTop: '4px' }}>Análisis comparativo (Sincronización Web).</p>
      </div>
      
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            style={{ flex: 1, height: '44px', fontSize: '13px', borderRadius: '12px', padding: '0 10px', background: '#13132b', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            value={s1} 
            onChange={e => setS1(e.target.value)}
          >
            <option value="">Seleccione un Periodo</option>
            {/* Solo mostramos periodos que tienen ramos configurados */}
            {semestres.filter(s => s.ramos_count >= 1).map(s => (
              <option key={`1-${s.id}`} value={s.id} disabled={s.id.toString() === s2}>
                {s.nombre}
              </option>
            ))}
          </select>
          <span style={{ color: 'rgba(148,163,184,0.4)', fontWeight: '900', fontSize: '10px' }}>VS</span>
          <select 
            style={{ flex: 1, height: '44px', fontSize: '13px', borderRadius: '12px', padding: '0 10px', background: '#13132b', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
            value={s2} 
            onChange={e => setS2(e.target.value)}
          >
            <option value="">Seleccione un Periodo</option>
            {semestres.filter(s => s.ramos_count >= 1).map(s => (
              <option key={`2-${s.id}`} value={s.id} disabled={s.id.toString() === s1}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <button 
          style={{ 
            width: '100%', height: '48px', borderRadius: '14px', fontWeight: '800', fontSize: '13px', marginTop: '12px',
            background: loading ? '#312e81' : '#4f46e5', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer'
          }}
          onClick={handleCompare} 
          disabled={!s1 || !s2 || s1 === s2 || loading}
        >
          {loading ? 'Consultando Backend...' : 'Comparar Rendimiento'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle color="#ef4444" size={24} />
          <span style={{ fontSize: '13px', color: '#fca5a5', fontWeight: '600' }}>{error}</span>
        </div>
      )}

      {analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.4s ease-out' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
             <div className="glass-card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(75, 163, 255, 0.1)', borderRadius: '16px', border: '1px solid rgba(75, 163, 255, 0.2)' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#4ba3ff', textTransform: 'uppercase' }}>{analysis.p1.nombre}</span>
                <div style={{ fontSize: '28px', fontWeight: '900', margin: '4px 0' }}>{toFix(analysis.avg1)}</div>
                <span style={{ fontSize: '9px', color: 'rgba(75, 163, 255, 0.6)' }}>Promedio General</span>
             </div>
             <div className="glass-card" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '16px', border: '1px solid rgba(255, 193, 7, 0.2)' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#ffc107', textTransform: 'uppercase' }}>{analysis.p2.nombre}</span>
                <div style={{ fontSize: '28px', fontWeight: '900', margin: '4px 0' }}>{toFix(analysis.avg2)}</div>
                <span style={{ fontSize: '9px', color: 'rgba(255, 193, 7, 0.6)' }}>Promedio General</span>
             </div>
          </div>

          <div className="glass-card" style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '16px',
            background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.1), transparent)', borderLeft: '4px solid #22c55e', border: '1px solid rgba(255,255,255,0.05)'
          }}>
             <div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#22c55e', textTransform: 'uppercase' }}>LÍDER ACADÉMICO</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>
                   {analysis.winner === 1 ? analysis.p1.nombre : analysis.p2.nombre} {analysis.avg1 === analysis.avg2 ? '=' : '↑'}
                </h3>
             </div>
             <Trophy color="#22c55e" size={28} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', marginBottom: '4px' }}>
                  <Hash size={14} />
                  <span style={{ fontSize: '9px', fontWeight: '900' }}>COBERTURA</span>
                </div>
                <div style={{ fontWeight: '800', fontSize: '14px' }}>{analysis.list1.length} / {analysis.list2.length} Ramos</div>
            </div>
            <div className="glass-card" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', marginBottom: '4px' }}>
                  <TrendingUp size={14} />
                  <span style={{ fontSize: '9px', fontWeight: '900' }}>TENDENCIA</span>
                </div>
                <div style={{ fontWeight: '800', fontSize: '14px' }}>
                   {analysis.avg2 > analysis.avg1 ? 'En ascenso' : (analysis.avg2 === analysis.avg1 ? 'Sin cambios' : 'A la baja')}
                </div>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
               <Scale size={16} color="#4f46e5" />
               <h3 style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>DESEMPEÑO ACADÉMICO</h3>
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.posData} barGap={4}>
                  <XAxis dataKey="name" tick={{ fill: 'rgba(148,163,184,0.5)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 7]} hide />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.03)'}} 
                    contentStyle={{ backgroundColor: '#07071a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                    labelStyle={{ fontWeight: 'bold', color: 'white' }}
                  />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                  <Bar dataKey="s1" name={analysis.p1.nombre} fill="#4ba3ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="s2" name={analysis.p2.nombre} fill="#ffc107" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
               <Target size={16} color="#c084fc" />
               <h3 style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>PERFIL COMPARATIVO</h3>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart key={`radar-${s1}-${s2}`} cx="50%" cy="50%" outerRadius="75%" data={analysis.radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(148,163,184,0.6)', fontSize: 9, fontWeight: '700' }} />
                  <PolarRadiusAxis domain={[0, 7]} tick={false} axisLine={false} />
                  <Radar name={analysis.p1.nombre} dataKey="s1" stroke="#4ba3ff" fill="#4ba3ff" fillOpacity={0.4} />
                  <Radar name={analysis.p2.nombre} dataKey="s2" stroke="#ffc107" fill="#ffc107" fillOpacity={0.4} />
                  <Tooltip contentStyle={{ backgroundColor: '#07071a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
             <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', margin: 0 }}>DETALLE POR RAMO</h3>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                   <div style={{ padding: '10px 15px', background: 'rgba(75, 163, 255, 0.05)', borderBottom: '1px solid rgba(75, 163, 255, 0.1)' }}>
                      <span style={{ fontSize: '10px', fontWeight: '900', color: '#4ba3ff' }}>📘 {analysis.p1.nombre}</span>
                   </div>
                   {analysis.list1.map(r => (
                      <div key={r.id} style={{ padding: '12px 15px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                               <div style={{ width: `${(Number(r.promedio_final || 0)/7)*100}%`, height: '100%', background: getLevelColor(r.promedio_final) }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: getLevelColor(r.promedio_final) }}>{toFix(r.promedio_final)}</span>
                         </div>
                      </div>
                   ))}
                </div>

                <div>
                   <div style={{ padding: '10px 15px', background: 'rgba(255, 193, 7, 0.05)', borderBottom: '1px solid rgba(255, 193, 7, 0.1)' }}>
                      <span style={{ fontSize: '10px', fontWeight: '900', color: '#ffc107' }}>📙 {analysis.p2.nombre}</span>
                   </div>
                   {analysis.list2.map(r => (
                      <div key={r.id} style={{ padding: '12px 15px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                         <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                               <div style={{ width: `${(Number(r.promedio_final || 0)/7)*100}%`, height: '100%', background: getLevelColor(r.promedio_final) }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: getLevelColor(r.promedio_final) }}>{toFix(r.promedio_final)}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}