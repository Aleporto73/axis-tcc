import { generateSessionSummary } from './assist/session-summarizer';

async function testSummarizer() {
  console.log('🧪 Testando Gerador de Resumo...\n');
  
  const transcription = `
Paciente: Essa semana foi muito difícil. Na segunda-feira tive uma reunião importante no trabalho e fiquei muito nervoso.

Terapeuta: O que você estava pensando antes da reunião?

Paciente: Eu pensava que ia falar besteira na frente de todo mundo, que iam me julgar e achar que eu sou incompetente. Senti muito medo e ansiedade.

Terapeuta: E o que de fato aconteceu na reunião?

Paciente: Na verdade correu bem. Consegui apresentar meu relatório e as pessoas fizeram algumas perguntas, mas nada muito complicado. Mas mesmo assim fiquei me sentindo um impostor o tempo todo.

Terapeuta: Vejo aqui que você teve um pensamento automático antes da reunião. Vamos trabalhar isso. Qual evidência você tinha de que ia falar besteira?

Paciente: Na verdade... nenhuma. Eu já apresentei outros relatórios antes e sempre correu bem.

Terapeuta: Exatamente. Esse é um padrão que vamos observar. Para a próxima semana, quero que você anote situações onde surgir esse tipo de pensamento catastrófico e busque evidências concretas a favor e contra.

Paciente: Ok, vou fazer isso.
  `;
  
  const summary = await generateSessionSummary(transcription);
  
  if (summary) {
    console.log('\n📋 RESUMO DA SESSÃO:\n');
    console.log('🎯 TEMA PRINCIPAL:', summary.tema_principal);
    console.log('\n📌 QUESTÕES TRABALHADAS:');
    summary.questoes_trabalhadas?.forEach((q: string, i: number) => 
      console.log(`   ${i + 1}. ${q}`)
    );
    console.log('\n🔧 TÉCNICAS UTILIZADAS:');
    summary.tecnicas_utilizadas?.forEach((t: string, i: number) => 
      console.log(`   ${i + 1}. ${t}`)
    );
    console.log('\n✅ PROGRESSOS:');
    summary.progressos?.forEach((p: string, i: number) => 
      console.log(`   ${i + 1}. ${p}`)
    );
    console.log('\n⚠️  PONTOS DE ATENÇÃO:');
    summary.pontos_atencao?.forEach((p: string, i: number) => 
      console.log(`   ${i + 1}. ${p}`)
    );
    console.log('\n📝 TAREFA DE CASA:', summary.tarefa_casa || 'Nenhuma');
  }
  
  process.exit(0);
}

testSummarizer();
