#!/bin/bash
# =====================================================
# AXIS TCC — Atualizar config ASR (Whisper transcribe)
# Melhora qualidade PT-BR sem trocar modelo
#
# Mudanças:
#   - language fixo "pt" (remove autodetect)
#   - beam_size=5 (busca mais ampla)
#   - best_of=5 (mais candidatos)
#   - temperature=0 (determinístico)
#   - condition_on_previous_text=True (contexto entre segmentos)
#
# Uso: bash scripts/update-asr-config.sh
# =====================================================

set -euo pipefail

CONTAINER="asr-service"
FILE="/app/app/main.py"

echo "=== [1/4] Verificando container ==="
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERRO: Container '${CONTAINER}' não está rodando."
  echo "Containers ativos:"
  docker ps --format '  {{.Names}} ({{.Status}})'
  exit 1
fi

echo "=== [2/4] Backup ==="
docker exec "$CONTAINER" cp "$FILE" "${FILE}.bak"
echo "Backup criado: ${FILE}.bak"

echo "=== [3/4] Aplicando nova config do transcribe() ==="
docker exec "$CONTAINER" sed -i 's/segments, info = get_model().transcribe(\n\s*tmp_path,/segments, info = get_model().transcribe(\n        tmp_path,/' "$FILE" 2>/dev/null || true

# Usa python pra fazer a substituição de forma segura (sed multi-line é frágil)
docker exec "$CONTAINER" python3 -c "
import re

with open('$FILE', 'r') as f:
    content = f.read()

# Pattern: get_model().transcribe( ... ) com os args antigos
old_pattern = r'(segments,\s*info\s*=\s*get_model\(\)\.transcribe\s*\(\s*\n\s*)tmp_path,\s*\n\s*language=language,\s*\n\s*vad_filter=True,\s*\n(\s*\))'

new_code = r'''\1tmp_path,
        language=\"pt\",
        vad_filter=True,
        beam_size=5,
        best_of=5,
        temperature=0,
        condition_on_previous_text=True,
\2'''

result, count = re.subn(old_pattern, new_code, content)

if count == 0:
    print('AVISO: Pattern não encontrado. Verificar main.py manualmente.')
    print('Conteúdo atual do trecho transcribe():')
    # Mostra contexto
    idx = content.find('transcribe(')
    if idx >= 0:
        print(content[max(0,idx-50):idx+300])
    else:
        print('transcribe() não encontrado no arquivo!')
    exit(1)

with open('$FILE', 'w') as f:
    f.write(result)

print(f'Substituição aplicada ({count} ocorrência(s)).')
"

echo ""
echo "=== Verificando resultado ==="
docker exec "$CONTAINER" grep -A 10 "transcribe(" "$FILE"

echo ""
echo "=== [4/4] Reiniciando container ==="
docker restart "$CONTAINER"
echo "Aguardando 10s para startup..."
sleep 10

echo ""
echo "=== Health check ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "OK — ASR service respondeu 200"
  curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/health
else
  echo "AVISO — HTTP $HTTP_CODE. Verificar logs:"
  echo "  docker logs --tail 50 $CONTAINER"
fi

echo ""
echo "=== Concluído ==="
echo "Para reverter: docker exec $CONTAINER cp ${FILE}.bak $FILE && docker restart $CONTAINER"
