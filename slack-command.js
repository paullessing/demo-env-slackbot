const querystring = require('querystring');
const environments = require('./environments');
const database = require('./database');
const slack = require('./slack');
const users = require('./users');

exports.handle = function handle(event) {
  const query = querystring.parse(event.body);
  const command = query && query.text || '';
  const user = users.getCanonicalName(query.user_name);

  const claimMatch = (/^claim (\w+)/i).exec(command);
  if (claimMatch && environments.isValid(claimMatch[1])) {
    const env = claimMatch[1];

    return database.markEnvironment(user, env, new Date())
      .then(() => slack.post(`*${user}* has claimed *${env}*!`))
      .then(() => ({ statusCode: 200 }));
  }

  const releaseMatch = (/^release (\w+)/i).exec(command);
  if (releaseMatch && environments.isValid(releaseMatch[1])) {
    const env = releaseMatch[1];

    return database.markEnvironment(user, env, null)
      .then(() => slack.post(`*${user}* has released *${env}*!`))
      .then(() => ({ statusCode: 200 }));
  }

  function formatTime(time) {
    let hours = time.getHours();
    const amPm = hours < 12 ? 'am' : 'pm';
    if (hours > 12) {
      hours -= 12;
    }
    const minutes = time.getMinutes() < 10 ? ('0' + time.getMinutes()) : time.getMinutes();
    return `${hours}:${minutes}${amPm}`;
  }

  return environments.getActive()
    .then((envs) => ({
      statusCode: 200,
      body: envs.length ?
        `Active environments: ${envs.sort(sortEnvironments).map((env) => `*${env.environment}* (${users.getCanonicalName(env.username)} since ${formatTime(env.time)})`).join(', ')}` :
        'Everything is free, take one!'
    }));
};

function sortEnvironments(a, b) {
  return a.environment < b.environment ? -1 : a.environment > b.environment ? 1 : 0;
}
