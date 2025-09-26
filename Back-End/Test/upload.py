from Modules.upload_ import *


name_project= "teste"
VIDEO_FILE_PATH = r"E:\Users\Media Cuts DeV\Downloads\WorkEnv\Docsphere\subclip_vertical_1.mp4"
USER_ID_FOR_TEST = "freitasalexandre810@gmail_com"

upload_(name_project, VIDEO_FILE_PATH, USER_ID_FOR_TEST,
        type_project="video",
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