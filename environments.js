const database = require('./database');

const ENVIRONMENTS = exports.ENVIRONMENTS = Object.freeze([
  'amstel',
  'budvar',
  'corona',
  'doombar',
  'estrella',
  'fruli',
  'gambrinus',
  'holba',

  'staging',
  'demo'
]);

exports.isValid = function isValid(name) {
  return ENVIRONMENTS.indexOf((name || '').toLowerCase()) >= 0;
};

exports.getActive = function getActive() {
  const now = new Date().getTime();
  return Promise.resolve()
    .then(() => database.getAllEnvironments())
    .then((envs) => envs
      .map((env) => Object.assign({}, env, { time: new Date(env.time) }))
      .filter((env) => {
        const time = env.time.getTime();
        return now - time < env.claimDurationHours * 3600 * 1000; // More than n hours since deploy
      })
    );
};
