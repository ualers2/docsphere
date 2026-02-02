# Documentação Técnica da API - Front-End

**URL Base:** `https://videomanager.api.mediacutsstudio.com`

**Versão:** 1.0  
**Data:** Janeiro 2026

---

## Autenticação

Todas as requisições devem incluir o header de autenticação:

```
X-User-Id: freitasalexandre810@gmail_com
```

observe que o X-User-Id é padrao de adm deixe-o como esta com esse email mesmo 
---

## Endpoints Disponíveis

### 1. Listar Projetos do Usuário

Retorna todos os projetos associados ao usuário autenticado.

**Endpoint:** `GET /api/projects`

**Headers:**
```
X-User-Id: usuario@example.com
```

**Resposta de Sucesso (200):**
```json
[
  {
    "name": "Meu Projeto",
    "model_ai": "gpt-4",
    "status": "Created",
    "used": false,
    "progress_percent": "100",
    "url_original": "https://youtube.com/watch?v=...",
    "thumbnail_url": "https://...",
    "createdAt": "2026-01-22T10:30:00.000Z",
    "videos": [
      {
        "id": "uuid-video-1",
        "filename": "video_corte_1.mp4",
        "title": "Título do Vídeo",
        "uploadedAt": "2026-01-22T10:35:00.000Z",
        "status": "UPLOADED",
        "progress_percent": "100"
      }
    ]
  }
]
```

**Resposta sem projetos (200):**
```json
[]
```

**Erro de Autenticação (403):**
```json
{
  "message": "Não autorizado"
}
```

---

### 2. Obter Detalhes de um Projeto Específico

Retorna informações detalhadas de um projeto específico.

**Endpoint:** `GET /api/projects/{project_name}`

**Parâmetros de URL:**
- `project_name` (string): Nome do projeto

**Headers:**
```
X-User-Id: usuario@example.com
```

**Exemplo de Requisição:**
```
GET /api/projects/MeuProjeto
```

**Resposta de Sucesso (200):**
```json
{
  "name": "Meu Projeto",
  "model_ai": "gpt-4",
  "status": "Created",
  "used": false,
  "progress_percent": "100",
  "url_original": "https://youtube.com/watch?v=...",
  "thumbnail_url": "https://...",
  "createdAt": "2026-01-22T10:30:00.000Z",
  "videos": [
    {
      "id": "uuid-video-1",
      "filename": "video_corte_1.mp4",
      "title": "Título do Vídeo",
      "description": "Descrição do vídeo",
      "hashtags": ["#tag1", "#tag2"],
      "uploadedAt": "2026-01-22T10:35:00.000Z",
      "status": "UPLOADED",
      "progress_percent": "100",
      "urltumbnail": "https://...",
      "minutagemdeInicio": "00:00",
      "minutagemdeFim": "02:30"
    }
  ]
}
```

**Resposta quando projeto não existe (404):**
```json
{
  "message": "Projeto não encontrado"
}
```

---

### 3. Obter Metadados de um Projeto

Retorna os metadados (informações de publicação) dos vídeos de um projeto.

**Endpoint:** `GET /api/projects/metadata/{user_id}/{project_name}`

**Parâmetros de URL:**
- `user_id` (string): ID do usuário (email com underscores ao invés de pontos)
- `project_name` (string): Nome do projeto

**Headers:**
```
X-User-Id: usuario@example.com
```

**Exemplo de Requisição:**
```
GET /api/projects/metadata/usuario_example_com/MeuProjeto
```

**Resposta de Sucesso (200):**
```json
[
  {
    "filename": "video_1.mp4",
    "title": "Título do Vídeo",
    "description": "Descrição completa",
    "tags": ["tecnologia", "tutorial"],
    "schedule_time": "2026-01-25T18:00:00Z",
    "social_networks": ["youtube", "tiktok"]
  }
]
```

**Resposta quando não há metadados (200):**
```json
[]
```

---

### 4. Gerar URL de Previsualização

