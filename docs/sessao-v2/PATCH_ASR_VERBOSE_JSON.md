# PATCH: ASR Service — Suporte a verbose_json

## Problema
O `main.py` do container `asr-service` descarta os segments do faster-whisper.
O generator é consumido no `" ".join()` e só o texto concatenado é retornado.

## Fix
Converter o generator para lista ANTES do join, ler o param `response_format`,
e retornar segments quando pedido.

## Diff a aplicar em /root/asr-service/app/main.py

Localizar o trecho:

```python
segments, info = get_model().transcribe(tmp_path, language=language, vad_filter=True)
text = " ".join([s.text for s in segments]).strip()
return JSONResponse(content={"text": text})
```

Substituir por:

```python
segments_gen, info = get_model().transcribe(tmp_path, language=language, vad_filter=True)

# Materializar generator (consumido uma vez só)
segments_list = list(segments_gen)

text = " ".join([s.text.strip() for s in segments_list]).strip()

# Ler response_format do form (default: "json" = só text)
response_format = form.get("response_format", "json")

if response_format == "verbose_json":
    return JSONResponse(content={
        "text": text,
        "language": language or info.language,
        "duration": round(info.duration, 3),
        "segments": [
            {
                "id": i,
                "start": round(s.start, 3),
                "end": round(s.end, 3),
                "text": s.text.strip(),
            }
            for i, s in enumerate(segments_list)
        ],
    })

return JSONResponse(content={"text": text})
```

## Notas
- `form.get("response_format", "json")` — depende de como o endpoint lê os params.
  Se usar FastAPI com `Form(...)`, precisa adicionar o parâmetro na assinatura.
  Se usar `request.form()` manual, o `.get()` funciona direto.
- `info.language` e `info.duration` vêm do TranscriptionInfo do faster-whisper.
- `round(s.start, 3)` = milissegundos de precisão (suficiente).

## Rebuild do container

```bash
cd /root/asr-service
docker build -t asr-service .
docker stop asr-service
docker rm asr-service
docker run -d \
  --name asr-service \
  --restart always \
  --gpus all \
  -p 8000:8000 \
  -v /root/asr-service/models:/root/.cache/huggingface \
  asr-service
```

NOTA: O `docker run` acima é um template. Verificar os flags reais com:
```bash
docker inspect asr-service --format='{{json .HostConfig}}' | python3 -m json.tool
```
Isso mostra os binds, gpus, ports e env vars originais pra replicar exatamente.

## Teste pós-rebuild

```bash
# Teste rápido com arquivo pequeno
curl -s -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@AUDIO_PATH" \
  -F "language=pt" \
  -F "response_format=verbose_json" \
  | python3 -m json.tool | head -40

# Deve retornar:
# {
#   "text": "...",
#   "language": "pt",
#   "duration": 123.456,
#   "segments": [
#     { "id": 0, "start": 0.0, "end": 3.2, "text": "..." },
#     ...
#   ]
# }

# Teste compatibilidade (sem verbose_json, deve continuar igual)
curl -s -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@AUDIO_PATH" \
  -F "language=pt" \
  | python3 -m json.tool | head -5

# Deve retornar:
# { "text": "..." }
```
