const { request } = require("https");

async function makeApiRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = request(options, (res) => {
      const body = [];
      if (res.statusCode < 200 || res.Status > 299) {
        reject(new Error(`request failed: ${res.StatusCode}`));
      }
      res.on("data", (chunk) => {
        body.push(chunk);
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(body).toString(),
        });
      });
    });

    req.on("error", (error) => {
      console.error(`error: ${error}`);
      reject(error);
    });

    if (data) {
      options.headers["Content-Length"] = Buffer.byteLength(data);
      req.write(data);
    }

    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function filterSetCookie(setCookie) {
  const cookie = setCookie.split("; ").reduce((cookieString, elt) => {
    const param = elt.split("=");
    if (param.length === 2 && cookieString.length > 0) {
      cookieString += `; ${param[0]}=${param[1]}`;
    } else if (param.length === 2) {
      cookieString = `${param[0]}=${param[1]}`;
    }
    return cookieString;
  }, []);
  return cookie;
}

module.exports = { makeApiRequest, sleep, filterSetCookie };
