# Video Manager API - Documentação Técnica

## Visão Geral

A Video Manager API é uma aplicação Flask para gerenciamento de projetos de vídeo e arquivos, com integração ao Firebase Realtime Database. A API oferece funcionalidades de upload, download, preview, e gerenciamento completo de projetos e arquivos multimídia.

## Arquitetura

### Stack Tecnológico
- **Backend**: Flask (Python)
- **Banco de Dados**: Firebase Realtime Database
- **Armazenamento**: Sistema de arquivos local
- **Autenticação**: Mock via header `X-User-Id`
- **Cache**: Cache em memória para otimização

### Estrutura de Diretórios
```
projeto/
├── server.py
├── Keys/
│   └── keys.env
├── videos/
│   └── {user_id}/
│       └── {project_name}/
│           └── arquivos...
└── Logs/
    └── uploaderserver.log
```

## Autenticação

A API utiliza autenticação baseada em verificação de conta registrada via header HTTP:
```http
X-User-Id: usuario@exemplo.com
```

**Processo de Autenticação:**
1. O email é enviado via header `X-User-Id`
2. O sistema verifica se existe uma conta registrada com este email no Firebase
3. Apenas usuários com contas criadas via `/api/create-login` podem acessar a API
4. O ID do usuário é normalizado substituindo pontos por underscores para uso no Firebase

**Função de Autenticação:**
```python
def authenticate_user(req):
    email = req.headers.get('X-User-Id')
    
    snapshot = users_ref.get() or {}
    for _, user in snapshot.items():
        if user.get("email") == email:
            logger.info("Usuário tem conta")
            return email.replace('.', '_')
    return None
```

**Códigos de Resposta de Autenticação:**
- **401 Unauthorized**: Header `X-User-Id` ausente ou conta não registrada
- **403 Forbidden**: Usuário não autorizado para o recurso específico

## Endpoints da API

### Status da API

#### GET `/`
Verifica se a API está funcionando.

**Resposta:**
```json
{
  "message": "#1 Video Manager API Media Cuts Studio funcionando!"
}
```

### Autenticação

#### POST `/api/create-login`
Cria uma nova conta de usuário.

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta (201):**
```json
{
  "message": "Usuário criado com sucesso",
  "user_id": "firebase_generated_id"
}
```

#### POST `/api/login`
Realiza login do usuário.

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta (200):**
```json
{
  "message": "Bem-vindo, usuario@exemplo.com!",
  "user_id": "firebase_user_id"
}
```

### Gerenciamento de Projetos

#### GET `/api/projects/{user_id}`
Lista todos os projetos de um usuário.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:**
```json
[
  {
    "name": "Meu Projeto",
    "model_ai": "modelo_ia",
    "status": "NEW",
    "used": false,
    "progress_percent": "100",
    "url_original": "url",
    "thumbnail_url": "url",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "videos": [
      {
        "id": "video_id",
        "filename": "video.mp4",
        "uploadedAt": "2023-01-01T00:00:00.000Z",
        "status": "UPLOADED"
      }
    ]
  }
]
```

#### POST `/api/projects/create`
Cria um novo projeto.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Body:**
```json
{
  "projectName": "Nome do Projeto",
  "model_ai": "modelo_opcional",
  "type_project": "video"
}
```

**Resposta (201):**
```json
{
  "message": "Projeto criado com sucesso",
  "project_name": "Nome do Projeto",
  "safe_project_name": "nome_sanitizado"
}
```

#### DELETE `/api/projects/{project_name}`
Remove um projeto completamente.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta (200):**
```json
{
  "message": "Projeto 'Nome do Projeto' excluído: nó no Firebase removido, arquivos locais removidos"
}
```

#### POST `/api/projects/{project_name}/mark-utilizado`
Marca um projeto como utilizado.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Body:**
```json
{
  "utilizado": true
}
```

**Resposta (200):**
```json
{
  "message": "Projeto marcado como utilizado com sucesso!"
}
```

#### GET `/api/list-projects`
Lista projetos de forma simplificada.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:**
```json
[
  {
    "id": "projeto_id",
    "name": "Nome do Projeto",
    "fileCount": 5
  }
]
```

