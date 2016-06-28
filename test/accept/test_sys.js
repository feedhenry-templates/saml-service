var assert = require('assert');
var request = require('supertest');
var app = require('../../application');

describe('Sys routes', function() {
  var server;

  before(function(done) {
    server = request(app);
    done();
  });

  after(function(done) {
    server = null;
    done();
  });

  it('GET /sys/info/ping', function(done) {
    server
      .get('/sys/info/ping')
      .expect(200)
      .end(function(err) {
        assert.ok(!err);
        done();
      });
  });

  it('GET /sys/info/version', function(done) {
    server
      .get('/sys/info/version')
      .expect(200)
      .end(function(err) {
        assert.ok(!err);
        done();
      });
  });
});
