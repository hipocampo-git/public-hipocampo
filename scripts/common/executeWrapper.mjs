import {ArgumentParser} from 'argparse';
import dotenv from 'dotenv';
import axios from 'axios';
import setCookie from 'set-cookie-parser';
import path from 'path';
import initLogs from './logger.js';
import {getGlobals} from 'common-es';
const {__dirname} = getGlobals(import.meta.url);

/**
 * Run wrapper method
 * @param {Function} callback - callback method
 */
export const runWrapper = async (callback) => {
  // Use &1 and _1 to represent absolute and relative ids

  // Will load .env.local if exists, otherwise it will just load .env
  dotenv.config({path: '.env.local'});
  dotenv.config({path: '.env'});

  const parser = new ArgumentParser({
    description: 'Argparse example'
  });

  parser.add_argument('-p', '--path', {default: null});
  parser.add_argument('-i', '--oldDeckId', {default: null});
  parser.add_argument('-d', '--deckName', {default: null});
  parser.add_argument('-c', '--cardId', {default: null});
  parser.add_argument('-o', '--owner', {default: null});
  parser.add_argument('-t', '--port', {default: null});
  parser.add_argument('-l', '--protocol', {default: null});
  parser.add_argument('-s', '--host', {default: null});
  parser.add_argument('-u', '--user', {default: null});
  parser.add_argument('-w', '--password', {default: null});
  parser.add_argument('-a', '--testAuto', {default: null});
  parser.add_argument('-f', '--file', {default: null});
  parser.add_argument('-rc', '--renameConflict', {
    action: 'store_true',
    default: false,
    help: 'Rename the existing deck if there is a conflict.'
  });
  parser.add_argument('-r', '--responses', {
    default: null,
    help: 'Valid options are none(null), "true", and  "only"'
  });
  parser.add_argument('-ei', '--existingDeckId', {
    default: null,
    help: 'Existing deck id to be used for responses import.'
  });

  const args = parser.parse_args();

  const topPath = `${args.path || __dirname}${path.sep}`;
  const dataPath = topPath + 'data';
  console.log('Logs being written to: ' + topPath + 'logs');

  const logger = initLogs(topPath);

  const loginUser = args.user || 'test_admin';
  const loginPassword =
    args.password || process.env.ADMIN_PASSWORD || 'Test1234';

  let urlPort;
  let urlProtocol = 'http';
  if (process.env.TEST_TARGET_ENV === 'development') {
    urlPort = 4000;
  } else if (process.env.TEST_TARGET_ENV === 'test') {
    urlPort = 5000;
  } else if (process.env.TEST_TARGET_ENV === 'production') {
    urlProtocol = 'https';
  }

  urlProtocol = args.protocol || urlProtocol;
  if (args.port === 'none') {
    urlPort = '';
  } else {
    urlPort = args.port || urlPort;
  }

  const urlHost = args.host || process.env.HOST_OVERRIDE || 'localhost';

  const assetUrl = '/api/assets';
  const apiUrl = `${urlProtocol}://${urlHost}${
    urlPort ? ':' + urlPort : ''
  }/api`;

  logger.verbose(`Using api url of ${apiUrl}`);

  const data = {
    username: loginUser,
    password: loginPassword,
    withCredentials: true
  };

  const response = await axios.post(`${apiUrl}/auth/signin`, data);

  const cookies = setCookie.parse(response);

  logger.verbose(JSON.stringify(cookies, null, '\t'));

  const connectSidCookie = cookies.find((cookie) => {
    return cookie.name === 'connect.sid';
  });

  const axiosOptions = {
    headers: {
      Cookie: encodeURI(`connect.sid=${connectSidCookie.value}`)
    }
  };

  let deckPath = `${dataPath + path.sep + args.oldDeckId}`;

  if (args.file) {
    deckPath = args.file;
  }

  let deckOwnerObject = {};

  if (args.owner) {
    const response2 = await axios.get(
      `${apiUrl}/users?search=${args.owner}`,
      axiosOptions
    );

    logger.verbose(JSON.stringify(response2.data));

    // Search returns non-exact matches so we need to filter again.
    deckOwnerObject = response2.data.find((user) => {
      logger.verbose(user.username);
      return user.username === args.owner;
    });

    logger.verbose(JSON.stringify(deckOwnerObject));
  }

  const callbackParams = {
    logger,
    topPath,
    dataPath,
    deckPath,
    deckOwner: deckOwnerObject,
    args,
    loginUser,
    loginPassword,
    urlPort,
    urlProtocol,
    urlHost,
    assetUrl,
    apiUrl,
    axiosOptions
  };

  await callback(callbackParams);
};
