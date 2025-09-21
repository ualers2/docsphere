import React, { useState, useCallback, useEffect } from 'react';
import { Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileTypeIcon, formatFileSize } from "@/components/FileTypeIcon";
import { useToast } from "@/hooks/use-toast";

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  videoId?: string; // ID retornado pelo backend
}

interface Project {
  id: string;
  name: string;
  fileCount: number;
}

export default function Upload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);

  const LANDING_APIURL = import.meta.env.VITE_API_BASE_URL;
  const email_user =  localStorage.getItem('user_email');
  const generateId = () => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        
        const response = await fetch(`${LANDING_APIURL}/list-projects`, {
          headers: { "X-User-Id":  email_user}
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (error) {
        console.error("Erro ao carregar projetos", error);
      }
    };

    fetchProjects();
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      file,
      id: generateId(),
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const realUpload = async (uploadFile: UploadFile) => {
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id 
        ? { ...f, status: 'uploading' as const }
        : f
    ));

    try {
      
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      
      const metadata = {
        projectName: selectedProject || newProjectName,
        type_project: "files"
      };
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(`${LANDING_APIURL}/upload-video`, {
        method: 'POST',
        headers: {
          'X-User-Id': email_user
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const videoId = result.video_id;
        
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                status: 'success' as const,
                progress: 100,
                videoId: videoId
              }
            : f
        ));

        toast({
          title: "Upload concluído",
          description: `${uploadFile.file.name} foi enviado com sucesso.`,
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'error' as const,
              error: 'Falha no upload'
            }
          : f
      ));

      toast({
        title: "Erro no upload",
        description: `Falha ao enviar ${uploadFile.file.name}.`,
        variant: "destructive",
      });
    }
  };

  const startUpload = async () => {
    if (!selectedProject && !newProjectName) {
      toast({
        title: "Projeto não selecionado",
        description: "Selecione um projeto ou crie um novo.",
        variant: "destructive",
      });
      return;
    }

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast({
        title: "Nenhum arquivo",
        description: "Adicione arquivos para fazer upload.",
        variant: "destructive",
      });
      return;
    }

    // Upload files in parallel
    const uploadPromises = pendingFiles.map(file => realUpload(file));
    await Promise.all(uploadPromises);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: "Nome inválido",
        description: "Digite um nome para o projeto.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingProject(true);
    try {
      const payload = {
        projectName: newProjectName,
        type_project: "files"
      };

      const resp = await fetch(`${LANDING_APIURL}/projects/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": email_user
        },
        body: JSON.stringify(payload)
      });

      const body = await resp.json();

      if (!resp.ok) {
        throw new Error(body.message || `Erro ${resp.status}`);
      }

      const safeName = body.safe_project_name || newProjectName;
      const prettyName = body.project_name || newProjectName;

      if (typeof setProjects === "function") {
        setProjects((prev: Project[]) => [{ id: safeName, name: prettyName, fileCount: 0 }, ...prev]);
      }
      setSelectedProject(safeName);
      setNewProjectName("");
      setIsCreatingProject(false);

      toast({
        title: "Projeto criado",
        description: `Projeto "${prettyName}" foi criado com sucesso.`,
      });

    } catch (err: any) {
      console.error("Erro ao criar projeto:", err);
      toast({
        title: "Falha ao criar projeto",
        description: err.message || "Erro desconhecido ao criar projeto.",
        variant: "destructive",
      });
      setIsCreatingProject(false);
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'bg-primary';
      case 'success':
        return 'bg-success';
      case 'error':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload de Arquivos</h1>
        <p className="text-muted-foreground">
          Envie documentos para seus projetos de forma rápida e segura
        </p>
      </div>

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Selecionar Projeto
          </CardTitle>
          <CardDescription>
            Escolha o projeto de destino ou crie um novo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isCreatingProject ? (
            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.name}>
                        <div className="flex items-center justify-between w-full">
                          <span>{project.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {project.fileCount} arquivos
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setIsCreatingProject(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Projeto
              </Button>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Nome do novo projeto..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createProject()}
                />
              </div>
              <Button onClick={createProject}>
                Criar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreatingProject(false);
                  setNewProjectName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="w-5 h-5 text-primary" />
            Adicionar Arquivos
          </CardTitle>
          <CardDescription>
            Arraste e solte arquivos ou clique para selecionar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              border-2 border-dashed rounded-xl p-12 text-center transition-smooth cursor-pointer
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <UploadIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Arraste arquivos aqui
            </h3>
            <p className="text-muted-foreground mb-4">
              ou clique para selecionar arquivos do seu computador
            </p>
            <Button variant="outline">
              Selecionar Arquivos
            </Button>
            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Arquivos Selecionados</CardTitle>
                <CardDescription>
                  {files.length} arquivo(s) • {formatFileSize(files.reduce((acc, f) => acc + f.file.size, 0))}
                </CardDescription>
              </div>
              <Button onClick={startUpload} className="gap-2">
                <UploadIcon className="w-4 h-4" />
                Iniciar Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center gap-4 p-4 rounded-lg border">
                  <FileTypeIcon fileType={uploadFile.file.name.split('.').pop() || ''} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground truncate">
                        {uploadFile.file.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </span>
                        {getStatusIcon(uploadFile.status)}
                      </div>
                    </div>
                    
                    {uploadFile.status === 'uploading' && (
                      <div className="space-y-1">
                        <Progress value={uploadFile.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {uploadFile.progress}% enviado
                        </p>
                      </div>
                    )}
                    
                    {uploadFile.status === 'error' && uploadFile.error && (
                      <p className="text-sm text-destructive">{uploadFile.error}</p>
                    )}
                    
                    {uploadFile.status === 'success' && (
                      <div className="space-y-1">
                        <p className="text-sm text-success">Upload concluído com sucesso</p>
                        {uploadFile.videoId && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">ID:</span>{' '}
                            <code className="font-mono bg-muted px-1 rounded">
                              {uploadFile.videoId}
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeFile(uploadFile.id)}
                    disabled={uploadFile.status === 'uploading'}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}