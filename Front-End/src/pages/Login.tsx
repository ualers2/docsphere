import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  ArrowLeft,
  Mail,
  Lock,
  CheckCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const LANDING_APIURL = import.meta.env.VITE_API_BASE_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${LANDING_APIURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || 'Erro no login');
      
      const formattedTime = new Date().toLocaleString('en-US', {
        hour: 'numeric', minute: 'numeric', hour12: true,
        day: '2-digit', month: 'short', year: 'numeric'
      });
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user_email', email);
      localStorage.setItem('api_key', result.api_key);
      localStorage.setItem('expire_time_license', result.expire_time_license);
      localStorage.setItem('login_time', formattedTime);
      
      login(result.api_key);
      navigate(`/home`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${LANDING_APIURL}/create-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, subscription_plan: 'startup', expiration: 'None' }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || 'Erro no registro');
      
      toast({ description: "Conta criada com sucesso! Faça login." });
      setIsRegistering(false);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    "Upload ilimitado de arquivos",
    "Organização automática por projetos", 
    "Analytics detalhado em tempo real",
    "Compartilhamento seguro",
    "API completa para integrações"
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao início</span>
            </Link>
            
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-r from-hero-from to-hero-to rounded-xl flex items-center justify-center">
                <Play className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold gradient-text">Doc Sphere</span>
            </div>
            
            <Badge variant="secondary" className="mb-4">
              Plataforma Avançada de Gestão de Documentos 
            </Badge>
          </div>

          <Card className="border-glass-border shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {isRegistering ? "Criar Conta" : "Bem-vindo de volta!"}
              </CardTitle>
              <CardDescription>
                {isRegistering 
                  ? "Preencha os dados para começar a usar a plataforma"
                  : "Faça login para acessar sua conta e gerenciar seus projetos"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <form 
                onSubmit={isRegistering ? handleRegister : handleLogin} 
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                  </div>
                </div>

                {isRegistering && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirme sua senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                    </div>
                  </div>
                )}

                {!isRegistering && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-input" />
                      <span className="text-muted-foreground">Lembrar de mim</span>
                    </label>
                    <a href="#" className="text-primary hover:underline">
                      Esqueceu a senha?
                    </a>
                  </div>
                )}

                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading 
                    ? (isRegistering ? "Criando conta..." : "Entrando...") 
                    : (isRegistering ? "Registrar" : "Fazer Login")}
                </Button>
              </form>

              <Separator />

              <div className="text-center space-y-2">
                {isRegistering ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Já tem uma conta?
                    </p>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full"
                      onClick={() => setIsRegistering(false)}
                    >
                      Fazer Login
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Ainda não tem uma conta?
                    </p>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full"
                      onClick={() => setIsRegistering(true)}
                    >
                      Criar Conta Gratuita
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Ao {isRegistering ? "registrar-se" : "fazer login"}, você concorda com nossos{" "}
            <a href="#" className="text-primary hover:underline">Termos de Uso</a>{" "}
            e{" "}
            <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-hero-from to-hero-to p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-center space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-4">
              Gerencie seus projetos de mídia com eficiência
            </h2>
            <p className="text-lg opacity-90">
              Plataforma completa para upload, organização e análise de arquivos de vídeo e documentos.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="glass rounded-xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">10,000+</div>
              <div className="text-sm opacity-80">Arquivos processados diariamente</div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/5 rounded-full blur-lg animate-float" style={{ animationDelay: "1s" }}></div>
      </div>
    </div>
  );
};

export default Login;
