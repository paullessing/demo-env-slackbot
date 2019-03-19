const database = require('./database');

const DEMO_ENVIRONMENTS = [
  'amstel',
  'budvar',
  'corona',
  'doombar',
  'estrella',
  'fruli',
  'gambrinus',
  'holba',
];

const ENVIRONMENTS = Object.freeze([
  ...DEMO_ENVIRONMENTS,

  'staging',
  'demo'
]);

function isValid(name) {
  return ENVIRONMENTS.indexOf((name || '').toLowerCase()) >= 0;
}

function getActive() {
  const now = new Date().getTime();
  return Promise.resolve()
    .then(() => database.getAllEnvironments())
    .then((envs) => envs
      .map((env) => ({
        ...env,
        time: new Date(env.time),
      }))
      .filter((env) => {
        const time = env.time.getTime();
        return now - time < env.claimDurationHours * 3600 * 1000; // More than n hours since deploy
      })
    );
}

async function autoclaim(event) {
  try {
    const query = JSON.parse(event.body);
    const user = query.user;
    if (!user) {
      throw new Error('No user supplied');
    }

    const activeEnvironments = (await getActive()).map((env) => env.environment);

    for (const envName of DEMO_ENVIRONMENTS) {
      if (activeEnvironments.indexOf(envName) < 0) {
        await database.markEnvironment(user, envName, new Date(), 8);
        return { statuscode: 200, body: envName, headers: { 'Content-Type': 'application/text' } };
      }
    }

    return { statuscode: 409 };
  } catch (e) {
    console.log(e);
    return { statuscode: 400, body: '' };
  }
}

module.exports = {
  ENVIRONMENTS,
  isValid,
  getActive,
  autoclaim,
};
