# AXIS ABA — Skill Operadora Ready v2.7.0

Reference: AXIS_ABA_BIBLE v2.7.0 — Camada Operadora Ready
Baseline: CSO-ABA v2.6.1 (CONGELADO)
Status: Aprovado — Março 2026

---

## Decisão Central

Motor clínico CSO-ABA v2.6.1 permanece CONGELADO.
v2.7.0 adiciona camada institucional auditável POR CIMA da camada clínica.

- Camada Clínica = o que o terapeuta vê e usa
- Camada Operadora = o que o convênio exige, audita e credencia

Nenhum código da camada operadora pode alterar, sobrescrever ou interferir no motor clínico.

---

## Regras Imutáveis (herdadas do v2.6.1)

- Motor CSO-ABA e pesos (0.25 x 4) — NUNCA alterados
- Append-only e snapshot imutável
- Engine version lock
- Decisão clínica sempre humana
- Generalização 3x2
- Manutenção 2/6/12 semanas
- Regressão tipificada com justificativa
- Regras 21-24 inquebráveis

---

## Princípio de Adoção 50+

Terapeutas 50+ com baixa fluência digital. Se a prova institucional atrapalhar o atendimento, o sistema falhou.

### Regras UX Obrigatórias

1. Zero wizard longo
2. Regra dos 2 cliques para iniciar/fechar sessão
3. Linguagem operacional ("Localização registrada"), não técnica ("accuracy_meters capturado")
4. Exceção guiada com dropdown de motivos prontos
5. Sem bloqueio cego — falha gera alerta, NUNCA trava
6. Sinal visual: verde=ok, amarelo=atenção, vermelho=revisar
7. Tudo funciona no celular
8. Admin vê complexidade; terapeuta vê tarefa

### Gate de Feature

Toda feature nova responde a DUAS perguntas:
- Isso ajuda quem paga?
- Isso continua simples para quem usa?

Se falhar em uma, não entra.

---

## Modelo de Dados — 12 Tabelas Novas + 1 Extensão

### Sprint 1 — Prova de Presença

