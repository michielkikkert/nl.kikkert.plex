var chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    packageJson = require('../../package.json'),
    config = require('lib/config/config'),
    expect = chai.expect;

chai.should();
chai.use(sinonChai);

describe('The config object', function () {

    it('should contain default items', function () {

        config.sections.should.be.a('object');
        expect(config.sections.shows).to.equal(null);
        expect(config.sections.movies).to.equal(null);
        config.remote.should.be.false;
        config.applicationName.should.equal('Node Plex Api');
        config.applicationVersion.should.equal(packageJson.version);
        config.applicationIdentifier.should.equal('8ef6fede-a547-4f9d-9865-e43bc3c4f190');
        config.port.should.equal(32400);

    });
});