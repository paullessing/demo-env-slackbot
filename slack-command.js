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

  const listMatch = (/^list\s?(.*)$/i).exec(command);
  if (listMatch) {
    const args = listMatch[1] ? listMatch[1].split(/\s+/g) : [];
    const showAll = args.indexOf('all') >= 0 || args.indexOf('--all') >= 0;

    const now = new Date();
    function formatTime(time) {
      if (time.getDay() !== now.getDay() || time.getMonth() !== now.getMonth()) {
        return time.toLocaleString('en-GB', { weekday: 'short', timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: false });
      }
      return time.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: false });
    }

    const formatHours = (hours) => {
      if (hours < 24) {
        return `${hours}h`;
      } else {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        if (remainingHours === 0) {
          return `${days}d`;
        } else {
          return `${days}d ${remainingHours}h`;
        }
      }
    };

    const formatActiveEnvironment = (env) =>
      `:wrench: *${env.environment}* (_${users.getCanonicalName(env.username)}_ since ${formatTime(env.time)} for ${formatHours(env.claimDurationHours)})`;
    const formatInactiveEnvironment = (env) =>
      `:heavy_check_mark: *${env}* - _free_`;

    return environments.getActive()
      .then((envs) => {
        if (envs.length || showAll) {
          const body = `${showAll ? 'Available' : 'Active'} environments:\n${environments.ENVIRONMENTS.map((env) => {
            const active = envs.find((activeEnv) => activeEnv.environment === env);
            if (active) {
              return formatActiveEnvironment(active);
            } else if (showAll) {
              return formatInactiveEnvironment(env);
            } else {
              return null;
            }
          }).filter(x => !!x).join('\n')}`;
          return {
            statusCode: 200,
            body
          };
        } else {
          return {
            statusCode: 200,
            body: 'Everything is free, take one!'
          }
        }
      });
  }

  return Promise.resolve({
    statusCode: 200,
    body: '*How to use:*\n' +
    '`list [all]`: Show active environments\n' +
    '`claim <env>`: Mark environment as _in use_\n' +
    '`free <env>`: Mark environment as no longer used\n' +
    '`help`: Show this help'
  });
};

function sortEnvironments(a, b) {
  return a.environment < b.environment ? -1 : a.environment > b.environment ? 1 : 0;
}
