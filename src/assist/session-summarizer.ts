import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateSessionSummary(transcription: string) {
  console.log('📝 Gerando resumo da sessão...');
  
  const prompt = `Você é um assistente especializado em Terapia Cognitivo-Comportamental (TCC).

Analise a transcrição da sessão abaixo e gere um resumo estruturado para o prontuário do paciente.

O resumo deve conter:
1. TEMA PRINCIPAL: Qual foi o foco principal da sessão
2. QUESTÕES TRABALHADAS: Problemas ou situações discutidas
3. TÉCNICAS UTILIZADAS: Intervenções TCC aplicadas (se houver)
4. PROGRESSOS OBSERVADOS: Avanços do paciente
5. PONTOS DE ATENÇÃO: Aspectos que requerem acompanhamento
6. TAREFA DE CASA: Atividades combinadas (se houver)

Retorne APENAS um JSON válido no seguinte formato:
{
  "tema_principal": "string",
  "questoes_trabalhadas": ["item 1", "item 2"],
  "tecnicas_utilizadas": ["técnica 1", "técnica 2"],
  "progressos": ["progresso 1", "progresso 2"],
  "pontos_atencao": ["ponto 1", "ponto 2"],
  "tarefa_casa": "descrição da tarefa ou null"
}

TRANSCRIÇÃO:
${transcription}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente clínico especializado em TCC.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 1500
    });
    
    const content = response.choices[0].message.content || '{}';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const summary = JSON.parse(cleanContent);
    
    console.log('✅ Resumo gerado com sucesso!');
    console.log('💰 Tokens:', response.usage?.total_tokens);
    
    return summary;
  } catch (error: any) {
    console.error('❌ Erro ao gerar resumo:', error.message);
    return null;
  }
}
