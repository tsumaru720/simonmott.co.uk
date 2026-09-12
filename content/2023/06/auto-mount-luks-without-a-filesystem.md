---
title: Auto mount LUKS without a filesystem
date: '2023-06-24T14:52:58+00:00'
slug: auto-mount-luks-without-a-filesystem
categories:
- Debugging
- System Administration
- Tweaking
tags:
- debugging
- disks
- systemd
---

One of my friends recently installed a new storage server in our shared lab environment and graciously gave me some storage space on it via iSCSI. I use Proxmox for my personal lab, and I intended to store some non-critical VM disks on this new storage so I could play around with properly using HA (High Availability) with Proxmox. Additionally, I wanted to gain some experience using iSCSI at the same time. While I trust my friend, the storage itself is outside of my control, so I figured it would be good practice to encrypt my data. The general go-to solution for this would seem to be LUKS.

<!--more-->

Going into detail on how to set up iSCSI and multipath is out of scope here, but the general idea is that you connect to the storage array via iSCSI, and it then gets exposed to your server as if it were a locally attached block device. From here, you can pretty much do whatever you like. In my case, I want to use it with LVM to store VM disks in Proxmox, so the general layout would be something similar to the image below:

<a href="/images/2023/06/LUKS.png"><img alt="" class="img-center" height="300" src="/images/2023/06/LUKS.png" width="257"/></a>

After setting up iSCSI and multipath, my system can see the storage LUN without any problems.

```console
# multipath -ll
san (36589cfc000000c0d01729cc32c52ecc4) dm-9 TrueNAS,iSCSI Disk
size=2.0T features='0' hwhandler='0' wp=rw
`-+- policy='round-robin 0' prio=15 status=active
|- 3:0:0:0 sdb 8:16 active ready running
`- 4:0:0:0 sdc 8:32 active ready running
```

I plan to use LVM on LUKS, which essentially means the LUN in its entirety is encrypted and needs to be correctly decrypted before anything on it can be detected by LVM. I set up `/etc/crypttab` with the appropriate key files and proceeded to test if it opens correctly without any prompting. This seemed to work as expected (san\_luks is just the name I gave it in `/etc/crypttab`):

```console
# systemctl status systemd-cryptsetup@san_luks.service
● systemd-cryptsetup@san_luks.service - Cryptography Setup for san_luks
Loaded: loaded (/etc/crypttab; generated)
Active: active (exited) since Fri 2023-06-23 20:02:33 BST; 18h ago
Docs: man:crypttab(5)
man:systemd-cryptsetup-generator(8)
man:systemd-cryptsetup@.service(8)
Main PID: 1935 (code=exited, status=0/SUCCESS)
Tasks: 0 (limit: 48147)
Memory: 0B
CGroup: /system.slice/system-systemd\x2dcryptsetup.slice/systemd-cryptsetup@san_luks.service

Jun 23 20:02:28 pve1 systemd[1]: Starting Cryptography Setup for san_luks...
Jun 23 20:02:28 pve1 systemd-cryptsetup[1935]: Set cipher aes, mode xts-plain64, key size 512 bits for device /dev/disk/by-uuid/4dfbd655-258b-42f8-b1a7-94155bdf1465.
Jun 23 20:02:33 pve1 systemd[1]: Finished Cryptography Setup for san_luks.
```

I proceeded to reboot, and... it didn't open the volume. I confirmed that iSCSI and multipath were fine, but the volume just didn't open on boot.

I tried enabling the cryptsetup service:

```console
# systemctl enable systemd-cryptsetup@san_luks.service
Failed to enable unit: Unit /run/systemd/generator/systemd-cryptsetup@san_luks.service is transient or generated.
```

I tried all sorts of arguments in `/etc/crypttab`, but nothing seemed to work.

After a fair amount of digging, it became apparent that the typical use-case for this kind of setup is to open an encrypted volume and then mount a filesystem that resides on it. All the articles I could find were geared towards this and hinted that you need to have crypttab set to automatically open the encrypted volume (which I did), but you also need a corresponding entry in `/etc/fstab` that references it. This reference, when systemd tries to mount it, actually triggers cryptsetup, and everything just works nicely.

This is a problem because I am not mounting a filesystem.

**Update: See addendum below**

Ultimately, I settled on a dirty workaround to ensure my encrypted volume was opened correctly on system boot. I had already confirmed that it works without any prompts from me, so I created a new systemd unit file that should run after multipath is started and set a requirement for my unit to trigger `systemd-cryptsetup@san_luks.service`.

This should run after multipath is loaded, so I have access to the block device it creates, and then trigger cryptsetup. The unit file runs once at boot and basically does nothing. I'm sure there's a nicer way to do this, but for me, this worked.

```console
# cat /etc/systemd/system/luks_auto_open.service
[Unit]
Description=LUKS Auto open
After=multipathd.service
Requires=systemd-cryptsetup@san_luks.service

[Service]
Type=oneshot
ExecStart=/usr/bin/echo
User=root

[Install]
WantedBy=multi-user.target
```

I don't like this workaround at all, but it gets the job done and allows me to continue setting up the new storage for use in Proxmox.

I suspect there's a more elegant way to do this that doesn't involve a makeshift unit file, but my Google-fu has failed me.

### Addendum

As it turns out, there is indeed a better way to do this. My friend [Dataforce](https://blog.dataforce.org.uk/) also ran into this problem and refused to accept there wasn't a better way to do this.

*"I'm convinced there must be a better more correct way". 😄*

He was so perturbed at my solution that he actually spent some more time than I did doing research and found the answer:

```bash
systemctl enable remote-cryptsetup.target
```

Initial testing seems to actually do what we want, rather than having to use my artisanal unit file. [Check out his page for more details](https://blog.dataforce.org.uk/2023/06/remote-crypttab-on-boot/)
