import ora from 'ora';
import spinners from 'cli-spinners';
import Duration from 'duration';
import readline from 'readline';

let startTime;

export const ASSET_URL = '/api/assets/';

/**
 * Wrapper method for starting a command line spinner
 * @param {string} text - initial text to display
 * @param {object|undefined} [logger] - active logger object
 * @return {*} - active spinner object
 */
export const startSpinner = (text, logger) => {
  if (logger) {
    startTime = new Date();
    logger.info(
      `Spinner start: ${startTime.toISOString().slice(0, 19).replace('T', ' ')}`
    );
  }
  return ora({
    text: text,
    spinner: spinners.random
  }).start();
};

/**
 * Wrapper method for ending a spinner with a success state.
 * @param {object} spinner - active spinner object
 * @param {object|undefined} [logger] - active logger object
 */
export const succeedSpinner = (spinner, logger) => {
  spinner.succeed();
  if (logger && startTime) {
    const endTime = new Date();

    const duration = new Duration(startTime, endTime).toString(1, 1);

    logger.info(
      `Spinner end: ${endTime.toISOString().slice(0, 19).replace('T', ' ')}`
    );
    logger.info(`Spinner duration: ${duration}`);
  }
};

/**
 * Command line interface factory
 * @return {Interface}
 */
export const newInterface = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return rl;
};

/**
 * Return object values in order specified by an array schema
 * @param {array}  arrSchema - array of object keys in the order that
 *   they should be returned
 * @param {object} obj - object containing the keys
 * @return {*[]} array of object values in the order of the schema
 */
export const orderedValues = (arrSchema, obj) => {
  const arrResult = [];
  for (let i = 0; i < arrSchema.length; i++) {
    arrResult[i] = obj[arrSchema[i]];
  }
  return arrResult;
};

/**
 * Does the text contain an asset link?
 * @param {string} text
 * @return {boolean}
 */
export const containsAssetLink = (text) => {
  return text.indexOf(ASSET_URL) !== -1;
};

/**
 * Extract the asset id from text that contains an asset url reference.
 * @param {string} text
 * @return {string|null}
 */
export const extractAssetId = (text) => {
  if (!containsAssetLink(text)) {
    return null;
  }

  const beginIndex = text.indexOf(ASSET_URL);
  const endIndex = text.indexOf('"', beginIndex + ASSET_URL.length);

  return text.substring(beginIndex + ASSET_URL.length, endIndex);
};

/**
 * Replace asset id from text that contains an asset url reference.
 * @param {string} text
 * @param {string|number} newId
 * @return {string|null}
 */
export const replaceAssetId = (text, newId) => {
  const oldAssetId = extractAssetId(text);
  if (oldAssetId === null) {
    return text;
  }

  text = text.replace(ASSET_URL + oldAssetId, ASSET_URL + newId);

  return text;
};
