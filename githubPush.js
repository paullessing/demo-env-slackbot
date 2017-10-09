const https = require('https');
const crypto = require('crypto');
const config = require('./config/config');

function postGithubPush(event, context, callback) {
  const actualHash = event && event.headers &&
    (event.headers['X-Hub-Signature'] || event.headers['x-hub-signature']) ||
    '';
  if (!actualHash) {
    console.log('Missing Hash');
    callback(null, { statusCode: 401, body: '"Not authenticated"' });
    return;
  }

  const shasum = crypto.createHmac('sha1', config.githubSecret);
  shasum.update(event.body || '');
  const expectedHash = 'sha1=' + shasum.digest('hex');

  if (expectedHash.length !== actualHash.length || !crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash))) {
    console.log(`Hash mismatch, expected: ${expectedHash}, actual: ${actualHash}`);
    callback(null, { statusCode: 401, body: '"Not authenticated"' });
    return;
  }

  if (event.body === 'isup') {
    callback(null, { statusCode: 200, body: '"I am up"' });
    return;
  }

  let body, error;

  try {
    body = JSON.parse(event.body);
  } catch (e) {
    error = e;
    body = null;
  }

  if (!body) {
    console.log('Failed to parse body');
    if (error) {
      console.log(error)
    }
    callback(null, { statusCode: 400, body: '"Malformed Request"' });
    return;
  }

  if (!body.ref) {
    callback(null, { statusCode: 204 });
    return;
  }

  const branchRegex = /^refs\/heads\/demo-([^\/]+)$/i;
  const match = branchRegex.exec(body.ref);
  if (!match) {
    callback(null, { statusCode: 204 });
    return;
  }
  const env = match[1];

  const data = JSON.stringify({
    channel: config.channel,
    username: config.username,
    text: `${body.sender.login} is using *${env}*/${body.repository.name}`
  });

  const options = {
    host: 'hooks.slack.com',
    port: 443,
    path: config.slackUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  console.log('Making request', options);

  const req = https.request(options, (res) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      data += chunk.toString();
    });
    res.on('end', function () {
      console.log('DATA');
      console.log(data);
      callback(null, { statusCode: 204 });
    });
  });

  req.on('error', (error) => {
    console.error(error);
    callback(null, { statusCode: 503, body: JSON.stringify(error) });
  });

  req.write(data);

  req.end();
}

module.exports.post = postGithubPush;
