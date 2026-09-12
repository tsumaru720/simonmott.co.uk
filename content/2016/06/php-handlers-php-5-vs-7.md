---
title: PHP Handlers and PHP 5 vs 7
date: '2016-06-11T22:39:47+00:00'
slug: php-handlers-php-5-vs-7
categories:
- Benchmarks
- Tweaking
tags:
- apache
- benchmark
- php
- php5
- php7
images:
- /images/2016/06/php_logo.png
---

<a href="/images/2016/06/php_logo.png"><img alt="php_logo" class="img-right" height="130" src="/images/2016/06/php_logo.png" width="248"/></a>

The idea for this post actually came from observing performance after moving this site over to WordPress (and to a lesser extent, my other website, [General Photography](http://www.gentog.co.uk/)). I use [Puppet](https://puppet.com/) orchestration for my servers and I made the mistake of trying to convert everything to puppet manifests and also get things working how I wanted without fully understanding how puppet works at the same time; That however is another story. This does means that my puppet manifests are not very flexible currently and I use suphp as my main PHP handler just because for me, at the time, it was easier.

That being said - I'm fully aware of the performance issues suphp exhibits because my [Observium](http://www.observium.org/) install used it at first - it now uses mod\_php because loading all the graphs was noticably slow. I thought I'd try to quantify the performance differences between suphp and mod\_php and decided I should do all 3 common PHP handlers. Whilst I was gathering metrics for this I decided It'd be useful to include PHP7 results too.

<!--more-->

### The Environment

I tried to ensure my testing was fair so I'll detail my setup. Firstly I cloned the container my website runs on 3 times. One so I can test suphp, one for mod\_php and one for php-fpm.

I will be performing these tests against different instances of my website which is based on WordPress 4.5.2

The first container was already set to go as I use suphp already - it was an exact clone of my website container. The second container I'd removed suphp and installed mod\_php and for the final container, I'd removed suphp and installed mod\_fastcgi and also set up php-fpm. The intial round of testing was done on these 3 containers which were then upgraded to PHP7 and the same round of testing done again.

I made sure the containers were running on the same host as my main website container to ensure similar performance as my live site and for results to be comparable to each other. They all use the same database container too so thats one less thing to worry about.

**Host Server Spec**

CPU: [Intel(R) Xeon(R) CPU L3360 @ 2.83GHz 4C/4T](http://ark.intel.com/products/40481/Intel-Xeon-Processor-L3360-12M-Cache-2_83-GHz-1333-MHz-FSB?q=l3360)

RAM: 8GB DDR2 PC2-6400 (800 MHz)

HDD: 2x 1TB WD-Black (WD1002FAEX) in RAID1

OS: Proxmox 4.2-5/7cf09667

Kernel: 4.4.6-1-pve

**Container Spec**

Contianer Type: LXC

OS: Ubuntu 14.04.1 *(Yes, I know it needs updating!)*

RAM: 1GB

CPU Limit: 2

CPU Units: 1024

**Software Versions**

Apache Version: 2.4.7

PHP 5.5.9-1ubuntu4.17

PHP 7.0.7-4+deb.sury.org~trusty+1

WordPress 4.5.2

MySQL: 5.5.41-0ubuntu0.14.04.1 (Although this is hosted in its own container which remains the same through the testing)

**Configuration**

Apache Mode: mpm\_prefork

Apache MaxClients: 20

Apache ServerLimit: 20

Apache MaxRequestsPerChild: 4000

php-fpm Process Manager: dynamic

php-fpm max\_children: 20

### The Testing

I first started by using curl to send 20 sequential GET requests to index.php via Apache and timing how long it takes to send me the generated contents of the page and then averaged it. For comparison purposes I also recorded the length of time PHP took to generate the page by invoking it on command line via `php-cgi -f index.php`, again taking an average.

<a href="/images/2016/06/php_time.png"><img alt="Avg load time for 20 sequential requests" class="img-center" height="511" src="/images/2016/06/php_time.png" width="929"/></a>

You can see from the chart above that suphp takes longer to return results than just invoking on the command line but this makes sense because Apache has to process the request and spawn a PHP process to fully deal with it along with network overheads between my test client and test server. PHP7's performance enhancements are visible here too with all handlers using PHP7 resulting in faster loading times. For both PHP5.5 and PHP7, mod\_php and php-fpm seem to share similar performance.

The **configuration** section above is important for our next test. I limited the number of processes that could spawn so as to not take out my container by putting it under too high load specifically for mod\_php - Whilst you can tweak those options to suit your liking/environment, each handler have different things to consider - primarily how much RAM they consume.

For both suphp and php-fpm handlers, they offload PHP to another process. For the particular modules I had configured in Apache, on average each process for both suphp and php-fpm tests seemed to hover around 7.5MB - for mod\_php however things are a bit different. mod\_php is a module that's loaded by Apache which allows it to interpret PHP itself without having to pass it off to another process, which is by far one of the reasons mod\_php performs so well however this does mean that for each Apache process created, it has to load this module every time which makes this a rather RAM heavy approach - During testing of mod\_php I'd clocked average Apache RAM usage at around 54MB per process so for all 20 processes running, that'd all but saturate RAM on my container.

php-fpm is definately the way to go if RAM is your concern. Whilst it does maintain a separate pool of processes ready to process PHP, its not constantly spawning/killing processes like suphp does and doesnt have to contend with other items in RAM like Apache does making it leaner.

We've seen above how each handler performs just by processing a simple request, lets take a look what they look like under a bit of load...

<a href="/images/2016/06/php_hits.png"><img alt="150 concurrent over 1 minute" class="img-center" height="508" src="/images/2016/06/php_hits.png" width="930"/></a>

In order to generate some load, I'd used a tool called siege in benchmark mode. Simply put, you point it at a URL (or a list of URLs), tell it how many concurrent "users" you want and give it some criteria for how long to run. In my case I used

```bash
siege -t1m -b -c150 https://www.simonmott.co.uk/
```

which would simulate 150 concurrent users hitting my website for 1 minute. Once a "user" has sent and received a successful (or failed) request, it immediately sends a new one. Testing in this method illustrates how quickly each handler can actually deal with requests (and shows off the performance improvements for PHP7 quite nicely).

To illustrate how each handler manages to cope with requests I plotted average, longest and shortest response times which shows especially how suphp, along with the low hit-rate, just struggles to keep up because of having to constantly spawn new processes, on top of that, because the processes are short lived (for the duration of the request), they do not benefit from any kind of opcode caching as mod\_php and php-fpm do.

### Conclusion

Another major pitfall of mod\_php aside from its RAM consumption is that all PHP it processes is done so as the user Apache runs as which isn't ideal for a multi-site environment because all sites need to be accessed (and modified, depending on your application) by your Apache user. This simply means in a multi-site environment that if someone compromises one of your websites, they can potentially glean database username/passwords for other sites accessible by this user and/or other sensitive information depending on your setup.

suphp is probably one of the easiest ways to afford more security over your websites because each process it spawns to deal with php, is done so as the user that owns the php file its trying to execute. This means that as long as your file permissions are sane, you shouldn't be able to read file contents of other users but you just take a major performance hit because of the way it works.

This leaves php-fpm. This by far is the best way to go if you put the time into configuring it. This handler allows pools of processes to run as specific users so grants you the same level of security as suphp, but it does so by keeping processes around much longer than suphp which means it benefits from not having the overheads of spawning new processes for each request, and can make use of opcode caching to further enhance performance along with better resource management in general.

The performance improvements for PHP7 are not something to ignore either - In the case of this WordPress blog, simple page loading time was **2x** faster via both mod\_php and php-fpm using the same settings. Furthermore as shown above, PHP7 was able to handle **3x** more requests in 1 minute with better average loading times than the same settings using PHP5.5.

For me, the clear winner here is php-fpm, no matter which version of PHP you decide to roll
