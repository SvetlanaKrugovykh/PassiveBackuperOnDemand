const Fastify = require('fastify')
const authPlugin = require('./src/plugins/authPlugin')

const app = Fastify({
  trustProxy: true,
  bodyLimit: 70 * 1024 * 1024 // 70 MB, allows 50MB chunks
})

app.register(authPlugin)
app.register(require('./src/routes/fileRoutes'))

module.exports = { app }