import requests
import os

def get_user_projects(base_url, user_id, token=None):
    """
    Chama o endpoint /api/projects/<user_id> para buscar os projetos do usuário.
    
    :param base_url: URL base da API (ex: http://localhost:4242 ou https://mediacutsstudio.com)
    :param user_id: ID do usuário (ex: email usado no sistema)
    :return: Lista de projetos ou mensagem de erro
    """
    url = f"{base_url}/api/projects/{user_id}"

    headers = {
        "Content-Type": "application/json"
    }
    if token:
        headers["X-User-Id"] = f"{user_id}"

    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            print("✅ Projetos recebidos com sucesso:")
            return response.json()
        elif response.status_code == 403:
            print("❌ Não autorizado. Verifique o token ou o user_id.")
            return response.json()
        else:
            print(f"⚠️ Erro {response.status_code}: {response.text}")
            return None
    except requests.RequestException as e:
        print(f"Erro na requisição: {e}")
        return None


if __name__ == "__main__":
    BASE_URL = "https://videomanager.api.mediacutsstudio.com"  # altere para sua URL de produção se necessário
    USER_ID = os.getenv('USER_ID')

    projetos = get_user_projects(BASE_URL, USER_ID)
    print(projetos)
    if projetos:
        for p in projetos:
            print(f"- {p['name']} (status: {p.get('status')}, vídeos: {len(p.get('videos', []))})")
