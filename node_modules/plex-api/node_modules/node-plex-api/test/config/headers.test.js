var os = require('os'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    headers = require('lib/config/headers'),
    config = require('lib/config/config'),
    expect = chai.expect;

chai.should();
chai.use(sinonChai);

describe('The headers object', function () {

    it('should the correct headers', function () {

        var platform = (os.platform() === 'darwin') ? 'MacOSX' : os.platform();

        headers.should.be.a('object');
        headers['X-Plex-Platform'].should.equal(platform);
        headers['X-Plex-Platform-Version'].should.equal(os.release());
        headers['X-Plex-Product-Version'].should.equal(config.applicationVersion);
        headers['X-Plex-Product'].should.equal(config.applicationName);
        headers['X-Plex-Client-Identifier'].should.equal(config.applicationIdentifier);
        expect(headers['X-Plex-Token']).to.equal(null);

    });
});