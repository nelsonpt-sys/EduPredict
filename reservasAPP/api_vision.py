from google import genai
from google.genai import types
from django.conf import settings
import json
import base64

def extraer_ramos_de_imagen(base64_string):
    """
    Toma una imagen en base64 de un horario académico y devuelve una lista de posibles nombres de ramos.
    Utiliza estrictamente el modelo Gemini 2.5 Flash, el cual sí está disponible en el entorno y soporta visión en v1beta.
    """
    try:
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not api_key:
            raise Exception("No se ha configurado GEMINI_API_KEY en settings.py")
            
        client = genai.Client(api_key=api_key)
        
        # Eliminar el prefijo data:image/png;base64, si existe
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
            
        image_bytes = base64.b64decode(base64_string)

        prompt = '''
        OCR Misión: Extrae SOLO los nombres de las asignaturas (ramos) de este horario académico.
        Reglas:
        - Ignora horas, salas, profesores y códigos.
        - Devuelve un arreglo JSON simple: ["Ramo 1", "Ramo 2"]
        - No expliques nada. Solo el JSON.
        '''

        part = types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg')
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt, part],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
        except Exception as api_err:
            err_msg = str(api_err)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                return {"ok": False, "error": "La IA de Google ha agotado su cuota gratuita por hoy. Por favor, intenta de nuevo en un momento o mañana."}
            if "503" in err_msg or "UNAVAILABLE" in err_msg:
                return {"ok": False, "error": "Los servidores de Google están saturados en este momento. Reintenta en unos segundos."}
            raise api_err
        
        raw_text = response.text.strip()
        
        # Limpieza por si Gemini retorna markdown
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "", 1)
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        
        ramos_extraidos = json.loads(raw_text.strip())
        
        # Filtrar únicos y asegurarse que sean un array de strings
        if isinstance(ramos_extraidos, list):
            unicos = sorted(list(set(str(r).strip() for r in ramos_extraidos if str(r).strip())))
            return {"ok": True, "ramos": unicos}
            
        return {"ok": False, "error": "La IA devolvió un formato no reconocido."}

    except Exception as e:
        return {"ok": False, "error": f"Error del sistema: {str(e)}"}
