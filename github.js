const crypto = require('crypto');
const config = require('./config/config');

exports.getGithubPushData = async function verifyValidRequest(event) {
  await verifyHash(event.headers, event.body);

  if (event.body === 'isup') {
    return Promise.reject({ statusCode: 200, body: '"I am up"' });
  }

  const body = await parseBody(event.body);
  const environment = await getEnvironment(body.ref);

  const username = body.sender.login;
  const repository = body.repository.name;

  return {
    environment,
    username,
    repository
  }
};

function verifyHash(headers, body) {
  const actualHash = event && event.headers &&
    (event.headers['X-Hub-Signature'] || event.headers['x-hub-signature']) ||
    '';
  if (!actualHash) {
    console.log('Missing Hash');
    return Promise.reject({statusCode: 401, body: '"Not authenticated"'});
  }

  const shasum = crypto.createHmac('sha1', config.githubSecret);
  shasum.update(event.body || '');
  const expectedHash = 'sha1=' + shasum.digest('hex');

  if (expectedHash.length !== actualHash.length || !crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash))) {
    console.log(`Hash mismatch, expected: ${expectedHash}, actual: ${actualHash}`);
    return Promise.reject({statusCode: 401, body: '"Not authenticated"'});
  }

  return Promise.resolve();
}

function parseBody(rawBody) {
  if (!rawBody) {
    console.log('Missing body');
    return Promise.reject({ statusCode: 400, body: '"Malformed Request"' });
  }

  return Promise.resolve(() => {
    return JSON.parse(rawBody);
  })
  .catch((error) => {
    console.log('Failed to parse body');
    console.log(error)
    return Promise.reject({ statusCode: 400, body: '"Malformed Request"' });
  });
}

function getEnvironment(ref) {
  if (!ref) {
    return Promise.reject({ statusCode: 204 });
  }

  const branchRegex = /^refs\/heads\/demo-([^\/]+)$/i;
  const match = branchRegex.exec(body.ref);
  if (!match) {
    return Promise.reject({ statusCode: 204 });
  }

  return Promise.resolve(match[1]);
}
