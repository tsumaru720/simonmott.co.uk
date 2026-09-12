---
title: Full screen Flash Video on Linux
date: '2013-08-05T00:01:23+00:00'
slug: full-screen-flash-video-linux
categories:
- System Administration
- Tweaking
tags:
- flash
- hex
- linux
- tweak
images:
- /images/2016/05/ghex-300x226.png
---

<a href="/images/2016/05/ghex.png"><img alt="ghex" class="img-right" height="226" src="/images/2016/05/ghex-300x226.png" width="300"/></a>

So here we have it - I've finally got around to tackling this issue which has been bugging me for a while.

When watching a flash video in full screen on dual monitors, as soon as you go off to do something else you will soon notice that your video is no longer full screen! How annoying.

The way to fix this is to edit the flash player binary. Firstly you need a hex editor - I use "ghex"

```console
$ sudo apt-get install ghex
```

You can of course use your hex editor of choice.

<!--more-->

Now that we have that sorted, its time to find our flash binary! Start playing a flash video and then see which plugin is open.

```console
$ lsof -n | grep -i flash
 firefox 4655 simon mem REG 8,1 17418724 1966425 /usr/lib/flashplugin-installer/libflashplayer.so
```

Open this file with your hex editor and look for the following string:

```
_NET_ACTIVE_WINDOW
```

Once you have this found, change any of the letters - In my case I changed it to:

```
__ET_ACTIVE_WINDOW
```

Save and re-open your browser and you should be able to watch full screen video in flash player whilst doing other things!

This will need to be re-applied every time you update flash.

A final note about this modification:

Chrome (not Chromium) uses its own built in flash plugin called PepperFlash which doesn't have "\_NET\_ACTIVE\_WINDOW", so if you want this fix to work with Google Chrome, enter "chrome://plugins/" in the url bar, then click "Details" on the right, scroll to the Adobe Flash Player plugin and 2 versions should be listed; disable the one that has "/opt/google/chrome/PepperFlash/libpepflashplayer.so" as its path. Doing this, Google Chrome will use the system Adobe Flash Player and not the built-in Google Chrome Adobe Flash Player.

Enjoy
