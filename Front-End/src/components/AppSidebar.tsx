import React from 'react';
import { 
  Home, 
  FolderOpen, 
  Upload, 
  Clock, 
  Settings, 
  User,
  FileText,
  Search,
  LogOut 
} from 'lucide-react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext"; // importa o hook


const resolvedUserEmail = localStorage.getItem('user_email')
const navigation = [
  { 
    title: "Dashboard", 
    url: "/home", 
    icon: Home,
    description: "Overview and analytics"
  },
  { 
    title: "Todos os Documentos", 
    url: "/documents", 
    icon: FileText,
    description: "Browse all files"
  },
  { 
    title: "Projetos", 
    url: "/projects", 
    icon: FolderOpen,
    description: "Manage project folders"
  },
  { 
    title: "Recentes", 
    url: "/recent", 
    icon: Clock,
    description: "Recently accessed"
  },
  { 
    title: "Upload", 
    url: "/upload", 
    icon: Upload,
    description: "Add new files"
  },
];

const quickActions = [
  { 
    title: "Buscar", 
    url: "/projects", 
    icon: Search,
    description: "Find documents"
  },
  { 
    title: "Configurações", 
    url: "/settings", 
    icon: Settings,
    description: "App preferences"
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
    
  const { logout } = useAuth(); // pega o logout
  const collapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    localStorage.clear(); // limpa dados extras
    window.location.href = "/"; // redireciona para login ou landing
  };

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  const getNavClass = (path: string) => {
    return isActive(path) 
      ? "bg-primary text-primary-foreground shadow-glow" 
      : "hover:bg-primary/10 text-foreground/80 hover:text-foreground";
  };

  return (
    <Sidebar className="border-r border-border/40 bg-sidebar">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <FileText className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg text-foreground">Doc Sphere</h1>
              <p className="text-xs text-muted-foreground">Gestão de Documentos</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12 transition-smooth">
                    <NavLink 
                      to={item.url} 
                      className={`${getNavClass(item.url)} rounded-lg flex items-center gap-3 px-3 py-3`}
                      title={collapsed ? item.title : item.description}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-xs opacity-75">{item.description}</span>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Ações Rápidas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {quickActions.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10 transition-smooth">
                    <NavLink 
                      to={item.url} 
                      className={`${getNavClass(item.url)} rounded-lg flex items-center gap-3 px-3 py-2`}
                      title={collapsed ? item.title : item.description}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-medium text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


      <SidebarFooter className="p-4 border-t border-border/40">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {resolvedUserEmail}
                </p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
            )}
          </div>

          {/* Botão de Logout */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            title="Sair"
            className="text-muted-foreground hover:text-red-500"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}