const crypto = require('crypto');
const config = require('./config/config');
const slack = require('./slack');
const users = require('./users');
const database = require('./database');

exports.onPush = async function onPush(event) {
  const data = await getGithubPushData(event);
  const current = await database.getEnvironment(data.environment);
  let claimDurationHours = current && current.claimDurationHours || 8;
  if (current && (current.time.getTime() + current.claimDurationHours * 3600 * 1000 < new Date().getTime())) {
    claimDurationHours = 8;
  }
  await Promise.all([
    slack.post(`${users.getCanonicalName(data.username)} is using *${data.environment}*/${data.repository}`),
    database.markEnvironment(users.getCanonicalName(data.username), data.environment, new Date(), claimDurationHours)
  ]);
  return null;
};

function getGithubPushData(event) {
  return Promise.resolve()
    .then(() => verifyHash(event.headers, event.body))
    .then(() => {
      if (event.body === 'isup') {
        return Promise.reject({ statusCode: 200, body: '"I am up"' });
      }
    })
    .then(() => parseBody(event.body))
    .then((body) => {
      console.log('Body', body);
      return getEnvironment(body.ref)
        .then((environment) => {
          const username = body.sender.login;
          const repository = body.repository.name;
          return {
            environment,
            username,
            repository
          }
        });
    });
};

function verifyHash(headers, body) {
  const actualHash = headers &&
    (headers['X-Hub-Signature'] || headers['x-hub-signature']) ||
    '';
  if (!actualHash) {
    console.log('Missing Hash');
    return Promise.reject({statusCode: 401, body: '"Not authenticated"'});
  }

  const shasum = crypto.createHmac('sha1', config.githubSecret);
  shasum.update(body || '');
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

  return Promise.resolve().then(() =>
    JSON.parse(rawBody)
  )
  .catch((error) => {
    console.log('Failed to parse body');
    console.log(error);
    return Promise.reject({ statusCode: 400, body: '"Malformed Request"' });
  });
}

function getEnvironment(ref) {
  if (!ref) {
    return Promise.reject({ statusCode: 204 });
  }

  const branchRegex = /^refs\/heads\/demo-([^\/]+)$/i;
  const match = branchRegex.exec(ref);
  if (!match) {
    console.log('Ignoring non-matching environment ' + ref);
    return Promise.reject({ statusCode: 204 });
  }

  return Promise.resolve(match[1]);
}
