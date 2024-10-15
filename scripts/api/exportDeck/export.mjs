import {promises as fspromises} from 'fs';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import {runWrapper} from '../../common/executeWrapper.mjs';
import {ExportClass} from './exportClass.mjs';
import * as utils from '../../common/utils.mjs';

// Primary key object ids should not be prefaced with anything.
// Foreign key object ids should be as follows:
// & (ampersand) is for absolute ids for objects that already exist _in the
//   target db (like user ids). These are ids that correlate to object ids in
//   the database.
// _ (underscore) is for relative ids for objects that are being exported.
//   (like card ids). These are ids that correlate to object ids in the import
//   data. We may still use the ids from the source db to make things easier,
//   but we don't expect these ids to match with ids in the target db.

let spinner;

/**
 * Callback entry point
 * @param {object} params
 * @return {Promise<void>}
 */
const callback = async (params) => {
  const {logger, dataPath} = params;

  spinner = utils.startSpinner('Exporting deck', logger);

  if (!fs.existsSync(dataPath)) {
    // Create the directory
    logger.verbose(`Creating directory ${dataPath}`);
    await fspromises.mkdir(dataPath);
  }

  params.spinner = spinner;

  const exportInstance = new ExportClass(params);

  await exportInstance.getDeck();

  // fs.existsSync is synchronous
  if (!fs.existsSync(exportInstance.deckPath)) {
    // Create the directory
    logger.verbose(`Creating directory ${exportInstance.deckPath}`);
    await fspromises.mkdir(exportInstance.deckPath);
  } else {
    // Empty the directory
    logger.verbose(`Emptying directory ${exportInstance.deckPath}`);

    const files = await fspromises.readdir(exportInstance.deckPath);
    for (let i = 0; i < files.length; i++) {
      await fspromises.rm(`${exportInstance.deckPath + path.sep}${files[i]}`);
    }
  }

  if (
    !params.args.responses ||
    (params.args.responses &&
      _.isString(params.args.responses) &&
      params.args.responses.toUpperCase() !== 'ONLY')
  ) {
    await exportInstance.exportDeck();
  }
  if (
    params.args.responses &&
    _.isString(params.args.responses) &&
    params.args.responses.toUpperCase() !== 'NONE' &&
    params.args.responses.toUpperCase() !== 'FALSE'
  ) {
    exportInstance.spinner = utils.startSpinner('Exporting responses', logger);
    await exportInstance.exportResponses(params);
    exportInstance.spinner.succeed();
  }

  logger.info('Export of deck id ' + exportInstance.deck.id + ' complete');
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