#### service_sites
Locais esperados de atendimento.
```
id UUID PK
tenant_id UUID FK → tenants
site_name TEXT
site_type TEXT ('clinic','home','school','telehealth','community','other')
address TEXT NULL (CRIPTOGRAFADO pgcrypto)
latitude DECIMAL(10,7) NULL
longitude DECIMAL(10,7) NULL
radius_meters INTEGER DEFAULT 200
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### Campos adicionais em sessions_aba (ALTER TABLE)
```
declared_site_id UUID FK → service_sites NULL
service_mode TEXT DEFAULT 'presencial' ('presencial','domiciliar','escolar','telehealth')
```

#### session_presence_proofs
Geolocalização de check-in e check-out.
```
id UUID PK
session_id UUID FK → sessions_aba
tenant_id UUID FK → tenants
proof_type TEXT ('checkin','checkout')
latitude DECIMAL(10,7) (CRIPTOGRAFADO pgcrypto)
longitude DECIMAL(10,7) (CRIPTOGRAFADO pgcrypto)
accuracy_meters DECIMAL(8,2) (em claro — usado em regras)
altitude_meters DECIMAL(8,2) NULL
distance_to_site_meters DECIMAL(8,2) NULL (em claro — usado em regras)
capture_source TEXT ('browser_gps','app_gps','manual_override')
confidence_status TEXT ('valid','warning','exception') (em claro — filtros/dashboards)
exception_reason TEXT NULL
device_hash TEXT (hash irreversível user-agent+screen+timezone — integridade, NÃO tracking)
ip_address TEXT (CRIPTOGRAFADO pgcrypto)
raw_payload_hash TEXT (SHA256 do payload bruto)
captured_at TIMESTAMPTZ
captured_by UUID FK → profiles
created_at TIMESTAMPTZ DEFAULT NOW()
```

Regras de classificação:
- accuracy <= 50m E distancia <= raio → valid
- accuracy 50-100m → valid (nota moderada)
- accuracy 100-500m → warning
- accuracy > 500m → exception (justificativa obrigatória)
- GPS negado → exception (exception_reason obrigatório)
- Distância > raio x 3 → flag UNEXPECTED_LOCATION
- Distância checkin/checkout > 5km → flag IMPOSSIBLE_TRAVEL
- telehealth → valid sem geo

Níveis de prova (configurável por pagador):
- none: sem GPS
- light: GPS só check-in
- standard: GPS check-in + check-out
- strict: GPS + atestação + anexo

#### session_attestations
Atestações digitais de terapeuta, supervisor e responsável.
```
id UUID PK
session_id UUID FK → sessions_aba
tenant_id UUID FK → tenants
attestor_type TEXT ('therapist','supervisor','guardian')
attestor_id TEXT
attestor_name TEXT
attestor_document_masked TEXT (ex: "CRP ***456/PE")
attestation_method TEXT ('system_login','otp_email','magic_link','canvas_signature','external_certificate','certified_timestamp')
attestation_hash TEXT (SHA256 session_id+attestor_id+timestamp)
ip_address TEXT (CRIPTOGRAFADO pgcrypto)
user_agent TEXT
canvas_data TEXT NULL (CRIPTOGRAFADO pgcrypto — complementar, NÃO pilar jurídico)
status TEXT ('completed','pending','expired')
attested_at TIMESTAMPTZ
expires_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ DEFAULT NOW()
```

Canal v2.7.0 para responsável: email + magic_link via Resend (já integrado). SMS/WhatsApp fora do escopo.

Regras:
1. Terapeuta: atestação automática ao fechar sessão (logado = autenticado, zero cliques)
2. Responsável: email com magic_link enviado após fechamento
3. Prazo: configurável por pagador (padrão 72h)
4. Expirada → status 'expired', sessão NÃO bloqueia
5. IMUTÁVEL após registro

#### session_evidence_bundles
Pacote de evidência por sessão.
```
id UUID PK
session_id UUID FK → sessions_aba
tenant_id UUID FK → tenants
bundle_hash TEXT (SHA256 de todos os componentes ordenados)
components JSONB (lista de {type, ref_id, individual_hash})
status TEXT ('complete','partial','exception')
missing_items TEXT[]
version INTEGER DEFAULT 1
supersedes_id UUID FK → session_evidence_bundles NULL
generated_at TIMESTAMPTZ
generated_by TEXT ('system','manual')
created_at TIMESTAMPTZ DEFAULT NOW()
```

Nova versão = NOVA LINHA sempre. supersedes_id aponta para versão anterior.

Componentes:
- Snapshot clínico (CSO) — sempre
- Prova presença (geo) — depende do pagador
- Atestação terapeuta — sempre
- Atestação responsável — depende do pagador
- Anexos — depende do pagador
- Local declarado — sempre
- Metadados técnicos — sempre

#### session_attachments
Anexos de sessão (fotos, documentos).
```
id UUID PK
session_id UUID FK → sessions_aba
tenant_id UUID FK → tenants
attachment_type TEXT ('photo_checkin','photo_checkout','document','prescription','other')
file_name TEXT
file_hash TEXT (SHA256)
file_size_bytes INTEGER
mime_type TEXT
storage_path TEXT
extracted_geo JSONB NULL (CRIPTOGRAFADO pgcrypto — só lat/lng/timestamp do EXIF)
uploaded_by UUID FK → profiles
uploaded_at TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT NOW()
```

EXIF bruto NUNCA armazenado. Extrair apenas lat/lng/timestamp.
Hash detecta duplicatas (DUPLICATE_PHOTO flag).
Max 10MB. Formatos: JPG, PNG, PDF. IMUTÁVEL após upload.

### Sprint 2 — Camada Institucional

#### learner_coverage_profiles
Cobertura do aprendiz por pagador.
```
id UUID PK
learner_id UUID FK → learners
tenant_id UUID FK → tenants
payer_profile_id UUID FK → payer_requirement_profiles
authorization_code TEXT NULL
authorized_hours_week DECIMAL(4,1) NULL
start_date DATE
end_date DATE NULL
status TEXT DEFAULT 'active' ('active','pending','expired','suspended')
notes TEXT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### claim_packets
Pacote documental para operadora.
```
id UUID PK
tenant_id UUID FK → tenants
learner_id UUID FK → learners
coverage_id UUID FK → learner_coverage_profiles
packet_type TEXT ('monthly','quarterly','guide','custom')
period_start DATE
period_end DATE
packet_status TEXT ('draft','ready','submitted','returned','accepted','disputed')
packet_hash TEXT
total_sessions INTEGER
sessions_with_full_proof INTEGER
sessions_with_partial_proof INTEGER
sessions_with_exception INTEGER
completeness_pct DECIMAL(5,2)
version INTEGER DEFAULT 1
supersedes_id UUID FK → claim_packets NULL
generated_at TIMESTAMPTZ
generated_by UUID FK → profiles
submitted_at TIMESTAMPTZ NULL
returned_at TIMESTAMPTZ NULL
return_reason TEXT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

IMUTÁVEL após 'submitted'. Ajuste = nova versão com supersedes_id.

#### claim_packet_items
```
id UUID PK
packet_id UUID FK → claim_packets
item_type TEXT ('clinical_report','session_evidence','prescription','pei','team_roster','consent','coverage_auth','other')
item_ref_id UUID
item_hash TEXT
item_status TEXT ('included','missing','expired','not_applicable')
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### payer_submissions
Registro de envios para operadora.
```
id UUID PK
packet_id UUID FK → claim_packets
packet_version INTEGER
tenant_id UUID FK → tenants
submission_method TEXT ('portal','email','physical','api')
submitted_at TIMESTAMPTZ
submitted_by UUID FK → profiles
response_status TEXT NULL ('pending','accepted','rejected','partial')
response_at TIMESTAMPTZ NULL
response_notes TEXT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
```

