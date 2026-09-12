---
title: Dual-stacking Proxmox Web UI (pveproxy)
date: '2018-06-20T20:49:59+00:00'
slug: dual-stacking-proxmox-web-ui-pveproxy
categories:
- Debugging
- System Administration
- Tweaking
tags:
- dual-stack
- ipv6
- proxmox
- pveproxy
images:
- /images/2018/06/Proxmox-logo-stacked.png
---

<a href="/images/2018/06/Proxmox-logo-stacked.png"><img alt="" class="img-right" height="190" src="/images/2018/06/Proxmox-logo-stacked.png" width="200"/></a>

As part of my recent (and ongoing) project to implement native IPv6 on my own infrastructure (except at home... I'm looking at you [Hyperoptic](https://www.hyperoptic.com/)), I decided to try to dual-stack as much as possible so that when I have IPv6 connectivity, services would prefer that over IPv4, without making things unavailable.

As it turns out, Proxmox's Web interface (pveproxy) doesn't listen on the IPv6 address family by default. This stumped me for a little while, but its pretty simple to fix when you know whats going on.

This post is going to spend most of its time explaining why this happens rather than the fix. If you're just here to see how to do it, check below.

<!--more-->

##### Dual-Stacking pveproxy - aka "The Fix"

pveproxy seems to rely on the contents of `/etc/hosts` in order to figure out what address family to use when binding port 8006 (the default GUI port). In order to change this we need to edit our `/etc/hosts` file and change the line which identifies our Proxmox host

We start with (for example)

```
10.0.0.100 pvehost.some.domain pvehost pvelocalhost
```

And we should change it to

```
::ffff:10.0.0.100 pvehost.some.domain pvehost pvelocalhost
```

All we've done here is add `::ffff:` before the IP address of our node. This tells the OS that its an IPv6 address - but its a special [IPv4-mapped-IPv6 address](https://en.wikipedia.org/wiki/IPv6#IPv4-mapped_IPv6_addresses). Restart the `pveproxy` service and you should now see it binds to an IPv6 socket

```console
tcp6       0      0 :::8006                 :::*                    LISTEN      -
```

Viola - The Proxmox Web interface should work on both IPv4 and IPv6.

##### How pveproxy chooses which family to use...

By default, pveproxy decides to bind to an IPv4 family socket. By changing the family to v6, enables it to work for both families, primarily because of how the OS is configured.

Specifically, this depends on the value of `bindv6only` in sysctl. If this is enabled then the socket would **only** work for IPv6 addresses and applications would have to specifically bind to both v4 and v6 address families independently, depending on which they want to support.

Leaving `bindv6only` disabled (default) is my preferred choice here as this would affect more than just Proxmox for me.

In order to figure this one out, I had to dig into the supplied perl modules for Proxmox. At the time of writing, I was using Proxmox 5.2 for my testing. Because I'm looking at the source for the modules, I wont quote line numbers as they will likely change over time. I will however link to the corresponding git commits.

If we start with the module for pveproxy - `/usr/share/perl5/PVE/Service/pveproxy.pm`

(Git: [2d3d4cf7ff410a04c6fe0579f59dde4fec1e56e3](https://git.proxmox.com/?p=pve-manager.git;a=blob;f=PVE/Service/pveproxy.pm;h=2d3d4cf7ff410a04c6fe0579f59dde4fec1e56e3;hb=HEAD#l70))

```perl
    my $family = PVE::Tools::get_host_address_family($self->{nodename});
    my $socket = $self->create_reusable_socket(8006, undef, $family);
```

It's pretty clear here that it gets the address family for *something*, and then creates a socket bound to port 8006 using that family. Tracing back to where `nodename` actually gets set, we end up looking at `/usr/share/perl5/PVE/INotify.pm`

(Git: [0b9ea4adc3e078a47369cd97bc6c271a45f16870)](https://git.proxmox.com/?p=pve-common.git;a=blob;f=src/PVE/INotify.pm;h=0b9ea4adc3e078a47369cd97bc6c271a45f16870;hb=HEAD#l502))

```perl
sub nodename {
    return $cached_nodename if $cached_nodename;
    my ($sysname, $nodename) = POSIX::uname();
    $nodename =~ s/\..*$//; # strip domain part, if any
    die "unable to read node name\n" if !$nodename;
    $cached_nodename = $nodename;
    return $cached_nodename;
}
```

My understanding of what the above snippet does ([POSIX::uname](http://perldoc.perl.org/POSIX.html#uname)) is that it in-fact grabs the same values as would be visible from `uname` on command line. Specifically the "kernel-name" and "nodename" arguments

```console
root@pvehost:~# uname -sn
Linux pvehost

root@pvehost:~# uname --kernel-name --nodename
Linux pvehost
```

From here, a host lookup is performed against the `nodename` value. On a fresh install this is typically an IPv4 address, so pveproxy will only ever bind to the IPv4 address family. The change to the host entry made earlier now technically makes this an IPv6 address, thus the family chosen is IPv6.

Personally, I'd like to have a bit more control over how pveproxy binds in the future.
