import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, FileText, Calendar, MoreVertical, Eye, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const resolvedUserEmail = localStorage.getItem('user_email') || '';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  project: string;
  downloads: number;
}

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const [loadingDocuments, setLoadingDocuments] = useState(true); // novo estado

  useEffect(() => {
    loadDocuments();
  }, []);

  const apiFetch = (path: string, opts: RequestInit = {}) => {
    const url = API_BASE.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
    const headers = new Headers(opts.headers || {});
    if (resolvedUserEmail) headers.set('X-User-Id', resolvedUserEmail);
    return fetch(url, { ...opts, headers });
  };

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    if (!resolvedUserEmail) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      setLoadingDocuments(false);
      return;
    }
    try {
      const res = await apiFetch(`/projects`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // transformar projetos em documentos
      const docs: Document[] = (Array.isArray(data) ? data : []).flatMap((p: any) => {
        const files = Array.isArray(p.videos) ? p.videos : (p.videos ? Object.values(p.videos) : []);
        return files.map((f: any) => ({
          id: f.id || f.filename,
          name: f.filename || f.name,
          type: f.type || f.mime || 'file',
          size: Number(f.size || f.filesize || 0),
          uploadDate: f.uploadDate || f.createdAt || new Date().toISOString(),
          project: p.name,
          downloads: f.downloads || 0
        }));
      });
      setDocuments(docs);
      setLoadingDocuments(false); 
    } catch (err: any) {
      console.error('Erro ao carregar documentos:', err);
      toast({ title: 'Erro ao carregar', description: err?.message || String(err), variant: 'destructive' });
      setLoadingDocuments(false);
    }
  };

  const filteredDocuments = useMemo(() =>
    documents.filter(doc =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.project.toLowerCase().includes(searchTerm.toLowerCase())
    ), [documents, searchTerm]
  );

  const handleDownload = async (doc: Document) => {
    try {
      const res = await apiFetch(`/projects/${encodeURIComponent(doc.project)}/videos/${encodeURIComponent(doc.id)}/download`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Download iniciado', description: doc.name });
    } catch (err: any) {
      console.error('Erro no download:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const handlePreview = async (doc: Document) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewTitle(doc.name);
    setPreviewBlobUrl(null);

    try {
      const res = await apiFetch(`/projects/${encodeURIComponent(doc.project)}/files/${encodeURIComponent(doc.id)}/content`);
      if (!res.ok) throw new Error(`Erro ao obter conteúdo (status ${res.status})`);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json') || contentType.includes('text')) {
        const text = await res.text();
        setPreviewContent(text);
      } else {
        const blob = await res.blob();
        setPreviewBlobUrl(window.URL.createObjectURL(blob));
      }
    } catch (err: any) {
      console.error('Erro no preview:', err);
      setPreviewError(err?.message || String(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewContent(null);
    setPreviewError(null);
    if (previewBlobUrl?.startsWith('blob:')) {
      try { window.URL.revokeObjectURL(previewBlobUrl); } catch {}
    }
    setPreviewBlobUrl(null);
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Deseja realmente excluir o documento "${doc.name}"?`)) return;
    try {
      const res = await apiFetch(`/projects/${encodeURIComponent(doc.project)}/videos/${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast({ title: 'Documento excluído', description: doc.name });
    } catch (err: any) {
      console.error('Erro ao excluir documento:', err);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gerencie todos os seus arquivos em um só lugar</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10"/>
        </div>
      </div>

      {filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum documento encontrado</h3>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingDocuments ? (
          <div className="col-span-full text-center py-12">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Carregando documentos...</h3>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum documento encontrado</h3>
          </div>
        ) : (
          filteredDocuments.map(doc => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle>{doc.name}</CardTitle>
                <CardDescription>{doc.project}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handlePreview(doc)}><Eye className="w-4 h-4"/> Ver</Button>
                  <Button size="sm" onClick={() => handleDownload(doc)}><Download className="w-4 h-4"/> Baixar</Button>
                  <Button size="sm" onClick={() => handleDelete(doc)} className="text-destructive"><Trash2 className="w-4 h-4"/> Excluir</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={closePreview}>
        <DialogContent className="max-w-3xl w-full max-h-[80vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <DialogTitle className="text-lg sm:text-xl truncate">{previewTitle}</DialogTitle>
                <DialogDescription className="text-sm sm:text-base">
                  {previewError ? previewError : 'Preview do documento'}
                </DialogDescription>
              </div>

              <div className="flex gap-2 ml-4">
                {previewContent && (
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(previewContent)
                        .then(() => toast({ title: 'Copiado', description: 'Texto copiado para a área de transferência.' }))
                        .catch(() => toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' }));
                    }}
                  >
                    Copiar
                  </Button>
                )}

                {(previewContent || previewBlobUrl) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (previewBlobUrl) {
                        const a = document.createElement('a');
                        a.href = previewBlobUrl;
                        a.download = previewTitle || 'documento';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      } else if (previewContent) {
                        const blob = new Blob([previewContent], { type: 'text/plain' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = previewTitle || 'documento.txt';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      }
                    }}
                  >
                    Baixar
                  </Button>
                )}

                <Button size="sm" variant="secondary" onClick={closePreview}>Fechar</Button>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 overflow-auto max-h-[65vh]">
            {previewLoading && (
              <div className="p-6 text-center text-muted-foreground">Carregando preview...</div>
            )}

            {!previewLoading && previewContent && (
              <pre className="p-4 bg-muted rounded overflow-auto break-words whitespace-pre-wrap">
                {previewContent}
              </pre>
            )}

            {!previewLoading && previewBlobUrl && (
              <iframe
                src={previewBlobUrl}
                className="w-full h-[60vh] border rounded"
                title={previewTitle || 'Preview'}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      
    </div>
  );
}
