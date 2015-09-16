# nl.kikkert.plex

This is the Plex Remote control app for the Homey device. There is still a lot to do but this version is functional on a virtual Homey. It uses the Plex.tv PIN procedure to get the Plex server and player details.

#A few notes

- Please note that if you run this on a public virtual homey, other people can technically get your plex.tv security token or give voice commands to your PMS, play at your own risk :-) If you want to test it on a public virtual homey, please don't forget to ctrl-c the athom project --run when you're done. This unloads the Plex app automically. Before you do so, make sure you hit the "reset settings" button on the Homey Plex App - settings page.

- The settings page is functional, but needs styling and some more fancy features

- The Homey plex app main trigger is "watch". This will kick of the main speech logic. To see more commands, check the app.json file.

- For now, the application only supports Movies and Shows (episodes).

- The Application caches all your media, you can force a refresh by saying "media refresh".

- Please note, if you actually want it to play stuff on a local (full blown) plex Home Theater, you'll have to make a port mapping on your router to your player (usually on port 3005). This is only needed for the (internet based) virtual Homey.  

#Example voice commands (of course, depends fully on what is in your media library):

- watch star trek voyager (if you have multiple matches, it will check Plex On Deck -> then Recently added, -> then never viewed media items that match)
- watch transformers
- watch the newest episode of house of cards
- watch a random movie
- media refresh - will refresh just the PMS cache on the Homey. There is functionality there to also forcefully refresh PMS itself, but that is not yet wired to speech.
- switch to (Other known PMS) -  (might be a shared server in your plex.tv account). You can find the known servers on the settings page.

There is quite some logic to get to the media item you want to watch. Please keep an eye on the speech-output page, because the application can ask for additional questions (you'll have a few seconds to provide an answer).

The only supported language for now is English (although some dutch commands might work). If nothing works, make sure to switch the virtual homey to english :-)
Feel free to shoot in issues or contact me via the Athom forum (https://forum.athom.com/discussion/366/homey-plex-application-main-discussion-thread#latest - MikeOne)
