const environments = require('environments');

exports.handle = function handle(event) {
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
        `Active environments: ${envs.map((env) => `*${env.environment}* (${env.username} since ${formatTime(env.time)})`).join(', ')}` :
        'Everything is free, take one!'
    }));
};
