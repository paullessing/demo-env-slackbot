const querystring = require('querystring');
const environments = require('./environments');
const database = require('./database');
const slack = require('./slack');
const users = require('./users');

exports.handle = async function handle(event) {
  const query = querystring.parse(event.body);
  const command = query && query.text || '';
  const user = users.getCanonicalName(query.user_name);

  console.log('Attempting to handle command', command);

  const claimMatch = (/^claim (\w+)(?:\s+(\d+[hd]?))?/i).exec(command);
  if (claimMatch && environments.isValid(claimMatch[1])) {
    const env = claimMatch[1];

    let claimDurationHours = 8;

    if (claimMatch[2]) {
      const matchTime = (/^(\d+)(h|d)?$/i).exec(claimMatch[2]);
      if (matchTime) {
        claimDurationHours = parseInt(matchTime[1], 10) * (matchTime[2] === 'd' ? 24 : 1);
      }
    }

    await database.markEnvironment(user, env, new Date(), claimDurationHours);
    await slack.post(`${user} is using *${env}* for the next ${claimDurationHours} hours`);
    return { statusCode: 200 };
  }

  const releaseMatch = (/^free (\w+)/i).exec(command);
  if (releaseMatch && environments.isValid(releaseMatch[1])) {
    const env = releaseMatch[1];

    return database.markEnvironment(user, env, new Date(), 0)
      .then(() => slack.post(`${user} is no longer using *${env}*`))
      .then(() => ({ statusCode: 200 }));
  }

  const listMatch = (/^list($|\s)/i).exec(command);
  if (listMatch) {
    const now = new Date();
    function formatTime(time) {
      if (time.getDay() !== now.getDay() || time.getMonth() !== now.getMonth()) {
        return time.toLocaleString('en-GB', { weekday: 'short', timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: false });
      }
      return time.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: false });
    }

    return environments.getActive()
      .then((envs) => ({
        statusCode: 200,
        body: envs.length ?
          `Active environments:\n${envs.sort(sortEnvironments).map((env) => `*${env.environment}* (${users.getCanonicalName(env.username)} since ${formatTime(env.time)} for ${env.claimDurationHours}h)`).join('\n')}` :
          'Everything is free, take one!'
      }));
  }

  return Promise.resolve({
    statusCode: 200,
    body: '*How to use:*\n' +
    '`list`: Show active environments\n' +
    '`claim <env>`: Mark environment as _in use_\n' +
    '`free <env>`: Mark environment as no longer used\n' +
    '`help`: Show this help'
  });
};

function sortEnvironments(a, b) {
  return a.environment < b.environment ? -1 : a.environment > b.environment ? 1 : 0;
}
