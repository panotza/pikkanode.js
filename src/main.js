const path = require('path')
const Koa = require('koa')
const koaBody = require('koa-body')
const serve = require('koa-static')
const session = require('koa-session')
const cors = require('@koa/cors')
const redis = require('redis')
const bluebird = require('bluebird')
const config = require('../config')

bluebird.promisifyAll(redis)
const redisClient = redis.createClient(config.redis)

const app = new Koa()

app.keys = ['supersecret']

const sessionConfig = {
  key: 'pikkanode:sess',
  maxAge: 1000 * 60 * 60 * 7,
  httpOnly: true,
  store: {
    async get (key, maxAge, { rolling }) {
      const sess = await redisClient.getAsync(key)
      return JSON.parse(sess)
    },
    async set (key, sess, maxAge, { rolling }) {
      await redisClient.setAsync(key, JSON.stringify(sess))
    },
    async destroy (key) {
      await redisClient.delAsync(key)
    }
  }
}

const stripPrefix = async (ctx, next) => {
  if (!ctx.path.startsWith('/-')) {
    ctx.status = 404
    return
  }

  ctx.path = ctx.path.slice(2)
  await next()
}

// throwAppError checks app error and return error message to client
app.context.throwAppError = function (err) {
  if (err && err.name === 'AppError') {
    this.status = err.status
    this.body = { error: err.message }
    return
  }
  console.error(err.message)
  this.throw()
}

const handleError = async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.throwAppError(err)
  }
}

app
  .use(cors({ credentials: true }))
  .use(session(sessionConfig, app))
  .use(koaBody({ multipart: true }))
  .use(handleError)
  .use(require('./route'))

  .use(stripPrefix)
  .use(serve(path.join(process.cwd(), 'public')))
  .listen(8080)

const health = new Koa()
health.use(ctx => {
  if (ctx.path === '/healthz') {
    ctx.body = {}
    return
  }
  ctx.status = 500
})
health.listen(18080)

const shutdownEvents = ['SIGINT', 'SIGQUIT', 'SIGTERM', 'SIGHUP', 'SIGSTP']
shutdownEvents.forEach(event => process.on(event, shutdown))
function shutdown (code) {
  redisClient.quit()
  console.log('[!] Shutdown:', code)
  process.exit()
}
