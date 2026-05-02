import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testOpenAI() {
  console.log('🧪 Testando conexão com OpenAI...\n');
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente útil.'
        },
        {
          role: 'user',
          content: 'Responda apenas com: OK, conexão funcionando!'
        }
      ],
      max_tokens: 20
    });
    
    console.log('✅ Resposta da OpenAI:', response.choices[0].message.content);
    console.log('💰 Tokens usados:', response.usage?.total_tokens);
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
  
  process.exit(0);
}

testOpenAI();
