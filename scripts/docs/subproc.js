class SignalError extends Error {
  constructor(signal, details = {}) {
    super(`Terminated by ${signal}`);
    Object.assign(this, details);
    this.signal = signal;
  }
}

class FailureError extends Error {
  constructor(code, details = {}) {
    super(`Exited with code ${code}`);
    Object.assign(this, details);
    this.code = code;
  }
}

Object.assign(exports, {
  SignalError,
  FailureError,
});
