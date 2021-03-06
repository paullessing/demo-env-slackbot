const github = require('./github');
const environments = require('./environments');
const slackCommand = require('./slack-command');

function handleRequest(handler) {
  return function(event, context, callback) {
    console.log('Handling request');
    return Promise.resolve()
      .then(() => handler(event))
      .then((result) => {
        console.log('Success', result);
        if (result && result.statusCode) {
          callback(null, result);
        } else if (result) {
          callback(null, { statusCode: 200, body: JSON.stringify(result) });
        } else {
          callback(null, { statusCode: 204 });
        }
      }).catch((e) => {
        console.log('Failure', e);
        if (e.statusCode) {
          callback(null, e);
        } else {
          console.log('Unhandled exeption:', e);
          callback(null, { statusCode: 500, body: JSON.stringify(e) });
        }
      });
  }
}

module.exports.post = handleRequest(github.onPush);
module.exports.getAll = handleRequest(environments.getActive);
module.exports.slackCommand = handleRequest(slackCommand.handle);
module.exports.autoclaim = handleRequest(environments.autoclaim);
