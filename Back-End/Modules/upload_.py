# Internal-server.py (parte relevante)
import os
import json
import requests
import logging
from typing import IO

diretorio_script = os.path.dirname(__file__)
os.makedirs(os.path.join(diretorio_script, '../', 'Logs'), exist_ok=True)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler = logging.FileHandler(os.path.join(diretorio_script, '../', 'Logs', 'upload_py.log'))
file_handler.setFormatter(formatter)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

def _guess_filename_from_fileobj(fileobj):
    # tenta obter nome do objeto (ex: handle.name)
    name = getattr(fileobj, "name", None)
    if isinstance(name, str):
        return os.path.basename(name)
    # tenta outros atributos (ex: filename)
    name2 = getattr(fileobj, "filename", None)
    if isinstance(name2, str):
        return os.path.basename(name2)
    return None

def _get_content_length(fileobj: IO):
    # tenta calcular tamanho sem consumir stream (somente para seekable)
    try:
        cur = fileobj.tell()
        fileobj.seek(0, os.SEEK_END)
        size = fileobj.tell()
        fileobj.seek(cur, os.SEEK_SET)
        return size
    except Exception:
        return None

def upload_(name_project, VIDEO_FILE_PATH, USER_ID_FOR_TEST,
            type_project="files",
            title='',
            description='',
            hashtags='',
            minutagemdeInicio='',
            minutagemdeFim='',
            urltumbnail='',
            justificativa='',
            sentimento_principal='',
            potencial_de_viralizacao=''):
    """
    Suporta:
      - VIDEO_FILE_PATH = '/caminho/para/arquivo.mp4'  (string com path)  -> multipart upload (compatibilidade antiga)
      - VIDEO_FILE_PATH = fileobj (objeto com .read())              -> raw streaming (headers X-Filename, X-Metadata)
      - VIDEO_FILE_PATH = {'fileobj': fileobj, 'filename': 'nome.mp4'} -> força nome quando fileobj não tem .name
    """
    UPLOAD_URL = "https://videomanager.api.mediacutsstudio.com"

    if type_project == "files":
        video_metadata = {
            "projectName": name_project,
            "type_project": type_project,
        }
    else:
        video_metadata = {
            "projectName": name_project,
            "type_project": "video",
            "title": title,
            "description": description,
            "hashtags": hashtags,
            "minutagemdeInicio": minutagemdeInicio,
            "minutagemdeFim": minutagemdeFim,
            "urltumbnail": urltumbnail,
            "justificativa": justificativa,
            "sentimento_principal": sentimento_principal,
            "potencial_de_viralizacao": potencial_de_viralizacao
        }

    # ----- Caso 1: caminho de arquivo (string path) -----
    if isinstance(VIDEO_FILE_PATH, str):
        if not os.path.exists(VIDEO_FILE_PATH):
            logger.info(f"Erro: O arquivo '{VIDEO_FILE_PATH}' não foi encontrado.")
            return None

        try:
            with open(VIDEO_FILE_PATH, 'rb') as video_file:
                files = {
                    'file': (os.path.basename(VIDEO_FILE_PATH), video_file, 'video/mp4')
                }
                data = {
                    'metadata': json.dumps(video_metadata)
                }
                headers = {
                    'X-User-Id': USER_ID_FOR_TEST
                }
                logger.info(f"Tentando enviar '{VIDEO_FILE_PATH}' para {UPLOAD_URL} (multipart)...")
                logger.info(f"Com metadados: {json.dumps(video_metadata, indent=2)}")
                response = requests.post(f"{UPLOAD_URL}/api/upload-video", files=files, data=data, headers=headers, timeout=300)

                if response.status_code in (200, 201):
                    logger.info("Upload bem-sucedido (multipart).")
                    payload = response.json()
                    return payload.get('video_id') or payload.get('item_id') or None
                else:
                    logger.info(f"Erro no upload (multipart): Código {response.status_code}")
                    try:
                        logger.info(json.dumps(response.json(), indent=2))
                    except Exception:
                        logger.info(response.text)
                    return None

        except Exception as e:
            logger.exception(f"Erro ao enviar arquivo (multipart): {e}")
            return None

    # ----- Caso 2: dicionário com fileobj e filename -----
    if isinstance(VIDEO_FILE_PATH, dict) and 'fileobj' in VIDEO_FILE_PATH:
        fileobj = VIDEO_FILE_PATH['fileobj']
        filename = VIDEO_FILE_PATH.get('filename') or _guess_filename_from_fileobj(fileobj) or 'upload.bin'

    # ----- Caso 3: file-like object direto -----
    elif hasattr(VIDEO_FILE_PATH, 'read'):
        fileobj = VIDEO_FILE_PATH
        filename = _guess_filename_from_fileobj(fileobj) or 'upload.bin'

    else:
        logger.info("Parâmetro VIDEO_FILE_PATH inválido. Deve ser path (string), file-like ou dict {'fileobj', 'filename'}.")
        return None

    # -------- Envio em modo stream (raw body) --------
    try:
        # calcula content-length quando possível
        content_length = _get_content_length(fileobj)
        headers = {
            'X-User-Id': USER_ID_FOR_TEST,
            'X-Filename': filename,
            'X-Metadata': json.dumps(video_metadata),
            # content-type de corpo bruto
            'Content-Type': 'application/octet-stream'
        }
        if content_length is not None:
            headers['Content-Length'] = str(content_length)

        logger.info(f"Tentando enviar stream '{filename}' para {UPLOAD_URL} (stream raw)...")
        logger.info(f"Com metadados: {json.dumps(video_metadata, indent=2)}, Content-Length: {content_length}")

        # requests aceita fileobj em data para streamar o corpo (não usa multipart)
        response = requests.post(f"{UPLOAD_URL}/api/upload-video", data=fileobj, headers=headers, timeout=300)

        if response.status_code in (200, 201):
            logger.info("Upload bem-sucedido (stream).")
            payload = response.json()
            return payload.get('video_id') or payload.get('item_id') or None
        else:
            logger.info(f"Erro no upload (stream): Código {response.status_code}")
            try:
                logger.info(json.dumps(response.json(), indent=2))
            except Exception:
                logger.info(response.text)
            return None

    except requests.exceptions.RequestException as e:
        logger.exception(f"Erro de conexão/requests durante upload stream: {e}")
        return None
    except Exception as e:
        logger.exception(f"Erro inesperado durante upload stream: {e}")
        return None
