require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

async function registerWebhook() {
  // Busca a conexão
  const conn = await pool.query('SELECT * FROM calendar_connections LIMIT 1')
  if (conn.rows.length === 0) {
    console.log('Nenhuma conexão encontrada')
    return pool.end()
  }
  
  const { id, access_token } = conn.rows[0]
  const channelId = 'axis-' + Date.now()
  const webhookUrl = 'https://axisclinico.com/api/google/webhook'
  
  console.log('Registrando webhook...')
  console.log('Channel ID:', channelId)
  console.log('URL:', webhookUrl)
  
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/watch', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
    }),
  })
  
  const data = await response.json()
  console.log('Resposta Google:', data)
  
  if (data.resourceId) {
    await pool.query(
      'UPDATE calendar_connections SET webhook_channel_id = $1, webhook_resource_id = $2, webhook_expiration = $3 WHERE id = $4',
      [channelId, data.resourceId, new Date(parseInt(data.expiration)), id]
    )
    console.log('Webhook registrado com sucesso!')
  } else {
    console.log('Erro ao registrar webhook')
  }
  
  pool.end()
}

registerWebhook()
