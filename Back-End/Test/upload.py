# exemplo_stream_upload.py
from Modules.upload_ import upload_
import io
import os

name_project = "requirements"
VIDEO_FILE_PATH = r"E:\Users\Media Cuts DeV\Downloads\WorkEnv\Docsphere\Back-End\requirements.txt"
USER_ID_FOR_TEST = "freitasalexandre810@gmail_com"

# ------------------------
# MODO A: passar file-like (stream direto do disco)
# ------------------------
print("Modo A: stream do arquivo no disco...")
if os.path.exists(VIDEO_FILE_PATH):
    with open(VIDEO_FILE_PATH, "rb") as f:
        # NÃO leia todo o arquivo na memória; passe o fileobj diretamente
        video_id = upload_(
            name_project,
            f,  # file-like -> upload_ envia em stream
            USER_ID_FOR_TEST,
            type_project="files",
            title='teste',
            description='teste',
            hashtags='#teste',
            minutagemdeInicio='00:00:00',
            minutagemdeFim='00:00:00',
            urltumbnail='testeurl',
            justificativa='none',
            sentimento_principal='none',
            potencial_de_viralizacao='none',
        )

    if video_id:
        print("Upload OK (modo A). video_id:", video_id)
    else:
        print("Upload falhou (modo A).")
else:
    print("Arquivo não encontrado:", VIDEO_FILE_PATH)

# ------------------------
# MODO B: passar bytes em memória (BytesIO) e forçar filename
# ------------------------
print("\nModo B: usar BytesIO e forçar filename...")
try:
    with open(VIDEO_FILE_PATH, "rb") as f_src:
        data = f_src.read()  # aqui você carrega em memória (só para exemplo)
    buf = io.BytesIO(data)
    buf.seek(0)  # crucial: coloque o ponteiro no início antes de enviar

    payload = {
        "fileobj": buf,
        "filename": "requirements.txt"
    }

    video_id2 = upload_(
        name_project,
        payload,  # dict com fileobj + filename -> upload_ envia em stream
        USER_ID_FOR_TEST,
        type_project="files",
        title='teste-2',
        description='teste-2',
        hashtags='#teste2',
        minutagemdeInicio='00:00:00',
        minutagemdeFim='00:00:00',
        urltumbnail='testeurl',
        justificativa='none',
        sentimento_principal='none',
        potencial_de_viralizacao='none',
    )

    if video_id2:
        print("Upload OK (modo B). video_id:", video_id2)
    else:
        print("Upload falhou (modo B).")

except Exception as e:
    print("Erro no modo B:", e)
