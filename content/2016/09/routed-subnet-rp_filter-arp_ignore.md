---
title: Routed Subnets, rp_filter and arp_ignore
date: '2016-09-23T20:40:25+00:00'
slug: routed-subnet-rp_filter-arp_ignore
categories:
- Networking
- System Administration
tags:
- arp
- debugging
- ipv4
- linux
- networking
- routing
---

Over the past couple of years, I've been quite accustomed to my ISP providing me with an IP block (typically a /29) instead of just a single static IP, but recently I've switched to [Hyperoptic](https://www.hyperoptic.com/) for their [FTTP](https://en.wikipedia.org/wiki/Fiber_to_the_x#Fiber_to_the_premises) offering (Because, Gigabit!). Unfortunately, they seem to only offer single IPs for residential service and require you to be on their business package which costs £££ if you want more IPs.

To get around this I decided to try to tunnel some IPs home - My setup is rather complex but I'm going to skip over the specifics for most of it and focus on the issue I was facing - lets ignore how the IPs route around the rest of my network and ultimately end up at the router for now and just look at the rather simplified view below.

<!--more-->

### The Problem

<a href="/images/2016/09/rp_filter.png"><img alt="rp_filter" class="img-right" height="419" src="/images/2016/09/rp_filter.png" width="398"/></a>

The image shows that I essentially have a router which has two NICs, one connected to the public internet, and one connected to a switch within my network. The second NIC has two IPs assigned to it as follows:

* **10.0.2.51/24** which is my internal private subnet

* **172.26.0.9/29** which is the subnet I want to tunnel/route to my server (172.x for the sake of this document)

Traffic would come into *Router* from an upstream device with a destination of 172.26.0.13. As the router has a route to a subnet in which that IP resides (by virtue of it having an IP in that subnet), it knows that IP should be reachable directly via our NIC2 interface and so ARPs for 172.26.0.13 out of it. Because both interfaces on *Server* and NIC2 on *Router* all sit in the same broadcast domain, my server happily replies to the ARP request (out of both interfaces - more on this later) so the router now forwards traffic down the wire to my server; Except there's no reply... but only sometimes.

After much head scratching, I noticed that when I do *sometimes* get a correct response from 172.26.0.13, the ARP table for *Router* was showing the MAC address for NIC1 on *Server*. When I don't get a reply (usually after the ARP entry expires) it instead shows the MAC for NIC2 - But having the MAC for NIC2 is what I'd expect, so whats going on?

### The Explanation

After spending a good amount of time throwing arbitrary queries into Google and cussing to myself, I eventually caved and asked my Network Engineer for a flat-mate, [Dataforce](https://blog.dataforce.org.uk/), for a fresh set of eyes.

We both spent a little while talking through the setup and testing various things and after a while took a look at a sysctl setting for `rp_filter` (Reverse Path Filter). Consulting kernel documentation at <https://www.kernel.org/doc/Documentation/networking/ip-sysctl.txt>, it says the following for rp\_filter:

```
rp_filter - INTEGER
	0 - No source validation.
	1 - Strict mode as defined in RFC3704 Strict Reverse Path
	    Each incoming packet is tested against the FIB and if the interface
	    is not the best reverse path the packet check will fail.
	    By default failed packets are discarded.
	2 - Loose mode as defined in RFC3704 Loose Reverse Path
	    Each incoming packet's source address is also tested against the FIB
	    and if the source address is not reachable via any interface
	    the packet check will fail.

	Current recommended practice in RFC3704 is to enable strict mode
	to prevent IP spoofing from DDos attacks. If using asymmetric routing
	or other complicated routing, then loose mode is recommended.
```

If I check the current value for *Server*, it is indeed **STRICT** (1)

```console
root@server:~# cat /proc/sys/net/ipv4/conf/all/rp_filter
1
```

This implies that when a packet is received on an interface, the source IP is checked against the local routing table to see if the route in which the server would normally talk to the source IP, is the same interface at which the packet was received. My server's default route (0.0.0.0) is out via NIC1, so traffic that ultimately comes from the internet via my tunnelled subnet would arrive on NIC2, but rp\_filter would match against NIC1 - thus the check fails and the packet is dropped as invalid.

### The Solution

Based on the documentation above, I either want to set rp\_filter to be either 0 (**NONE**) or 2 (**LOOSE**). This is done via sysctl and the value can be changed whilst live in one of two ways:

```console
root@server:~# sysctl -w net.ipv4.conf.all.rp_filter=2
net.ipv4.conf.all.rp_filter = 2
```

or

```console
root@server:~# echo 2 > /proc/sys/net/ipv4/conf/all/rp_filter
```

Using either of these methods will only change the value until the server is rebooted. The value reverts to whatever is defined in sysctl.conf on boot so to make this change permanent, either edit your config, or add the following line if its not already defined:

```console
root@server:~# echo "net.ipv4.conf.all.rp_filter = 2" >> /etc/sysctl.conf
```

Changing this to **LOOSE** (2) means that when a packet is received on an interface, rp\_filter will check the route table to see if the source IP is reachable via **any** interface and if so, accept it (because it matches against 0.0.0.0). If I were to set this to **NONE** (0), it outright wouldn't do any verification checks so would just work normally regardless - the choice as to which you use is up to you.

### Bonus Issues!

Now, if you recall I mentioned earlier that without this change, it *sometimes* worked and *sometimes* didn't. This is a whole different issue altogether!

When *Router* sends an ARP request, its a broadcast, so *Server* will see it on both NIC1 and NIC2 as they are both within the same broadcast domain. By default *Server* will respond to the ARP request out of both interfaces because it has the requested IP on one of its local interfaces. So, sometimes when *Router* ARPs for 172.26.0.13, the reply that leaves NIC1 on *Server* arrives back at *Router* first, so *Router* sends packets to NIC1.

Using the scenario above with rp\_filter set **STRICT**, packets arrive into NIC1 and the source would be reachable via NIC1 so everything just kinda works. However when ARP replies from NIC2 arrive back at *Router* first, we are back to *Server* dropping packets as invalid because of rp\_filter being **STRICT**.

Now that we understand rp\_filter a bit better and have changed it to **LOOSE**, we should probably make sure that *Server* only responds to ARP on the interface with the IP being requested. Whilst everything seemingly just works without doing this, we should make sure the flow of traffic is predictable and not randomly switching between interfaces based on which ARP reply arrives back first; so lets take a look back at the kernel documentation linked above and focus on `arp_ignore`

```bash
arp_ignore - INTEGER
	Define different modes for sending replies in response to
	received ARP requests that resolve local target IP addresses:
	0 - (default): reply for any local target IP address, configured
	on any interface
	1 - reply only if the target IP address is local address
	configured on the incoming interface
	2 - reply only if the target IP address is local address
	configured on the incoming interface and both with the
	sender's IP address are part from same subnet on this interface
	3 - do not reply for local addresses configured with scope host,
	only resolutions for global and link addresses are replied
	4-7 - reserved
	8 - do not reply for all local addresses

	The max value from conf/{all,interface}/arp_ignore is used
	when ARP request is received on the {interface}
```

So as above, lets set the value that best suits to what we need and make it persistent, in this case I chose 2

```console
root@server:~# echo 2 > /proc/sys/net/ipv4/conf/all/arp_ignore
root@server:~# echo "net.ipv4.conf.all.arp_ignore = 2" >> /etc/sysctl.conf
```

We've now ensured that ARP replies are sent out of only the interface which has the IP being requested. Reverse Path Filter will no longer drop packets based on which interface the source is reachable and I can now talk to my server via my tunnelled IPs and everyone's happy! :)

*\*Icons provided by <https://icons8.com>\**
