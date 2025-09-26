import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, FileText, Calendar, MoreVertical, Eye, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const UPLOAD_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolvedUserEmail = localStorage.getItem('user_email') || '';

interface Project {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  lastModified: string; // ISO
  size: string;
  type: 'files' | 'video' | 'document';
  videos?: any[]; // metadados brutos do backend
  createdAt?: string;
  status?: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { toast } = useToast();

  // modal específico de arquivos
  const [filesOpen, setFilesOpen] = useState(false);
  const [filesLoadingMap, setFilesLoadingMap] = useState<Record<string, boolean>>({});

  // preview modal states (como em Recent.tsx)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  // criação de projeto (mantive breve)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState<'files' | 'video'>('files');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProjects(); /* eslint-disable-next-line */ }, []);

  const apiFetch = (path: string, opts: RequestInit = {}) => {
    const base = UPLOAD_URL.replace(/\/+$/, '');
    const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = new Headers(opts.headers || {});
    if (resolvedUserEmail) headers.set('X-User-Id', resolvedUserEmail);
    return fetch(url, { ...opts, headers });
  };

  async function loadProjects() {
    if (!resolvedUserEmail) {
      toast({ title: "Erro", description: "Usuário não encontrado em localStorage (user_email).", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/projects`, { method: 'GET' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const mapped: Project[] = (Array.isArray(data) ? data : []).map((p: any, idx: number) => {
        const videosArr = Array.isArray(p.videos) ? p.videos : (p.videos ? Object.values(p.videos) : []);
        const fileCount = videosArr.length;
        let totalSize = '-';
        try {
          const sizes = videosArr.map((v: any) => v.size || v.filesize || 0).filter(Boolean);
          if (sizes.length > 0) {
            const sum = sizes.reduce((a: number, b: number) => a + Number(b), 0);
            if (sum > 1024 * 1024 * 1024) totalSize = `${(sum / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            else if (sum > 1024 * 1024) totalSize = `${(sum / (1024 * 1024)).toFixed(2)} MB`;
            else totalSize = `${(sum / 1024).toFixed(2)} KB`;
          }
        } catch (e) { totalSize = '-'; }
        const createdAt = p.createdAt || p.created_at || new Date().toISOString();
        return {
          id: (p.name || `proj-${idx}`).toString(),
          name: p.name || p.safe_project_name || `Projeto ${idx + 1}`,
          description: p.description || p.model_ai || '',
          fileCount,
          lastModified: createdAt,
          size: totalSize,
          type: p.type_project || (p.videos && Object.keys(p.videos).length ? 'video' : 'files'),
          videos: videosArr,
          createdAt,
          status: p.status
        } as Project;
      });
      setProjects(mapped);
    } catch (err: any) {
      console.error('Erro ao carregar projetos:', err);
      toast({ title: 'Erro ao carregar projetos', description: err?.message || String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  const filteredProjects = useMemo(() => projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [projects, searchTerm]);

  const handleViewProject = async (project: Project) => {
    setSelectedProject(null);
    setIsDialogOpen(true);
    setLoadingDetail(true);

    try {
      const res = await apiFetch(`/projects/metadata/${encodeURIComponent(resolvedUserEmail)}/${encodeURIComponent(project.name)}`, { method: 'GET' });
      if (!res.ok) { console.warn('metadata não disponível'); setSelectedProject(project); return; }
      const metadata = await res.json();
      const videos = Array.isArray(metadata) ? metadata : [];
      // combine metadata with existing project's videos (backend may have ids in videos)
      const mergedVideos = mergeVideos(project.videos || [], videos);
      setSelectedProject({ ...project, videos: mergedVideos });
    } catch (err: any) {
      console.error('Erro ao buscar metadados:', err);
      toast({ title: 'Erro ao carregar detalhes', description: err?.message || String(err), variant: 'destructive' });
      setSelectedProject(project);
    } finally { setLoadingDetail(false); }
  };

  // merge: prefer entries that have id (from /projects), but append metadata entries
  function mergeVideos(existing: any[], metadataList: any[]) {
    const byFilename = new Map<string, any>();
    existing.forEach(v => { if (v.filename) byFilename.set(v.filename, v); if (v.id) byFilename.set(v.id, v); });
    metadataList.forEach(m => {
      const key = m.filename || m.title || JSON.stringify(m);
      if (!byFilename.has(key)) byFilename.set(key, { ...m, id: m.filename });
    });
    return Array.from(byFilename.values());
  }

  const handleOpenFiles = (project: Project) => {
    setSelectedProject(project);
    // ensure we have videos - if not, fetch metadata then open
    if (!project.videos || project.videos.length === 0) {
      handleViewProject(project).then(() => setFilesOpen(true));
    } else {
      setFilesOpen(true);
    }
  };

  const downloadFile = async (projectName: string, fileId: string, filename?: string) => {
    try {
      setFilesLoadingMap(m => ({ ...m, [fileId]: true }));
      const res = await apiFetch(`/projects/${encodeURIComponent(projectName)}/videos/${encodeURIComponent(fileId)}/download`, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Status ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition');
      let name = filename || 'download';
      if (cd) {
        const m = /filename\*=UTF-8''(.+)$/.exec(cd) || /filename="?([^\";]+)"?/.exec(cd);
        if (m && m[1]) name = decodeURIComponent(m[1]);
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Download iniciado', description: name });
    } catch (err: any) {
      console.error('Erro no download:', err);
      toast({ title: 'Erro no download', description: err?.message || String(err), variant: 'destructive' });
    } finally { setFilesLoadingMap(m => ({ ...m, [fileId]: false })); }
  };

  // novo handlePreview - abre modal elegante (igual ao Recent.tsx)
  const handlePreview = async (projectName: string, fileId: string, title?: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewBlobUrl(null);
    setPreviewTitle(title || fileId);

    try {
      // tenta buscar conteúdo textual/JSON direto
      const res = await apiFetch(`/projects/${encodeURIComponent(projectName)}/files/${encodeURIComponent(fileId)}/content`, { method: 'GET' });
      if (!res.ok) {
        // se não for possível ler como texto, tentamos a rota de preview otimizada (que retorna preview_url)
        const resPreview = await apiFetch(`/projects/${encodeURIComponent(projectName)}/videos/${encodeURIComponent(fileId)}/preview`, { method: 'GET' });
        if (resPreview.ok) {
          const body = await resPreview.json().catch(() => null);
          if (body && body.preview_url) {
            // para binários servidos por preview_url, abrimos em nova aba (mas ainda mostramos modal com opção)
            setPreviewBlobUrl(body.preview_url);
            return;
          }
        }
        throw new Error(`Conteúdo não disponível para preview (status ${res.status})`);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setPreviewContent(JSON.stringify(json, null, 2));
      } else if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml')) {
        const text = await res.text();
        setPreviewContent(text);
      } else {
        // binário: obter blob e criar URL para abrir
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        // revocar depois quando modal fechar
      }

    } catch (err: any) {
      console.error('Erro no preview:', err);
      setPreviewError(err?.message || String(err));
    } finally { setPreviewLoading(false); }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewTitle(null);
    if (previewBlobUrl && previewBlobUrl.startsWith('blob:')) {
      try { window.URL.revokeObjectURL(previewBlobUrl); } catch {};
    }
    setPreviewBlobUrl(null);
    setPreviewLoading(false);
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!confirm(`Confirmar exclusão do projeto "${projectName}"? Essa ação é irreversível.`)) return;

    try {
      // opcional: bloquear UI durante a ação
      setLoading(true);

      const res = await apiFetch(`/projects/${encodeURIComponent(projectName)}`, {
        method: 'DELETE'
      });

      // tenta extrair mensagem do body mesmo em erro
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message || `Erro ${res.status}`);
      }

      // remover do estado local
      setProjects(prev => prev.filter(p => p.name !== projectName));

      // fechar modais/detalhes caso estejam abertos para esse projeto
      if (selectedProject?.name === projectName) {
        setSelectedProject(null);
        setIsDialogOpen(false);
        setFilesOpen(false);
      }

      toast({
        title: "Projeto excluído",
        description: body?.message || `Projeto "${projectName}" removido com sucesso.`,
      });
    } catch (err: any) {
      console.error("Erro ao excluir projeto:", err);
      toast({
        title: "Erro ao excluir",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (projectName: string, fileId: string) => {
    if (!confirm('Confirmar exclusão do arquivo? Essa ação é irreversível.')) return;
    try {
      setFilesLoadingMap(m => ({ ...m, [fileId]: true }));
      const res = await apiFetch(`/projects/${encodeURIComponent(projectName)}/videos/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      // atualizar estado local
      setSelectedProject(sp => sp ? ({ ...sp, videos: (sp.videos || []).filter(v => (v.id || v.filename) !== fileId) }) : sp);
      setProjects(prev => prev.map(pr => pr.name === projectName ? ({ ...pr, videos: (pr.videos || []).filter(v => (v.id || v.filename) !== fileId), fileCount: Math.max(0, (pr.fileCount || 1) - 1) }) : pr));
      toast({ title: 'Arquivo excluído', description: 'Arquivo removido com sucesso.' });
    } catch (err: any) {
      console.error('Erro ao excluir arquivo:', err);
      toast({ title: 'Erro ao excluir', description: err?.message || String(err), variant: 'destructive' });
    } finally { setFilesLoadingMap(m => ({ ...m, [fileId]: false })); }
  };

  function escapeHtml(unsafe: string) {
    return unsafe.replace(/[&<"'>]/g, function (m) { return ({ '&':'&amp;','<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#039;" } as any)[m]; });
  }

  const createProject = async () => {
    if (!newProjectName.trim()) { toast({ title: 'Nome inválido', description: 'Digite um nome para o projeto.', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      const payload = { projectName: newProjectName, type_project: newProjectType };
      const res = await apiFetch(`/projects/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `Status ${res.status}`);
      await loadProjects();
      setIsCreateOpen(false);
      setNewProjectName(''); setNewProjectType('files');
      toast({ title: 'Projeto criado', description: `Projeto "${body.project_name || newProjectName}" criado.` });
    } catch (err: any) {
      console.error('Erro ao criar projeto:', err);
      toast({ title: 'Falha ao criar projeto', description: err?.message || String(err), variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const getProjectIcon = (type: Project['type']) => { switch (type) { case 'video': return '🎥'; case 'document': return '📄'; default: return '📁'; } };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground">Gerencie seus projetos e organize seus arquivos</p>
        </div>
        <div className="flex gap-4">
          <Input placeholder="Buscar projetos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64" />
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4"/> Novo Projeto</Button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-12">Carregando projetos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getProjectIcon(project.type)}</div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                        <CardDescription className="text-sm line-clamp-2">{project.description}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewProject(project)}><Eye className="w-4 h-4 mr-2"/> Ver Detalhes</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenFiles(project)}><FolderOpen className="w-4 h-4 mr-2"/> Ver Arquivos</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteProject(project.name)} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2"/> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4"/> <span>{project.fileCount} arquivos</span></div>
                    <Badge variant="secondary" className="text-xs">{project.size}</Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="w-3 h-3"/> <span>Modificado em {new Date(project.lastModified).toLocaleDateString('pt-BR')}</span></div>

                  <Button variant="outline" className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors" onClick={() => handleOpenFiles(project)}>
                    <FolderOpen className="w-4 h-4"/> Abrir Projeto
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {filteredProjects.length === 0 && !loading && (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum projeto encontrado</h3>
          <p className="text-muted-foreground">{searchTerm ? 'Tente ajustar sua busca' : 'Crie seu primeiro projeto para começar'}</p>
        </div>
      )}

      {/* Dialog: detalhes do projeto (mantido) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3"><div className="text-2xl">{selectedProject && getProjectIcon(selectedProject.type)}</div>{selectedProject?.name || (loadingDetail ? 'Carregando...' : '')}</DialogTitle>
            <DialogDescription>{selectedProject?.description}</DialogDescription>
          </DialogHeader>

          {loadingDetail ? <div className="p-6">Carregando detalhes...</div> : selectedProject ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><h4 className="font-medium text-sm text-muted-foreground">Arquivos</h4><p className="text-2xl font-bold text-foreground">{selectedProject.fileCount}</p></div>
                <div className="space-y-2"><h4 className="font-medium text-sm text-muted-foreground">Tamanho Total</h4><p className="text-2xl font-bold text-foreground">{selectedProject.size}</p></div>
              </div>

              <div className="space-y-2"><h4 className="font-medium text-sm text-muted-foreground">Última Modificação</h4><p className="text-foreground">{new Date(selectedProject.lastModified).toLocaleDateString('pt-BR', { year:'numeric', month:'long', day:'numeric' })}</p></div>

              <div className="space-y-2"><h4 className="font-medium text-sm text-muted-foreground">ID do Projeto</h4><code className="text-xs bg-muted px-2 py-1 rounded font-mono">{selectedProject.id}</code></div>

              <div className="flex gap-3 pt-4">
                <Button className="flex-1 gap-2" onClick={() => { setIsDialogOpen(false); setFilesOpen(true); }}><FolderOpen className="w-4 h-4"/> Ver Arquivos</Button>
                <Button variant="outline" className="gap-2" onClick={() => { window.location.href = '/upload'; }}><Plus className="w-4 h-4"/> Upload</Button>
              </div>
            </div>
          ) : <div className="p-6">Nenhum detalhe disponível.</div>}
        </DialogContent>
      </Dialog>

      {/* Dialog: arquivos do projeto - elegante listagem com ações */}
      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📁</div>
                <div>
                  <div className="font-semibold">{selectedProject?.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedProject?.fileCount} arquivo(s)</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => { setFilesOpen(false); }}>{'Fechar'}</Button>
              </div>
            </DialogTitle>
            <DialogDescription>Lista completa de arquivos com ações: Preview, Download e Deletar.</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {(!selectedProject || !selectedProject.videos) ? (
              <div className="text-center py-8">Nenhum arquivo encontrado.</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                {selectedProject.videos.map((v: any, i: number) => {
                  const id = v.id || v.filename || String(i);
                  const name = v.title || v.filename || id;
                  const sizeLabel = v.size ? (Number(v.size) > 0 ? (Number(v.size) > 1024*1024 ? `${(Number(v.size)/(1024*1024)).toFixed(2)} MB` : `${(Number(v.size)/1024).toFixed(2)} KB`) : '-') : (v.filesize ? `${v.filesize}` : '-');
                  return (
                    <div key={id} className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center text-lg">{name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground truncate">{v.description || v.title || ''}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground mr-4">{sizeLabel}</div>
                        <Button size="sm" variant="ghost" onClick={() => handlePreview(selectedProject!.name, id, name)} disabled={!!filesLoadingMap[id]}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadFile(selectedProject!.name, id, v.filename)} disabled={!!filesLoadingMap[id]}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteFile(selectedProject!.name, id)} disabled={!!filesLoadingMap[id]}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: preview elegante — usa mesmo padrão do Recent.tsx */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); else setPreviewOpen(open); }}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewTitle || 'Preview'}</span>
              <div className="text-sm text-muted-foreground">{resolvedUserEmail}</div>
            </DialogTitle>
            <DialogDescription>{previewError ? 'Erro ao carregar conteúdo' : 'Visualização rápida do arquivo'}</DialogDescription>
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
                <pre className="whitespace-pre-wrap text-sm font-mono">{previewContent}</pre>
              </div>
            )}

            {!previewLoading && !previewError && !previewContent && previewBlobUrl && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">Conteúdo não textual — abra em nova aba ou faça download.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={() => window.open(previewBlobUrl, '_blank')}>Abrir em nova aba</Button>
                  <Button onClick={() => {
                    // forçar download
                    const a = document.createElement('a');
                    a.href = previewBlobUrl;
                    a.download = previewTitle || 'download';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}>Download</Button>
                </div>
              </div>
            )}

            {!previewLoading && !previewError && !previewContent && !previewBlobUrl && (
              <div className="text-center py-6 text-muted-foreground">Nenhum conteúdo disponível para preview.</div>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => { closePreview(); }}>Fechar</Button>
            {previewContent && (
              <Button onClick={() => {
                navigator.clipboard.writeText(previewContent || '').then(() => {
                  toast({ title: 'Conteúdo copiado', description: 'O texto foi copiado para a área de transferência.' });
                }).catch(() => {
                  toast({ title: 'Falha ao copiar', variant: 'destructive' });
                });
              }}>Copiar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: criação de projeto (mantido simples) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
            <DialogDescription>Crie um novo projeto — nome e tipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome do projeto</label>
              <Input placeholder="Ex.: Projeto Alpha" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createProject(); }} className="mt-2" />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <div className="mt-2">
                <select value={newProjectType} onChange={(e) => setNewProjectType(e.target.value as 'files' | 'video')} className="w-full border rounded px-3 py-2">
                  <option value="files">Files (documentos)</option>
                  <option value="video">Video</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); setNewProjectName(''); }}>Cancelar</Button>
              <Button onClick={createProject} disabled={creating}>{creating ? 'Criando...' : 'Criar Projeto'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
