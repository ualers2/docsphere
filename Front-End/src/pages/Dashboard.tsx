import React, { useEffect, useState } from "react";
import { Upload, FileText, FolderOpen, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import heroImage from "@/assets/hero-documents.jpg";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface StatsCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
}

function StatsCard({ title, value, description, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card className="transition-smooth hover:shadow-elegant">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            {trend && (
              <Badge variant="secondary" className="mt-2 text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                {trend}
              </Badge>
            )}
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "primary";
}

function QuickAction({ title, description, icon: Icon, onClick, variant = "default" }: QuickActionProps) {
  return (
    <Card className="transition-smooth hover:shadow-elegant cursor-pointer group" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-smooth ${
              variant === "primary"
                ? "gradient-primary text-white shadow-glow"
                : "bg-secondary group-hover:bg-primary/10"
            }`}
          >
            <Icon className={`w-6 h-6 ${variant === "primary" ? "text-white" : "text-primary"}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentActivity {
  action: string;
  file: string;
  time: string;
  project: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState([
    { title: "Total de Documentos", value: "0", description: "Arquivos armazenados", icon: FileText },
    { title: "Projetos Ativos", value: "0", description: "Projetos em andamento", icon: FolderOpen },
    { title: "Uploads Hoje", value: "0", description: "Arquivos enviados", icon: Upload },
    { title: "Acessos Recentes", value: "0", description: "Downloads esta semana", icon: Clock }
  ]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const userEmail = localStorage.getItem("user_email") || "";

  useEffect(() => {
    if (!userEmail) return;
    loadDashboardData();
  }, [userEmail]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(userEmail)}`, {
        headers: { "X-User-Id": userEmail }
      });
      if (!res.ok) throw new Error(await res.text());
      const projects = await res.json();

      let totalDocs = 0;
      let uploadsHoje = 0;
      let atividades: RecentActivity[] = [];

      projects.forEach((p: any) => {
        const projectName = p.name || p.project_name || "";
        const videosObj = p.videos || {};
        Object.values(videosObj).forEach((v: any) => {
          const filename = v.filename || v.name || "arquivo";
          totalDocs++;
          const uploadedAt = v.uploadedAt || v.createdAt;
          if (uploadedAt) {
            const d = new Date(uploadedAt);
            if (d.toDateString() === new Date().toDateString()) uploadsHoje++;
          }
          atividades.push({
            action: v.status === "ready" ? "Upload realizado" : "Arquivo enviado",
            file: filename,
            time: uploadedAt ? new Date(uploadedAt).toLocaleString("pt-BR") : "sem data",
            project: projectName
          });
        });
      });

      atividades.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecent(atividades.slice(0, 5));

      setStats([
        { title: "Total de Documentos", value: String(totalDocs), description: "Arquivos armazenados", icon: FileText },
        { title: "Projetos Ativos", value: String(projects.length), description: "Projetos em andamento", icon: FolderOpen },
        { title: "Uploads Hoje", value: String(uploadsHoje), description: "Arquivos enviados hoje", icon: Upload },
        { title: "Acessos Recentes", value: "—", description: "Downloads esta semana", icon: Clock }
      ]);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro", description: err.message || "Falha ao carregar dados do dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    { title: "Fazer Upload", description: "Enviar novos documentos", icon: Upload, onClick: () => navigate("/upload"), variant: "primary" as const },
    { title: "Criar Projeto", description: "Organize seus documentos", icon: FolderOpen, onClick: () => navigate("/projects") },
    { title: "Ver Documentos", description: "Navegar por todos os arquivos", icon: FileText, onClick: () => navigate("/documents") },
    { title: "Arquivos Recentes", description: "Acessar modificados recentemente", icon: Clock, onClick: () => navigate("/recent") }
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl font-bold mb-4">Bem-vindo ao Doc Sphere</h1>
          <p className="text-xl opacity-90 mb-6">
            Gerencie todos os seus documentos em um só lugar. Upload, organize e acesse seus arquivos com facilidade.
          </p>
          <div className="flex gap-4">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-white/90 font-semibold" onClick={() => navigate("/upload")}>
              <Upload className="w-5 h-5 mr-2" />Fazer Upload
            </Button>
            <Button size="lg" variant="outline" className="bg-white text-gray-900 hover:bg-white/90 font-semibold" onClick={() => navigate("/documents")}>
              Ver Documentos
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <StatsCard key={i} {...s} />
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Ações Rápidas</h2>
            <p className="text-muted-foreground">Acesso rápido às funções mais utilizadas</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((a, i) => (
            <QuickAction key={i} {...a} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Atividade Recente
          </CardTitle>
          <CardDescription>Últimas ações realizadas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-6">Carregando...</div>}
          {!loading && recent.length === 0 && <div className="text-muted-foreground py-6">Nenhuma atividade encontrada</div>}
          <div className="space-y-4">
            {recent.map((act, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-smooth">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{act.action}</p>
                    <p className="text-sm text-muted-foreground">{act.file} • {act.project}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{act.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
