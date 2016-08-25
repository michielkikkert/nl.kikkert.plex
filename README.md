# nl.kikkert.plex

This is the Plex Remote control app for the Homey device. There is still a lot to do but this version should be functional. It uses the Plex.tv PIN procedure to get the Plex server and player details.


# Main Voice Triggers

EN: Watch (I want to watch star trek);
NL: Kijk / kijken (Ik wil star trek kijken)

# Version 1.2.0

- Continuation support! So if you want to watch a media item (using speech), the app now looks at the viewOffset. So if the offset is high enough (about 3 minutes into the movie), it will ask you if you would like to continue where you finished (answer 'no' or 'nee' to restart from the beginning).
- FLOWS! As per request. The app is now capable of subscribing to PMS updates over a websocket. These flow triggers will also trigger when a play event is detected outside of Homey. This means you can now fairly easily make a flow that dims your lights as soon as you start a movie, even if you start that movie using your remote control. Still some caveats to take into account:
	1) The logic does not keep track if WHAT item is playing. It just looks at a playing event coming from your (selected!) PMS. 
	2) If you have multiple players in your house (in multiple rooms), it will NOT differentiate. So triggers will fire even if you start a movie in one room ('playing') but if you stop a movie in another room, it will also fire stop. No way to control what is what as the socket events do not give me enough details to determine which player is playing what. So it should work fine for a simple setup - but also if you only use one player at a time. Also, if you do have multiple players, and you want to start watching something on another player, make sure you stop playing on the first one (and not have it paused). Paused players will still continue to fire events.
	3) Shared servers are a bitch. So if for example you have Homey set to your own PMS, but via your smart TV you start a movie from a shared server, the flow will not trigger. If however you change Homey to the shared server, flows WILL trigger, however, they will also trigger when the owner of the shared servers starts or stops a movie
	4) PHT (Plex Home Theater) - is a bitch! It does not emit a stop event (and when it does, it can take up to 5 minutes). This might screw up your stop flows a bit. Even if I would take the time (a lot of time) - to code some kind of work-around for this issue, it would still give you a delay of around 15 seconds before I can safely fire the stop event.

	This notification functionality is switched on by default, however, I can see scenarios that might cause the logic to get twisted (it is event based after all). In that case, you can disable or reset (by switching off and on) on the settings page. The settings page will also show you if things work as it should give you a live view of the playing state and what is playing.

# Version 1.1.2

- Added PMP Driver. Support for PMP (Plex Media Player). This player is only available for Plex-Pass holders and is still in beta. I can therefore not guarantee that it will keep working as releases of PMP progress. For now it's working fine.

# Version 1.1.1

- App broke on Homey 0.9.2 due to capabilities change. FIXED.

# Version 1.1.0

- Complete refactor of the settings page
- Complete refactor of the PMS connection logic
- Fix for socket hangup errors causing the App to crash
- Work-around for CPU warnings with very large PMS libraries (needs a proper fix at a later stage)
- Choose your best connection (now allows you to even choose the network interface if more than one is found)
- Added realtime debugging to browser console (on the settings page / plex, open your browser console)
- Addded Shared Server Support (EXPERIMENTAL - especially ChromeCast is tricky)
- Added translation support to main application and PHT + Chrome drivers
- Added Support for DUTCH (at least speech, settings page still needs some more work to translate)
- Tweaks to speech triggers
- Added speech logic that allows for better movie title targetting bij asking: "I want to watch a movie" ("Ik wil een film kijken") - after which you can provide just the title. Because speech parsing is then much easier, the app can use a smart text indexer to determine best match. It also a more natural way of asking for things (btw - also works for series: "I want to watch a series" - "Ik wil een serie kijken".)
- FLOWS: added triggers for play, stop, pause and continue
- FLOWS: added actions for playItem, stop, pause and continue

THIS RELEASE REQUIRES YOU TO RE-START THE PLEX PIN PROCEDURE. AFTER INSTALL, GO TO SETTINGS AND HIT 'Reset settings' and then do the PIN thing again. Be patient, if all goes well it will show all connection options and shared servers if you have any.

# Player support

This release supports 2 drivers: 1) PHT - Plex Home Theater and 2) ChromeCast (only v2 has been tested). More drivers may be developed by the community. Just report your wishes at the dedicated Plex Thread: https://forum.athom.com/discussion/366/homey-plex-application-main-discussion-thread .Please note that the ChromeCast driver detects many more devices on your network then just ChromeCasts. It might also support smart TV's and other DNLA devices. Please just add a real chromecast device as the other devices are unlikely to work (VERY unlikely).

# Step-By-Step Installation:

* 1) Install the App on your Homey.
* 2) Configure your Plex Media Server to allow remote access
* 3) Goto Plex.tv -> Settings -> Server (advanced view) -> Network and make sure the 'Secure Connections' dropdown is set to 'Preferred' and NOT required.
* 4) Open een browser window en log into plex.tv
* 5) Go to the Homey page - Settings - Plex (left column)
* 6) Click the 'Start Pin Process' button, remember the PIN and go to plex.tv/pin to enter it.
* 7) Go back to the Homey settings page. You should see your available PMS servers, click 'use this connection' button next to the connection you want to use. If it cannot connect with your choosen connection, it will turn red.
* 8) The Homey Plex app will now analyze your media and cache all relevant media keys for speech recognition (this might take a minute)
* 9) Now go to the 'Devices' page on the Homey and add a device in a Zone. Select Plex, your needed Driver and pick your device.
* 10) Homey Plex should now be ready to receive voice commands!
* 11) Enjoy watching.

# Flow support

Multiple triggers and actions are available. The pPlayItem action also shows your media in the autocomplete.

# Plex Media Server setup

You can add your PMS by using the PIN procedure found on the Settings page after you installed the App. PMS needs to allow remote connections for this. Homey needs to be able to access your PMS (and any found players). Firewalls might really screw stuff up.

# A few notes

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
