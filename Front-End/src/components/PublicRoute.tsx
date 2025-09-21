// components/PublicRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface PublicRouteProps {
  children: JSX.Element;
  redirectTo?: string;
}

const PublicRoute = ({ children, redirectTo = "/home" }: PublicRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se já está autenticado, redirecionar para a área logada
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Se NÃO está autenticado, mostrar o conteúdo público (Landing ou Login)
  return children;
};

export default PublicRoute;