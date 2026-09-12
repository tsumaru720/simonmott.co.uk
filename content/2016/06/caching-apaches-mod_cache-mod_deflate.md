---
title: Caching with Apache's mod_cache and mod_deflate
date: '2016-06-06T18:21:49+00:00'
slug: caching-apaches-mod_cache-mod_deflate
categories:
- System Administration
- Tweaking
tags:
- apache
- cache
- mod_cache
- mod_cache_disk
- mod_deflate
---

I currently work in the hosting industry and as part of my job I have to deal with WordPress on a regular basis and as such I've seen how appalling it can be sometimes with regards to page loading times. Given that my content on here doesn't change all too often, it makes sense to spend the time generating the content only once and serving it to meet multiple requests for the same document. In order to do this one would usually employ some form of caching.

WordPress itself does have the option for multiple caching plugins which integrate nicely but in my experience they still have to pass the request off to a PHP handler which means some processing is still needed to accommodate the request (albeit less than a full page load). For the purposes of this article though, I'm going to assume a generic framework as this technique is not specific to WordPress at all.

There're a number of software solutions to sit in front of your web server which act as a cache and some of the more notable ones are [nginx](https://www.nginx.com/) and [varnish](https://varnish-cache.org/) and each have their pros and cons (As far as I know, Varnish can't do native SSL termination yet). For this post though, I'll be making use of some Apache modules to do the same thing. This was mostly an experiment for myself to see what I could do with it - I've found some limitations which as of yet I haven't been able to work around for lack of knowledge on the inner workings of Apache, but for now It does the job.

<!--more-->

I'll probably be doing an article on varnish and/or nginx in the future, but for now lets focus on [mod\_cache](https://httpd.apache.org/docs/current/mod/mod_cache.html) and [mod\_cache\_disk](https://httpd.apache.org/docs/current/mod/mod_cache_disk.html).

Lets start by taking a benchmark of how long the homepage takes to load without cache. The following will hit my homepage 5 times with a 1 second delay between each request

```console
simon@kinmu:~$ i=0; while [ $i -lt 5 ]; do time -p curl "https://www.simonmott.co.uk/" > /dev/null; sleep 1; i=$[$i+1]; done 2>&1 | grep real | awk '{print $2}' | awk '{avg += ($1 - avg) / NR;} END {print "Average: " avg "s";}'
Average: 0.696s
```

This gives us an average of **0.696s** to load the page... This is the time to beat :)

Before we begin - I encourage you to read the Apache documentation for [mod\_cache](https://httpd.apache.org/docs/current/mod/mod_cache.html) and [mod\_cache\_disk](https://httpd.apache.org/docs/current/mod/mod_cache_disk.html) - it will make a lot more sense if you do!

### mod\_cache - The config

I'll start by showing you my current config - I'll then go through each option and comment as to why I made the decision to use that particular setting/option. This snippet of config lives in my **VirtualHost** directive for my website and I suspect a lot of my comments will essentially be copy/pasted from apache.org

```bash
CacheQuickHandler off

CacheRoot /var/cache/apache2/mod_cache_disk/simonmott.co.uk
CacheEnable disk /
CacheDirLevels 2
CacheDirLength 1
CacheMaxFileSize 2000000

CacheIgnoreNoLastMod On
CacheDefaultExpire 7200
CacheIgnoreCacheControl On
CacheLastModifiedFactor 0.5
CacheIgnoreHeaders Set-Cookie Cookie
CacheHeader on

CacheLock on

CacheDisable /wp-admin
CacheDisable /wp-login.php
CacheDisable /wp-cron.php

SetOutputFilter CACHE
AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/rss+xml text/xml image/svg+xml
```

### The config explained

OK, we've got the config, now lets go through it

```apache
CacheQuickHandler off
```

The CacheQuickHandler directive controls the phase in which the cache is handled.

In the default enabled configuration, the cache operates within the quick handler phase. This phase short circuits the majority of server processing, and represents the most performant mode of operation for a typical server. The cache bolts onto the front of the server, and the majority of server processing is avoided.

When disabled, the cache operates as a normal handler, and is subject to the full set of phases when handling a server request. While this mode is slower than the default, it allows the cache to be used in cases where full processing is required, such as when content is subject to authorization

We currently don't want the cache to be processed "quickly" for reasons we'll explain later ;)

```apache
CacheRoot /var/cache/apache2/mod_cache_disk/simonmott.co.uk
```

