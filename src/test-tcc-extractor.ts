import { extractTCCElements } from './assist/tcc-extractor';

async function testTCCExtractor() {
  console.log('🧪 Testando Extrator TCC...\n');
  
  const transcriptionExample = `
Paciente: Essa semana foi muito difícil. Na segunda-feira tive uma reunião importante no trabalho e fiquei muito nervoso.

Terapeuta: O que você estava pensando antes da reunião?

Paciente: Eu pensava que ia falar besteira na frente de todo mundo, que iam me julgar e achar que eu sou incompetente. Senti muito medo e ansiedade.

Terapeuta: E o que de fato aconteceu na reunião?

Paciente: Na verdade correu bem. Consegui apresentar meu relatório e as pessoas fizeram algumas perguntas, mas nada muito complicado. Mas mesmo assim fiquei me sentindo um impostor o tempo todo.

Terapeuta: Interessante. E como você se sentiu depois?

Paciente: Aliviado, mas também confuso. Porque eu construí um cenário catastrófico na minha cabeça que não aconteceu.
  `;
  
  const result = await extractTCCElements(transcriptionExample);
  
  if (result) {
    console.log('\n📊 RESULTADO DA EXTRAÇÃO:');
    console.log('\n🔹 FATOS:');
    result.fatos?.forEach((fato: string, i: number) => console.log(`   ${i + 1}. ${fato}`));
    
    console.log('\n💭 PENSAMENTOS:');
    result.pensamentos?.forEach((pensamento: string, i: number) => console.log(`   ${i + 1}. ${pensamento}`));
    
    console.log('\n❤️  EMOÇÕES:');
    result.emocoes?.forEach((emocao: string, i: number) => console.log(`   ${i + 1}. ${emocao}`));
  }
  
  process.exit(0);
}

testTCCExtractor();
