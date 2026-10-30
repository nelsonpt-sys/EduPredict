import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, googleAuth } from '../services/api';

export default function Login({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Configurar Google Login
  useEffect(() => {
    /* global google */
    const initializeGoogle = () => {
      if (typeof google === 'undefined') {
        setTimeout(initializeGoogle, 100);
        return;
      }

      google.accounts.id.initialize({
        client_id: "698317788745-cuv71udqlnp0mrkpsklgh6t1sll9g8p4.apps.googleusercontent.com",
        callback: handleGoogleCallback,
        ux_mode: 'popup'
      });

      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        { theme: "outline", size: "large", width: "100%", text: "signin_with" }
      );
    };

    initializeGoogle();
  }, []);

  const handleGoogleCallback = async (response) => {
    setLoading(true);
    try {
      const data = await googleAuth(response.credential);
      setAuth(true);
      // Si es nuevo usuario, mandarlo a elegir nombre
      if (data.is_new) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError("Error con Google: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      setAuth(true);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
      <div className="text-center mb-4">
        <h1 style={{ fontSize: '32px' }}>EduPredict</h1>
        <p>Tu asistente académico inteligente</p>
      </div>

      <div className="glass-card">
        <h2 className="text-center">Iniciar Sesión</h2>
        {error && <div style={{ color: 'var(--level-2)', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}

        {/* Botón de Google */}
        <div id="googleBtn" style={{ marginBottom: '20px' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ margin: '0 10px', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>O con usuario</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            className="input-base"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-base"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary mt-4" disabled={loading}>
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
        </form>
        <div className="text-center mt-4">
          <p>¿No tienes cuenta? <Link to="/register" style={{ color: 'var(--primary-color)' }}>Regístrate aquí</Link></p>
        </div>
      </div>
    </div>
  );
}