This option simply defines where on disk the cache will be stored - The default for my installation is **/var/cache/apache2/mod\_cache\_disk** but I opted to split the cache by vhost so that I have slightly finer control (For example, I can completely clear the cache for my website by removing the contents of **/var/cache/apache2/mod\_cache\_disk/simonmott.co.uk** which shouldn't affect the cache for another website)

```apache
CacheEnable disk /
```

This option simply enables the cache for any URL under this domain. If you wanted to only cache for simonmott.co.uk/test then you would use "/test" instead of "/"

```bash
CacheDirLevels 2
CacheDirLength 1
CacheMaxFileSize 2000000 # <-- This is 2MB
```

This set of options controls how many files can be stored on disk and the max-file size that can be committed to cache. **CacheDirLevels** specifies how many levels of subdirectory there should be, and **CacheDirLength** specifies how many characters should be in each directory. With the example settings given above, the hash would be turned into a filename prefix as /var/cache/apache2/mod\_cache\_disk/simonmott.co.uk/x/y/TGxSMO2b68mBCykqkp1w.

The overall aim of this technique is to reduce the number of subdirectories or files that may be in a particular directory, as most file-systems slow down as this number increases. With setting of "1" for **CacheDirLength** there can at most be 64 subdirectories at any particular level. With a setting of 2 there can be 64 \* 64 subdirectories, and so on. Unless you have a good reason not to, using a setting of "1" for **CacheDirLength** is recommended.

Setting **CacheDirLevels** depends on how many files you anticipate to store in the cache. With the setting of "2" used in the above example, a grand total of 4096 subdirectories can ultimately be created. With 1 million files cached, this works out at roughly 245 cached URLs per directory. **CacheMaxFileSize** controls the max size of a file that can be stored (in bytes).

```apache
CacheIgnoreNoLastMod On
CacheDefaultExpire 7200
```

The **CacheIgnoreNoLastMod** directive provides a way to specify that documents without last-modified dates should be considered for caching, even without a last-modified date. If neither a last-modified date nor an expiry date are provided with the document then the value specified by the **CacheDefaultExpire** directive will be used to generate an expiration date.

```apache
CacheIgnoreCacheControl On
```

**CacheIgnoreCacheControl On** tells the server to attempt to serve the resource from the cache even if the request from a client contains no-cache header value

```apache
CacheLastModifiedFactor 0.5
```

In the event that a document does not provide an expiry date but does provide a last-modified date, an expiry date can be calculated based on the time since the document was last modified with the **CacheLastModifiedFactor** directive

```apache
CacheIgnoreHeaders Set-Cookie Cookie
```

**CacheIgnoreHeaders** specifies additional HTTP headers that should not to be stored in the cache. For example, it makes sense in some cases to prevent cookies from being stored in the cache.

```apache
CacheHeader on
```

When the **CacheHeader** directive is switched on, an **X-Cache** header will be added to the response with the cache status of this response.

```apache
CacheLock on
```

The **CacheLock** directive enables the thundering herd lock for the given URL space.

```apache
CacheDisable /wp-admin
CacheDisable /wp-login.php
CacheDisable /wp-cron.php
```

The **CacheDisable** directive instructs mod\_cache to not cache urls at or below url-string. The values I've chosen here ***ARE*** specific to WordPress

The last two lines in my config for **SetOutputFilter** and **AddOutputFilterByType** is where things get interesting and this one requires some more in-depth explanation...

### mod\_deflate and the *Vary* header

Because of where mod\_cache initially sits, if you enable mod\_deflate and your visitor sends appropriate "**Accept-Encoding**" headers then mod\_deflate will dutifully compress the output for you, but this happens before mod\_cache saves it. This isn't a big problem because mod\_deflate adds a "**Vary: accept-encoding**" header to the output, thus mod\_cache will store a separate cached copy of your content for each variation of the "Accept-Encoding" header it encounters. This method does mean that ALL processing is cached - dynamic content generated by PHP is saved, so no need to process the request again and CPU time to compress the output has already been done which to some is ideal and you can stop here without adding the last two lines above.

I however don't like the idea of multiple copies of the same page - If I visit a page on my Desktop using Chrome, I want the same page when I visit on my Phone using Chrome. The problem here is that Chrome for desktop sends `Accept-Encoding: gzip, sdch` whereas Chrome for Android sends `Accept-Encoding: gzip, sdch, br` which is a different variation of the header, thus they get two separate copies processed and cached, despite having an already cached copy that is of suitable encoding. Something to also consider is the vector for a DoS by filling my server with files based on lots of different `Accept-Encoding` headers

Depending on how popular your website is, you could end up with hundreds of copies for a single page cached because of the differing headers and for my site, that just doesn't sit right with me. Documentation [here](https://httpd.apache.org/docs/current/mod/mod_cache.html#finecontrol) suggests you can defer mod\_deflate until after your content has been saved in the cache, however this doesn't seem to work - It spits an error about duplicate "CACHE" filters and just continues as normal, compressing then caching.

```console
[cache:debug] [pid 9497] mod_cache.c(1718): [client 10.0.0.20:40156] AH00777: cache: CACHE filter was added twice, or was added where the cache has been bypassed and will be ignored: /
```

I have a work-around, but it does have a caveat which I'll get to shortly - I have also approached Apache httpd mailing lists, but as of yet I don't have a solid fix for this but for now the workaround is:

```apache
SetOutputFilter CACHE
AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/rss+xml text/xml image/svg+xml
```

To the best of my knowledge (as the docs are a bit sketchy here), **SetOutputFilter** will force all output to be passed through the **CACHE** filter; Doing this here ensures content is saved to our cache first and we then conditionally pass through **DEFLATE** for text-based content (As that generally compresses well). Sounds exactly like what I want, right?

Well... Not quite.

It seems that doing this combination of output filters means that content is actually being saved into our cache before mod\_expires has chance to add correct cache-control headers and specific expires headers. This just means that all content is being cached for the duration of **CacheDefaultExpire**, instead of what I try to set via mod\_expires. The headers do eventually get added though so at least our visitors browsers will cache content correctly :)

For the time being I can live with this behaviour, but as mentioned earlier, I will probably be looking to move my web stack over to nginx so this will suffice until then.

### Conclusion

So, we have caching all set up and working, but is it making a difference? Well - Once a page is requested, but its not cached (a MISS), the request will process as normal and return output to the visitor. Subsequent requests are served from cache so no processing is needed.

Once all this was set up, I visited my website which generated the page and stored it in cache - My average page loading time from earlier was **0.696s**, so lets see what it is now its in cache

```console
simon@kinmu:~$ i=0; while [ $i -lt 5 ]; do time -p curl "https://www.simonmott.co.uk/" > /dev/null; sleep 1; i=$[$i+1]; done 2>&1 | grep real | awk '{print $2}' | awk '{avg += ($1 - avg) / NR;} END {print "Average: " avg "s";}'
Average: 0.036s
```

Thats an impressive **19x** improvement on average page loading time!

I'd say its working nicely ;)
