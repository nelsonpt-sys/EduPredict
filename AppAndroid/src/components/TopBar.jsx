import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout, checkSessionStatus } from '../services/api';
import { LogOut, User, ChevronDown } from 'lucide-react';
import './TopBar.css';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkSessionStatus().then(res => {
      if (res.authenticated) {
        setUser(res.user);
      }
    });
  }, []);

  const getPageName = () => {
    const path = location.pathname;
    if (path === '/') return 'Inicio';
    if (path === '/period') return 'Período Académico';
    if (path === '/stats') return 'Estadísticas';
    if (path === '/filter') return 'Filtrar Ramos';
    if (path.startsWith('/create-course')) return 'Crear Ramo';
    if (path.startsWith('/edit-course')) return 'Editar Ramo';
    if (path === '/setup') return 'Configuración';
    return 'Panel académico';
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login'; // Recarga completa para limpiar estado
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
  };

  const usernameInitial = user?.display_name ? user.display_name.charAt(0).toUpperCase() : '?';

  return (
    <nav className="topbar">
      <div className="topbar-container">
        {/* Lado Izquierdo: Branding & Breadcrumb */}
        <div className="topbar-left">
          <span className="brand-name">EduPredict</span>
          <span className="breadcrumb-sep">/</span>
          <span className="page-name">{getPageName()}</span>
        </div>

        {/* Lado Derecho: Usuario */}
        <div className="topbar-right">
          <div className="user-pill" onClick={() => setShowDropdown(!showDropdown)}>
            <div className="user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : usernameInitial}
            </div>
            <span className="username-text d-none-mobile">{user?.display_name || 'Usuario'}</span>
            <ChevronDown size={14} className={`chevron ${showDropdown ? 'rotate' : ''}`} />
          </div>

          {showDropdown && (
            <>
              <div className="dropdown-overlay" onClick={() => setShowDropdown(false)} />
              <div className="topbar-dropdown">
                <div className="dropdown-header">
                  <p className="user-name-bold">{user?.display_name}</p>
                  <p className="user-role">Estudiante · EduPredict</p>
                </div>
                <button className="dropdown-item logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  Cerrar Sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
