// Utility to send Telegram messages
const axios = require('axios')

async function sendTelegramMessage(message, botToken, chatId) {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
  try {
    await axios.post(apiUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  } catch (e) {
    // Optionally log error
    console.error('Failed to send Telegram message:', e.message)
  }
}

module.exports = sendTelegramMessage
