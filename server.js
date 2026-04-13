const https = require('https');
const fs = require('fs');
const { parse } = require('url');
const next = require('next');

const dev = true;
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem'),
};

app
  .prepare()
  .then(() => {
    https
      .createServer(httpsOptions, (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      })
      .listen(port, hostname, () => {
        console.log(`> Ready on https://${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error('Failed to start HTTPS server:', error);
    process.exit(1);
  });