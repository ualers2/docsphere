# server.py
from flask import Flask, render_template, Response, request, jsonify, session, redirect,send_from_directory,  url_for
from flask_cors import CORS  
import time
import pytz
import hashlib
from dotenv import load_dotenv
import os
import logging
import uuid
from firebase_admin import db
from datetime import datetime, timedelta
import json
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter.util import get_remote_address
from werkzeug.formparser import parse_form_data
from werkzeug.utils import secure_filename # Para sanitizar nomes de arquivos
import re
from asgiref.wsgi import WsgiToAsgi
import shutil
from firebase_admin import initialize_app, credentials, storage, get_app
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), 'Keys', 'keys.env'))


cred_path = os.getenv("databaseKEYS")
databaseURL = os.getenv("databaseURL")

cred = credentials.Certificate(cred_path)
app_instance = initialize_app(cred, {
    'databaseURL': databaseURL
}, name='app1')



app = Flask(__name__)
if os.getenv("FLASK_ENV") == "development":
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:4343",
                "https://4b5664b86dca.ngrok-free.app",
                "https://2bb8e949eac6.ngrok-free.app",
                "https://a7ae3fc28c35.ngrok-free.app"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
            "allow_headers": ["Content-Type", "Authorization", "X-User-Id"],
            "supports_credentials": True
        }
    })

asgi_app = WsgiToAsgi(app)

app.secret_key = 'sua_chave_secreta'  # Substitua por uma chave forte e secreta
app.permanent_session_lifetime = timedelta(minutes=60)  # Sessão válida por 60 minutos

diretorio_script = os.path.dirname(os.path.abspath(__file__)) 

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
os.makedirs(os.path.join(diretorio_script, 'Logs'), exist_ok=True)
file_handler = logging.FileHandler(os.path.join(diretorio_script, 'Logs', 'uploaderserver.log'))
file_handler.setFormatter(formatter)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)




users_ref = db.reference("users", app=app_instance)
video_path_cache = {}
CACHE_TTL = 300 
CHUNK_SIZE =  1 * 1024 * 1024
VIDEO_BASE_DIR = os.path.join(os.path.dirname(__file__), 'videos')
ALLOWED_EXTENSIONS = {
    'mp4',
    'txt',
    'pem',
    'srt', 'ass', 'pickle', 'json',
    'wav',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
    'js', 'jsx', 'ts', 'tsx',
    'html', 'css',
    'svg', 'ico',
    'md',
    'pdf',
    'py'
}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def authenticate_user(req):
    email = req.headers.get('X-User-Id')
    
    snapshot = users_ref.get() or {}
    for _, user in snapshot.items():
        db_email = user.get("email") 
        logger.info(f"X-User-Id {email}")
        logger.info(f"email {db_email}")
        if db_email == email.replace('_', '.'):
            logger.info("Usuário tem conta")
            return email, email.replace('.', '_')
    logger.info("Usuário nao tem conta")
    return None, None

@app.route('/')
def index():
    return jsonify({"message": "#1 Video Manager API Media Cuts Studio funcionando!"})


@app.route("/api/create-login", methods=["POST"])
def create_login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email e senha são obrigatórios"}), 400

    # 🔹 Busca todos os usuários e verifica se já existe o email
    snapshot = users_ref.get() or {}
    for _, user in snapshot.items():
        if user.get("email") == email:
            return jsonify({"error": "Usuário já existe"}), 400

    # 🔹 Cria novo usuário
    hashed_password = generate_password_hash(password)
    new_user_ref = users_ref.push({
        "email": email,
        "password": hashed_password,
        "last_seen": str(datetime.utcnow())
    })

    return jsonify({
        "message": "Usuário criado com sucesso",
        "user_id": new_user_ref.key
    }), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    # 🔹 Busca todos os usuários e encontra pelo email
    snapshot = users_ref.get() or {}
    user_id, user_data = None, None
    for uid, user in snapshot.items():
        if user.get("email") == email:
            user_id, user_data = uid, user
            break

    if not user_data or not check_password_hash(user_data["password"], password):
        return jsonify({"error": "Credenciais inválidas"}), 401

    # 🔹 Atualiza last_seen
    users_ref.child(user_id).update({
        "last_seen": str(datetime.utcnow())
    })

    return jsonify({
        "message": f"Bem-vindo, {user_data['email']}!",
        "user_id": user_id
    }), 200

@app.route('/api/projects/metadata/<user_id>/<project_name>', methods=['GET'])
def get_project_metadata(user_id, project_name):
    try:
        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        # Normaliza o nome do projeto como você faz ao salvar
        safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
        safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

        # Referência ao nó "metadata" do projeto
        ref = db.reference(
            f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}/metadata',
            app=app_instance
        )
        metadata_node = ref.get()

        # Se não houver metadados, retorna lista vazia (200)
        if not metadata_node:
            return jsonify([]), 200

        result = []
        # metadata_node deve ser um dict com chaves = basename do arquivo
        if isinstance(metadata_node, dict):
            for basename, meta in metadata_node.items():
                # meta normalmente é um dict com os campos salvos
                if not isinstance(meta, dict):
                    # pulamos entradas inesperadas
                    continue

                entry = {
                    "filename": meta.get("filename", basename),
                    "title": meta.get("title"),
                    "description": meta.get("description"),
                    "tags": meta.get("tags", []),
                    "schedule_time": meta.get("schedule_time"),
                    "social_networks": meta.get("social_networks", [])
                }
                result.append(entry)
        else:
            # caso raro: estrutura inesperada -> retorna vazia
            return jsonify([]), 200

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Erro em /api/projects/metadata/{user_id}/{project_name}: {e}", exc_info=True)
        return jsonify({"message": f"Erro ao buscar metadados: {str(e)}"}), 500

