const { spawnSync } = require('child_process');

const { pathExistsSync, removeSync, readdirSync } = require('fs-extra');
const tape = require('tape');
const { GlobSync } = require('glob');

const { getUserCachePath } = require('./lib/shared');

const initialWorkingDir = process.cwd();

const mkCommand = cmd => (args, options = {}) => {
  const {error, stdout, stderr, status} = spawnSync(cmd, args, {
    env: {
      ...process.env,
      SLS_DEBUG: 't',
      ...(process.env.CI ? { LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' } : {}),
    },
    ...options
  });
  if (error)
    throw error;
  if (status)
    throw new Error(`${cmd} failed with status code ${status} and stderr: ${stderr}`)
  return stdout && stdout.toString().trim();
};
const sls = mkCommand('sls');
const git = mkCommand('git');
const npm = mkCommand('npm');
const unzip = mkCommand('unzip');

const setup = () => {
  removeSync(getUserCachePath());
};

teardown = () => {
  [
    'puck',
    'puck2',
    'puck3',
    'node_modules',
    '.serverless',
    '.requirements.zip',
    '.requirements-cache',
    'foobar',
    'package-lock.json',
    'slimPatterns.yml',
    'serverless.yml.bak',
    getUserCachePath(),
    ...GlobSync('serverless-python-requirements-*.tgz').found,
  ].map(path => removeSync(path));
  git(['checkout', 'serverless.yml']);
  process.chdir(initialWorkingDir);
  removeSync('tests/base with a space');
};

const test = (desc, func) =>
  tape.test(desc, t => {
    setup();
    try {
      func(t);
    } finally {
      teardown();
    }
  });


test('py3.6 can package flask with default options', t => {
  process.chdir('tests/base');
  const path = npm(['pack', '../..'])
  npm(['i', path]);
  sls(['package']);
  unzip(['.serverless/sls-py-req-test.zip', '-d', 'puck']);
  const files = readdirSync('puck');
  t.true(files.includes('flask'), 'flask is packaged');
  t.end();
});

test('py3.6 can package flask with zip option', t => {
  process.chdir('tests/base');
  const path = npm(['pack', '../..'])
  npm(['i', path]);
  sls(['--zip=true', 'package']);
  unzip(['.serverless/sls-py-req-test.zip', '-d', 'puck']);
  const files = readdirSync('puck');
  t.true(files.includes('.requirements.zip'), 'zipped requirements are packaged');
  t.true(files.includes('unzip_requirements.py'), 'unzip util is packaged');
  t.false(files.includes('flask'), "flask isn't packaged on its own");
  t.end();
});
