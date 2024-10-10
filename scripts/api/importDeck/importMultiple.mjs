// import {promises as fsPromises} from 'fs';
// import path from 'path';
// import _ from 'lodash';
// import {runWrapper} from '../../common/executeWrapper.mjs';
// import {ImportClass} from './importClass.mjs';
import * as utils from '../../common/utils.mjs';
import {spawn} from 'child_process';

// & is for absolute ids for objects that already exist (like user ids)
// _ is for relative ids for objects that are being imported (like card ids)

let spinner;

/**
 * Callback entry point
 * @param {object} params
 * @return {Promise<void>}
 */
const callback = async (params = {}) => {
  // const {logger} = params;

  spinner = utils.startSpinner('');
  params.spinner = spinner;


  const commonSettings = {
    oldDeckId: 'SpanishTest',
    testAuto: 'TEMP',
    renameConflict: false,
    deleteConflict: false,
  };


  const processSettings = [
    {
      environment: 'localhost',
      user: 'test_admin',
      password: 'Test1234',
      host: 'localhost',
      port: 4000,
      protocol: 'http',
    },
    {
      environment: 'test',
      user: 'test_admin',
      password: 'Buster22!',
      host: 'hipocampo-test.herokuapp.com',
      port: 'none',
      protocol: 'https',
    }

  ];



  // const commands = [
  //   'node scripts/api/importDeck/import.mjs -p scripts/api --oldDeckId 129318 --user test_admin --password Test1234 --host localhost --port 4000 --protocol http --testAuto NONE',
  //   'node scripts/api/importDeck/import.mjs -p scripts/api --oldDeckId 131196 --user test_admin --password Test1234 --host hipocampo-pr-779.herokuapp.com --port none --protocol https --testAuto NONE',
  //   // 'node scripts/api/importDeck/import.mjs -p scripts/api --user hipocampo1 --password Buster22! --host www.hipocampo.com --oldDeckId "English Vocab Tutorial" --port none --protocol https --testAuto NONE',
  //   // 'node scripts/api/importDeck/import.mjs -p scripts/api --user test_admin --password Test1234 --host localhost --oldDeckId "English Vocab Tutorial" --port 4000 --protocol http --testAuto PERM',
  //   // 'node scripts/api/importDeck/import.mjs -p scripts/api --user hipocampo1 --password Test1234 --host localhost --oldDeckId "Periodic Table" --port 4000 --protocol http --testAuto NONE --renameConflict'
  // ];

  const commands = processSettings.map((settings) => {
    return `node scripts/api/importDeck/import.mjs -p scripts/api --oldDeckId ${commonSettings.oldDeckId} --user ${settings.user} --password ${settings.password} --host ${settings.host} --port ${settings.port} --protocol ${settings.protocol} --deleteConflict --testAuto ${commonSettings.testAuto} --logDir ${settings.environment}`;});


  processSettings.forEach((process, index) => {
    const child = spawn(commands[index],
      { shell: true });

    child.stdout.on('data', (data) => {
      console.log(`${process.environment}: stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`${process.environment}: stderr: ${data}`);
    });

    child.on('close', (code) => {
      console.log(`${process.environment}: 
      child process exited with code ${code}`);
    });
  });




  spinner.succeed(
    'Import of study sessions and responses complete'
  );

};

try {
  await callback();
} catch (error) {
  if (spinner) {
    // Don't pass an argument to fail() so that we persist the prior message.
    spinner.fail();
  }
  console.error(error.message);
  console.error(error.stack);
  process.exitCode = 1;
}