#### provider_credentials
Cadastro institucional de prestadores. 1:1 com profiles no v2.7.0.
```
id UUID PK
profile_id UUID FK → profiles (UNIQUE)
tenant_id UUID FK → tenants
full_name TEXT
council_type TEXT ('CRP','CRFa','CREFITO','CRM','BCBA','other')
council_number TEXT
council_uf TEXT
council_valid_until DATE NULL
specializations TEXT[]
education_level TEXT ('graduacao','especializacao','mestrado','doutorado')
role_in_team TEXT ('supervisor','terapeuta','fono','to','psicopedagoga')
weekly_hours_total DECIMAL(4,1) NULL
is_credentialed BOOLEAN DEFAULT false
credential_code TEXT NULL
credential_status TEXT DEFAULT 'pending' ('active','pending','expired','blocked')
documents_complete BOOLEAN DEFAULT false
last_verified_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

#### learner_therapists — EXTENSÃO (nome canônico mantido)
ALTER TABLE para adicionar:
```
role_in_case TEXT ('supervisor_clinico','terapeuta_aba','fono','to','psicopedagoga')
weekly_hours DECIMAL(4,1)
start_date DATE
end_date DATE NULL
```

### Sprint 3 — Integridade

#### integrity_flags
```
id UUID PK
tenant_id UUID FK → tenants
entity_type TEXT ('session','provider','packet','learner')
entity_id UUID
rule_code TEXT
severity TEXT ('info','warning','critical')
description TEXT
first_detected_at TIMESTAMPTZ
last_detected_at TIMESTAMPTZ
status TEXT ('open','reviewing','resolved','waived')
reviewed_by UUID FK → profiles NULL
reviewed_at TIMESTAMPTZ NULL
review_notes TEXT NULL
auto_resolved BOOLEAN DEFAULT false
created_at TIMESTAMPTZ DEFAULT NOW()
```

Regras de detecção:
- OVERLAP_SESSIONS: critical — 2 sessões simultâneas mesmo terapeuta
- IMPOSSIBLE_TRAVEL: critical — checkout A → checkin B <15min, >20km
- UNEXPECTED_LOCATION: warning — geo > raio x 3
- DUPLICATE_PHOTO: critical — mesmo hash em sessões diferentes
- RETROEDIT_ATTEMPT: critical — editar sessão fechada
- EXCESSIVE_DURATION: warning — sessão > 6h
- RECURRENT_EXCEPTION: warning — >30% exceções no mês
- MISSING_GEO_REQUIRED: warning — sem geo quando pagador exige
- EXPIRED_COUNCIL: warning — conselho vencido
- EXPIRED_COVERAGE: warning — cobertura expirada
- INACTIVE_PROVIDER: warning — inativo atendendo
- NO_ATTESTATION: info — sem atestação quando pagador exige
- INCOMPLETE_PACKET: warning — itens obrigatórios faltantes
- HOURS_EXCEEDED: warning — horas > autorizadas

Flag critical NÃO pode ser waived sem review_notes.

### Sprint 4 — Perfis por Pagador

#### payer_requirement_profiles
```
id UUID PK
tenant_id UUID FK → tenants
payer_name TEXT
payer_code TEXT NULL
requires_geo BOOLEAN DEFAULT false
geo_level TEXT DEFAULT 'none' ('none','light','standard','strict')
requires_guardian_attestation BOOLEAN DEFAULT false
guardian_attestation_deadline_hours INTEGER DEFAULT 72
requires_photo BOOLEAN DEFAULT false
requires_attachment_per_guide BOOLEAN DEFAULT false
report_frequency_days INTEGER DEFAULT 90
report_template TEXT DEFAULT 'standard'
requires_team_roster BOOLEAN DEFAULT true
requires_prescription BOOLEAN DEFAULT true
requires_pei BOOLEAN DEFAULT false
requires_coverage_auth BOOLEAN DEFAULT false
cid_version TEXT DEFAULT 'CID-10' ('CID-10','CID-11','both')
max_file_size_mb INTEGER DEFAULT 10
accepted_formats TEXT[] DEFAULT '{pdf,jpg,png}'
checklist_items JSONB
notes TEXT NULL
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Segurança

