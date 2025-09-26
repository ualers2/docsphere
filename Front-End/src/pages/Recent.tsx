import React, { useEffect, useMemo, useState } from 'react';
import { Clock, FileText, Download, Eye, MoreVertical, Calendar, User, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileTypeIcon, formatFileSize } from "@/components/FileTypeIcon";
import { useToast } from "@/hooks/use-toast";

interface RecentFile {
  id: string;
  videoId: string; // ID retornado pelo backend
  name: string;
  type: string;
  size: number;
  projectName: string;
  uploadDate?: string | null;
  lastAccessed?: string | null;
  userId: string;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
}


export default function Recent() {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // states para preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const UPLOAD_URL = import.meta.env.VITE_API_BASE_URL
  const resolvedUserEmail = localStorage.getItem('user_email')

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserEmail]);

  async function loadFiles() {
    if (!resolvedUserEmail) {
      toast({ title: 'Usuário não informado', description: 'Passe userEmail como prop ou salve em localStorage como "user_email"', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${UPLOAD_URL}/projects`, {
        headers: { 'X-User-Id': resolvedUserEmail }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ao buscar projetos: ${res.status} ${text}`);
      }

      const projects = await res.json();

      // Flatten: cada projeto tem `videos` (obj) com keys = videoId
      const flattened: RecentFile[] = [];

      (projects || []).forEach((p: any) => {
        const projectName = p.name || p.project_name || p.safe_project_name || '';
        const videosObj = p.videos || {};

        // Se videos for array (por segurança), itera
        if (Array.isArray(videosObj)) {
          videosObj.forEach((v: any) => {
            flattened.push(mapVideoToRecentFile(v, projectName, resolvedUserEmail));
          });
        } else {
          Object.entries(videosObj).forEach(([vid, vdata]: any) => {
            const videoData = typeof vdata === 'object' ? vdata : { filename: String(vdata) };
            // garantir id
            videoData.id = videoData.id || vid;
            flattened.push(mapVideoToRecentFile(videoData, projectName, resolvedUserEmail));
          });
        }
      });

      // Ordena por data de upload (mais recente primeiro) quando disponível
      flattened.sort((a, b) => {
        const da = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const db = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return db - da;
      });

      setFiles(flattened);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao carregar arquivos', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function mapVideoToRecentFile(v: any, projectName: string, userEmail: string): RecentFile {
    const filename = v.filename || v.title || v.name || '';
    const id = v.id || v.videoId || v.video_id || filename;
    const type = (filename.split('.').pop() || '').toLowerCase();

    return {
      id: String(id),
      videoId: String(id),
      name: filename,
      type,
      size: v.size || 0,
      projectName,
      uploadDate: v.uploadedAt || v.uploaded_at || v.createdAt || null,
      lastAccessed: v.last_accessed || null,
      userId: userEmail,
      status: (v.status || (v.uploadedAt ? 'ready' : 'uploaded') || 'uploaded') as RecentFile['status']
    };
  }

  const projects = useMemo(() => Array.from(new Set(files.map(f => f.projectName))).filter(Boolean), [files]);

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.projectName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = filterProject === "all" || file.projectName === filterProject;
    const matchesStatus = filterStatus === "all" || file.status === filterStatus;
    return matchesSearch && matchesProject && matchesStatus;
  });

  const handleDownload = async (file: RecentFile) => {
    try {
      const response = await fetch(
        `${UPLOAD_URL}/projects/${encodeURIComponent(file.projectName)}/videos/${encodeURIComponent(file.videoId)}/download`,
        {
          headers: {
            'X-User-Id': resolvedUserEmail
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({ title: 'Download iniciado', description: `${file.name} está sendo baixado.` });
      } else {
        const text = await response.text();
        throw new Error(`Falha no download: ${response.status} ${text}`);
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Erro no download', description: `Não foi possível baixar ${file.name}. ${error.message || ''}`, variant: 'destructive' });
    }
  };

  // Novo handlePreview: abre modal e busca conteúdo textual em /files/<file_id>/content
  const handlePreview = async (file: RecentFile) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewTitle(file.name);

    try {
      const res = await fetch(`${UPLOAD_URL}/projects/${encodeURIComponent(file.projectName)}/files/${encodeURIComponent(file.videoId)}/content`, {
        headers: { 'X-User-Id': resolvedUserEmail }
      });

      if (!res.ok) {
        // Se não for texto, pode ser que o backend force download -> tratar como erro de preview
        const text = await res.text();
        throw new Error(`Falha ao obter conteúdo: ${res.status} ${text}`);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('application/json')) {
        const json = await res.json();
        setPreviewContent(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setPreviewContent(text);
      }

    } catch (e: any) {
      console.error(e);
      setPreviewError(e.message || String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewContent(null);
    setPreviewTitle(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const getStatusBadge = (status: RecentFile['status']) => {
    const statusConfig = {
      uploaded: { variant: "secondary" as const, label: "Enviado" },
      processing: { variant: "default" as const, label: "Processando" },
      ready: { variant: "default" as const, label: "Pronto", className: "bg-success text-success-foreground" },
      error: { variant: "destructive" as const, label: "Erro" },
    } as const;

    const config = statusConfig[status] || statusConfig.uploaded;
    return (
      <Badge variant={config.variant} className={'className' in config ? (config as any).className : ""}>
        {config.label}
      </Badge>
    );
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Arquivos Recentes</h1>
        <p className="text-muted-foreground">Acesse rapidamente seus arquivos mais recentes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Input placeholder="Buscar arquivos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />

            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Todos os projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project} value={project}>{project}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="uploaded">Enviado</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading && (
          <div className="text-center py-6">Carregando arquivos...</div>
        )}

        {filteredFiles.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <FileTypeIcon fileType={file.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground truncate">{file.name}</h3>
                    {getStatusBadge(file.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1"><FileText className="w-3 h-3" /><span>{formatFileSize(file.size)}</span></div>
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>Acessado: {formatDateTime(file.lastAccessed)}</span></div>
                    <div className="flex items-center gap-1"><User className="w-3 h-3" /><span>{file.projectName}</span></div>
                    <div className="flex items-center gap-1"><Hash className="w-3 h-3" /><code className="text-xs font-mono bg-muted px-1 rounded">{file.videoId.split('-')[0]}...</code></div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {file.status === 'ready' && (
                    <Button variant="outline" size="sm" onClick={() => handleDownload(file)} className="gap-2">
                      <Download className="w-4 h-4" />Download
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreview(file)}><Eye className="w-4 h-4 mr-2" />Ver Detalhes</DropdownMenuItem>
                      {file.status === 'ready' && (
                        <DropdownMenuItem onClick={() => handleDownload(file)}><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground"><span className="font-medium">ID Completo:</span> <code className="font-mono bg-muted px-2 py-1 rounded text-foreground">{file.videoId}</code></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum arquivo recente encontrado</h3>
          <p className="text-muted-foreground">{searchTerm || filterProject !== "all" || filterStatus !== "all" ? 'Tente ajustar seus filtros' : 'Faça upload de alguns arquivos para vê-los aqui'}</p>
        </div>
      )}

      {/* Modal de preview elegante */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); else setPreviewOpen(open); }}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewTitle || 'Preview'}</span>
              <div className="text-sm text-muted-foreground">{resolvedUserEmail}</div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {previewLoading && (
              <div className="text-center py-8">Carregando conteúdo...</div>
            )}

            {previewError && (
              <div className="text-center py-6 text-destructive">Erro ao carregar conteúdo: {previewError}</div>
            )}

            {!previewLoading && !previewError && previewContent && (
              <div className="overflow-auto max-h-[60vh] p-4 bg-muted rounded">
                {/* Exibe JSON formatado ou texto simples. Mantemos whitespace e quebra de linhas. */}
                <pre className="whitespace-pre-wrap text-sm font-mono">{previewContent}</pre>
              </div>
            )}

            {!previewLoading && !previewError && !previewContent && (
              <div className="text-center py-6 text-muted-foreground">Nenhum conteúdo textual disponível para esse arquivo.</div>
            )}

          </div>

          <DialogFooter className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => { closePreview(); }}>
              Fechar
            </Button>
            {previewContent && (
              <Button onClick={() => {
                // copiar para clipboard
                navigator.clipboard.writeText(previewContent || '').then(() => {
                  toast({ title: 'Conteúdo copiado', description: 'O texto foi copiado para a área de transferência.' });
                }).catch(() => {
                  toast({ title: 'Falha ao copiar', variant: 'destructive' });
                });
              }}>
                Copiar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
