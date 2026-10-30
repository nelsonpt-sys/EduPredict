import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';
import { UserPlus, User, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Register({ setAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const navigate = useNavigate();

  // Validaciones en tiempo real
  const passwordsMatch = password && password2 && password === password2;
  const passwordMismatch = password2 && password !== password2;
  const usernameValid = username.trim().length >= 3;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!usernameValid) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), password);
      setAuth(true);
      navigate('/setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '24px 20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, rgba(79,70,229,0.12), transparent)',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, var(--primary-color), #7c3aed)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <UserPlus size={28} color="white" />
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '900', margin: 0 }}>Crea tu cuenta 🎓</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
          Únete a EduPredict y toma el control de tu rendimiento
        </p>
      </div>

      <div className="glass-card">
        {/* Error Banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#fca5a5' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister}>
          {/* Campo: Nombre de usuario */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              display: 'block',
              marginBottom: '7px'
            }}>Nombre de usuario</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} />
              <input
                id="reg-username"
                type="text"
                className="input-base"
                placeholder="Elige un nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
            {username && !usernameValid && (
              <p style={{ fontSize: '11px', color: '#f87171', marginTop: '5px', paddingLeft: '4px' }}>
                Mínimo 3 caracteres
              </p>
            )}
          </div>

          {/* Campo: Contraseña */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              display: 'block',
              marginBottom: '7px'
            }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} />
              <input
                id="reg-password1"
                type={showPass ? 'text' : 'password'}
                className="input-base"
                placeholder="Crea una contraseña segura"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ paddingLeft: '40px', paddingRight: '44px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && password.length < 8 && (
              <p style={{ fontSize: '11px', color: '#f87171', marginTop: '5px', paddingLeft: '4px' }}>
                Mínimo 8 caracteres
              </p>
            )}
          </div>

          {/* Campo: Confirmar contraseña */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              display: 'block',
              marginBottom: '7px'
            }}>Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: passwordMismatch ? '#f87171' : passwordsMatch ? '#4ade80' : 'var(--text-secondary)'
              }} />
              <input
                id="reg-password2"
                type={showPass2 ? 'text' : 'password'}
                className="input-base"
                placeholder="Repite tu contraseña"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                style={{
                  paddingLeft: '40px',
                  paddingRight: '44px',
                  borderColor: passwordMismatch
                    ? 'rgba(239,68,68,0.5)'
                    : passwordsMatch
                    ? 'rgba(74,222,128,0.5)'
                    : undefined
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass2(!showPass2)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordMismatch && (
              <p style={{ fontSize: '11px', color: '#f87171', marginTop: '5px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={11} /> Las contraseñas no coinciden
              </p>
            )}
            {passwordsMatch && (
              <p style={{ fontSize: '11px', color: '#4ade80', marginTop: '5px', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={11} /> Las contraseñas coinciden
              </p>
            )}
          </div>

          <button
            id="reg-submit"
            type="submit"
            className="btn-primary"
            style={{ width: '100%', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            disabled={loading || passwordMismatch || !username || !password || !password2}
          >
            <UserPlus size={18} />
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>¿Ya tienes cuenta? </span>
          <Link to="/login" style={{ color: 'var(--primary-color)', fontSize: '13px', fontWeight: '600' }}>
            Inicia sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
