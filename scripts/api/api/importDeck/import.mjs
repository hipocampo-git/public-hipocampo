import {promises as fsPromises} from 'fs';
import path from 'path';
import _ from 'lodash';
import {runWrapper} from '../../common/executeWrapper.mjs';
import {ImportClass} from './importClass.mjs';
import * as utils from '../../common/utils.mjs';

// & is for absolute ids for objects that already exist (like user ids)
// _ is for relative ids for objects that are being imported (like card ids)

let spinner;

/**
 * Callback entry point
 * @param {object} params
 * @return {Promise<void>}
 */
const callback = async (params) => {
  const {logger} = params;

  spinner = utils.startSpinner('', logger);
  params.spinner = spinner;

  params.fileData = await fsPromises.readFile(
    `${params.deckPath + path.sep}metadata.json5`
  );

  const importInstance = new ImportClass(params);

  // TODO: 'ONLY' option is still a WIP.
  if (
    !params.args.responses ||
    (params.args.responses &&
      _.isString(params.args.responses) &&
      params.args.responses.toUpperCase() !== 'ONLY')
  ) {
    await importInstance.importDeck();
    logger.info('Import of deck id ' + importInstance.newDeckId + ' complete');
  }

  if (
    params.args.responses &&
    _.isString(params.args.responses) &&
    params.args.responses.toUpperCase() !== 'NONE' &&
    params.args.responses.toUpperCase() !== 'FALSE'
  ) {
    const responseFileData = await fsPromises.readFile(
      `${params.deckPath + path.sep}responses.json5`
    );

    importInstance.spinner.text = 'Importing responses';
    await importInstance.importResponses(responseFileData);
    importInstance.spinner.succeed(
      'Import of study sessions and responses complete'
    );
  }
};

try {
  await runWrapper(callback);
} catch (error) {
  if (spinner) {
    // Don't pass an argument to fail() so that we persist the prior message.
    spinner.fail();
  }
  console.error(error.message);
  console.error(error.stack);
  process.exitCode = 1;
}
