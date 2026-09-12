---
title: Odd behaviour with /etc/mtab being a regular file
date: '2016-07-13T19:53:35+00:00'
slug: odd-behaviour-with-etcmtab-regular-file
categories:
- Debugging
- System Administration
tags:
- binfmt
- centos
- debugging
- hang
- mount
- strace
- systemd
---

One of our customers had recently requested a Bare-Metal Restore (BMR) of one of their servers; which is a pretty routine task for us. However, upon bringing the restored server up I'd noticed some odd behaviour with some of its services, notably snmpd.

Our monitoring successfully polls most metrics that we look for, however fails on getting disk statistics and eventually snmpd just starts timing out. Using `snmpbulkwalk` I could see that I was getting a response right up until midway through the **HOST-RESOURCES MIB**. It did look to be hanging on mount points and once snmpbulkwalk had timed out, I couldn't get a successful response from snmpd again. This was also seemingly affecting MariaDB, preventing it from starting, amongst other things.

<!--more-->

I tried to run `df` to check on disk usage/inodes, but this also hung. From previous experience this usually means one of the mount points is broken so I ran `strace df` which indicated what the problem was:

```console
stat("/proc/sys/fs/binfmt_misc", ^C
Process 2961 detached
```

You can see from the above that the process stalled whilst trying to stat `/proc/sys/fs/binfmt_misc`. After a bit of Googling, a "quick and simple" fix for this was to un-mount and remount it. Note that a `mount -o remount` didn't work and similarly just hung.

I'd found the command to mount this again at <https://www.kernel.org/doc/Documentation/binfmt_misc.txt>

```bash
umount -f -l /proc/sys/fs/binfmt_misc
mount binfmt_misc -t binfmt_misc /proc/sys/fs/binfmt_misc
```

This is all well and good, but I want a more permanent fix. What was causing this to fail consistently whenever the system boots?

I suspect this relates to the `systemd-binfmt` service, so should be handled pretty early in our boot process. Checking `journalctl` to see what's going on with systemd yields the following error which jumped out at me:

```console
Jul 12 08:08:01 myserver1.example.com systemd[1]: /etc/mtab is not a symlink or not pointing to
/proc/self/mounts. This is not supported anymore. Please make sure to replace this file by a
symlink to avoid incorrect or misleading mount(8) output.
```

Interesting...

Taking a look at `/etc/mtab`, this was indeed a regular file instead of a symlink. Being the likely cause for the observed mount issues (due to the system thinking things are mounted when in-fact they are not), this was removed and re-added as the correct symlink.

```bash
[root@myserver1 ~]# ls -al /etc/mtab
lrwxrwxrwx 1 root root 17 Jul 12 08:46 /etc/mtab -> /proc/self/mounts
```

The server was then rebooted and everything seemed to come back up without any issues.

This server was seemingly working fine before the BMR, but had only been up 3 months or so. I've checked other servers deployed at the same time with the same template and they are not affected which rules out our deployment system. I've also tested our BMR process again (Now that /etc/mtab has been fixed) but it comes back correctly, as a symlink.

The backup from which the BMR was originally performed has since unfortunately cycled out of retention so I can't do much more debugging from that; This does mean that at the moment I'm not sure how this change came about for this particular server but I'm glad I've got to the bottom of its strange behaviour.
