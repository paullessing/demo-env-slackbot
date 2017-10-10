const https = require('https');
const crypto = require('crypto');
const config = require('./config/config');
const database = require('./database');

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
  const username = body.sender.login;
  const repo = body.repository.name;

  Promise.all([
    postToSlack(env, username, repo),
    database.markEnvironment(username, env, new Date())
  ])
    .then(() => {
      done(null, { statusCode: 204 });
    }, (err) => {
      done(null, { statusCode: 503, body: JSON.stringify(error) });
    });
}

function postToSlack(env, username, repository) {
  const data = JSON.stringify({
    channel: config.channel,
    username: config.username,
    text: `${username} is using *${env}*/${repository}`
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

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        data += chunk.toString();
      });
      res.on('end', function () {
        console.log('DATA');
        console.log(data);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(error);
      reject(error);
    });

    req.write(data);

    req.end();
  });
}

function getAllActiveEnvironments() {
  return database.getAllEnvironments()
    .then((envs) => envs
      .map((env) => Object.assign({}, env, { time: new Date(env.time) }))
      .filter((env) => {
        const time = env.time.getTime();
        const now = new Date().getTime();
        return now - time < 8 * 3600 * 1000; // More than 8 hours since deploy
      })
    );
}

function getAll(event, context, callback) {
  console.log('Fetching all data');
  getAllActiveEnvironments()
    .then((data) => {
      console.log('Data', data);
      callback(null, { statusCode: 200, body: JSON.stringify(data) });
    }, (error) => {
      callback(null, { statusCode: 500, body: JSON.stringify(error.toString()) });
    });
}

module.exports.post = postGithubPush;
module.exports.getAll = getAll;
