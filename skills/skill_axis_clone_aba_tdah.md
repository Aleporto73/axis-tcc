# SKILL — Clonar Estrutura do AXIS ABA para TDAH

## QUANDO USAR

Quando precisar criar componentes/páginas/APIs do módulo TDAH baseados no ABA existente.

---

## ARQUIVOS DE REFERÊNCIA (LER ANTES DE CRIAR)

### Hub Card
- `app/hub/page.tsx`

### Layout e Sidebar
- `app/aba/layout.tsx`
- `components/aba/SidebarABA.tsx`

### License Gate
- `app/aba/layout.tsx` (verificar product_type)

### APIs
- `app/api/aba/patients/route.ts`
- `app/api/aba/sessions/route.ts`

### Engine
- `src/engines/cso-aba.ts`

---

## TABELA DE CONVERSÃO ABA → TDAH

| ABA | TDAH |
|-----|------|
| `/app/aba/` | `/app/tdah/` |
| `SidebarABA` | `SidebarTDAH` |
| `aba_patients` | `tdah_patients` |
| `aba_sessions` | `tdah_sessions` |
| `product_type: 'aba'` | `product_type: 'tdah'` |
| Cor `#2563eb` | Cor `#0d7377` |
| `CSO-ABA` | `CSO-TDAH` |

---

## REGRAS IMUTÁVEIS

1. RLS com tenant_id sempre
2. License gate com product_type correto
3. Sidebar com ícones Lucide
4. Labels em PT-BR
5. Não quebrar isolamento entre módulos

---

## COMANDOS DE EXEMPLO

### Hub Card TDAH
> "Lê app/hub/page.tsx, encontra o card ABA, cria card TDAH abaixo com cor #0d7377, link /tdah, product_type 'tdah'"

### Layout TDAH
> "Lê app/aba/layout.tsx e cria app/tdah/layout.tsx com product_type 'tdah'"

### Sidebar TDAH
> "Lê components/aba/SidebarABA.tsx e cria components/tdah/SidebarTDAH.tsx com cor #0d7377"
