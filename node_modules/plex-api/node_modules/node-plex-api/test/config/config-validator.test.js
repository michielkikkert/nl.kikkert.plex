var chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    configValidator = require('lib/config/config-validator'),
    expect = chai.expect;

chai.should();
chai.use(sinonChai);

describe('The config validator', function () {

    it('should be a function', function () {

        configValidator.should.be.a('function');

    });

    it('should throw an exception if no host is configured', function () {

        expect(function () {
            configValidator({});
        }).to.throw('Plex API requires a host');

    });

    it('should throw an exception if no port is configured', function () {

        expect(function () {
            configValidator({
                host: 'host'
            });
        }).to.throw('Plex API requires a port');

    });

    it('should throw an exception if no username is configured', function () {

        expect(function () {
            configValidator({
                host: 'host',
                port: 1234
            });
        }).to.throw('Plex API requires a username');

    });

    it('should throw an exception if no password is configured', function () {

        expect(function () {
            configValidator({
                host: 'host',
                port: 1234,
                username: 'Username'
            });
        }).to.throw('Plex API requires a password');

    });

    it('should not throw an exception if the configuration is valid', function () {

        expect(function () {
            configValidator({
                host: 'host',
                port: 1234,
                username: 'Username',
                password: 'Password'
            });
        }).to.not.throw();

    });
});