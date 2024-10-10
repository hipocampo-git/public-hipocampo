const {createLogger, format, transports} = require('winston');
const fs = require('fs');
const path = require('path');

// We are using the default (npm) logging levels:
// {
//   error: 0,
//    warn: 1,
//    info: 2,
// ^ The levels above will go to the console
//    http: 3,
// verbose: 4,
//   debug: 5,
//   silly: 6
// }

/**
 * Initial setup of logging
 * @param {string} appDir - application directory to put the logs directory
 * @param {string} [subDir] - subdirectory to put the logs
 * @return {*}
 */
const initLogs = (appDir, subDir) => {
  let logDir;
  if (subDir) {
    logDir = path.join(appDir, 'logs', subDir);
  } else {
    logDir = path.join(appDir, 'logs');
  }
  // const logDir = path.join(appDir, 'logs');

  // console.log(`Logs being written to: ' + topPath + 'logs');
  console.log(`Logs being written to: ${logDir}`);


  if (!fs.existsSync(logDir)) {
    // Create the directory if it does not exist
    fs.mkdirSync(logDir);
  }

  return createLogger({
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
    transports: [
      new transports.Console({
        level: 'info',
        format: format.printf((data) => {
          // Only display the level to the console for warn & error
          const logText = data.level + ':';
          return `${logText} ${data.message}`;
        })
      }),
      new transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error'
      }),
      new transports.File({
        filename: path.join(logDir, 'warn.log'),
        level: 'warn'
      }),
      new transports.File({
        filename: path.join(logDir, 'combined.log'),
        level: 'silly'
      })
    ]
  });
};

// module.exports = (appDir, logDir) => {
//   return initLogs(appDir, logDir);
// };

// Pass through a variable number of arguments to the logger

module.exports = initLogs;

