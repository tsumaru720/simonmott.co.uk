---
title: UN2400 Mobile Broadband on Ubuntu 11.10
date: '2012-03-11T09:09:32+00:00'
slug: un2400-mobile-broadband-ubuntu-11-10
categories:
- Firmware
- System Administration
tags:
- drivers
- firmware
- ubuntu
- un2400
images:
- /images/2016/05/un2420-300x298.png
---

<a href="/images/2016/05/un2420.png"><img alt="un2420" class="img-right" height="298" src="/images/2016/05/un2420-300x298.png" width="300"/></a>

I have a HP Compaq Mini 311c-1030SA netbook with ION. I decided to encrypt it the other day just on the off chance it was stolen that way I would be happy that none of my data would be lost.

It had the orignal OS (Windows XP Home) and Kubuntu Linux in a dual boot configuration. Windows encrypted nicely with TrueCrypt and I decided to start fresh with Linux as the version I had installed was fairly old and as far as I am aware there is no way to on the fly encrypt a currently installed distro.

Lets just say that due to a slip of the hand I somewhat destroyed my encrypted Windows partition! (Foolishly, one of the first things I did when i got the netbook a few years ago was remove the recovery partition for more HDD space too)

This isn't really a big problem for me as I hardly ever used the Windows install. Here is the clincher though, the netbook has a Qualcomm UN2400 Mobile Broadband chip which requires the firmware to be uploaded to the chip based off what country/carrier you plan on using. This firmware and some of the ppp configuration scripts are installed onto the Windows partition... which I had just destroyed!

<!--more-->

Getting the firmware was not a problem as I downloaded the driver from the HP website and extracted the .msi file to get what I needed. For convenience the firmware can be obtained [here](/images/2012/03/un2400.tar.gz).

Now that I have the firmware images on my netbook again I can follow the guide written by my good friend, Dataforce. This can be located on his website, [blog.dataforce.org.uk](http://blog.dataforce.org.uk/2010/08/ubuntu-on-hp-compaq-mini-311c-1030sa/)

To save you all some time here is what I did to get mine working (Mostly taken from Dataforce's website):

```console
# Install gobi-loader
 sudo apt-get install gobi-loader

# Create missing directory
 sudo mkdir -p /lib/firmware/gobi

# Use full paths for gobi_loader
 sudo sed -i 's@"gobi_loader@"/lib/udev/gobi_loader@' /lib/udev/rules.d/60-gobi.rules

# Copy firmware to the device
 sudo cp /home/simon/HP/UMTS/amss.mbn /lib/firmware/gobi/
 sudo cp /home/simon/HP/UMTS/apps.mbn /lib/firmware/gobi/
 sudo cp /home/simon/HP/6/uqcn.mbn /lib/firmware/gobi/

# Stop modemmanager corrupting the firmware whilst it is being uploaded by blacklisting the non-modem version of the device
 echo 'ATTRS{idVendor}=="03f0", ATTRS{idProduct}=="241d", ENV{ID_MM_DEVICE_IGNORE}="1"' >> /lib/udev/rules.d/77-mm-usb-device-blacklist-custom.rules
```

As a breif explanation I use the image in the "6" folder as it is listed on [HP's Support Pages](http://h20566.www2.hp.com/hpsc/doc/public/display?lang=en&cc=us&docId=emr_na-c01738839) as "Generic UTMS (Europe)" however I suggest you take a look and choose whats best for you.

Restart your machine and check you have the correct number of ttyUSB devices

```console
$ ls /dev/ttyUSB*
 /dev/ttyUSB0 /dev/ttyUSB1 /dev/ttyUSB2
```

The hard part is done! All that is left is, in my case at least, to use the build in KDE NetworkManager check that the "Mobile Broadband" tab is no longer disabled and follow the wizard for creating a new mobile broadband connection for your contry/carrier.
