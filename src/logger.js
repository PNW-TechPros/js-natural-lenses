import { isObject, isUndefined } from 'underscore';
import importSync from '../src-cjs/import-sync.js';

/**
 * @interface Logger
 * @since 2.2.0
 * @description
 * A subset of the functionality offered by the `console` in a browser or
 * Node.js, with optional special-case handlers.
 */

/**
 * @function Logger#info
 * @summary Called to log information
 * @since 2.2.0
 * @param {...*} obj
 *
 * @description
 * Conceptually like the standard `console.info`.  If the first *obj* is a
 * string, it gives the format with `%`-style substitution specifiers drawing
 * from the remaining *objs*.  This method is used to communicate important
 * information not indicating any kind of problem.
 */

/**
 * @function Logger#warn
 * @summary Called to log a warning
 * @since 2.2.0
 * @param {...*} obj
 *
 * @description
 * Conceptually like the standard `console.warn`.  If the first *obj* is a
 * string, it gives the format with `%`-style substitution specifiers drawing
 * from the remaining *objs*.  This method is used to communicate a situation
 * that likely indicates a problem, but for which there is defined behavior.
 */

/**
 * @function Logger#error
 * @summary Called to log an error
 * @since 2.2.0
 * @param {...*} obj
 *
 * @description
 * Conceptually like the standard `console.error`.  If the first *obj* is a
 * string, it gives the format with `%`-style substitution specifiers drawing
 * from the remaining *objs*.  This method is used to communicate extended,
 * human-friendly details of an error condition.
 */

/**
 * @function Logger#trace
 * @summary Called to request logging of the current stack trace
 * @since 2.2.0
 *
 * @description
 * Conceptually like the standard `console.trace`.  Called when call stack
 * information might be helpful in resolving the condition that has been logged.
 */

/**
 * @function Logger#preinstallationCalls
 * @summary (optional) Handler for notification of preinstallation logging calls
 * @since 2.2.0
 * @param {Object.<string, number>} callCounts  Count of calls to logging functions, by method name
 *
 * @description
 * If the Logger object has this method when it is installed for this library
 * and any logging calls have previously been made, this method will be called
 * with an Object whose properties are Logger method names and whose corresponding
 * values are the count of times the method was called on the default logger
 * since the last report or since the beginning of the process.  Counts are
 * only for logging done from this library.  All counts are at least 1 — absence
 * of the method name from *callCounts* indicates no calls.
 *
 * If this method is not provided on a Logger and call counts exist to be
 * reported, a call will be made to {@link Logger#warn}.
 */

const LOGGER_METHODS = [
  'assert',         'clear',        'count',
  'countReset',     'debug',        'dir',            'dirxml',
  'error',          'group',        'groupCollapsed', 'groupEnd',
  'info',           'log',          'profile',        'profileEnd',
  'table',          'time',         'timeEnd',        'timeLog',
  'timeStamp',      'trace',        'warn'
];

const loggerCounts = new WeakMap();
function tallyLoggerCall(logger, methodName) {
  let callCounts = loggerCounts.get(logger);
  if (!callCounts) {
    loggerCounts.set(logger, (callCounts = {}))
  }
  callCounts[methodName] = (callCounts[methodName] || 0) + 1;
}

// Testing function
export function makeDefaultLogger(base) {
  const result = {};
  for (const methodName of LOGGER_METHODS) {
    result[methodName] = (...args) => {
      tallyLoggerCall(result, methodName);
      return base[methodName](...args);
    }
  }
  return result;
}
const defaultLogger = makeDefaultLogger(console);

// Interface resembling require('async_hooks').AsyncLocalStorage
const globalLoggerStore = (function() {
  let store = { logger: defaultLogger, reportLoggerCounts: true };
  let warnedAsync = false;
  return {
    enterWith(newStore) {store = newStore;},
    getStore() {return store;},
    run(newStore, body) {
      const oldStore = store;
      store = newStore;
      function revert() {
        store = oldStore;
      }
      
      let result;
      try {
        result = body();
      } catch (e) {
        revert();
        throw e;
      }
      if (isObject(result) && result.then) {
        if (!warnedAsync) {
          warnedAsync = true;
          newStore.logger.warn(
            "Temporary logger used for async callback, will persist until\n" +
            "result fulfills or rejects.  Call asyncLogging() to avoid this\n" +
            "warning, or wrap the returned value so it is not \"thenable\"."
          );
        }
        return result.then(
          val => {
            revert();
            return val;
          },
          err => {
            revert();
            throw err;
          }
        );
      } else {
        revert();
        return result;
      }
    }
  };
}());
let loggerStore = globalLoggerStore;

const ASYNC_ENGINES = {
  node() {
    const { AsyncLocalStorage } = importSync('async_hooks');
    const asyncStore = new AsyncLocalStorage();
    asyncStore.enterWith({ logger: console, asyncLocal: true });
    setAsyncStore(asyncStore);
  },
};
function setAsyncStore(asyncStore) {
  const { reportLoggerCounts } = loggerStore.getStore();
  loggerStore = asyncStore;
  if (reportLoggerCounts) {
    asyncStore.getStore().reportLoggerCounts = reportLoggerCounts;
  }
}
export function enableAsync(engine) {
  if (isUndefined(engine)) {
    throw new Error("Engine name required");
  }
  if (!ASYNC_ENGINES.hasOwnProperty(engine)) {
    throw new Error(`Unknown async engine "${engine}"`);
  }
  ASYNC_ENGINES[engine]();
}

export function get() {
  return loggerStore.getStore().logger;
}

export function set(newLogger) {
  const { logger: oldLogger, reportLoggerCounts, ...store } = loggerStore.getStore();
  loggerStore.enterWith({ ...store, logger: newLogger });
  let callCounts = {};
  if (reportLoggerCounts && (callCounts = loggerCounts.get(oldLogger))) {
    loggerCounts.delete(oldLogger);
    if (newLogger.preinstallationCalls) {
      newLogger.preinstallationCalls(callCounts);
    } else {
      newLogger.warn(
        "Logging call(s) preceding logger replacement: %o",
        callCounts
      );
    }
  }
  return oldLogger;
}

set.forBlock = function(newLogger, body) {
  const store = loggerStore.getStore();
  return loggerStore.run({ ...store, logger: newLogger }, body);
}

// Testing function
export function rawSwapIn(newLogger) {
  const store = loggerStore.getStore();
  store.logger = newLogger;
}

// Testing function
export function resetLoggerStore() {
  loggerStore = globalLoggerStore;
}

// Testing function
export function resetLoggerCountReporting() {
  const store = loggerStore.getStore();
  store.reportLoggerCounts = true;
  loggerCounts.delete(store.logger);
}

export function smartLog(info) {
  const { trace, ...printInfo } = info, logger = get();
  logger[info.level || 'info'](printInfo);
  if (trace) {
    logger.trace();
  }
}
