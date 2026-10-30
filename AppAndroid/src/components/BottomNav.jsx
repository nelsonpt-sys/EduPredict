import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Plus, BarChart2, Filter } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const getStyle = (target) => ({
    color: path === target ? 'white' : 'var(--text-secondary)',
    transition: 'color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textDecoration: 'none',
    fontSize: '10px',
    gap: '4px'
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '65px',
      background: 'rgba(7, 7, 26, 0.85)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid var(--card-border)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <Link to="/" style={getStyle('/')}>
        <Home size={24} color={path === '/' ? 'var(--primary-color)' : 'var(--text-secondary)'} />
        Inicio
      </Link>
      <Link to="/period" style={getStyle('/period')}>
        <Calendar size={24} color={path === '/period' ? '#22c55e' : 'var(--text-secondary)'} />
        Período
      </Link>
      <Link to="/create-course" style={{
        ...getStyle('/create-course'),
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
        padding: '12px',
        borderRadius: '50%',
        color: 'white',
        transform: 'translateY(-10px)',
        boxShadow: '0 4px 15px var(--primary-glow)'
      }}>
        <Plus size={24} color="white" />
      </Link>
      <Link to="/stats" style={getStyle('/stats')}>
        <BarChart2 size={24} color={path === '/stats' ? '#eab308' : 'var(--text-secondary)'} />
        Stats
      </Link>
      <Link to="/filter" style={getStyle('/filter')}>
        <Filter size={24} color={path === '/filter' ? '#3b82f6' : 'var(--text-secondary)'} />
        Filtrar
      </Link>
    </div>
  );
}
