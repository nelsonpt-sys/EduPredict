import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actualizarPerfil } from '../services/api';

export default function Onboarding() {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      await actualizarPerfil(displayName.trim());
      navigate('/setup'); // Después de elegir nombre, ir a configurar periodos si es nuevo
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="text-center mb-6">
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>¡Bienvenido a EduPredict! 🎓</h1>
        <p>Solo un paso más. ¿Cómo te gustaría que te llamemos?</p>
      </div>

      <div className="glass-card">
        {error && <div style={{ color: 'var(--level-2)', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Nombre de visualización</label>
            <input 
              type="text" 
              className="input-base" 
              placeholder="Ej: Juan Pérez" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
            />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
              Este nombre será el que aparezca en tus reportes y el que use tu asistente IA. Puede repetirse.
            </p>
          </div>

          <button type="submit" className="btn-primary mt-4" disabled={loading || !displayName.trim()}>
            {loading ? 'Guardando...' : 'Comenzar mi aventura'}
          </button>
        </form>
      </div>
    </div>
  );
}
