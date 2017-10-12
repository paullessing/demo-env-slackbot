const database = require('./database');
const slack = require('./slack');
const github = require('./github');

function handleRequest(handler) {
  return function(event, context, callback) {
    return Promise.resolve()
      .then(() => handler(event))
      .then((result) => {
        if (result) {
          callback(null, { statusCode: 200, body: JSON.stringify(result) });
        } else {
          callback(null, { statusCode: 204 });
        }
      }).catch((e) => {
        if (e.statusCode) {
          callback(null, e);
        } else {
          console.log('Unhandled exeption:', e);
          callback(null, { statusCode: 500, body: JSON.stringify(e) });
        }
      });
  }
}

function onGithubPush(event) {
  return Promise.resolve()
    .then(() => github.getGithubPushData(event))
    .then((data) => Promise.all([
      slack.post(`${data.username} is using *${data.environment}*/${data.repository}`),
      database.markEnvironment(data.username, data.environment, new Date())
    ]))
    .then(() => null);
}

function getAllActiveEnvironments() {
  return Promise.resolve()
    .then(() => database.getAllEnvironments())
    .then((envs) => envs
      .map((env) => Object.assign({}, env, { time: new Date(env.time) }))
      .filter((env) => {
        const time = env.time.getTime();
        const now = new Date().getTime();
        return now - time < 8 * 3600 * 1000; // More than 8 hours since deploy
      })
    );
}

module.exports.post = handleRequest(onGithubPush);
module.exports.getAll = handleRequest(getAllActiveEnvironments);
