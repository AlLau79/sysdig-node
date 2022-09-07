const Prometheus = require('prom-client');
const express = require('express');
const http = require('http');

const prom_gc = require('prometheus-gc-stats');
prom_gc();

Prometheus.collectDefaultMetrics();

const requestHistogram = new Prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['code', 'handler', 'method'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
})

const counter = new Prometheus.Counter({
  name: 'custom_metric_counter',
  help: 'Increments the counter every time you visit a broke endpoint. Reset the counter by visiting /',
  aggregator: 'sum'
})


const requestTimer = (req, res, next) => {
  const path = new URL(req.url, `http://${req.hostname}`).pathname
  const stop = requestHistogram.startTimer({
    method: req.method,
    handler: path
  })
  res.on('finish', () => {
    stop({
      code: res.statusCode
    })
  })
  next()
}

const app = express();
const server = http.createServer(app)

// See: http://expressjs.com/en/4x/api.html#app.settings.table
const PRODUCTION = app.get('env') === 'production';

// Administrative routes are not timed or logged, but for non-admin routes, pino
// overhead is included in timing.
app.get('/ready', (req, res) => res.status(200).json({status:"ok"}));
app.get('/live', (req, res) => res.status(200).json({status:"ok"}));
app.get('/metrics', (req, res, next) => {
  res.set('Content-Type', Prometheus.register.contentType)
  res.end(Prometheus.register.metrics())
})

// Time routes after here.
app.use(requestTimer);

// Log routes after here.
const pino = require('pino')({
  level: PRODUCTION ? 'info' : 'debug',
});
app.use(require('pino-http')({logger: pino}));

app.get('/', (req, res) => {
  counter.reset();
  // Use req.log (a `pino` instance) to log JSON:
  req.log.info({message: 'Hello from Node.js Starter Application!'});
  res.send('Hello from Node.js Starter Application!');
});

// :client is the name , state is the game (1 for 'log in' 0 for 'log out')
app.get('/:state/:client', (req, res) => {
    const connected = new Prometheus.Gauge({
      name: `custom_${req.params.client}_status`,
      help: "keeps a 'boolean' value to track which 'clients' are connected to the service",
      labelNames: ['client', 'connected'],
    });

    if (state == 1){
      connected.labels(req.params.client, true);
    }
    else if (state == 0){
      connected.labels(req.params.client, false);
    }
    Prometheus.register.registerMetric(connected);
});

app.get('*', (req, res) => {
  counter.inc()
  res.status(404).send("Not Found");
});

// Listen and serve.
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`App started on PORT ${PORT}`);
});
