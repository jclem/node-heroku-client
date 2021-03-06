'use strict';

process.env.HEROKU_CLIENT_ENCRYPTION_SECRET = 'abcd1234abcd1234';

var http         = require('http');
var https        = require('https');
var Request      = require('../../lib/request');
var memjs        = require('memjs');
var MockCache    = require('../helpers/mockCache');
var MockRequest  = require('../helpers/mockRequest');
var MockResponse = require('../helpers/mockResponse');

describe('request', function() {
  it('uses the v3 API', function(done) {
    makeRequest('/apps', {}, function() {
      expect(https.request.mostRecentCall.args[0].headers.Accept).toEqual('application/vnd.heroku+json; version=3');
      done();
    });
  });

  it('makes a request to a given path', function(done) {
    makeRequest('/apps', {}, function() {
      expect(https.request.mostRecentCall.args[0].path).toEqual('/apps');
      done();
    });
  });

  it('accepts a timeout', function(done) {
    makeRequest('/apps', { timeout: 1 }, function(err) {
      expect(err.message).toEqual('Request took longer than 1ms to complete.');
      done();
    }, { timeout: 10 });
  });

  it('writes the request body as a string', function(done) {
    spyOn(MockRequest.prototype, 'write');

    makeRequest('/apps', { body: { foo: 'bar' } }, function() {
      expect(MockRequest.prototype.write).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }));
      done();
    });
  });

  it('sets the Content-length when a body is present', function(done) {
    spyOn(MockRequest.prototype, 'setHeader');

    makeRequest('/apps', { body: { foo: 'bar' } }, function() {
      expect(MockRequest.prototype.setHeader).toHaveBeenCalledWith('Content-length', JSON.stringify({ foo: 'bar' }).length);
      done();
    });
  });

  it('sets the Content-length to 0 when a body is not present', function(done) {
    spyOn(MockRequest.prototype, 'setHeader');

    makeRequest('/apps/example/collaborators/bob%40example.com', { method: 'DELETE' }, function() {
      expect(MockRequest.prototype.setHeader).toHaveBeenCalledWith('Content-length', 0);
      done();
    });
  });

  describe('when using an HTTP proxy', function() {
    beforeEach(function() {
      process.env.HEROKU_HTTP_PROXY_HOST='localhost:5000';
    });

    afterEach(function() {
      delete process.env.HEROKU_HTTP_PROXY_HOST;
    });

    it('uses an http agent', function(done) {
      makeRequest('/apps', {}, function() {
        expect(http.request.mostRecentCall.args[0].host).toBeDefined();
        done();
      });
    });

    it('uses the proxy host', function(done) {
      makeRequest('/apps', {}, function() {
        expect(http.request.mostRecentCall.args[0].host).toEqual('localhost:5000');
        done();
      });
    });

    it('uses the full API URL as its path', function(done) {
      makeRequest('/apps', {}, function() {
        expect(http.request.mostRecentCall.args[0].path).toEqual('https://api.heroku.com/apps');
        done();
      });
    });

    describe('when a proxy port is defined', function() {
      beforeEach(function() {
        process.env.HEROKU_HTTP_PROXY_PORT='8000';
      });

      afterEach(function() {
        delete process.env.HEROKU_HTTP_PROXY_PORT;
      });

      it('uses the defined port', function(done) {
        makeRequest('/apps', {}, function() {
          expect(http.request.mostRecentCall.args[0].port).toEqual('8000');
          done();
        });
      });
    });

    describe('when a proxy port is not defined', function() {
      it('defaults to port 8080', function(done) {
        makeRequest('/apps', {}, function() {
          expect(http.request.mostRecentCall.args[0].port).toEqual(8080);
          done();
        });
      });
    });
  });

  describe('when not using an HTTP proxy', function() {
    it('uses the API host as its host', function(done) {
      makeRequest('/apps', {}, function() {
        expect(https.request.mostRecentCall.args[0].host).toEqual('api.heroku.com');
        done();
      });
    });

    it('makes a request to port 443', function(done) {
      makeRequest('/apps', {}, function() {
        expect(https.request.mostRecentCall.args[0].port).toEqual(443);
        done();
      });
    });
  });

  describe('callbacks and promises', function() {
    it('sends a successful response to the callback', function(done) {
      makeRequest('/apps', {}, function(err, body) {
        expect(body).toEqual(JSON.parse('{ "message": "ok" }'));
        done();
      });
    });

    it('sends an error to the callback', function(done) {
      makeRequest('/apps', {}, function(err) {
        expect(err.message).toEqual('Expected response to be successful, got 404');
        done();
      }, { response: { statusCode: 404 } });
    });

    it('resolves a promise when successful', function(done) {
      makeRequest('/apps', {}).then(function(body) {
        expect(body).toEqual({ 'message': 'ok' });
        done();
      });
    });

    it('rejects a promise when there is an error on the request object', function() {
      makeRequest('/apps', {}, function(err) {
        expect(err.message).toEqual('there was an error');
      }, { emitError: 'there was an error' });
    });

    it('rejects a promise when there is an error from an unexpected response', function(done) {
      makeRequest('/apps', {}, null, { response: { statusCode: 404 } }).fail(function(err) {
        expect(err.message).toEqual('Expected response to be successful, got 404');
        done();
      });
    });
  });

  describe('options', function() {
    it('uses an auth string', function(done) {
      makeRequest('/apps', { token: 'api-token' }, function() {
        expect(https.request.mostRecentCall.args[0].auth).toEqual(':api-token');
        done();
      });
    });

    it('uses auth if provided explicitly', function(done) {
      makeRequest('/apps', { auth: 'user:pass'}, function() {
        expect(https.request.mostRecentCall.args[0].auth).toEqual('user:pass');
        done();
      });
    });

    it('GETs by default', function(done) {
      makeRequest('/apps', {}, function() {
        expect(https.request.mostRecentCall.args[0].method).toEqual('GET');
        done();
      });
    });

    it('accepts a method', function(done) {
      makeRequest('/apps', { method: 'POST' }, function() {
        expect(https.request.mostRecentCall.args[0].method).toEqual('POST');
        done();
      });
    });

    it('parses JSON by default', function(done) {
      makeRequest('/apps', {}, function(err, body) {
        expect(body).toEqual({ message: 'ok' });
        done();
      });
    });

    it('can accept `false` to parseJSON', function(done) {
      makeRequest('/apps', { parseJSON: false }, function(err, body) {
        expect(body).toEqual('{ "message": "ok" }');
        done();
      });
    });

    it('accepts a host', function(done) {
      makeRequest('/apps', { host: 'api.example.com' }, function() {
        expect(https.request.mostRecentCall.args[0].host).toEqual('api.example.com');
        done();
      });
    });

    it('extends the default headers with custom headers', function(done) {
      var expectedHeaders = {
        'Arbitrary': 'header',
        'Accept': 'application/vnd.heroku+json; version=3',
        'Content-type': 'application/json',
        'Range': 'id ]..; max=1000'
      };

      makeRequest('/apps', { headers: { 'Arbitrary': 'header' } }, function() {
        expect(https.request.mostRecentCall.args[0].headers).toEqual(expectedHeaders);
        done();
      });
    });
  });

  describe('status codes', function() {
    it('expects a 2xx response by default', function(done) {
      makeRequest('/apps', {}, function(err) {
        expect(err.message).toEqual('Expected response to be successful, got 404');
        done();
      }, { response: { statusCode: 404 } });
    });
  });

  describe('handling Range headers', function() {
    it('sends a default Range header', function() {
      makeRequest('/apps', {}, function() {
        expect(https.request.mostRecentCall.args[0].headers.Range).toEqual('id ]..; max=1000');
      });
    });

    describe('when receiving a Next-Range header', function() {
      it('sends the Next-Range header on the next request', function(done) {
        makeRequest('/apps', {}, function() {
          expect(https.request.mostRecentCall.args[0].headers.Range).toEqual('id abcdefg..; max=1000');
          done();
        }, { response: { headers: { 'next-range': 'id abcdefg..; max=1000' } } });
      });

      it('aggregates response bodies', function(done) {
        makeRequest('/apps', {}, function(err, body) {
          expect(body).toEqual([{ message: 'ok' }, { message: 'ok' }]);
          done();
        }, { returnArray: true, response: { headers: { 'next-range': 'id abcdefg..; max=1000' } } });
      });
    });
  });

  describe('caching', function() {
    var secret    = process.env.HEROKU_CLIENT_ENCRYPTION_SECRET;
    var encryptor = require('simple-encryptor')(secret);
    var cache     = new MockCache();

    beforeEach(function() {
      spyOn(memjs.Client, 'create').andReturn(cache);
      Request.connectCacheClient({ cache: cache, key: secret });
    });

    it('sends an etag from the cache', function(done) {
      makeRequest('/apps', {}, function() {
        expect(https.request.mostRecentCall.args[0].headers['If-None-Match']).toEqual('123');
        done();
      }, { response: { statusCode: 304 } });
    });

    it('gets with a postfix', function(done) {
      spyOn(cache, 'get').andCallThrough();

      makeRequest('/apps', { token: 'api-token' }, function() {
        var key = JSON.stringify(['/apps', 'id ]..; max=1000', 'api-token']);
        expect(cache.get).toHaveBeenCalledWith(encryptor.hmac(key), jasmine.any(Function));
        done();
      });
    });

    it('returns a cached body', function(done) {
      makeRequest('/apps', {}, function(err, body) {
        expect(body).toEqual({ cachedFoo: 'bar' });
        done();
      }, { response: { statusCode: 304 } });
    });

    it('writes to the cache when necessary', function(done) {
      spyOn(cache, 'set');

      makeRequest('/apps', { token: 'api-token' }, function() {
        var expectedKey = JSON.stringify(['/apps', 'id ]..; max=1000', 'api-token']);

        var expectedValue = {
          body: { message: 'ok' },
          etag: '123'
        };

        expect(cache.set).toHaveBeenCalledWith(encryptor.hmac(expectedKey), jasmine.any(String));
        expect(encryptor.decrypt(cache.set.mostRecentCall.args[1])).toEqual(expectedValue);
        done();
      }, { response: { headers: { etag: '123' } } });
    });
  });
});

function makeRequest(path, options, callback, testOptions) {
  testOptions = testOptions || {};
  options.path = path;

  spyOn(https, 'request').andCallFake(fakeRequest);
  spyOn(http,  'request').andCallFake(fakeRequest);

  function fakeRequest(options, requestCallback) {
    if (options.headers.Range !== 'id ]..; max=1000') {
      testOptions.response.headers['next-range'] = undefined;
    }

    var req = new MockRequest();
    var res = new MockResponse(testOptions.response || {});

    requestCallback(res);

    setTimeout(function() {
      if (testOptions.returnArray) {
        res.emit('data', '[{ "message": "ok" }]');
      } else {
        res.emit('data', '{ "message": "ok" }');
      }

      if (testOptions.emitError) {
        req.emit('error', new Error(testOptions.emitError));
        req.abort();
      }

      if (!req.isAborted) { res.emit('end'); }
    }, testOptions.timeout || 0);

    return req;
  }

  return Request.request(options, function(err, body) {
    if (callback) { callback(err, body); }
  });
}