@app.route('/api/projects', methods=['GET'])
def get_user_projects():
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Não autorizado"}), 403
    try:
        ref = db.reference(f'projects/{authenticated_user_id_filter}', app=app_instance)
        projects_data = ref.get()

        if not projects_data:
            return jsonify([]), 200

        # Formata os dados para o frontend, removendo `serverFilePath`
        formatted_projects = []
        for project_name, project_details in projects_data.items():
            videos_list = []
            if 'videos' in project_details:
                for video_id, video_data in project_details['videos'].items():
                    # Crie um novo dicionário sem serverFilePath
                    safe_video_data = {k: v for k, v in video_data.items() if k != 'serverFilePath'}
                    safe_video_data['id'] = video_id # Adiciona o ID do Firebase ao objeto
                    videos_list.append(safe_video_data)
            
            formatted_projects.append({
                "name": project_details.get("name", project_name),
                "model_ai": project_details.get("model_ai"),
                "status": project_details.get("status"),
                "used": project_details.get("used"),
                "progress_percent": project_details.get("progress_percent"), 
                "url_original": project_details.get("url_original"), 
                "thumbnail_url": project_details.get("thumbnail_url"), 
                "createdAt": project_details.get("createdAt"),
                "videos": videos_list
            })
        
        return jsonify(formatted_projects), 200

    except Exception as e:
        return jsonify({"message": f"Erro ao buscar projetos: {str(e)}"}), 500

