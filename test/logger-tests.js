const lens = require('#this'), lensUtils = lens;
const loggerInternals = require('../cjs/logger.js');
const {assert} = require('chai');
const sinon = require('sinon');
const immutable = require('immutable');
const { range } = require('underscore');

async function loadEsmSubjects() {
  const m = await import('#this');
  const { default: lens, ...lensUtils } = await import('#this');
  const loggerInternals = await import('../esm/logger.js');
  return { lens, lensUtils, loggerInternals };
}

function testSequence(loaderName, subjects) {
  const origIt = it;
  describe(loaderName, () => {
    subjects = Promise.resolve(subjects);
    let lens, lensUtils, loggerInternals, smartLog;
    
    async function loadSubjects() {
      ({ lens, lensUtils, loggerInternals } = await subjects);
      ({ smartLog } = loggerInternals);
    }
    
    let it = (name, body) => {
      return origIt(name, async () => {
        await loadSubjects();
        return body();
      });
    };
    
    function divertLogging() {
      const { makeDefaultLogger, rawSwapIn, resetLoggerCountReporting } = loggerInternals;
      const logger = {
        log() {},
        info() {},
        warn() {},
        trace() {},
        preinstallationCalls: sinon.fake(),
      };
      
      // This is NOT a public interface, just used for testing logger
      rawSwapIn(makeDefaultLogger(logger));
      resetLoggerCountReporting();
      
      return { logger, defaultLogger: logger };
    }
    
    function send(methodName, ...args) {
      return loggerInternals.get()[methodName](...args);
    }
    
    beforeEach(async () => {
      await loadSubjects();
      loggerInternals.resetLoggerStore();
      this.diversion = divertLogging();
    });
    
    describe("Logger", () => {
      it("logs counts of calls to default logger", () => {
        const { logger } = this.diversion;
        send('log', "a log entry");
        send('info', "some info");
        send('warn', "a warning");
        const expectedCounts = {log: 1, info: 1, warn: 1};
        
        // This invokes the standard logic for replacing the logger (even
        // though we are replaing it with itself)
        // loggerInternals.set(logger);
        lensUtils.setLogger(logger);
        
        let callArg;
        sinon.assert.calledOnce(logger.preinstallationCalls);
        callArg = logger.preinstallationCalls.firstCall.args[0];
        assert.include(callArg, expectedCounts);
        assert.hasAllKeys(callArg, expectedCounts);
      });
      
      it("warns if new logger doesn't handle preinstallation call counts", () => {
        send('log', "a log entry");
        send('info', "some info");
        send('warn', "a warning");
        const expectedCounts = {log: 1, info: 1, warn: 1};
        
        // This invokes the standard logic for replacing the logger (even
        // though we are replaing it with itself)
        // loggerInternals.set(logger);
        const logger = {
          warn: sinon.fake(),
        };
        lensUtils.setLogger(logger);
        
        let callArg;
        sinon.assert.calledOnce(logger.warn);
        callArg = logger.warn.firstCall.args[1];
        assert.include(callArg, expectedCounts);
        assert.hasAllKeys(callArg, expectedCounts);
      });
      
      it("only warns if preinstallation calls to the default logger are made", () => {
        const logger = {};
        lensUtils.setLogger(logger);
      });
      
      describe("temporary diversion", () => {
        it("sends calls to a different logger", () => {
          const { defaultLogger } = this.diversion;
          defaultLogger.log = sinon.fake();
          const logger = {
            log: sinon.fake(),
          };
          lensUtils.setLogger.forBlock(logger, () => {
            send('log', "a log entry");
          });
          sinon.assert.notCalled(defaultLogger.log);
          sinon.assert.calledOnce(logger.log);
        });
        
        it("cleans up after a synchronous thrown exception", () => {
          const { defaultLogger } = this.diversion;
          defaultLogger.log = sinon.fake();
          const logger = {
            log: sinon.fake(),
          };
          const error = new Error("INTENTIONAL");
          const prevLogger = loggerInternals.get();
          assert.throws(() => {
            lensUtils.setLogger.forBlock(logger, () => {
              throw error;
            });
          }, error);
          assert.strictEqual(loggerInternals.get(), prevLogger);
        });
        
        it("warns if a 'thenable' returned from body", async () => {
          const { defaultLogger } = this.diversion;
          const nonOutputting = sinon.fake();
          defaultLogger.log = defaultLogger.warn = nonOutputting;
          const logger = {
            log: sinon.fake(),
            warn: sinon.fake(),
          };
          await lensUtils.setLogger.forBlock(logger, async () => {
            send('log', "a log entry");
          });
          sinon.assert.notCalled(nonOutputting);
          sinon.assert.calledOnce(logger.log);
          sinon.assert.calledOnce(logger.warn);
        });
        
        it("cleans up after an asynchronous throw exception", async () => {
          const { defaultLogger } = this.diversion;
          defaultLogger.log = sinon.fake();
          const logger = {
            log: sinon.fake(),
          };
          const error = new Error("INTENTIONAL");
          const prevLogger = loggerInternals.get();
          await lensUtils.setLogger.forBlock(logger, async () => {
              throw error;
          }).then(
            () => {assert.fail("expected error")},
            (err) => {assert.strictEqual(err, error);}
          );
          assert.strictEqual(loggerInternals.get(), prevLogger);
        });
      });
      
      describe("asynchronous-enabled logging", () => {
        it("can be configured to handle asynchronous logging", async() => {
          const { defaultLogger } = this.diversion;
          const nonOutputting = sinon.fake();
          defaultLogger.log = defaultLogger.info = defaultLogger.warn = nonOutputting;
          lensUtils.asyncLogging('node');
          
          const logger = {
            log: sinon.fake(),
          };
          const logArgs = [1,2].map(n => Symbol(`message #{n}`));
          let resolveBlocker;
          let blocker = new Promise(function(resolve, reject) {
            resolveBlocker = () => {
              resolve();
              return blocker;
            }
          });
          lensUtils.setLogger.forBlock(logger, () => {
            send('log', logArgs[0]);
            const currentLogger = loggerInternals.get();
            blocker = blocker.then(() => {
              send('log', logArgs[1]);
              assert.strictEqual(loggerInternals.get(), currentLogger);
            });
          });
          sinon.assert.notCalled(nonOutputting);
          sinon.assert.calledOnce(logger.log);
          
          let finalAssertsComplete = false;
          blocker = blocker.then(() => {
            sinon.assert.notCalled(nonOutputting);
            sinon.assert.calledTwice(logger.log);
            finalAssertsComplete = true;
          });
          
          await resolveBlocker();
          assert(finalAssertsComplete, "asynchronous tests did not complete");
        });
        
        it("throws an error if no engine name is given", () => {
          assert.throws(
            () => lens.asyncLogging()
          );
        });
        
        it("throws an error if an unknown engine name is given", () => {
          assert.throws(
            () => lens.asyncLogging('smurf')
          );
        });
      });
      
      describe("#smartLog() (internal function)", () => {
        it("defaults to 'info' level", () => {
          const { logger } = this.diversion;
          logger.info = sinon.fake();
          const marker = Symbol('marker');
          smartLog({marker});
          
          sinon.assert.calledOnce(logger.info);
          const callArg = logger.info.firstCall.args[0];
          assert.include(callArg, {marker});
        });
      })
    });
  });
}

testSequence('CommonJS', { lens, lensUtils, loggerInternals });
testSequence('ESM', loadEsmSubjects());
