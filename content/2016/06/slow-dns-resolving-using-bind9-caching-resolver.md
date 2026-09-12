---
title: Slow DNS resolving using bind9 as caching resolver
date: '2016-06-26T02:30:46+00:00'
slug: slow-dns-resolving-using-bind9-caching-resolver
categories:
- Debugging
- Networking
- System Administration
tags:
- bind
- bind9
- debugging
- dns
- ipv4
- ipv6
- named
---

I currently have 4 DNS servers across my estate and until recently these were all configured to forward all queries to Google DNS (8.8.8.8). I ended up having an issue with Google caching an undesired record value so I opted to change my DNS servers so that they no longer forward queries elsewhere, but instead try to answer it themselves; Doing this gives me slightly more control over my DNS cache.

As I use named (bind9) this was a pretty trivial change - Simply remove the `forwarders { 8.8.8.8; };` clause in my configuration and that should be that.

During my post-change testing though I'd noticed that resolution was taking significantly longer for un-cached queries than I'd expect (microsoft.gointeract.io is only used to illustrate my issue):

<!--more-->

```console
root@ns3:~# rndc flush && dig microsoft.gointeract.io

; <<>> DiG 9.9.5-3ubuntu0.8-Ubuntu <<>> microsoft.gointeract.io
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 40048
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 4, ADDITIONAL: 9

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;microsoft.gointeract.io. IN A

;; ANSWER SECTION:
microsoft.gointeract.io. 300 IN CNAME interact-utm.cloudapp.net.
interact-utm.cloudapp.net. 60 IN A 23.101.130.247

;; AUTHORITY SECTION:
cloudapp.net. 172799 IN NS prd3.azuredns-cloud.net.
cloudapp.net. 172799 IN NS prd1.azuredns-cloud.net.
cloudapp.net. 172799 IN NS prd2.azuredns-cloud.net.
cloudapp.net. 172799 IN NS prd4.azuredns-cloud.net.

;; ADDITIONAL SECTION:
prd1.azuredns-cloud.net. 172799 IN A 204.79.195.43
prd1.azuredns-cloud.net. 172799 IN AAAA 2a01:111:2005:5::5
prd2.azuredns-cloud.net. 172799 IN A 65.55.117.43
prd2.azuredns-cloud.net. 172799 IN AAAA 2a01:111:2006:c::5
prd3.azuredns-cloud.net. 172799 IN A 204.79.195.48
prd3.azuredns-cloud.net. 172799 IN AAAA 2a01:111:2020:3::5
prd4.azuredns-cloud.net. 172799 IN A 65.55.117.48
prd4.azuredns-cloud.net. 172799 IN AAAA 2a01:111:2032:1::5

;; Query time: 4502 msec
;; SERVER: 10.0.2.13#53(10.0.2.13)
;; WHEN: Sat Jun 25 17:08:38 BST 2016
;; MSG SIZE rcvd: 374
```

The entire query took 4.5 seconds which seems unusually long. I was seeing similar Query times for my other DNS servers too and they're located in other facilities dotted around the country so I set about trying to find out why.

Using `tcpdump` I could quickly see a potential cause for the delay...

```console
17:08:35.729948 IP6 fe80::6432:36ff:fe38:3536.20251 > 2a01:111:2005:5::5.53: 1759% [1au] A? interact-utm.cloudapp.net. (54)
17:08:36.530082 IP6 fe80::6432:36ff:fe38:3536.21384 > 2a01:111:2020:3::5.53: 33150% [1au] A? interact-utm.cloudapp.net. (54)
17:08:37.330127 IP6 fe80::6432:36ff:fe38:3536.22815 > 2a01:111:2006:c::5.53: 49009% [1au] A? interact-utm.cloudapp.net. (54)
17:08:38.130220 IP6 fe80::6432:36ff:fe38:3536.4519 > 2a01:111:2032:1::5.53: 3339% [1au] A? interact-utm.cloudapp.net. (54)
17:08:38.930305 IP 46.xx.xx.xx.1965 > 204.79.195.43.53: 13538% [1au] A? interact-utm.cloudapp.net. (54)
17:08:38.937824 IP 204.79.195.43.53 > 46.xx.xx.xx.1965: 13538*- 1/0/1 A 23.101.130.247 (70)
```

This shows my server sending queries to an IPv6 address using its link-local address (*IPv4 obfuscated*).

1. I do not have IPv6 configured for anything yet

2. The link-local address isn't public routable

Here we can see named is waiting for a short timeout period before moving onto the next address to query - It eventually gets a response on its IPv4 address. Each IPv6 address in the recursion chain will add more delay.

By default named works with both IPv4 and IPv6, but it seems that becuase my system **\*seems\*** IPv6 capable, it tries to use it regardless which causes a delay in resolution. As I don't yet have working IPv6 connectivity everywhere, I opted to disable IPv6 in named itself for the time being.

Looking at named manual, simply invoking the daemon with ***-4*** should do the trick. As I am running Ubuntu, I added it to named's defaults:

```console
root@ns3:~# cat /etc/default/bind9 
# run resolvconf?
RESOLVCONF=no

# startup options for the server
OPTIONS="-u bind -4"
```

Once added, restart named and you should see much improved resolving times:

```console
root@ns3:~# rndc flush && dig microsoft.gointeract.io

; <<>> DiG 9.9.5-3ubuntu0.8-Ubuntu <<>> microsoft.gointeract.io
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 42883
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 4, ADDITIONAL: 9

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;microsoft.gointeract.io. IN A

;; ANSWER SECTION:
microsoft.gointeract.io. 300 IN CNAME interact-utm.cloudapp.net.
interact-utm.cloudapp.net. 60 IN A 23.101.130.247

;; AUTHORITY SECTION:
cloudapp.net. 172800 IN NS prd4.azuredns-cloud.net.
cloudapp.net. 172800 IN NS prd1.azuredns-cloud.net.
cloudapp.net. 172800 IN NS prd2.azuredns-cloud.net.
cloudapp.net. 172800 IN NS prd3.azuredns-cloud.net.

;; ADDITIONAL SECTION:
prd1.azuredns-cloud.net. 172800 IN A 204.79.195.43
prd1.azuredns-cloud.net. 172800 IN AAAA 2a01:111:2005:5::5
prd2.azuredns-cloud.net. 172800 IN A 65.55.117.43
prd2.azuredns-cloud.net. 172800 IN AAAA 2a01:111:2006:c::5
prd3.azuredns-cloud.net. 172800 IN A 204.79.195.48
prd3.azuredns-cloud.net. 172800 IN AAAA 2a01:111:2020:3::5
prd4.azuredns-cloud.net. 172800 IN A 65.55.117.48
prd4.azuredns-cloud.net. 172800 IN AAAA 2a01:111:2032:1::5

;; Query time: 231 msec
;; SERVER: 10.0.2.13#53(10.0.2.13)
;; WHEN: Sat Jun 25 17:10:29 BST 2016
;; MSG SIZE rcvd: 374
```

Much better :)
