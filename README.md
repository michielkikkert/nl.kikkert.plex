# nl.kikkert.plex

This is the Plex Remote control app for the Homey device. There is still a lot to do but this version should be functional. It uses the Plex.tv PIN procedure to get the Plex server and player details.

# Player support

This release supports 2 drivers: 1) PHT - Plex Home Theater and 2) ChromeCast (only v2 has been tested). More drivers may be developed by the community. Just report your wishes at the dedicated Plex Thread: https://forum.athom.com/discussion/366/homey-plex-application-main-discussion-thread .Please note that the ChromeCast driver detects many more devices on your network then just ChromeCasts. It might also support smart TV's and other DNLA devices. Please just add a real chromecast device as the other devices are unlikely to work (VERY unlikely).

# Step-By-Step Installation:

* 1) Install the App on your Homey.
* 2) Configure your Plex Media Server to allow remote access
* 3) Open een browser window en log into plex.tv
* 4) Go to the Homey page - Settings - Plex (left column)
* 5) Click the 'Start Pin Process' button, remember the PIN and go to plex.tv/pin to enter it.
* 6) Go back to the Homey settings page. You should see your available PMS server, click select button next to it.
* 7) The Homey Plex app will now analyze your media and cache all relevant media keys for speech recognition (this might take a minute)
* 8) Now go to the 'Devices' page on the Homey and add a device in a Zone. Select Plex, your needed Driver and pick your device.
* 9) Homey Plex should now be ready to receive voice commands!
* 10) Enjoy watching.

# Flow support

I build in some basic triggers (play media, stop media) and one action (play media), which includes media search in your PMS. If you need more, let me know or fork the code, code it, and do a Pull Request :-)

# Plex Media Server setup

You can add your PMS by using the PIN procedure found on the Settings page after you installed the App. PMS needs to allow remote connections for this. Homey needs to be able to access your PMS (and any found players). Firewalls might really screw stuff up.

# A few notes

- The settings page is functional, but needs styling and some more fancy features

- The Homey plex app main trigger is "watch". This will kick of the main speech logic. To see more commands, check the app.json file.

- For now, the application only supports Movies and Shows (episodes).

- The Application caches all your media, you can force a refresh by saying "media refresh".


#Example voice commands (of course, depends fully on what is in your media library):

- watch star trek voyager (if you have multiple matches, it will check Plex On Deck -> then Recently added, -> then never viewed media items that match)
- watch transformers
- watch the newest episode of the walking dead
- watch a random movie
- media refresh - will refresh PMS itself (in case you just added something to the library) and refresh the cache on the Homey.
- what am I currently watching? 


There is quite some logic to get to the media item you want to watch. Please keep an eye on the speech-output page, because the application can ask for additional questions (you'll have a few seconds to provide an answer).

The only supported language for now is English (although some dutch commands might work). If nothing works, make sure to switch your homey to english :-). If you like more languages, I really could use some translators who can help out.



Feel free to shoot in issues or contact me via the Athom forum (https://forum.athom.com/discussion/366/homey-plex-application-main-discussion-thread - MikeOne)
