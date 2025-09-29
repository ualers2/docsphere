import subprocess
import os

os.chdir(os.path.join(os.path.dirname(__file__)))
# Adiciona o caminho do Docker Compose
os.environ["PATH"] += r";C:\Program Files\Docker\Docker\resources\bin"
path = os.path.join(os.path.dirname(__file__))
def executar_comando(comando):
    """Executa um comando sem abrir um novo terminal (funciona dentro do contêiner)."""
    subprocess.run(comando, shell=True)


executar_comando("docker-compose up --build -d nginx_proxy_server")
