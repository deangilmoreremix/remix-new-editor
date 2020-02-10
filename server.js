
const dev = process.env.NODE_ENV !== 'production';

const express = require('express');
const compression = require('compression');
const next = require('next');
const mobxReact = require('mobx-react');
const { port, forceSsl, nakedRun } = require('./config/config');

const app = next({ dev });
const handle = app.getRequestHandler();

// const checkAccess = require('./lib/express/check-access');
const { processForm, isValidMedia, mediaUpload } = require('./lib/express/media-upload');
// const { join } = require('./lib/express/video-processing');
const getContentType = require('./lib/express/get-content-type');

mobxReact.useStaticRendering(true);

app.prepare().then(() => {
  const server = express();
  server.use(compression());
  server.use((req, res, callback) => {
    const schema = req.headers['x-forwarded-proto'] || req.protocol;
    if (schema !== 'https' && forceSsl) {
      // Redirect to https.
      res.redirect(`https://${req.headers.host}${req.url}`);
    } else {
      callback();
    }
  });
  // todo implement auth
  // require('./lib/express/webmaker-auth')(server);
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true }));
  // server.post('/api/media/join', join);
  // server.put('/api/media', processForm, isValidMedia, mediaUpload);
  server.get('/api/get-content-type', getContentType);

  if (!nakedRun) {
    server.get('/_next/*', (req, res) => {
      handle(req, res);
    });
    // todo implement auth
    // server.get('*', checkAccess, (req, res) => {
    //   handle(req, res);
    // });
    server.get('*', (req, res) => {
      handle(req, res);
    });
  }
  server.listen(port);
  console.log(`> Ready on http://localhost:${port}`);
});
