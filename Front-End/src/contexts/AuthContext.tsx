// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean; // Adicionar estado de loading
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Iniciar como loading

  // Verificar autenticação no mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          // Aqui você pode adicionar validação adicional do token
          // Por exemplo, verificar expiração, fazer request para API, etc.
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false); // Finalizar loading
      }
    };

    checkAuth();
  }, []);

  function login(token: string) {
    try {
      localStorage.setItem('auth_token', token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
    }
  }

  function logout() {
    try {
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}