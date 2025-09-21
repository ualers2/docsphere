import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FolderOpen, 
  BarChart3, 
  Shield, 
  Zap, 
  ArrowRight,
  CheckCircle,
  Star,
  Play
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-media-cuts.jpg";

const Landing = () => {
  const features = [
    {
      icon: Upload,
      title: "Upload Inteligente",
      description: "Faça upload de vídeos e documentos com organização automática por projetos."
    },
    {
      icon: FolderOpen,
      title: "Gestão de Projetos",
      description: "Organize seus arquivos em projetos e acesse facilmente quando precisar."
    },
    {
      icon: BarChart3,
      title: "Analytics Avançado",
      description: "Acompanhe estatísticas detalhadas de uploads, downloads e atividades."
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Seus arquivos protegidos com criptografia e controle de acesso."
    }
  ];

  const benefits = [
    "Upload em massa com progresso em tempo real",
    "Preview integrado para documentos e vídeos",
    "Organização automática por tipo de arquivo",
    "Compartilhamento seguro com controle de permissões",
    "Dashboard com métricas completas",
    "API completa para integrações"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass border-b border-glass-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-hero-from to-hero-to rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Doc Sphere</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">
              Benefícios
            </a>
            <Link to="/login">
              <Button variant="hero" size="sm">
                Fazer Login
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-6 text-sm">
            ✨ Nova versão disponível
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Gerencie seus
            <span className="gradient-text"> vídeos e documentos</span>
            <br />como nunca antes
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma completa para upload, organização e gerenciamento de arquivos de mídia. 
            Perfeita para profissionais e equipes que precisam de eficiência.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/login">
              <Button variant="hero" size="xl" className="group">
                Começar Agora
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="ghost" size="xl">
              Ver Demo
              <Play className="ml-2" />
            </Button>
          </div>

          {/* Hero Image */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-hero-from/20 to-hero-to/20 rounded-2xl blur-3xl"></div>
            <img 
              src={heroImage} 
              alt="Doc Sphere Dashboard" 
              className="relative rounded-2xl shadow-2xl border border-glass-border animate-float"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Recursos <span className="gradient-text">Poderosos</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para gerenciar seus arquivos de forma profissional
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-all duration-300 border-glass-border">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-hero-from to-hero-to rounded-lg mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Por que escolher o <span className="gradient-text">Doc Sphere</span>?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Nossa plataforma foi desenvolvida pensando na produtividade e facilidade de uso.
              </p>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link to="/login">
                  <Button variant="hero" size="lg">
                    Começar Gratuitamente
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-hero-from/10 to-hero-to/10 rounded-2xl blur-2xl"></div>
              <div className="relative glass rounded-2xl p-8 border border-glass-border">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-lg mb-4">
                    "O Doc Sphere revolucionou nossa forma de trabalhar com arquivos de mídia. 
                    A organização automática e o dashboard analítico são incríveis!"
                  </blockquote>
                  <cite className="text-muted-foreground">
                    — Maria Silva, Produtora Digital
                  </cite>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-hero-from to-hero-to text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de profissionais que já confiam no Doc Sphere
          </p>
          <Link to="/login">
            <Button variant="secondary" size="xl" className="bg-white text-primary hover:bg-gray-100">
              Criar Conta Gratuita
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-glass-border">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-r from-hero-from to-hero-to rounded flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold gradient-text">Doc Sphere</span>
          </div>
          <p className="text-muted-foreground">
            © 2024 Doc Sphere. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;