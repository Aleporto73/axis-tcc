import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'Arquivo de áudio obrigatório' }, { status: 400 })
    }

    // Transcrição com Whisper - otimizado para áudios curtos (2-5 min)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
      prompt: 'Transcrição de resumo clínico feito por psicólogo. Termos técnicos: TCC, cognição, comportamento, emoção, ansiedade, depressão, TDAH, trauma, intervenção, psicoterapia.',
    })

    return NextResponse.json({
      success: true,
      text: transcription
    })
  } catch (error) {
    console.error('Erro ao transcrever áudio:', error)
    return NextResponse.json({ error: 'Erro ao transcrever áudio' }, { status: 500 })
  }
}