### Upload de Arquivos

#### POST `/api/upload-video`
Faz upload de vídeos ou outros arquivos para um projeto.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Arquivo a ser enviado
- `metadata`: JSON com metadados do arquivo

**Exemplo de metadata para vídeos:**
```json
{
  "projectName": "Meu Projeto",
  "type_project": "video",
  "title": "Título do Vídeo",
  "description": "Descrição",
  "hashtags": ["tag1", "tag2"],
  "minutagemdeInicio": "00:00",
  "minutagemdeFim": "Fim",
  "urltumbnail": "url",
  "justificativa": "texto",
  "sentimento_principal": "alegria",
  "potencial_de_viralizacao": "alto"
}
```

**Exemplo de metadata para arquivos:**
```json
{
  "projectName": "Meu Projeto",
  "type_project": "files"
}
```

**Resposta (201 para files, 200 para videos):**
```json
{
  "message": "Vídeo e metadados enviados com sucesso!",
  "item_id": "uuid_gerado",
  "filename": "nome_original.mp4",
  "project_name": "Meu Projeto",
  "type_project": "video"
}
```

### Download e Preview

#### GET `/api/projects/{project_name}/videos/{video_id}/download`
Faz download de um arquivo específico (otimizado).

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:** Arquivo binário para download

#### GET `/api/videos/{video_id}`
Download legacy de vídeo por ID.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:** Arquivo binário para download

#### GET `/api/projects/{project_name}/videos/{video_id}/preview`
Gera URL de preview para vídeo (otimizado).

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:**
```json
{
  "preview_url": "https://api.exemplo.com/api/files/stream/path/to/file",
  "filename": "video.mp4"
}
```

#### GET `/api/projects/{project_name}/files/{file_id}/content`
Serve conteúdo de arquivos de texto ou força download.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:** 
- Para arquivos de texto (.txt, .md, .json): conteúdo direto
- Para outros: download forçado

#### DELETE `/api/projects/{project_name}/videos/{video_id}`
Remove um arquivo específico do projeto.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:**
```json
{
  "message": "Operação concluída",
  "videoId": "video_id",
  "filename": "nome_arquivo",
  "removedFromDisk": true,
  "diskReason": null,
  "removedFromFirebase": true
}
```

### Metadados de Projetos

#### GET `/api/projects/metadata/{user_id}/{project_name}`
Obtém metadados de todos os arquivos de um projeto.

**Resposta:**
```json
[
  {
    "filename": "video.mp4",
    "title": "Título",
    "description": "Descrição",
    "tags": ["tag1", "tag2"],
    "schedule_time": "2023-01-01T10:00:00Z",
    "social_networks": ["youtube", "tiktok"]
  }
]
```

### Configurações de Usuário

#### GET `/api/settings`
Obtém configurações do usuário.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:**
```json
{
  "displayName": "Nome",
  "email": "usuario@exemplo.com",
  "theme": "dark",
  "language": "pt-BR",
  "emailNotifications": true
}
```

#### POST `/api/settings`
Salva configurações do usuário.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Body:**
```json
{
  "displayName": "Nome Atualizado",
  "theme": "light",
  "emailNotifications": false
}
```

#### POST `/api/change-password`
Altera senha do usuário.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Body:**
```json
{
  "current_password": "senha_atual",
  "new_password": "nova_senha"
}
```

#### POST `/api/settings/profile-image`
Upload de imagem de perfil.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
Content-Type: multipart/form-data
```

**Form Data:**
- `image`: Arquivo de imagem

#### DELETE `/api/settings/delete-profile-image`
Remove imagem de perfil.

#### GET `/api/settings/export`
Exporta todas as configurações do usuário.

#### POST `/api/settings/import`
Importa configurações do usuário.

#### POST `/api/settings/reset`
Reseta configurações para valores padrão.

#### GET `/api/settings/activity-log`
Obtém log de atividades das configurações.

### Arquivos Estáticos

#### GET `/api/files/stream/{path}`
Serve arquivos estáticos com autenticação.

**Headers:**
```http
X-User-Id: usuario@exemplo.com
```

**Resposta:** Conteúdo do arquivo

#### GET `/api/videos/{video_id}/preview/file`
Serve arquivo de vídeo para streaming.

## Códigos de Status HTTP

- **200 OK**: Operação bem-sucedida
- **201 Created**: Recurso criado com sucesso
- **400 Bad Request**: Dados inválidos ou ausentes
- **401 Unauthorized**: Autenticação necessária
- **403 Forbidden**: Não autorizado para o recurso
- **404 Not Found**: Recurso não encontrado
- **499 Client Closed Request**: Cliente desconectou
- **500 Internal Server Error**: Erro interno do servidor

## Estrutura do Firebase

### Usuários
```
users/
  {user_id}/
    email: string
    password: string (hash)
    last_seen: string
