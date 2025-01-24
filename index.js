const Fastify = require('fastify')
const authPlugin = require('./src/plugins/authPlugin')

const app = Fastify({
  trustProxy: true,
})

app.register(authPlugin)
app.register(require('./src/routes/fileRoutes'))

module.exports = { app }