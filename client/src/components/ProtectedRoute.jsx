import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, token } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles.length && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
