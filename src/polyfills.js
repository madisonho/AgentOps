// Crypto and process polyfill for Vite
if (typeof global === "undefined") {
  window.global = window;
}

if (typeof global.crypto === "undefined") {
  global.crypto = window.crypto;
}

if (typeof global.crypto.getRandomValues === "undefined") {
  global.crypto.getRandomValues = function (array) {
    return window.crypto.getRandomValues(array);
  };
}

// Process polyfill for browser environment
if (typeof process === "undefined") {
  window.process = {
    env: {
      NODE_ENV: "development",
      REACT_APP_API_URL: undefined,
      REACT_APP_USE_MOCK_DATA: undefined,
    },
  };
}