### Criptografia
- pgcrypto com `pgp_sym_encrypt/decrypt`
- Chave: env var `AXIS_ENCRYPTION_KEY`
- Decrypt só no backend, nunca no cliente
- Colunas criptografadas: lat/long, IP, address, extracted_geo, canvas_data
- Colunas em claro (queries): confidence_status, distance, accuracy, site_type, radius, geo_level

### RBAC Institucional
- Terapeuta: vê status verde/amarelo/vermelho, seus dados próprios
- Supervisor: seus casos, flags dos seus casos, claim packets read-only
- Admin: tudo, decripta coordenadas, CRUD completo

### Acesso a dados sensíveis
Todo acesso a GPS, endereços e extracted_geo gera log em axis_audit_logs.

---

## Jobs Operacionais

| Job | Frequência | Ação |
|-----|-----------|------|
| purge_geo | Mensal | Anonimiza lat/long/IP com created_at > 2 anos |
| scan_integrity | Diário | Recalcula flags automáticas |
| check_expiration | Diário | Flags para conselhos/coberturas vencendo em <=30 dias |
| expire_attestations | Diário | Marca atestações expiradas |

Implementação: cron no VPS, scripts bash + SQL via docker exec, mesmo padrão do backup existente.

---

## LGPD

### Bases Legais
- Geolocalização/Foto: Consentimento específico (Art. 11, I) do responsável legal
- Compartilhamento com operadora: Tutela da saúde (Art. 11, II, f) + Consentimento — exige revisão jurídica
- Atestação responsável: Consentimento (Art. 7, I)
- Dados clínicos: Tutela da saúde (Art. 11, II, f)

### Retenção
- Geo/Fotos: 2 anos (auditoria) → purge automático
- Bundles/Atestações/Claim packets: 7 anos (CFM/CRP)
- Flags/Payer submissions: 5 anos (compliance)

### Minimização
- GPS: só lat/long/accuracy
- Fotos: só lat/long/timestamp do EXIF, EXIF bruto descartado
- Device: hash irreversível (integridade, não tracking)
- IP: anonimizar após 2 anos

Purge de geo NÃO invalida bundle_hash/packet_hash.

---

## Regras Duras v2.7.0

1. Sessão fechada NÃO pode ser editada
2. Ausência de GPS NÃO apaga sessão — gera exceção
3. Nenhum pagador altera motor clínico
4. Alteração de perfil de pagador é versionada
5. Anexo/foto não substitui hash do bundle
6. Dados de menores: APENAS o estritamente necessário
7. Bundle imutável — correção cria nova versão
8. Flag critical NÃO waived sem notas
9. Claim packet imutável após 'submitted'
10. Motor CSO-ABA NUNCA alterado para agradar operadora
11. EXIF bruto NUNCA armazenado
12. Compartilhamento com operadora EXIGE revisão jurídica
13. Acesso a GPS/endereços gera audit log
14. Geo e IP anonimizados após 2 anos

---

## Workflow de Exceção

### GPS falha
Terapeuta → dropdown motivo → exception em presence_proofs → bundle 'exception' → supervisor revisa

### Responsável não atesta
Email magic_link → deadline 72h → 'expired' → sessão NÃO bloqueia → bundle 'partial' + flag

### Anexo faltante
Bundle 'partial' + missing_items → alerta conformidade → upload tardio → nova versão bundle

Princípio: exceção documentada > sessão travada. SEMPRE.

---

## O que NÃO entra no v2.7.0

- Conector TISS completo
- Biometria facial
- Integração direta com portais
- Portal read-only para operadora
- Foto obrigatória como padrão
- ICP-Brasil como requisito (plugável)
- SMS/WhatsApp para atestação
- Antifraude geoespacial avançado
- EXIF bruto
- Alteração no motor CSO-ABA

---

## Roadmap

| Sprint | Estimativa | Entregas |
|--------|-----------|----------|
| 0 | 1-2 dias | Alinhar Bible, glossário, skill |
| 1 | 3-4 semanas | service_sites, presence_proofs, attestations, bundles, attachments |
| 2 | 3-4 semanas | coverage_profiles, claim_packets, provider_credentials, learner_therapists ext |
| 3 | 2 semanas | integrity_flags, painel conformidade, workflow exceção |
| 4 | 1 semana | payer_requirement_profiles, validação automática |
| 5 | 1-2 semanas | LGPD ampliada, CID-11 readiness, demo mode |
| **Total** | **10-14 semanas** | |

---

## Pricing

| Plano | Operadora Ready? |
|-------|-----------------|
| Free (1 aprendiz) | Não |
| Founders (50) | Básico (geo light + atestação terapeuta) |
| Clínica 100 | Completo (geo + atestação + claim packets) |
| Clínica 250 | Completo + integridade + dashboards institucionais |