Gera uma URL para previsualização (streaming) de um vídeo específico.

**Endpoint:** `GET /api/projects/{project_name}/videos/{video_id}/preview`

**Parâmetros de URL:**
- `project_name` (string): Nome do projeto
- `video_id` (string): UUID do vídeo

**Headers:**
```
X-User-Id: usuario@example.com
```

**Exemplo de Requisição:**
```
GET /api/projects/MeuProjeto/videos/uuid-video-1/preview
```

**Resposta de Sucesso (200):**
```json
{
  "preview_url": "https://videomanager.api.mediacutsstudio.com/api/files/stream/usuario_example_com/MeuProjeto/uuid-video-1_video.mp4",
  "filename": "video_corte_1.mp4"
}
```

**Resposta quando vídeo não encontrado (404):**
```json
{
  "message": "Vídeo não encontrado ou não autorizado"
}
```

**Notas:**
- A URL retornada em `preview_url` pode ser usada diretamente em um elemento `<video>` para streaming
- A URL de preview tem cache de 5 minutos
- Suporta streaming parcial (range requests)

---

### 5. Download de Vídeo

Faz o download completo de um vídeo específico.

**Endpoint:** `GET /api/projects/{project_name}/videos/{video_id}/download`

**Parâmetros de URL:**
- `project_name` (string): Nome do projeto
- `video_id` (string): UUID do vídeo

**Headers:**
```
X-User-Id: usuario@example.com
```

**Exemplo de Requisição:**
```
GET /api/projects/MeuProjeto/videos/uuid-video-1/download
```

**Resposta de Sucesso (200):**
- Retorna o arquivo binário do vídeo
- Header `Content-Disposition: attachment; filename="video_corte_1.mp4"`
- Header `Content-Type` apropriado para o tipo de arquivo

**Resposta quando vídeo não encontrado (404):**
```json
{
  "message": "Vídeo não encontrado ou não autorizado"
}
```

**Notas:**
- O arquivo será baixado com o nome original preservado
- Suporta interrupção e retomada de download
- Implementa cache para otimizar performance

---

### 6. Visualizar Conteúdo de Arquivo de Texto

Serve o conteúdo de arquivos de texto ou força download para outros tipos.

**Endpoint:** `GET /api/projects/{project_name}/files/{file_id}/content`

**Parâmetros de URL:**
- `project_name` (string): Nome do projeto
- `file_id` (string): UUID do arquivo

**Headers:**
```
X-User-Id: usuario@example.com
```

**Exemplo de Requisição:**
```
GET /api/projects/MeuProjeto/files/uuid-file-1/content
```

**Resposta para arquivos de texto (.txt, .md, .json, .log, .csv):**
- Status: 200
- Content-Type: `text/plain; charset=utf-8` ou `application/json`
- Body: Conteúdo do arquivo

**Resposta para outros arquivos:**
- Status: 200
- Download forçado do arquivo

**Resposta quando arquivo não encontrado (404):**
```json
{
  "message": "Arquivo não encontrado ou não autorizado"
}
```

---

## Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Não autorizado |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## Estrutura de Dados

### Objeto Project
```typescript
interface Project {
  name: string;
  model_ai?: string;
  status: "NEW" | "Created" | "UPLOADED" | string;
  used: boolean;
  progress_percent: string;
  url_original: string;
  thumbnail_url: string;
  createdAt: string; // ISO 8601
  videos: Video[];
}
```

### Objeto Video
```typescript
interface Video {
  id: string; // UUID
  filename: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  uploadedAt: string; // ISO 8601
  status: "UPLOADED" | "PROCESSING" | string;
  progress_percent: string;
  urltumbnail?: string;
  minutagemdeInicio?: string; // formato "HH:MM"
  minutagemdeFim?: string; // formato "HH:MM" ou "Fim"
  type_project?: "video" | "files";
  size?: number; // tamanho em bytes
}
```