```

### Projetos
```
projects/
  {user_id}/
    {project_name}/
      name: string
      model_ai: string
      type_project: string
      status: string
      used: boolean
      createdAt: string
      videos/
        {video_id}/
          filename: string
          serverFilePath: string
          uploadedAt: string
          status: string
          (outros campos específicos)
      metadata/
        {basename}/
          filename: string
          title: string
          description: string
          tags: array
          schedule_time: string
          social_networks: array
```

### Configurações de Usuário
```
user_settings/
  {user_id}/
    profile/
      displayName: string
      email: string
      bio: string
      avatar: string
    notifications/
      emailNotifications: boolean
      pushNotifications: boolean
    privacy/
      profilePublic: boolean
    preferences/
      theme: string
      language: string
```

## Tipos de Arquivo Suportados

### Vídeos
- mp4

### Legendas
- srt, ass

### Dados
- pickle, json

### Áudio
- wav

### Imagens
- jpg, jpeg, png, gif, webp, bmp

### Código
- js, jsx, ts, tsx, py

### Web
- html, css, svg, ico

### Documentos
- md, pdf

### Texto
- csv, txt, log

## Cache e Otimização

A API utiliza cache em memória para otimizar buscas frequentes:

- **TTL**: 300 segundos (5 minutos)
- **Chave do Cache**: `{user_id}_{project_name}_{item_id}`
- **Dados Cached**: Caminho do arquivo e nome original

## Segurança

### Sanitização
- Nomes de arquivos são sanitizados usando `secure_filename()`
- Caracteres especiais são removidos/substituídos
- Validação de path traversal para evitar acesso a arquivos fora do diretório base

### Validação de Arquivos
- Verificação de extensões permitidas
- Validação de tamanho máximo (configurável)
- Verificação de tipos MIME quando aplicável

### Autenticação
- Header `X-User-Id` obrigatório para todas as operações
- Validação de autorização por usuário
- IDs de usuário normalizados para segurança

## Logs

A aplicação mantém logs detalhados em:
- **Arquivo**: `Logs/uploaderserver.log`
- **Console**: Saída padrão
- **Nível**: INFO e superior

Tipos de logs incluem:
- Operações de upload/download
- Erros de sistema
- Cache hits/misses
- Operações de autenticação

## Configuração

### Variáveis de Ambiente (.env)
```
databaseKEYS=caminho/para/firebase-key.json
databaseURL=https://projeto.firebaseio.com
```

### Configurações da Aplicação
- **SECRET_KEY**: Chave secreta do Flask
- **SESSION_LIFETIME**: 60 minutos
- **VIDEO_BASE_DIR**: Diretório base para arquivos
- **CACHE_TTL**: 300 segundos
- **ALLOWED_EXTENSIONS**: Lista de extensões permitidas

## Tratamento de Erros

A API implementa tratamento robusto de erros:

- **Desconexão de Cliente**: Status 499
- **Arquivos Não Encontrados**: Status 404 com mensagem específica
- **Erros de Permissão**: Status 403 com contexto
- **Erros de Validação**: Status 400 com detalhes
- **Erros Internos**: Status 500 com log detalhado

## Limitações Conhecidas

1. **Autenticação Mock**: Sistema atual é apenas para desenvolvimento
2. **Armazenamento Local**: Arquivos armazenados localmente (não em cloud)
3. **Cache em Memória**: Cache perdido em reinicializações
4. **CORS Comentado**: Configuração de CORS está desabilitada no código
5. **Sem Rate Limiting**: Não há limitação de taxa implementada