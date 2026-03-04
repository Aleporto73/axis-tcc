import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function extractTCCElements(transcription: string) {
  console.log('🧠 Analisando transcrição para extrair elementos TCC...');
  
  const prompt = `Você é um assistente especializado em Terapia Cognitivo-Comportamental (TCC).

Analise o texto da sessão abaixo e extraia:

1. FATOS: Situações concretas, eventos objetivos mencionados pelo paciente
2. PENSAMENTOS: Pensamentos automáticos, crenças, interpretações do paciente
3. EMOÇÕES: Sentimentos e emoções expressas pelo paciente

Retorne APENAS um JSON válido no seguinte formato:
{
  "fatos": ["fato 1", "fato 2"],
  "pensamentos": ["pensamento 1", "pensamento 2"],
  "emocoes": ["emoção 1", "emoção 2"]
}

TEXTO DA SESSÃO:
${transcription}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente especializado em análise de sessões de TCC.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const content = response.choices[0].message.content || '{}';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleanContent);
    
    console.log('✅ Extração concluída!');
    console.log('   - Fatos:', extracted.fatos?.length || 0);
    console.log('   - Pensamentos:', extracted.pensamentos?.length || 0);
    console.log('   - Emoções:', extracted.emocoes?.length || 0);
    console.log('💰 Tokens:', response.usage?.total_tokens);
    
    return extracted;
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    return null;
  }
}