### Objeto Metadata
```typescript
interface VideoMetadata {
  filename: string;
  title?: string;
  description?: string;
  tags?: string[];
  schedule_time?: string; // ISO 8601
  social_networks?: string[];
}
```

---

## Exemplos de Uso

### Exemplo 1: Listar e Visualizar Projetos

```javascript
// Buscar todos os projetos
const response = await fetch('https://videomanager.api.mediacutsstudio.com/api/projects', {
  headers: {
    'X-User-Id': 'usuario@example.com'
  }
});

const projects = await response.json();
console.log(projects);
```

### Exemplo 2: Obter Preview de um Vídeo

```javascript
// Obter URL de preview
const projectName = 'MeuProjeto';
const videoId = 'uuid-video-1';

const response = await fetch(
  `https://videomanager.api.mediacutsstudio.com/api/projects/${projectName}/videos/${videoId}/preview`,
  {
    headers: {
      'X-User-Id': 'usuario@example.com'
    }
  }
);

const { preview_url, filename } = await response.json();

// Usar no elemento de vídeo
const videoElement = document.querySelector('video');
videoElement.src = preview_url;
```

### Exemplo 3: Download de Vídeo

```javascript
// Iniciar download
const projectName = 'MeuProjeto';
const videoId = 'uuid-video-1';

const downloadUrl = `https://videomanager.api.mediacutsstudio.com/api/projects/${projectName}/videos/${videoId}/download`;

// Opção 1: Link direto
window.location.href = downloadUrl;

// Opção 2: Fetch com blob
const response = await fetch(downloadUrl, {
  headers: {
    'X-User-Id': 'usuario@example.com'
  }
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'video.mp4';
a.click();
```

### Exemplo 4: Visualizar Detalhes de um Projeto

```javascript
const projectName = 'MeuProjeto';

const response = await fetch(
  `https://videomanager.api.mediacutsstudio.com/api/projects/${projectName}`,
  {
    headers: {
      'X-User-Id': 'usuario@example.com'
    }
  }
);

const project = await response.json();

// Acessar vídeos do projeto
project.videos.forEach(video => {
  console.log(`Vídeo: ${video.filename}`);
  console.log(`Status: ${video.status}`);
  console.log(`ID: ${video.id}`);
});
```

---

## Notas Importantes

1. **Autenticação**: Todas as requisições devem incluir o header `X-User-Id` com o email do usuário.

2. **Cache**: As URLs de preview são cacheadas por 5 minutos para otimização de performance.

3. **Nomes de Projeto**: Os nomes de projetos são sanitizados internamente. Caracteres especiais e pontos são removidos.

4. **Formato de Datas**: Todas as datas seguem o padrão ISO 8601 (ex: `2026-01-22T10:30:00.000Z`).

5. **CORS**: A API está configurada para aceitar requisições de origens permitidas em ambiente de desenvolvimento.

6. **Tipos de Arquivo Suportados**: 
   - Vídeos: mp4
   - Textos: txt, md, json, log, csv
   - Imagens: jpg, jpeg, png, gif, webp, bmp
   - Outros: pdf, py, js, ts, html, css, etc.

7. **Limites**:
   - Chunk size para streaming: 1 MB
   - TTL do cache: 300 segundos (5 minutos)

---

## Troubleshooting

### Erro 403 (Não autorizado)
- Verifique se o header `X-User-Id` está sendo enviado
- Confirme que o email está correto

### Erro 404 (Recurso não encontrado)
- Verifique o nome do projeto e ID do vídeo
- Confirme que o recurso pertence ao usuário autenticado

### Preview não carrega
- Verifique se a URL de preview foi gerada corretamente
- Confirme que o arquivo existe no servidor
- Teste se o vídeo é acessível via download

### Download interrompido
- A API suporta retomada de download
- Verifique a conexão de rede
- Confirme que o arquivo não foi deletado

---

**Suporte**: Para questões técnicas, entre em contato com a equipe de desenvolvimento back-end.
