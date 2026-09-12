---
title: Office 2010, KMS Activation and Domain Relationships
date: '2012-02-28T21:33:51+00:00'
slug: office-2010-kms-activation-domain-relationships
categories:
- System Administration
tags:
- dns
- kms
- licensing
- microsoft
- office
---

Whilst this seems trivial to some people, not only did this issue affect my office, but one of our branches in India too so I figure its worth noting somewhere!

My current employer has many operating companies (OpCo's) dotted around the world, all under one brand. Because of this structure, our OpCo in the UK has a two way trust relationship between our domain and the parent company's. For arguments sake, lets call them UKNET and CENTRALNET.

At the end of last year we were told to use a Microsoft KMS server hosted on CENTRALNET to install Office 2010 on some of our workstations. Easy.. or so we thought.

<!--more-->

On UKNET we have our own DNS servers and for the SRV type that we need, they were infact misconfigured. This lead to our Office installs refusing to activate!

The easiest way to check it is working correctly is on a PC on UKNET (adapt to meet your own needs of course):

```bash
C:\>nslookup -type=srv _vlmcs._tcp.example.com
 Server: dns.example.com
 Address: 192.168.1.1

Non-authoritative answer:
 _vlmcs._tcp.example.com SRV service location:
 priority = 0
 weight = 0
 port = 1688
 svr hostname = kms.example.com
```

In the above snippet, example.com is the FQDN for your domain. A result like the one above implies that your machine is being told where to go for the KMS activation and as long as you can communicate with kms.example.com, you are good to go! (Cue trusty telnet!!)

If however, you are not getting any results from your DNS server, you can either change your DNS settings to one that does give the correct result or simply tell Office where to go to activate!

For this, I will just be letting Office know where to go. You need to complete your install and then on the target machine run:

```bat
cscript "%ProgramFiles%\Microsoft Office\Office14\ospp.vbs" /sethst:kms.example.com
```

Note that Office14 is version specific and is in fact Office 2010. No doubt this figure will change for newer versions but for now this works.

Once the above command has completed successfully simply launch an application from the suite and check its activation status. If all went well, you should have a nice activated version of office!
