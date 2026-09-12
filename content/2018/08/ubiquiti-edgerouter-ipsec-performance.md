---
title: Ubiquiti EdgeRouter IPsec performance
date: '2018-08-29T17:11:16+00:00'
slug: ubiquiti-edgerouter-ipsec-performance
categories:
- Benchmarks
- Networking
tags:
- edgerouter 4
- edgerouter lite
- edgerouter x
- er4
- erl
- erx
- gre
- ipsec
- throughput
- ubiquiti
- ubnt
images:
- /images/2018/08/UBNT_Primary_Logo_RGB.png
---

<img alt="ubiquiti-logo" class="img-right" height="151" src="/images/2018/08/UBNT_Primary_Logo_RGB.png" width="200"/>

I've been working on setting up a lab environment for myself and decided to pick up a couple of Ubiquiti's [EdgeRouter 4](https://www.ubnt.com/edgemax/edgerouter-4/) routers to act as my core routing devices, along with an [EdgeRouter X](https://www.ubnt.com/edgemax/edgerouter-x/) to act as my out-of-band router. These new devices, along with an [EdgeRouter Lite](https://www.ubnt.com/edgemax/edgerouter-lite/) loaned to me for this article by Dom at [LoveServers](https://loveservers.com/), puts me in a reasonably good position to do some performance testing between these different models of EdgeMAX routers. I thought a good place to start would be to compare how well these different models perform in terms of IPsec throughput and overall CPU usage at the same time.

Part of my lab setup will involve provisioning a couple of IPsec tunnels between the lab and my home network. So whilst this article will mainly focus on IPsec, I will be including some general observations/comparisons between the devices too which may be informative to some people.

<!--more-->

##### Methodology

According to Ubiquiti's data sheets, the EdgeRouter 4 should be the beefier device, so it seemed logical to use the pair I have to establish a base number which I can compare the other two models against. The physical layout I've used for the testing is pretty straightforward in that it's two Dell R210ii servers directly attached to a router each, with another link between the two routers, as illustrated below.

<img alt="physical-layout" class="img-center" height="293" src="/images/2018/08/er4-er4.png" width="560"/>

The routers themselves are initially at the factory default settings other than rudimentary interface configs, some static routes, hardware offloading (more on that later) and the configuration components needed to establish an encrypted GRE tunnel using IPsec. Unfortunately, as I am limited by the overall performance for just one of the EdgeRouter 4's, I wont really know if the throughput is capped by encryption or decryption performance; So for the purposes of this test, I will assume the value I establish will be the same each way for the EdgeRouter 4. I may explore this in the future once I have something that can push more data than these devices are capable of, which should allow me to measure them independently.

However, as these devices should, in theory, out-perform the other models, I should be able to discern encryption and decryption throughput separately for the EdgeRouter Lite and EdgeRouter X

I referenced [this article](https://help.ubnt.com/hc/en-us/articles/115006567467-EdgeRouter-Hardware-Offloading) from Ubiquiti's support center which, at the time of writing, details both the encryption and hashing algorithms that are supported by the different offload engines contained within my test devices - specifically for firmware v1.10.5.

I thus settled on these settings for the bulk of my testing which are supported by both the Cavium (ER4 and ERL) and MediaTek (ERX) offload engines. Each device was rebooted when any change to its hardware offload settings were made, just to ensure it loaded correctly.

|  |  |
| --- | --- |
| Phase 1 - Internet Key Exchange | Phase 2 - Encapsulating Security Payload |
| Key Exchange: IKEv2 Encryption Algo: AES256 Hash Algo: SHA1 Diffie-Hellman Group: 14 (2048 bit) Lifetime: 86400 | Mode: Tunnel Encryption Algo: AES128 Hash Algo: SHA1 Perfect Forward Secrecy: Enabled Lifetime: 3600 |

##### Establishing a Baseline

For each of the tests, regardless of router configuration, I will be useing iperf to measure throughput between servers and will keep the settings at basically default - run via TCP, for 30s and display output every 1s (In CSV format so I can compile the results).

```console
Server2# iperf -s
Server1# iperf -c 172.26.2.2 -x CSV -y c -t 30 -i 1
```

<img alt="edgerouter-raw-throughput-graph" class="img-left" height="428" src="/images/2018/08/Throughput-on-GigE-All-Offloading-Enabled.png" width="372"/>

As for measuring CPU usage, I popped a script in /tmp on both routers being tested that would calculate CPU usage based on `/proc/stat` and output to console with a timestamp so I could correlate between tests.

Once I had the initial test plan sorted out, I made sure that all relevant hardware offloading was enabled and started by measuring if the devices can actually forward traffic at 1 Gbps. This was a simple test using iperf from **Server 1** over to **Server 2** via the routers, without any IPsec or GRE configuration in place. Just pure packet forwarding via static routes.

The routers are ordered from left to right; Most expensive to least expensive. EdgeRouter 4, EdgeRouter Lite and EdgRouter X respectively and thankfully, it seems that all routers are more than capable of forwarding packets at basically line rate **(See image to the left)**.
 

<img alt="edgerouter-raw-throughput-cpu-graph" class="img-right" height="428" src="/images/2018/08/CPU-Usage-on-GigE-All-Offloading-Enabled.png" width="372"/>

Whilst I expected nothing less, I wanted to make sure that they were capable of actually forwarding packets at gigabit speeds - I've seen some routers that do a lot worse! What is more interesting about this first test seems to lie with the CPU usage of the devices whilst pushing packets.

Both the EdgeRouter 4 and EdgeRouter Lite use SoC's from Cavium and use a "not insignificant" amount of CPU when just routing, whereas the EdgeRouter X uses a MediaTek based SoC which hardly makes a dent.

From observing what's going on from the PoV of the device, most of the usage on the Cavium based devices appears to comes from soft interrupts so, I'd expect this is simply down to the different manufacturers hardware offloading methods which probably explains the surprisingly low CPU usage for the EdgeRouter X.

Whilst this is certainly an interesting point to see this early on, I would be curious as to how the CPU in the X performs with other tasks that cant really be offloaded as easily. I may test this in more detail based on a more traditional home/office type test with QoS and ACLs etc or even some dynamic routing enabled to try to tax the CPU a bit more.

For now however, that's out of scope of this article.

##### Initial Testing

At the time of writing this, there wasn't really much in the way of documented figures for IPsec performance on the EdgeRouter 4 that I could find, so I figured - I have the kit, lets test it!

<img alt="edgerouter4-phase2-aes-performance" class="img-right" height="428" src="/images/2018/08/ER4-Phase-2-AES.png" width="372"/>

The initial test was to measure throughput between two EdgeRouter 4s, and use that as a base to compare with the older models as they're also quite popular. As mentioned previously; I am testing between just these two devices and I cant tell if the performance I see in my results is due to hitting a ceiling on encryption or decryption, so for the remainder of this article I will assume both figures are the same for the ER4.

Whilst the testing was done using the IPsec configuration outlined earlier, I did also test using AES256 for both Phase 1 and 2. As you might expect, throughput was a little less when using AES256 due to the increase in computation required. I decided to stick with AES128 as the primary choice for the remainder of the tests.

AES256 **is** a better choice, generally speaking for encryption, however the added compute required didn't seem worth it to me in conjunction with the relatively short key lifetime's, AES128 should be secure enough for my purposes.

I did also dabble with MD5 as the hashing algorithm, but in all of my tests it performed worse than SHA1 - I simply chalk this up to the offload engine being optimised for SHA1 vs MD5.

If you're looking for guidance on what configuration to use for IPsec, a good read is the [NCSC guidelines](https://www.ncsc.gov.uk/guidance/using-ipsec-protect-data) for IPsec along with [this page](https://www.servercentral.com/ipsec-parameter-choice-rationales/) which explains why you might choose one type over the other.

As you can see, the EdgeRouter 4 performs pretty well in this test. CPU usage for both tests were around the 50% mark.

##### Initial Observations

Something I did note during my tests but couldn't quite explain is that *sometimes*, throughput between the EdgeRouter 4s would drop by about 100 Mbps along with a CPU usage drop from 50% utilization, down to 35-40%. I haven't been able to figure this one out definitively however I am guessing its a side-effect of the interaction between the CPU and its co-processor for offloading - possibly something to do with power states. It would only manifest every 1 in 10 tests or so and apply consistently for that flow.

Because I was consistently getting around 440-450 Mbps however, I went with an average of those results as the value for the ER4.

<img alt="edgerouter4-different-offload-settings" class="img-left" height="428" src="/images/2018/08/ER4-Offload-Modules.png" width="372"/>

Another curious observation came about when playing around with the different hardware offload modes. For all of the tests I compiled results with all hardware offloading enabled - but out of interest, I decided to disable **ALL** hardware offloading **EXCEPT** for the IPsec module and in all cases I got better throughput (about 5% more) out of the EdgeRouter 4 with a consistent 50% CPU usage, like before.

To me, this result is somewhat unexpected. I would have thought that offloading as much as possible to the offload engine would give better results but that does not appear to be the case.

I am only speculating but I think this may be to do with packets going back and forth from the co-processor unit in the Cavium chip. For example, A packet may come into the device for forwarding - get offloaded and then need to come back out of the offload engine to be processed further before being GRE encapsulated (and offloaded) and then ultimately encrypted (again, IPsec offloaded)?
 
I am curious to see how this behaviour would affect overall performance of the device when its doing other CPU related tasks and not just IPsec encryption. However that's out of scope for this article.

##### Testing the EdgeRouter Lite

Now that we have some figures for the EdgeRouter 4, I can move on to testing one of the other models. The logic here is that the EdgeRouter 4 is the more capable device by far, so by putting one of the (in theory) less powerful devices in place of one of the EdgeRouter 4s, the result I get would be capped by the performance of that device, and thus we measure its performance.

Using this logic, I can push traffic through the EdgeRouter Lite as the first hop, thus testing its encryption performance, and vice versa, having the EdgeRouter Lite as the last hop, testing its decryption performance.

<img alt="edgerouter-lite-ipsec-performance" class="img-center" height="428" src="/images/2018/08/ERL-Combined.png" width="744"/>

The EdgeRouter Lite clearly suffers with its weaker CPU here - It was pretty much maxed out through the testing. This would probably perform OK if you don't have a lot of bandwidth to play with, but doesn't seem to do well much past 100 Mbit.

As observed with the ER4, curiously I see higher throughput through the EdgeRouter Lite with all but IPsec offloading disabled (about 10-12% improvement) whilst CPU usage is about the same.

##### Testing the EdgeRouter X

Given the result observed earlier for the raw throughput test of the EdgeRouter X, I was very interested to see how this one would turn out. This particular model of EdgeRouter is based on a different SoC manufacturer than the other two devices (MediaTek, vs Cavium respectively) so has a different hardware offload engine. This even more apparent in the configuration of the router and how you enable hardware offloading.

For the Cavium devices, we have a choice to enable specific features as/where needed (Forwarding has to be offloaded for any of the others to work, except for IPsec)

```bash
set system offload ipv4 forwarding enable
set system offload ipv4 gre enable
set system offload ipv4 pppoe enable
set system offload ipv4 vlan enable

set system offload ipv6 forwarding enable
set system offload ipv6 pppoe enable
set system offload ipv6 vlan enable

set system offload ipsec enable
```

Whereas for the EdgeRouter X's MediaTek system, we simply have the choice of

```bash
set system offload hwnat enable
set system offload ipsec enable
```

So, using the same IPsec configuration settings for the EdgeRouter 4 and EdgeRouter Lite tests (detailed above), this router performed surprisingly well - Better than I had initially expected.

<img alt="edgerouter-x-ipsec-performance" class="img-center" height="428" src="/images/2018/08/ERX-Combined.png" width="744"/>

There's a noticeable improvement in throughput and CPU usage on the ERX over the ERL which is quite surprising given the price point of the two models.

Interestingly however, unlike the two Cavium devices, the EdgeRouter X loses encryption performance with all other offloading disabled but gains some on decryption. Whilst the other two devices CPU usage remained pretty consistent, there is a noticeable change on the ERX for all offload vs IPsec only offloading. 

<img alt="edgerouter-x-different-offload-performance" class="img-center" height="428" src="/images/2018/08/ERX-IPsec-Offload-Combined.png" width="744"/>

This just reinforces the fact that not all offload engines are equal - even within devices under the same brand. That being said however the EdgeRouter X seems to be a very capable device and I do look forward to a time when I can compare it to the EdgeRouter Lite in a more "real-world" scenario.

##### Bandwidth-capped Test

The above tests do well to illustrate how well each model of router perform when unrestricted and allowed to try to push as much as they possibly can. I opted to do one final test and limit bandwidth to 100Mbit. I decided to do this on each server by forcing their NICs to 100M FDX. The aim of this test is to illustrate how each routers compare to each other when given the same workload.

<img alt="edgerouter-100mbit-capped-performance" class="img-center" height="389" src="/images/2018/08/Router-CPU-Usage-Throughput-capped-at-100-Mbit.png" width="746"/>

All of the routers managed line rate (100M) and as the above shows, really reinforces how much better the EdgeRouter X is at handling IPsec over the EdgeRouter Lite. Interestingly in the capped test, the ERL used more CPU on decryption which is the opposite to earlier when it was pushing as much as it possibly can.

**Conclusion**

I originally set out to determine what throughput I could expect from these various devices at each end of an IPsec tunnel to allow for a more informed decision as to how to structure my network. The EdgeRouter 4 is pretty much what I expected it to be - in that it's a very capable device and looks like it will be more then capable as a core router for my use case.

Despite the image this article paints for the EdgeRouter Lite, it is still a very capable device. It's a router that's aimed at home or small office users and the likelihood they have an internet connection that requires higher IPsec throughput is pretty low. Whilst the device itself isnt the cheapest around, the features it comes with certainly make it an attractive prospect for more advanced users who want to get more out of their Router than something like a BT Home Hub.

The EdgeRouter X on the other hand is a truly intriguing device! On the face of things it looks like it should perform better than the Lite at most things - however I will likely be comparing these in a more direct fashion in the future. Whilst the EdgeRouter X does indeed perform well, It will not be suitable as a drop-in replacement for the Lite for all situations - namely where dealing with high packet counts are required. The EdgeRouter Lite is rated at 1 million Packets-Per-Second (PPS) at 64 bytes in size whereas the EdgeRouter X is only rated for 260,000.

With that being said though, the EdgeRouter X is still a very good candidate for enthusiast users or light deployments - especially given its PoE passthrough feature.

I will leave you with a final graph that shows each router's IPsec throughput side-by-side to highlight the differences between them.

<img alt="" class="img-center" height="389" src="/images/2018/08/IPsec-Throughput.png" width="746"/>

It'll be interesting to see if Ubiquiti can improve on these numbers in the future through software updates, or if the limitations are purely with the offloading hardware.
