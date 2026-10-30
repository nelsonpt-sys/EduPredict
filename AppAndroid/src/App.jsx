import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { checkSessionStatus } from './services/api';

// Pantallas
import Login from './screens/Login';
import Register from './screens/Register';
import SetupInitial from './screens/SetupInitial';
import Home from './screens/Home';
import MyPeriod from './screens/MyPeriod';
import CourseForm from './screens/CourseForm';
import CompareStats from './screens/CompareStats';
import FilterDashboard from './screens/FilterDashboard';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import FloatingChat from './components/FloatingChat';
import Onboarding from './screens/Onboarding';
import UpdateNotifier from './components/UpdateNotifier';

function ProtectedRoute({ children, isAuthenticated }) {
  if (isAuthenticated === null) return <div className="loader-container"><div className="loader"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function MainLayout() {
  const location = useLocation();

  // Mapear ruta actual a contexto de página para el Asistente EduPredict
  const getPageContext = () => {
    const path = location.pathname;
    if (path === '/period') return { pagina: 'period' };
    if (path.startsWith('/create-course')) return { pagina: 'create-course' };
    if (path.startsWith('/edit-course')) return { pagina: 'edit-course' };
    if (path === '/stats') return { pagina: 'stats' };
    if (path === '/filter') return { pagina: 'filter' };
    return { pagina: 'home' };
  };

  return (
    <>
      <TopBar />
      <div className="main-content pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<SetupInitial />} />
          <Route path="/period" element={<MyPeriod />} />
          <Route path="/create-course" element={<CourseForm />} />
          <Route path="/edit-course/:id" element={<CourseForm />} />
          <Route path="/stats" element={<CompareStats />} />
          <Route path="/filter" element={<FilterDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* El Asistente EduPredict está disponible en todas las pantallas */}
      <FloatingChat pageContext={getPageContext()} />
      <BottomNav />
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    checkSessionStatus()
      .then(res => setIsAuthenticated(res.authenticated))
      .catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <Router>
      <div className="app-container">
        <UpdateNotifier />
        <Routes>
          <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
          <Route path="/register" element={<Register setAuth={setIsAuthenticated} />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Rutas Protegidas */}
          <Route path="/*" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <MainLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