@app.route('/api/projects/create', methods=['POST'])
def create_project():
    """
    Cria um projeto vazio para o usuário.
    Espera JSON:
    {
        "projectName": "Nome do Projeto",
        "model_ai": "opcional",
        "type_project": "video" ou "files"
    }
    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    data = request.get_json() or {}
    project_name = data.get("projectName")
    model_ai = data.get("model_ai", "")
    type_project = data.get("type_project", "video")

    if not project_name:
        return jsonify({"message": "Nome do projeto é obrigatório"}), 400

    # Sanitização do nome do projeto
    safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
    safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

    user_key = authenticated_user_id.replace('.', '_')
    user_dir = os.path.join(VIDEO_BASE_DIR, user_key)
    project_dir = os.path.join(user_dir, safe_project_name_filter)

    # Criação do diretório físico
    try:
        os.makedirs(project_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Erro ao criar diretório do projeto: {e}", exc_info=True)
        return jsonify({"message": "Erro ao criar diretório do projeto no servidor"}), 500

    # Criação do nó no Firebase
    project_ref = db.reference(f'projects/{user_key}/{safe_project_name_filter}', app=app_instance)
    try:
        existing_project = project_ref.get()
        if existing_project:
            return jsonify({"message": "Projeto já existe"}), 400

        project_ref.set({
            "name": project_name,
            "model_ai": model_ai,
            "type_project": type_project,
            "status": "NEW",
            "used": False,
            "createdAt": datetime.utcnow().isoformat(),
            "videos": {}
        })

        return jsonify({
            "message": "Projeto criado com sucesso",
            "project_name": project_name,
            "safe_project_name": safe_project_name_filter
        }), 201

    except Exception as e:
        logger.error(f"Erro ao criar projeto no Firebase: {e}", exc_info=True)
        return jsonify({"message": "Erro interno ao criar projeto"}), 500
    

@app.route('/api/projects/create/video', methods=['POST'])
def create_video_project():
    """
    Cria um projeto vazio para o usuário.

    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    data = request.get_json() or {}
    project_name = data.get("projectName")
    model_ai = data.get("model_ai", "")
    type_project = data.get("type_project", "video")
    pasted_url = data.get("pasted_url")
    thumbnail_url = data.get("thumbnail_url")

    if not project_name:
        return jsonify({"message": "Nome do projeto é obrigatório"}), 400

    # Sanitização do nome do projeto
    safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
    safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

    user_key = authenticated_user_id.replace('.', '_')
    user_dir = os.path.join(VIDEO_BASE_DIR, user_key)
    project_dir = os.path.join(user_dir, safe_project_name_filter)

    # Criação do diretório físico
    try:
        os.makedirs(project_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Erro ao criar diretório do projeto: {e}", exc_info=True)
        return jsonify({"message": "Erro ao criar diretório do projeto no servidor"}), 500

    # Criação do nó no Firebase
    project_ref = db.reference(f'projects/{user_key}/{safe_project_name_filter}', app=app_instance)
    try:
        existing_project = project_ref.get()
        if existing_project:
            return jsonify({"message": "Projeto já existe"}), 400

        tz_str = 'America/Sao_Paulo'
        try:
            tz = pytz.timezone(tz_str)
        except Exception as e:
            return jsonify({'error': f'Timezone inválido: {str(e)}'}), 400

        data_to_save = {
            "name": project_name,
            "model_ai": model_ai,
            "status": "Created",
            "url_original": pasted_url,
            "type_project": type_project,
            "progress_percent": "0",
            "used": False,
            "thumbnail_url": thumbnail_url,
            "createdAt": datetime.now(tz).isoformat(),
            "delete_after": (datetime.now(tz) + timedelta(days=3)).isoformat(),  # data 3 dias à frente
            "videos": {}
        }
        project_ref.set(data_to_save)

        return jsonify({
            "message": "Projeto criado com sucesso",
            "project_name": project_name,
            "safe_project_name": safe_project_name_filter
        }), 201

    except Exception as e:
        logger.error(f"Erro ao criar projeto no Firebase: {e}", exc_info=True)
        return jsonify({"message": "Erro interno ao criar projeto"}), 500
    
@app.route('/api/list-projects', methods=['GET'])
def list_projects():
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    projects_ref = db.reference(f'projects/{authenticated_user_id_filter}', app=app_instance)
    projects = projects_ref.get() or {}

    result = [
        {"id": key, "name": data.get("name", key), "fileCount": len(data.get("videos", {}))}
        for key, data in projects.items()
    ]
    return jsonify(result), 200


@app.route('/api/settings', methods=['GET'])
def get_user_settings():
    """Obter configurações do usuário"""
    try:
        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings = settings_ref.get()
        
        if not settings:
            return jsonify({'message': 'Configurações não encontradas'}), 404
        
        # Flatten
        flat_settings = {
            **settings.get('profile', {}),
            **settings.get('notifications', {}),
            **settings.get('privacy', {}),
            **settings.get('preferences', {})
        }

        return jsonify(flat_settings), 200

        
    except Exception as e:
        return jsonify({'error': f'Erro ao obter configurações: {str(e)}'}), 500

@app.route('/api/settings', methods=['POST'])
def save_user_settings():
    """Salvar configurações do usuário"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        # Estrutura das configurações
        settings_data = {
            'profile': {
                'displayName': data.get('displayName', ''),
                'email': data.get('email', ''),
                'bio': data.get('bio', ''),
                'avatar': data.get('avatar', '')
            },
            'notifications': {
                'emailNotifications': data.get('emailNotifications', True),
                'pushNotifications': data.get('pushNotifications', True),
                'projectUpdates': data.get('projectUpdates', True),
                'systemAlerts': data.get('systemAlerts', False)
            },
            'privacy': {
                'profilePublic': data.get('profilePublic', False),
                'showEmail': data.get('showEmail', False),
                'allowComments': data.get('allowComments', True)
            },
            'preferences': {
                'theme': data.get('theme', 'system'),
                'language': data.get('language', 'pt-BR'),
                'timezone': data.get('timezone', 'America/Sao_Paulo'),
                'autoBackup': data.get('autoBackup', True),
                'compressionLevel': data.get('compressionLevel', 'medium'),
                'maxFileSize': data.get('maxFileSize', 100)
            },
            'updatedAt': datetime.now().isoformat(),
            'updatedBy': authenticated_user_id
        }
        
        # Salvar no Firebase
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings_ref.set(settings_data)
        
        return jsonify({
            'message': 'Configurações salvas com sucesso',
            'settings': settings_data
        }), 200
        
    except Exception as e:
        logger.info(f'Erro ao salvar configurações: {str(e)}')
        return jsonify({'error': f'Erro ao salvar configurações: {str(e)}'}), 500

@app.route('/api/change-password', methods=['POST'])
def change_password():
    """Alterar senha do usuário"""
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Senha atual e nova senha são obrigatórias'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'Nova senha deve ter pelo menos 6 caracteres'}), 400
        
        # Verificar senha atual

        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        user_ref = db.reference(f'users/{authenticated_user_id_filter}', app=app_instance)
        user_data = user_ref.get()
        
        if not user_data:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Verificar se a senha atual está correta
        current_password_hash = hashlib.sha256(current_password.encode()).hexdigest()
        if user_data.get('password') != current_password_hash:
            return jsonify({'error': 'Senha atual incorreta'}), 400
        
        # Hash da nova senha
        new_password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        
        # Atualizar senha no Firebase
        user_ref.update({
            'password': new_password_hash,
            'passwordUpdatedAt': datetime.now().isoformat()
        })
        
        # Log da alteração de senha
        password_log_ref = db.reference(f'password_changes/{authenticated_user_id_filter}', app=app_instance)
        password_log_ref.push({
            'changedAt': datetime.now().isoformat(),
            'userEmail': authenticated_user_id,
            'ipAddress': request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        })
        
        return jsonify({'message': 'Senha alterada com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao alterar senha: {str(e)}'}), 500

@app.route('/api/settings/profile-image', methods=['POST'])
def upload_profile_image():
    """Upload de imagem do perfil"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Nenhuma imagem fornecida'}), 400

        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
            
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'Nenhuma imagem selecionada'}), 400
        
        # Verificar extensão do arquivo
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Formato de arquivo não suportado'}), 400
        
        # Verificar tamanho do arquivo (max 5MB)
        file.seek(0, 2)  # Ir para o final do arquivo
        file_size = file.tell()
        file.seek(0)  # Voltar ao início
        
        if file_size > 5 * 1024 * 1024:  # 5MB
            return jsonify({'error': 'Arquivo muito grande. Máximo 5MB'}), 400
        
        # Gerar nome único para o arquivo
        import uuid
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Salvar arquivo localmente (você pode integrar com S3, Cloudinary, etc.)
        upload_folder = 'uploads/profile_images'
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # URL da imagem (ajuste conforme sua configuração)
        image_url = f"/uploads/profile_images/{unique_filename}"
        
        # Atualizar configurações do usuário com nova imagem

        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings_ref.update({
            'profile/avatar': image_url,
            'profile/avatarUpdatedAt': datetime.now().isoformat()
        })
        
        return jsonify({
            'message': 'Imagem do perfil atualizada com sucesso',
            'imageUrl': image_url
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro no upload da imagem: {str(e)}'}), 500

@app.route('/api/settings/delete-profile-image', methods=['DELETE'])
def delete_profile_image():
    """Remover imagem do perfil"""
    try:

        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        
        # Obter URL da imagem atual
        current_settings = settings_ref.get()
        if current_settings and 'profile' in current_settings:
            current_avatar = current_settings['profile'].get('avatar')
            
            # Remover arquivo físico se existir
            if current_avatar and current_avatar.startswith('/uploads/'):
                file_path = current_avatar[1:]  # Remove '/' do início
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        # Remover URL do avatar das configurações
        settings_ref.update({
            'profile/avatar': '',
            'profile/avatarDeletedAt': datetime.now().isoformat()
        })
        
        return jsonify({'message': 'Imagem do perfil removida com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao remover imagem: {str(e)}'}), 500

@app.route('/api/settings/export', methods=['GET'])
def export_user_settings():
    """Exportar todas as configurações do usuário"""
    try:

        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        # Obter configurações
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings = settings_ref.get()
        
        # Obter dados do usuário
        user_ref = db.reference(f'users/{authenticated_user_id_filter}', app=app_instance)
        user_data = user_ref.get()
        
        export_data = {
            'exportedAt': datetime.now().isoformat(),
            'userEmail': authenticated_user_id,
            'settings': settings or {},
            'accountInfo': {
                'email': user_data.get('email') if user_data else '',
                'createdAt': user_data.get('created_at') if user_data else '',
                'subscriptionPlan': user_data.get('subscription_plan') if user_data else ''
            }
        }
        
        return jsonify(export_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao exportar configurações: {str(e)}'}), 500

@app.route('/api/settings/import', methods=['POST'])
def import_user_settings():
    """Importar configurações do usuário"""
    try:
        data = request.get_json()
        if not data or 'settings' not in data:
            return jsonify({'error': 'Dados de configuração não fornecidos'}), 400
        
        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        settings_data = data['settings']
        
        # Adicionar metadados de importação
        settings_data.update({
            'importedAt': datetime.now().isoformat(),
            'importedBy': authenticated_user_id
        })
        
        # Salvar configurações importadas
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings_ref.set(settings_data)
        
        return jsonify({
            'message': 'Configurações importadas com sucesso',
            'importedSettings': settings_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao importar configurações: {str(e)}'}), 500

@app.route('/api/settings/reset', methods=['POST'])
def reset_user_settings():
    """Resetar configurações para valores padrão"""
    try:

        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        
        # Configurações padrão
        default_settings = {
            'profile': {
                'displayName': '',
                'email': authenticated_user_id,
                'bio': '',
                'avatar': ''
            },
            'notifications': {
                'emailNotifications': True,
                'pushNotifications': True,
                'projectUpdates': True,
                'systemAlerts': False
            },
            'privacy': {
                'profilePublic': False,
                'showEmail': False,
                'allowComments': True
            },
            'preferences': {
                'theme': 'system',
                'language': 'pt-BR',
                'timezone': 'America/Sao_Paulo',
                'autoBackup': True,
                'compressionLevel': 'medium',
                'maxFileSize': 100
            },
            'resetAt': datetime.now().isoformat(),
            'resetBy': authenticated_user_id
        }
        
        # Resetar configurações
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings_ref.set(default_settings)
        
        return jsonify({
            'message': 'Configurações resetadas com sucesso',
            'settings': default_settings
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao resetar configurações: {str(e)}'}), 500

@app.route('/api/settings/activity-log', methods=['GET'])
def get_settings_activity_log():
    """Obter log de atividades das configurações"""
    try:
        authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
        if not authenticated_user_id:
            return jsonify({"message": "Autenticação necessária"}), 401
        
        # Obter logs de atividade
        logs = []
        
        # Log de configurações
        settings_ref = db.reference(f'user_settings/{authenticated_user_id_filter}', app=app_instance)
        settings = settings_ref.get()
        
        if settings:
            if 'updatedAt' in settings:
                logs.append({
                    'action': 'settings_updated',
                    'timestamp': settings['updatedAt'],
                    'description': 'Configurações atualizadas'
                })
            
            if 'importedAt' in settings:
                logs.append({
                    'action': 'settings_imported',
                    'timestamp': settings['importedAt'],
                    'description': 'Configurações importadas'
                })
            
            if 'resetAt' in settings:
                logs.append({
                    'action': 'settings_reset',
                    'timestamp': settings['resetAt'],
                    'description': 'Configurações resetadas'
                })
        
        # Log de mudanças de senha
        password_log_ref = db.reference(f'password_changes/{authenticated_user_id_filter}', app=app_instance)
        password_logs = password_log_ref.get()
        
        if password_logs:
            for log_id, log_data in password_logs.items():
                logs.append({
                    'action': 'password_changed',
                    'timestamp': log_data['changedAt'],
                    'description': 'Senha alterada',
                    'ipAddress': log_data.get('ipAddress')
                })
        
        # Ordenar logs por timestamp (mais recente primeiro)
        logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Limitar a 50 logs mais recentes
        logs = logs[:50]
        
        return jsonify({
            'activityLog': logs,
            'totalLogs': len(logs)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Erro ao obter log de atividades: {str(e)}'}), 500



@app.route('/api/upload-video', methods=['POST'])
def upload_files():
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    content_type = request.content_type or ""
    is_multipart = content_type.startswith("multipart/form-data")

    # helper para sanitizar nome do projeto
    def sanitize_project_name(raw):
        safe_project_name = secure_filename(raw or "")
        safe_project_name = safe_project_name.replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
        return re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

    # --- modo multipart/form-data (com form + file) ---
    if is_multipart:
        # validar presença de arquivo e metadata
        if 'file' not in request.files:
            return jsonify({"message": "Nenhum arquivo de vídeo enviado"}), 400
        if 'metadata' not in request.form:
            return jsonify({"message": "Nenhum metadado enviado"}), 400

        file = request.files['file']
        try:
            metadata = json.loads(request.form['metadata'])
        except Exception:
            return jsonify({"message": "Metadados inválidos (não é JSON válido)"}), 400

        if file.filename == '':
            return jsonify({"message": "Nome de arquivo inválido"}), 400
        if not allowed_file(file.filename):
            return jsonify({"message": "Tipo de arquivo não permitido"}), 400

        project_name = metadata.get('projectName')
        if not project_name:
            return jsonify({"message": "Nome do projeto é obrigatório nos metadados"}), 400

        safe_project_name_filter = sanitize_project_name(project_name)
        user_dir = os.path.join(VIDEO_BASE_DIR, authenticated_user_id_filter)
        project_dir = os.path.join(user_dir, safe_project_name_filter)
        try:
            os.makedirs(project_dir, exist_ok=True)
        except OSError as e:
            logger.exception("Erro ao criar diretório")
            return jsonify({"message": "Erro no servidor ao preparar armazenamento"}), 500

        video_id = str(uuid.uuid4())
        original_filename = secure_filename(file.filename)
        filename_on_disk = f"{video_id}_{original_filename}"
        file_path = os.path.join(project_dir, filename_on_disk)

        try:
            file.save(file_path)  # mesmo comportamento de antes
        except Exception as e:
            logger.exception("Erro ao salvar arquivo (multipart)")
            return jsonify({"message": "Erro ao salvar arquivo de vídeo no servidor"}), 500

    # --- modo stream (raw binary) ---
    else:
        # Para streaming exigimos que os metadados (JSON) e filename venham por header ou query param.
        # Headers aceitos: X-Filename, X-Metadata (JSON string)
        filename_header = request.headers.get("X-Filename") or request.args.get("filename")
        metadata_header = request.headers.get("X-Metadata") or request.args.get("metadata")

        if not filename_header:
            return jsonify({"message": "Cabeçalho X-Filename ausente para upload em stream"}), 400
        if not metadata_header:
            return jsonify({"message": "Cabeçalho X-Metadata ausente para upload em stream"}), 400

        try:
            metadata = json.loads(metadata_header)
        except Exception:
            return jsonify({"message": "Metadados inválidos (X-Metadata não é JSON válido)"}), 400

        project_name = metadata.get('projectName')
        if not project_name:
            return jsonify({"message": "Nome do projeto é obrigatório nos metadados"}), 400

        if not allowed_file(filename_header):
            return jsonify({"message": "Tipo de arquivo não permitido"}), 400

        safe_project_name_filter = sanitize_project_name(project_name)
        user_dir = os.path.join(VIDEO_BASE_DIR, authenticated_user_id_filter)
        project_dir = os.path.join(user_dir, safe_project_name_filter)
        try:
            os.makedirs(project_dir, exist_ok=True)
        except OSError as e:
            logger.exception("Erro ao criar diretório (stream)")
            return jsonify({"message": "Erro no servidor ao preparar armazenamento"}), 500

        video_id = str(uuid.uuid4())
        original_filename = secure_filename(filename_header)
        filename_on_disk = f"{video_id}_{original_filename}"
        file_path = os.path.join(project_dir, filename_on_disk)

        # grava o body em chunks (streaming)
        try:
            with open(file_path, "wb") as f:
                while True:
                    chunk = request.stream.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    f.write(chunk)
        except Exception as e:
            logger.exception("Erro ao salvar arquivo (stream)")
            # tenta remover arquivo incompleto
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass
            return jsonify({"message": "Erro ao salvar arquivo de vídeo no servidor (stream)"}), 500

    # --- A partir daqui o arquivo está salvo em file_path; vamos montar os metadados e atualizar o Firebase ---
    try:
        type_project = metadata.get('type_project', 'video')
        if type_project == "video":
            update_data = {
                "filename": original_filename,
                "serverFilePath": os.path.relpath(file_path, VIDEO_BASE_DIR),
                "uploadedAt": datetime.now().isoformat(),
                "status": "UPLOADED",
                "progress_percent": "100",
            }
            update_data.update({
                "type_project": "video",
                "title": metadata.get('title', original_filename),
                "descricao": metadata.get('description', ''),
                "hashtags": metadata.get('hashtags', []),
                "minutagemdeInicio": metadata.get('minutagemdeInicio', '00:00'),
                "minutagemdeFim": metadata.get('minutagemdeFim', 'Fim'),
                "urltumbnail": metadata.get('urltumbnail', ''),
                "justificativa": metadata.get('justificativa', ''),
                "sentimento_principal": metadata.get('sentimento_principal', ''),
                "potencial_de_viralizacao": metadata.get('potencial_de_viralizacao', ''),
            })
            if isinstance(update_data["hashtags"], str):
                update_data["hashtags"] = [tag.strip() for tag in update_data["hashtags"].split(',') if tag.strip()]

            item_ref_path = f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}/videos/{video_id}'
            item_ref = db.reference(item_ref_path, app=app_instance)
            item_ref.update(update_data)

            return jsonify({
                "message": f"{'Vídeo' if type_project == 'video' else 'Arquivo'} e metadados atualizados com sucesso!",
                "item_id": video_id,
                "video_id": video_id,
                "filename": original_filename,
                "project_name": project_name,
                "type_project": type_project
            }), 200

        elif type_project == "files":
            file_size = os.path.getsize(file_path)
            video_metadata_for_firebase = {
                "type_project": "files",
                "id": video_id,
                "filename": original_filename,
                "serverFilePath": os.path.relpath(file_path, VIDEO_BASE_DIR),
                "uploadedAt": datetime.now().isoformat(),
                "size": file_size,
                "status": "ready"
            }

            project_ref = db.reference(f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}', app=app_instance)
            existing_project = project_ref.get()
            if not existing_project:
                project_ref.set({
                    "name": project_name,
                    "createdAt": datetime.now().isoformat(),
                    "videos": {}
                })
            video_ref = project_ref.child(f'videos/{video_id}')
            video_ref.set(video_metadata_for_firebase)

            return jsonify({
                "message": "Vídeo e metadados enviados com sucesso!",
                "video_id": video_id,
                "filename": original_filename,
                "project_name": project_name
            }), 201

    except Exception as e:
        logger.exception("Erro ao atualizar metadados no Firebase")
        # cleanup em caso de erro
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        return jsonify({"message": f"Erro interno do servidor: {str(e)}"}), 500



@app.route('/api/projects/<project_name>/videos/<video_id>/download', methods=['GET'])
def download_video_optimized(project_name, video_id):
    """
    Rota otimizada para download de vídeos.
    Recebe nome do projeto + id do vídeo para buscar diretamente no caminho do Firebase
    e evitar varreduras/loops que geram alto consumo do Realtime DB.
    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401
    

    # Sanitização do nome do projeto (mantive a mesma lógica usada no preview)
    project_name_safe = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
    logger.info(f"[DOWNLOAD] for {project_name_safe}")

    cache_key = f"{authenticated_user_id_filter}_{project_name_safe}_{video_id}"
    now = time.time()

    # 1) Tenta cache em memória
    if cache_key in video_path_cache:
        cached_data, timestamp = video_path_cache[cache_key]
        if now - timestamp < CACHE_TTL:
            video_found_path = cached_data['path']
            video_filename = cached_data['filename']
            logger.info(f"[DOWNLOAD] Cache HIT para vídeo {video_id} no projeto {project_name_safe}")
        else:
            del video_path_cache[cache_key]
            video_found_path = None
            video_filename = None
    else:
        video_found_path = None
        video_filename = None

    # 2) Se não tem no cache, busca diretamente no Firebase sem varredura
    if not video_found_path:
        video_found_path, video_filename = find_video_optimized_direct(authenticated_user_id_filter, project_name_safe, video_id)
        if video_found_path and video_filename:
            video_path_cache[cache_key] = ({'path': video_found_path, 'filename': video_filename}, now)
            logger.info(f"[DOWNLOAD] Cache MISS - dados salvos para {video_id}")

    if not video_found_path or not video_filename:
        logger.info(f"[DOWNLOAD] Vídeo '{video_id}' no projeto '{project_name_safe}' não encontrado.")
        return jsonify({"message": "Vídeo não encontrado ou não autorizado"}), 404

    # 3) Monta caminho no disco e envia o arquivo (com tratamento de desconexão)
    full_file_path = os.path.join(VIDEO_BASE_DIR, video_found_path)
    if not os.path.exists(full_file_path):
        logger.warning(f"[DOWNLOAD] Arquivo original não encontrado no disco: {full_file_path}")
        return jsonify({"message": "Arquivo original não encontrado"}), 404

    directory = os.path.dirname(full_file_path)
    actual_filename_on_disk = os.path.basename(full_file_path)

    logger.info(f"[DOWNLOAD] Iniciando envio: '{actual_filename_on_disk}' para usuário {authenticated_user_id}")

    try:
        # Usamos send_from_directory para manter compatibilidade (Flask >=2.2 suporta download_name)
        return send_from_directory(directory, 
                                   actual_filename_on_disk, 
                                   as_attachment=True, 
                                   download_name=video_filename,
                                   conditional=False
                                )
    except (ConnectionResetError, BrokenPipeError) as e:
        logger.warning(f"Cliente desconectou durante o envio do arquivo {video_filename}: {e}")
        return Response(status=499)
    except Exception as e:
        logger.error(f"Erro inesperado ao enviar arquivo {video_filename}: {e}", exc_info=True)
        return jsonify({"message": f"Erro ao enviar vídeo: {str(e)}"}), 500



# --- Rota de download legacy ---
@app.route('/api/videos/<video_id>', methods=['GET'])
def download_video(video_id):
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    try:
        user_projects_ref = db.reference(f'projects/{authenticated_user_id_filter}/', app=app_instance)
        user_projects_data = user_projects_ref.get()
        
        video_found_path = None
        video_filename = None

        if user_projects_data:
            for project_key, project_details in user_projects_data.items():
                if 'videos' in project_details and video_id in project_details['videos']:
                    video_data = project_details['videos'][video_id]
                    video_found_path = video_data.get('serverFilePath')
                    video_filename = video_data.get('filename')
                    break

        if not video_found_path or not video_filename:
            logger.info(f"DEBUG: Vídeo ID '{video_id}' não encontrado ou não autorizado para user '{authenticated_user_id}'.")
            return jsonify({"message": "Vídeo não encontrado ou não autorizado"}), 404

        full_file_path = os.path.join(VIDEO_BASE_DIR, video_found_path)

        if os.path.exists(full_file_path):
            directory = os.path.dirname(full_file_path)
            actual_filename_on_disk = os.path.basename(full_file_path)
            logger.info(f"[Download] '{actual_filename_on_disk}' ")
            try:
                return send_from_directory(directory, actual_filename_on_disk, as_attachment=True, download_name=video_filename)
            except (ConnectionResetError, BrokenPipeError) as e:
                # Cliente desconectou antes de terminar o download
                logger.warning(f"Cliente desconectou durante o envio do arquivo {video_filename}: {e}")
                # Retorna resposta vazia ou aborta silenciosamente
                return Response(status=499)  # 499 Client Closed Request (não oficial)
            except Exception as e:
                logger.error(f"Erro inesperado ao enviar arquivo {video_filename}: {e}", exc_info=True)
                return jsonify({"message": f"Erro ao enviar vídeo: {str(e)}"}), 500
        else:
            logger.info(f"DEBUG: Arquivo não encontrado no disco: {full_file_path}")
            return jsonify({"message": "Arquivo de vídeo não encontrado no servidor"}), 404

    except Exception as e:
        logger.error(f"ERRO INESPERADO no download_video: {e}", exc_info=True)
        return jsonify({"message": f"Erro ao baixar vídeo: {str(e)}"}), 500

# A nova rota otimizada, que recebe o nome do projeto e o ID do vídeo
@app.route('/api/projects/<project_name>/videos/<video_id>/preview', methods=['GET'])
def preview_video_optimized(project_name, video_id):
    """
    Busca otimizada que utiliza o nome do projeto e o ID do vídeo para
    ir diretamente ao caminho no Firebase, minimizando o download de dados.
    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401
    
    # Sanitiza o nome do projeto para segurança
    project_name_safe = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
    
    cache_key = f"{authenticated_user_id_filter}_{project_name_safe}_{video_id}"
    
    try:
        # 1. Verifica cache primeiro
        now = time.time()
        if cache_key in video_path_cache:
            cached_data, timestamp = video_path_cache[cache_key]
            if now - timestamp < CACHE_TTL:
                video_found_path = cached_data['path']
                video_filename = cached_data['filename']
                logger.info(f"[PREVIEW] Cache HIT para vídeo {video_id} no projeto {project_name_safe}")
            else:
                # Cache expirado
                del video_path_cache[cache_key]
                video_found_path = None
                video_filename = None
        else:
            video_found_path = None
            video_filename = None

        # 2. Se não está em cache, busca de forma otimizada no Firebase
        if not video_found_path:
            # A busca otimizada agora é direta, sem loops
            video_found_path, video_filename = find_video_optimized_direct(
                authenticated_user_id_filter,
                project_name_safe,
                video_id
            )
            
            # Armazena no cache se encontrou
            if video_found_path and video_filename:
                video_path_cache[cache_key] = (
                    {'path': video_found_path, 'filename': video_filename},
                    now
                )
                logger.info(f"[PREVIEW] Cache MISS - dados salvos para {video_id}")
        
        if not video_found_path or not video_filename:
            logger.info(f"[PREVIEW] Vídeo '{video_id}' no projeto '{project_name_safe}' não encontrado.")
            return jsonify({"message": "Vídeo não encontrado ou não autorizado"}), 404

        # Resto da lógica para servir o arquivo permanece igual
        full_file_path = os.path.join(VIDEO_BASE_DIR, video_found_path)
        if not os.path.exists(full_file_path):
            return jsonify({"message": "Arquivo original não encontrado"}), 404

        scheme = "https" if request.headers.get("X-Forwarded-Proto", "http") == "https" else "http"
        preview_url = url_for('serve_static_video', path=video_found_path, _external=True, _scheme=scheme)
        
        logger.info(f"[PREVIEW] preview_url gerada: '{preview_url}'")
        return jsonify({
            "preview_url": preview_url.replace('http://', 'https://'),
            "filename": video_filename
        }), 200

    except Exception as e:
        logger.error(f"[PREVIEW] ERRO: {e}", exc_info=True)
        return jsonify({"message": f"Erro ao gerar preview: {str(e)}"}), 500

@app.route('/api/projects/<project_name>/files/<file_id>/content', methods=['GET'])
def serve_file_content(project_name, file_id):
    """
    Endpoint para servir conteúdo de arquivos de texto (e outros arquivos não-vídeo).
    - Se for .txt, .md, .json etc => retorna conteúdo direto (text/plain ou application/json).
    - Se for outro formato => faz download.
    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    # Sanitização do nome do projeto
    project_name_safe = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")

    cache_key = f"{authenticated_user_id_filter}_{project_name_safe}_{file_id}"
    now = time.time()

    try:
        # 1) Verifica cache
        if cache_key in video_path_cache:
            cached_data, timestamp = video_path_cache[cache_key]
            if now - timestamp < CACHE_TTL:
                file_found_path = cached_data['path']
                file_filename = cached_data['filename']
            else:
                del video_path_cache[cache_key]
                file_found_path, file_filename = None, None
        else:
            file_found_path, file_filename = None, None

        # 2) Busca otimizada no Firebase se não está em cache
        if not file_found_path:
            file_found_path, file_filename = find_video_optimized_direct(
                authenticated_user_id_filter,
                project_name_safe,
                file_id
            )
            if file_found_path and file_filename:
                video_path_cache[cache_key] = (
                    {'path': file_found_path, 'filename': file_filename},
                    now
                )

        if not file_found_path or not file_filename:
            return jsonify({"message": "Arquivo não encontrado ou não autorizado"}), 404

        # 3) Monta caminho físico
        full_file_path = os.path.join(VIDEO_BASE_DIR, file_found_path)
        if not os.path.exists(full_file_path):
            return jsonify({"message": "Arquivo não encontrado no servidor"}), 404

        # 4) Se for texto/JSON/Markdown, retorna conteúdo
        if file_filename.lower().endswith(('.txt', '.md', '.json', '.log', '.csv')):
            try:
                with open(full_file_path, 'r', encoding="utf-8") as f:
                    content = f.read()
                mimetype = "text/plain"
                if file_filename.endswith(".json"):
                    mimetype = "application/json"
                elif file_filename.endswith(".csv"):
                    mimetype = "text/csv"
                return Response(content, mimetype=mimetype)
            except Exception as e:
                logger.error(f"Erro ao ler conteúdo do arquivo {file_filename}: {e}")
                return jsonify({"message": f"Erro ao ler conteúdo: {str(e)}"}), 500

        # 5) Caso contrário, força download
        directory = os.path.dirname(full_file_path)
        actual_filename_on_disk = os.path.basename(full_file_path)
        return send_from_directory(directory, actual_filename_on_disk, as_attachment=True, download_name=file_filename)

    except Exception as e:
        logger.error(f"ERRO em serve_file_content: {e}", exc_info=True)
        return jsonify({"message": f"Erro interno: {str(e)}"}), 500
    


@app.route('/api/projects/<project_name>', methods=['DELETE'])
def delete_project(project_name):
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Usuário não autenticado"}), 401

    try:
        safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
        safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

        # Caminhos no disco
        user_dir = os.path.join(VIDEO_BASE_DIR, authenticated_user_id_filter)
        project_dir = os.path.join(user_dir, safe_project_name_filter)

        # 1) Remover arquivos do projeto no disco
        fs_deleted, fs_reason = _remove_directory_safe(project_dir)
        if fs_deleted:
            logger.info(f"[delete-project] Arquivos do projeto removidos: {project_dir}")
        elif fs_reason == "not_found":
            logger.info(f"[delete-project] Diretório do projeto não encontrado (nada a remover): {project_dir}")
        elif fs_reason == "unsafe_path":
            logger.error(f"[delete-project] Caminho inseguro detectado. Abortando.")
            return jsonify({"message": "Falha ao excluir projeto: caminho inseguro detectado."}), 400
        else:
            logger.error(f"[delete-project] Erro ao remover arquivos do projeto: {project_dir} ({fs_reason})")
            # Prossegue para remover do DB, mas informa falha parcial

        # 2) Remover referência no Firebase RTDB
        ref = db.reference(f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}', app=app_instance)
        existed_in_db = ref.get() is not None
        if existed_in_db:
            ref.delete()
            logger.info(f"[delete-project] Projeto '{safe_project_name_filter}' excluído do Firebase com sucesso!")
        else:
            logger.info(f"[delete-project] Projeto '{safe_project_name_filter}' não existia no Firebase.")

        # 3) Limpar entradas de cache relacionadas ao projeto
        _clear_project_cache_entries(authenticated_user_id_filter, safe_project_name_filter)

        # 4) Limpeza opcional do diretório do usuário se vazio
        _cleanup_user_dir_if_empty(user_dir)

        # Monta mensagem de retorno, incluindo status do FS
        resp_msg_parts = []
        if existed_in_db:
            resp_msg_parts.append("nó no Firebase removido")
        else:
            resp_msg_parts.append("nó no Firebase não encontrado")
        if fs_deleted:
            resp_msg_parts.append("arquivos locais removidos")
        elif fs_reason == "not_found":
            resp_msg_parts.append("arquivos locais inexistentes")
        else:
            resp_msg_parts.append("falha ao remover arquivos locais")

        return jsonify({
            "message": f"Projeto '{project_name}' excluído: " + ", ".join(resp_msg_parts)
        }), 200

    except Exception as e:
        logger.error(f"Erro ao excluir projeto: {e}", exc_info=True)
        return jsonify({"message": "Erro ao excluir projeto"}), 500
    
@app.route('/api/projects/<project_name>/videos/<video_id>', methods=['DELETE'])
def delete_single_video(project_name, video_id):
    """
    Deleta somente um vídeo/arquivo do projeto do usuário (remove arquivo no disco + nó no Firebase).
    Requer header 'X-User-Id' (mock de autenticação usado atualmente).
    """
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Usuário não autenticado"}), 401

    try:
        # Normalizações 
        safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
        safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)

        # Referência ao item no Firebase
        video_ref_path = f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}/videos/{video_id}'
        video_ref = db.reference(video_ref_path, app=app_instance)
        video_data = video_ref.get()

        if not video_data:
            logger.info(f"[delete-single-video] Vídeo {video_id} não encontrado em {video_ref_path}")
            return jsonify({"message": "Vídeo/arquivo não encontrado no projeto."}), 404

        server_file_path = video_data.get('serverFilePath') or video_data.get('serverFilePathRelative') or None
        filename = video_data.get('filename') or video_data.get('title') or video_id

        # Resultado inicial
        fs_deleted = False
        fs_reason = None

        if server_file_path:
            # Monta caminho absoluto e garante segurança (não permite sair de VIDEO_BASE_DIR)
            full_file_path = os.path.join(VIDEO_BASE_DIR, server_file_path)
            abs_base = os.path.abspath(VIDEO_BASE_DIR)
            abs_target = os.path.abspath(full_file_path)

            if not abs_target.startswith(abs_base + os.sep):
                logger.warning(f"[delete-single-video] Caminho inseguro detectado: {abs_target}")
                return jsonify({"message": "Falha: caminho de arquivo inseguro."}), 400

            if os.path.exists(full_file_path):
                try:
                    os.remove(full_file_path)
                    fs_deleted = True
                    logger.info(f"[delete-single-video] Arquivo removido do disco: {full_file_path}")
                except Exception as e:
                    fs_reason = f"Erro ao remover arquivo do disco: {str(e)}"
                    logger.error(f"[delete-single-video] {fs_reason}", exc_info=True)
            else:
                fs_reason = "Arquivo não existe no disco"
                logger.info(f"[delete-single-video] Arquivo já não existia no disco: {full_file_path}")
        else:
            fs_reason = "serverFilePath ausente nos metadados"
            logger.info(f"[delete-single-video] serverFilePath ausente para {video_ref_path}")

        # Remove o nó do Firebase (metadados)
        try:
            video_ref.delete()
            firebase_deleted = True
            logger.info(f"[delete-single-video] Nó Firebase removido: {video_ref_path}")
        except Exception as e:
            firebase_deleted = False
            logger.error(f"[delete-single-video] Falha ao remover nó no Firebase: {e}", exc_info=True)

        # Limpa cache referente ao projeto
        try:
            _clear_project_cache_entries(authenticated_user_id_filter, safe_project_name_filter)
        except Exception:
            pass

        # Limpa diretório do usuário se vazio (opcional)
        try:
            _cleanup_user_dir_if_empty(os.path.join(VIDEO_BASE_DIR, authenticated_user_id_filter))
        except Exception:
            pass

        return jsonify({
            "message": "Operação concluída",
            "videoId": video_id,
            "filename": filename,
            "removedFromDisk": fs_deleted,
            "diskReason": fs_reason,
            "removedFromFirebase": firebase_deleted
        }), 200

    except Exception as e:
        logger.error(f"[delete-single-video] Erro inesperado: {e}", exc_info=True)
        return jsonify({"message": "Erro interno ao tentar deletar o arquivo/vídeo."}), 500


@app.route('/api/projects/<project_name>/mark-utilizado', methods=['POST'])
def mark_project_utilizado(project_name):
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Usuário não autenticado"}), 401

    try:
        data = request.json or {}
        utilizado = data.get("utilizado", True)
        logger.info(f"[mark-utilizado] '{utilizado}' ")
        safe_project_name = secure_filename(project_name).replace("-", "").replace("....", "").replace("...", "").replace("..", "").replace(".", "").replace("... - ", "").replace('"????????"', '').replace("...__", "_")
        safe_project_name_filter = re.sub(r'[^0-9A-Za-z_-]', '', safe_project_name)
    
        logger.info(f"[mark-utilizado] safe_project_name_filter '{safe_project_name_filter}' ")
        ref = db.reference(f'projects/{authenticated_user_id_filter}/{safe_project_name_filter}', app=app_instance)
        timestamp_now = datetime.utcnow().isoformat() + 'Z'  # formato ISO UTC
        ref.update({
            "used": utilizado,
            "last_used_timestamp": timestamp_now
        })
        logger.info(f"[mark-utilizado] marcado como {utilizado} com sucesso! ")
        return jsonify({"message": f"Projeto {'marcado como utilizado' if utilizado else 'não utilizado'} com sucesso!"})
    except Exception as e:
        logger.error(f"Erro ao atualizar utilizado: {e}", exc_info=True)
        return jsonify({"message": "Erro ao atualizar utilizado"}), 500

# A rota para servir o arquivo permanece inalterada
@app.route('/api/files/stream/<path:path>', methods=['GET'])
def serve_static_video(path):
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    full_file_path = os.path.join(VIDEO_BASE_DIR, path)
    if not os.path.exists(full_file_path):
        return jsonify({"message": "Arquivo não encontrado"}), 404

    directory = os.path.dirname(full_file_path)
    filename = os.path.basename(full_file_path)
    
    return send_from_directory(directory, filename, as_attachment=False)

@app.route('/api/videos/<video_id>/preview/file', methods=['GET'])
def serve_video_preview(video_id):
    """Serve o arquivo real do vídeo para streaming"""
    authenticated_user_id, authenticated_user_id_filter = authenticate_user(request)
    if not authenticated_user_id:
        return jsonify({"message": "Autenticação necessária"}), 401

    user_projects_ref = db.reference(f'projects/{authenticated_user_id_filter}/', app=app_instance)
    user_projects_data = user_projects_ref.get()

    video_found_path = None
    if user_projects_data:
        for project_key, project_details in user_projects_data.items():
            if 'videos' in project_details and video_id in project_details['videos']:
                video_data = project_details['videos'][video_id]
                video_found_path = video_data.get('serverFilePath')
                break

    if not video_found_path:
        return jsonify({"message": "Vídeo não encontrado ou não autorizado"}), 404

    full_file_path = os.path.join(VIDEO_BASE_DIR, video_found_path)
    if not os.path.exists(full_file_path):
        return jsonify({"message": "Arquivo original não encontrado"}), 404

    directory = os.path.dirname(full_file_path)
    filename = os.path.basename(full_file_path)
    return send_from_directory(directory, filename, as_attachment=False)

def _remove_directory_safe(path_to_remove: str):
    """Remove diretório e conteúdo com verificação de segurança para evitar path traversal.
    Retorna (ok: bool, reason: str)
    """
    try:
        abs_base = os.path.abspath(VIDEO_BASE_DIR)
        abs_target = os.path.abspath(path_to_remove)
        if not abs_target.startswith(abs_base + os.sep):
            logger.warning(f"[delete-project] Tentativa de remoção fora do VIDEO_BASE_DIR: {abs_target}")
            return False, "unsafe_path"
        if not os.path.exists(abs_target):
            return False, "not_found"
        shutil.rmtree(abs_target)
        return True, "deleted"
    except Exception as e:
        logger.error(f"[delete-project] Falha ao remover diretório '{path_to_remove}': {e}", exc_info=True)
        return False, f"error:{e}"


def _cleanup_user_dir_if_empty(user_dir: str):
    try:
        if os.path.isdir(user_dir) and len(os.listdir(user_dir)) == 0:
            os.rmdir(user_dir)
    except Exception as e:
        logger.warning(f"[delete-project] Não foi possível remover diretório de usuário vazio '{user_dir}': {e}")


def _clear_project_cache_entries(user_key: str, project_name_safe: str):
    prefix = f"{user_key}_{project_name_safe}_"
    to_delete = [k for k in list(video_path_cache.keys()) if str(k).startswith(prefix)]
    for k in to_delete:
        try:
            del video_path_cache[k]
        except Exception:
            pass

def find_video_optimized_direct(user_id_filter, project_name_safe, video_id):
    """
    Busca otimizada que minimiza o download de dados do Firebase usando o nome do projeto.
    Retorna (serverFilePath, filename) ou (None, None)
    """
    try:
        video_ref = db.reference(f'projects/{user_id_filter}/{project_name_safe}/videos/{video_id}', app=app_instance)
        video_data = video_ref.get()

        if video_data:
            video_path = video_data.get('serverFilePath')
            video_filename = video_data.get('filename')

            if video_path and video_filename:
                logger.info(f"[OPTIMIZE] Vídeo encontrado diretamente em {project_name_safe}")
                return video_path, video_filename

        return None, None
    except Exception as e:
        logger.error(f"[OPTIMIZE] Erro na busca direta: {e}", exc_info=True)
        return None, None

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=4242)