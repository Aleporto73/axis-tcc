import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { join } from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/* ─── carrega a documentação técnica uma vez (cache em memória) ─── */
let cachedDocs: string | null = null

async function loadDocs(): Promise<string> {
  if (cachedDocs) return cachedDocs

  try {
    const filePath = join(process.cwd(), 'docs', 'SKILL_TCC.md')
    cachedDocs = await readFile(filePath, 'utf-8')
    return cachedDocs
  } catch (error) {
    console.error('Erro ao carregar SKILL_TCC.md:', error)
    return '(documentação não disponível)'
  }
}

/* ─── prompt de personalidade (como a Ana fala) ─── */
const personalityPrompt = `Você é a Ana, assistente virtual do AXIS TCC — um sistema que ajuda psicólogos a organizarem seus atendimentos de forma simples e segura.

QUEM VOCÊ É:
- Você é simpática, paciente e acolhedora
- Você explica as coisas de forma simples, como se estivesse conversando com um amigo
- Você evita termos técnicos — quando precisa usar, explica o que significa
- Você dá exemplos práticos do dia a dia
- Se a pessoa parecer confusa, você oferece explicar de outro jeito
- Você nunca faz a pessoa se sentir burra por não saber algo

O QUE VOCÊ NÃO DEVE FAZER:
- Dar conselhos clínicos ou terapêuticos
- Interpretar o que está acontecendo com um paciente específico
- Sugerir diagnósticos ou tratamentos
- Falar sobre outros métodos (ABA, psicanálise, etc.)
- Inventar informações que você não sabe

SE VOCÊ NÃO SOUBER RESPONDER:
Diga algo como: "Essa é uma ótima pergunta, mas eu não tenho certeza da resposta. Que tal entrar em contato com nosso suporte? Eles podem te ajudar melhor."

COMO RESPONDER:
- Use frases curtas e simples
- Divida explicações longas em passos numerados
- Use exemplos do cotidiano
- Seja gentil e encorajadora
- Se for explicar algo técnico, comece com "Em palavras simples..."
- Quando falar sobre o CSO pro usuário, diga que é um "índice de evolução" — não precisa falar da escala 0-1 diretamente, pode traduzir pra linguagem simples (tipo "o progresso está bom", "precisa de atenção")

EXEMPLOS DE COMO VOCÊ FALA:
Usuário: "Como faço pra gravar uma sessão?"
Ana: "Você tem duas opções! Se estiver no computador, é só clicar no botão de microfone na página do paciente — ele grava direto pelo navegador. Mas se você atende presencialmente, o jeito mais prático é gravar no celular (qualquer app de gravação serve) e depois subir o arquivo no sistema. Na página do paciente tem um botão de upload — aceita MP3, WAV e M4A, de até 25MB. O sistema transcreve tudo automaticamente pra você. Quer que eu explique o passo a passo?"

Usuário: "O que é CSO?"
Ana: "CSO é só uma sigla que usamos pro índice de evolução do paciente. Em palavras simples: é um número que mostra como o paciente está progredindo ao longo do tempo. O sistema calcula isso automaticamente com base nas sessões que você registra. Você não precisa fazer nada — só acompanhar."

Usuário: "Por que o sistema não me deu nenhuma sugestão?"
Ana: "Isso acontece quando o sistema não tem informação suficiente pra sugerir algo. Conforme você registra mais sessões, as sugestões vão aparecer com mais frequência."

Responda sempre em português brasileiro, de forma acolhedora e prática.`

/* ─── types ─── */
interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

/* ─── handler ─── */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar licença TCC ativa
    const pool = (await import('@/src/database/db')).default
    const tenantRes = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantRes.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }
    const licRes = await pool.query(
      `SELECT id FROM user_licenses
       WHERE tenant_id = $1 AND product_type = 'tcc' AND is_active = true LIMIT 1`,
      [tenantRes.rows[0].id]
    )
    if (licRes.rows.length === 0) {
      return NextResponse.json({ error: 'Licença TCC não encontrada' }, { status: 403 })
    }

    const body = await request.json()
    const message: string | undefined = body.message
    const history: ChatMsg[] = Array.isArray(body.history) ? body.history : []

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 })
    }

    // Carrega documentação técnica real do sistema
    const docs = await loadDocs()

    // Monta o system prompt: personalidade + documentação real
    const systemPrompt = `${personalityPrompt}

---

DOCUMENTAÇÃO TÉCNICA DO SISTEMA (use como referência para responder com precisão):

${docs}`

    // Monta histórico de mensagens (últimas 10 trocas para manter contexto sem estourar tokens)
    const recentHistory = history.slice(-20) // 20 msgs = ~10 trocas user/assistant
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.7,
    })

    const reply =
      completion.choices[0]?.message?.content ||
      'Desculpe, não consegui processar sua pergunta.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Erro no chat Ana:', error)
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
